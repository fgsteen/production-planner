// Solves the plan LP with HiGHS. Used by the Web Worker in the app and directly in unit tests.
import type { Highs } from 'highs';
import { checkCapacity } from '../model/demand';
import type { Dataset } from '../model/types';
import { buildPlanLp, readPlan, type PlanResult } from './lp';

export function solvePlan(highs: Highs, ds: Dataset): PlanResult {
  const check = checkCapacity(ds);
  const model = buildPlanLp(ds, check);
  const t0 = performance.now();
  const res = highs.solve(model.lp, { output_flag: false });
  const solveMs = performance.now() - t0;
  const columns = res.Status === 'Optimal' ? Object.fromEntries(Object.entries(res.Columns).map(([name, c]) => [name, c.Primal])) : {};
  return readPlan(model, ds, check.weeks, res.Status, columns, solveMs);
}
