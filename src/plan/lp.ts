// First planning LP (S04 spike, ADR 0003): continuous machine-hours per product × machine × ISO
// week, with one stock per product (no locations), no line clears, storage or trucks yet.
//
//   hours[p,m,w] ≥ 0     time machine m spends on product p in week w
//   stock[p,w]   ≥ 0     units of p held at the end of week w (none before week 1)
//   short[p,w]   ≥ 0     demand of p in week w that is not met
//
//   Σ_p hours[p,m,w] ≤ available hours of m in w
//   stock[p,w-1] + Σ_m rate[p,m] · hours[p,m,w] + short[p,w] − stock[p,w] = demand[p,w]
//
//   minimise  SHORT · Σ short + HOLD · Σ stock + Σ hours
//
// Unmet demand costs far more than anything else; holding stock costs a little so production
// happens just in time; machine-hours cost 1 so faster machines are preferred.
import { effectiveRate } from '../model/capacity';
import type { CapacityCheck } from '../model/demand';
import type { Dataset, Id } from '../model/types';

const SHORT = 1000;
const HOLD = 0.001;

export interface PlanModel {
  lp: string;
  /** Column name → what it is, for reading the solution back. */
  hours: Map<string, { productId: Id; machineId: Id; week: number }>;
  shorts: Map<string, { productId: Id; week: number }>;
}

/** LP names must avoid spaces and operators; ids are user-editable, so index them instead. */
export function buildPlanLp(ds: Dataset, check: CapacityCheck): PlanModel {
  const { weeks, machineHours } = check;
  const pIdx = new Map(ds.products.map((p, i) => [p.id, i]));
  const mIdx = new Map(ds.machines.map((m, i) => [m.id, i]));
  const caps = ds.capabilities.filter((c) => pIdx.has(c.productId) && mIdx.has(c.machineId) && effectiveRate(c) > 0);

  const hours = new Map<string, { productId: Id; machineId: Id; week: number }>();
  const shorts = new Map<string, { productId: Id; week: number }>();
  const objective: string[] = [];
  const rows: string[] = [];
  const h = (p: number, m: number, w: number) => `h_${p}_${m}_${w}`;
  const st = (p: number, w: number) => `s_${p}_${w}`;
  const sh = (p: number, w: number) => `u_${p}_${w}`;
  const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toPrecision(12));

  for (let w = 1; w <= weeks; w++) {
    for (const c of caps) {
      const name = h(pIdx.get(c.productId)!, mIdx.get(c.machineId)!, w);
      hours.set(name, { productId: c.productId, machineId: c.machineId, week: w });
      objective.push(`+ ${name}`);
    }
    for (const p of ds.products) {
      const i = pIdx.get(p.id)!;
      shorts.set(sh(i, w), { productId: p.id, week: w });
      objective.push(`+ ${SHORT} ${sh(i, w)}`, `+ ${HOLD} ${st(i, w)}`);
    }
  }

  for (const m of ds.machines) {
    const j = mIdx.get(m.id)!;
    const mCaps = caps.filter((c) => c.machineId === m.id);
    if (mCaps.length === 0) continue;
    for (let w = 1; w <= weeks; w++) {
      const terms = mCaps.map((c) => `+ ${h(pIdx.get(c.productId)!, j, w)}`).join(' ');
      rows.push(` cap_${j}_${w}: ${terms} <= ${num(machineHours.get(m.id)?.[w - 1] ?? 0)}`);
    }
  }

  for (const pc of check.products) {
    const i = pIdx.get(pc.productId)!;
    const pCaps = caps.filter((c) => c.productId === pc.productId);
    for (let w = 1; w <= weeks; w++) {
      const made = pCaps.map((c) => `+ ${num(effectiveRate(c))} ${h(i, mIdx.get(c.machineId)!, w)}`).join(' ');
      const prev = w > 1 ? `+ ${st(i, w - 1)} ` : '';
      rows.push(` bal_${i}_${w}: ${prev}${made} + ${sh(i, w)} - ${st(i, w)} = ${num(pc.weeklyDemand[w - 1])}`);
    }
  }

  // Wrap long expressions: the LP reader has a line length limit.
  const wrap = (s: string) => s.replace(/((?:\S+\s+){40})/g, '$1\n  ');
  const lp = ['Minimize', ` obj: ${wrap(objective.join(' '))}`, 'Subject To', ...rows.map(wrap), 'End'].join('\n');
  return { lp, hours, shorts };
}

export interface PlanResult {
  status: string;
  /** Shifts per machine → product → total over the year. */
  shifts: { machineId: Id; productId: Id; shifts: number }[];
  /** Shifts per machine per week (index 0 = week 1), summed over products. */
  machineWeekShifts: Map<Id, number[]>;
  unmetUnits: number;
  solveMs: number;
}

/** Column values from a HiGHS solution, by name. */
export type ColumnValues = Record<string, number>;

export function readPlan(model: PlanModel, ds: Dataset, weeks: number, status: string, columns: ColumnValues, solveMs: number): PlanResult {
  const totals = new Map<string, number>();
  const machineWeekShifts = new Map<Id, number[]>(ds.machines.map((m) => [m.id, new Array(weeks).fill(0)]));
  for (const [name, { productId, machineId, week }] of model.hours) {
    const shifts = (columns[name] ?? 0) / ds.settings.shiftHours;
    if (shifts < 1e-9) continue;
    const key = `${machineId}\u0000${productId}`;
    totals.set(key, (totals.get(key) ?? 0) + shifts);
    machineWeekShifts.get(machineId)![week - 1] += shifts;
  }
  let unmetUnits = 0;
  for (const name of model.shorts.keys()) unmetUnits += columns[name] ?? 0;
  const shifts = [...totals].map(([key, s]) => {
    const [machineId, productId] = key.split('\u0000');
    return { machineId, productId, shifts: s };
  });
  return { status, shifts, machineWeekShifts, unmetUnits, solveMs };
}
