// Solves the plan MILP with HiGHS. Used by the Web Worker in the app and directly in unit tests.
//
// HiGHS alone finds poor plans for the line-clear binaries within seconds (its relaxation is weak),
// so the MIP gets a warm start (ADR 0007):
//   1. solve the LP relaxation (runs continuous);
//   2. fix each run to 1 where the relaxation produced, 0 elsewhere, and solve that LP: a full plan
//      with every line clear paid for;
//   3. solve the MIP from that plan, stopping within MIP_REL_GAP or at the time limit.
import type { Highs } from 'highs';
import { checkCapacity } from '../model/demand';
import type { Dataset } from '../model/types';
import { buildPlanLp, MIP_REL_GAP, readPlan, TIME_LIMIT_S, type PlanResult } from './lp';

/** Longest campaign cycle in weeks. */
const MAX_CYCLE = 8;

/**
 * Which runs a campaign cycle allows (1) or forbids (0). Runs are named `r_<product>_<machine>_<week>`.
 * A pair producing `avg` hours a week, below its campaign length, runs every k = ⌈campaign ÷ avg⌉ weeks;
 * the cycled pairs on a machine get offsets 0, 1, 2, … so they don't all run in the same week.
 */
export function campaignCycles(runNames: string[], relaxedHours: (k: number) => number, campaignHours: (k: number) => number): number[] {
  const pairs = new Map<string, { machine: string; ks: number[] }>();
  runNames.forEach((n, k) => {
    const [, p, m] = n.split('_');
    const key = `${p}_${m}`;
    if (!pairs.has(key)) pairs.set(key, { machine: m, ks: [] });
    pairs.get(key)!.ks.push(k);
  });
  const allowed = new Array<number>(runNames.length).fill(1);
  const nextOffset = new Map<string, number>();
  for (const { machine, ks } of pairs.values()) {
    const total = ks.reduce((a, k) => a + relaxedHours(k), 0);
    const avg = total / ks.length;
    const campaign = campaignHours(ks[0]);
    if (total < 1e-6 || campaign <= avg) continue;
    const cycle = Math.min(MAX_CYCLE, Math.ceil(campaign / avg));
    if (cycle < 2) continue;
    const offset = nextOffset.get(machine) ?? 0;
    nextOffset.set(machine, offset + 1);
    ks.forEach((k, idx) => (allowed[k] = (idx + offset) % cycle === 0 ? 1 : 0));
  }
  return allowed;
}

