// Solves the demo at several line clear weights and prints the trade-offs (S08). Not a test: it only
// reports. Set MEASURE_WEIGHTS=0,4,10 and MEASURE_DEMAND=1.3 (demand scale) to vary it. With unmet
// demand it also prints the unmet share per product (R64).
import loadHighs from 'highs';
import { it } from 'vitest';
import { seedDataset } from '../../src/model/seed';
import type { Dataset } from '../../src/model/types';
import { solvePlan } from '../../src/plan/solve';

const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const weights = (env.MEASURE_WEIGHTS ?? '0,4,10').split(',').map(Number);
const scale = Number(env.MEASURE_DEMAND ?? 1);

it('measures the demo plan', async () => {
  const highs = await loadHighs();
  const rows = [];
  const unmetRows: Record<string, string | number>[] = [];
  for (const w of weights) {
    const ds: Dataset = {
      ...seedDataset,
      settings: { ...seedDataset.settings, priorities: { ...seedDataset.settings.priorities, lineClears: w } },
      demand: seedDataset.demand.map((d) => ({ ...d, yearlyUnits: d.yearlyUnits * scale })),
    };
    const plan = solvePlan(highs, ds);
    const lanePallets = plan.lanes.reduce((a, l) => a + l.weeks.reduce((b, x) => b + x.pallets, 0), 0);
    rows.push({
      weight: w,
      largeClears: plan.lineClears.reduce((a, l) => a + l.large, 0),
      clearHours: Math.round(plan.lineClears.reduce((a, l) => a + l.hours, 0)),
      U: plan.maxUtilisation.toFixed(3),
      unmet: Math.round(plan.unmetUnits),
      pallets: Math.round(lanePallets),
      gap: plan.mipGap?.toFixed(3),
      s: (plan.solveMs / 1000).toFixed(1),
      ...(plan.stages ?? {}),
    });
    if (plan.unmetUnits < 1) continue;
    const byProduct = new Map<string, number>();
    for (const u of plan.unmet) byProduct.set(u.productId, (byProduct.get(u.productId) ?? 0) + u.units);
    const row: Record<string, string | number> = { weight: w };
    for (const d of ds.demand) row[d.productId] = `${Math.round((100 * (byProduct.get(d.productId) ?? 0)) / Math.max(1, d.yearlyUnits))}%`;
    unmetRows.push(row);
  }
  console.table(rows);
  if (unmetRows.length) console.table(unmetRows);
});
