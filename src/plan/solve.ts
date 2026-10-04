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

export function solvePlan(highs: Highs, ds: Dataset, timeLimitS = TIME_LIMIT_S): PlanResult {
  const check = checkCapacity(ds);
  const model = buildPlanLp(ds, check);
  const t0 = performance.now();
  const S = highs.constants.modelStatus;

  const { status, columns, gap } = highs.withModel({ format: 'lp', data: model.lp }, (mdl) => {
    mdl.options.set({ output_flag: false });
    const names = Array.from({ length: mdl.getDimensions().numCols }, (_, i) => mdl.getColName(i));
    const values = (colValue: ArrayLike<number>) => Object.fromEntries(names.map((n, i) => [n, colValue[i]]));
    const runs = names.flatMap((n, i) => (n.startsWith('r_') ? [i] : []));
    if (runs.length === 0) {
      const res = mdl.run();
      const ok = res.modelStatus === S.optimal;
      return { status: ok ? 'Optimal' : `HiGHS status ${res.modelStatus}`, columns: ok ? values(Float64Array.from(mdl.getSolution().colValue)) : {}, gap: 0 };
    }
    const sel = { kind: 'set' as const, indices: Int32Array.from(runs) };
    const hoursOf = runs.map((i) => mdl.getColByName(`h_${names[i].slice(2)}`));
    const minRunHours = runs.map((i) => model.minRunHours.get(names[i]) ?? 0);

    // 1. Relaxation, repeated: runs too small for a worthwhile campaign (MIN_RUN_LOTS lots) are
    //    forbidden, at most half of each product–machine pair's runs per round, so the volume moves
    //    into fewer, longer runs.
    mdl.changeColsIntegrality(sel, new Int32Array(runs.length)); // 0 = continuous
    const upper = new Float64Array(runs.length).fill(1);
    const pairOf = runs.map((i) => names[i].slice(2, names[i].lastIndexOf('_')));
    const shortCols = names.flatMap((n, i) => (n.startsWith('u_') ? [i] : []));
    const unmet = (v: ArrayLike<number>) => shortCols.reduce((a, i) => a + v[i], 0);
    let relaxed: ArrayLike<number> = [];
    let baseUnmet = Infinity;
    let lastDropped: number[] = [];
    for (let round = 0; round < 8; round++) {
      mdl.changeColsBounds(sel, new Float64Array(runs.length), upper);
      mdl.clearSolver(); // a warm start from the last basis can take minutes; a fresh solve takes ~1 s
      mdl.run();
      const sol = Float64Array.from(mdl.getSolution().colValue);
      // A round that leaves demand unmet (e.g. no early runs left for a pre-SFG chain) is undone.
      if (unmet(sol) > baseUnmet + 1) {
        for (const k of lastDropped) upper[k] = 1;
        mdl.changeColsBounds(sel, new Float64Array(runs.length), upper);
        break;
      }
      relaxed = sol;
      baseUnmet = Math.min(baseUnmet, unmet(sol));
      const byPair = new Map<string, number[]>();
      hoursOf.forEach((h, k) => relaxed[h] > 1e-6 && byPair.set(pairOf[k], [...(byPair.get(pairOf[k]) ?? []), k]));
      lastDropped = [];
      for (const ks of byPair.values()) {
        const small = ks.filter((k) => relaxed[hoursOf[k]] < minRunHours[k] - 1e-6).sort((a, b) => relaxed[hoursOf[a]] - relaxed[hoursOf[b]]);
        for (const k of small.slice(0, Math.floor(ks.length / 2))) {
          upper[k] = 0;
          lastDropped.push(k);
        }
      }
      if (lastDropped.length === 0) break;
    }

    // 2. Runs fixed to 1 where the relaxation produced, so their line clears are paid in full. The
    //    other allowed runs stay open (continuous), so work can move to them when the paid line
    //    clears leave too little time (e.g. week 1, which starts without stock); any that get used
    //    are fixed to 1 in turn. Finally all runs are fixed: the start is a plan with every line
    //    clear paid for.
    const lower = Float64Array.from(hoursOf, (h) => (relaxed[h] > 1e-6 ? 1 : 0));
    let start: Float64Array = new Float64Array();
    for (let round = 0; round < 6; round++) {
      mdl.changeColsBounds(sel, lower, upper.map((u, k) => Math.max(u, lower[k])));
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
    mdl.clearSolver();
    mdl.run();
    start = Float64Array.from(mdl.getSolution().colValue);
    const startObjective = mdl.getObjectiveValue();

    // 3. MIP from that start, over the runs the relaxation kept.
    mdl.changeColsBounds(sel, new Float64Array(runs.length), upper);
    mdl.changeColsIntegrality(sel, new Int32Array(runs.length).fill(1)); // 1 = integer
    mdl.setSolution({ colValue: start });
    const elapsedS = (performance.now() - t0) / 1000;
    mdl.options.set({ mip_rel_gap: MIP_REL_GAP, time_limit: Math.max(1, timeLimitS - elapsedS) });
    const res = mdl.run();
    const optimal = res.modelStatus === S.optimal;
    const mipPlan = optimal || res.modelStatus === S.timeLimit;
    // HiGHS may not keep the start as its incumbent: fall back to the start if it is better.
    const better = mipPlan && mdl.getObjectiveValue() <= startObjective + 1e-9;
    const bound = Number(mdl.info.get('mip_dual_bound'));
    const objective = better ? mdl.getObjectiveValue() : startObjective;
    return {
      status: optimal && better ? 'Optimal' : 'Time limit reached',
      columns: values(better ? Float64Array.from(mdl.getSolution().colValue) : start),
      gap: Number.isFinite(bound) && objective > 0 ? Math.max(0, (objective - bound) / objective) : 1,
    };
  });
  return { ...readPlan(model, ds, check.weeks, status, columns, performance.now() - t0), mipGap: gap };
}