export function solvePlan(highs: Highs, ds: Dataset, timeLimitS = TIME_LIMIT_S): PlanResult {
  const check = checkCapacity(ds);
  const model = buildPlanLp(ds, check);
  const t0 = performance.now();
  const S = highs.constants.modelStatus;

  const { status, columns, gap, stages } = highs.withModel({ format: 'lp', data: model.lp }, (mdl) => {
    mdl.options.set({ output_flag: false });
    const names = Array.from({ length: mdl.getDimensions().numCols }, (_, i) => mdl.getColName(i));
    const values = (colValue: ArrayLike<number>) => Object.fromEntries(names.map((n, i) => [n, colValue[i]]));
    const runs = names.flatMap((n, i) => (n.startsWith('r_') ? [i] : []));
    // alone[m,w] may be 1 only if at most one run is fixed on m in week w (lp.ts); binary in the MIP.
    const alone = names.flatMap((n, i) => (n.startsWith('a_') ? [i] : []));
    const aloneSel = { kind: 'set' as const, indices: Int32Array.from(alone) };
    const setAlone = (fixedRuns: ArrayLike<number>, exact: boolean) => {
      const count = new Map<string, number>();
      runs.forEach((i, k) => fixedRuns[k] === 1 && count.set(names[i].slice(names[i].indexOf('_', 2) + 1), (count.get(names[i].slice(names[i].indexOf('_', 2) + 1)) ?? 0) + 1));
      const up = Float64Array.from(alone, (i) => ((count.get(names[i].slice(2)) ?? 0) <= 1 ? 1 : 0));
      mdl.changeColsBounds(aloneSel, exact ? up : new Float64Array(alone.length), up);
    };
    if (runs.length === 0) {
      const res = mdl.run();
      const ok = res.modelStatus === S.optimal;
      return { status: ok ? 'Optimal' : `HiGHS status ${res.modelStatus}`, columns: ok ? values(Float64Array.from(mdl.getSolution().colValue)) : {}, gap: 0, stages: {} };
    }
    const sel = { kind: 'set' as const, indices: Int32Array.from(runs) };
    const hoursOf = runs.map((i) => mdl.getColByName(`h_${names[i].slice(2)}`));
    const stages: Record<string, number> = {};
    const lap = (stage: string) => (stages[stage] = Math.round(performance.now() - t0) / 1000 - Object.values(stages).reduce((a, b) => a + b, 0));

    // 1. Relaxation (runs continuous), then campaigns: a product–machine pair whose average weekly
    //    production is shorter than a campaign worth its line clear may only run every k-th week,
    //    k = campaign ÷ weekly average (at most MAX_CYCLE). The pairs on a machine are staggered.
    //    If that leaves more than 0.1 % of demand unmet, the campaigns are halved (twice at most,
    //    then dropped); a little is fine, as step 2 may open other runs.
    mdl.changeColsIntegrality(sel, new Int32Array(runs.length)); // 0 = continuous
    if (alone.length) mdl.changeColsIntegrality(aloneSel, new Int32Array(alone.length));
    const upper = new Float64Array(runs.length).fill(1);
    const shortCols = names.flatMap((n, i) => (n.startsWith('u_') ? [i] : []));
    const unmet = (v: ArrayLike<number>) => shortCols.reduce((a, i) => a + v[i], 0);
    const relax = () => {
      mdl.changeColsBounds(sel, new Float64Array(runs.length), upper);
      mdl.clearSolver(); // a warm start from the last basis can take minutes; a fresh solve takes ~1 s
      mdl.run();
      return Float64Array.from(mdl.getSolution().colValue);
    };
    // Campaigns across weeks (cont) are left out of the relaxation: they make the LP several times
    // slower, and step 2 adds them back.
    const conts = names.flatMap((n, i) => (n.startsWith('c_') ? [i] : []));
    const setCont = (ub: number) => conts.length && mdl.changeColsBounds({ kind: 'set', indices: Int32Array.from(conts) }, new Float64Array(conts.length), new Float64Array(conts.length).fill(ub));
    setCont(0);
    let relaxed: ArrayLike<number> = relax();
    const tolerance = unmet(relaxed) + 1e-3 * check.products.reduce((a, p) => a + p.yearlyDemand, 0);
    const relaxedHours = Float64Array.from(hoursOf, (h) => relaxed[h]);
    for (const scale of [1, 0.5, 0.25]) {
      const cycles = campaignCycles(runs.map((i) => names[i]), (k) => relaxedHours[k], (k) => scale * (model.campaignHours.get(names[runs[k]]) ?? 0));
      if (!cycles.some((c) => c === 0)) break;
      cycles.forEach((c, k) => (upper[k] = c));
      const cycled = relax();
      if (unmet(cycled) <= tolerance) {
        relaxed = cycled;
        break;
      }
      upper.fill(1);
    }
    lap('relax');
    setCont(1);

    // 2. Runs fixed to 1 where the relaxation produced, so their line clears are paid in full. All
    //    other runs are open (continuous), so work can move to them where the paid line clears or the
    //    cycles leave too little (e.g. week 1, which starts without stock); any that get used are
    //    fixed to 1 in turn. Finally all runs are fixed: the start is a plan with every line clear
    //    paid for.
    const lower = Float64Array.from(hoursOf, (h) => (relaxed[h] > 1e-6 ? 1 : 0));
    let start: Float64Array = new Float64Array();
    for (let round = 0; round < 6; round++) {
      mdl.changeColsBounds(sel, lower, new Float64Array(runs.length).fill(1));
      if (alone.length) setAlone(lower, false);
      mdl.clearSolver(); // a warm start from the last basis can take minutes; a fresh solve takes ~1 s
      mdl.run();
      start = Float64Array.from(mdl.getSolution().colValue);
      let opened = 0;
      hoursOf.forEach((h, k) => {
        if (lower[k] === 0 && start[h] > 1e-6) {
          lower[k] = 1;
          opened++;
        }
      });
      if (opened === 0) break;
    }
    // Runs left empty only cost line clear time.
    const fixed = Float64Array.from(hoursOf, (h, k) => (lower[k] === 1 && start[h] > 1e-6 ? 1 : 0));
    mdl.changeColsBounds(sel, fixed, fixed);
    if (alone.length) setAlone(fixed, true);
    mdl.clearSolver();
    mdl.run();
    start = Float64Array.from(mdl.getSolution().colValue);
    const startObjective = mdl.getObjectiveValue();
    lap('fix');

    // 3. MIP from that start, over the runs the cycles allow plus those the start uses.
    mdl.changeColsBounds(sel, new Float64Array(runs.length), upper.map((u, k) => Math.max(u, fixed[k])));
    mdl.changeColsIntegrality(sel, new Int32Array(runs.length).fill(1)); // 1 = integer
    if (alone.length) {
      mdl.changeColsBounds(aloneSel, new Float64Array(alone.length), new Float64Array(alone.length).fill(1));
      mdl.changeColsIntegrality(aloneSel, new Int32Array(alone.length).fill(1));
    }
    mdl.setSolution({ colValue: start });
    const elapsedS = (performance.now() - t0) / 1000;
    mdl.options.set({ mip_rel_gap: MIP_REL_GAP, time_limit: Math.max(1, timeLimitS - elapsedS) });
    const res = mdl.run();
    lap('mip');
    const optimal = res.modelStatus === S.optimal;
    const mipPlan = optimal || res.modelStatus === S.timeLimit;
    // HiGHS may not keep the start as its incumbent: fall back to the start if it is better.
    const better = mipPlan && mdl.getObjectiveValue() <= startObjective + 1e-9;
    const bound = Number(mdl.info.get('mip_dual_bound'));
    const objective = better ? mdl.getObjectiveValue() : startObjective;
    return {
      status: optimal && better ? 'Optimal' : 'Time limit reached',
      columns: values(better ? Float64Array.from(mdl.getSolution().colValue) : start),
      gap: Number.isFinite(bound) && objective > 0 ? Math.min(1, Math.max(0, (objective - bound) / objective)) : 1,
      stages,
    };
  });
  return { ...readPlan(model, ds, check.weeks, status, columns, performance.now() - t0), mipGap: gap, stages };
}
