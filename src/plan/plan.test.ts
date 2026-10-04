import loadHighs from 'highs';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedDataset } from '../model/seed';
import type { Dataset } from '../model/types';
import { solvePlan } from './solve';

let highs: Awaited<ReturnType<typeof loadHighs>>;
beforeAll(async () => {
  highs = await loadHighs();
});

// Two machines, one product. M1 makes 100/h, M2 50/h; 40 h/week each (1 × 8 h shift, Mon–Fri).
const tiny = (weeklyDemand: number): Dataset => ({
  ...seedDataset,
  sites: [{ id: 'S', name: 'S', isDemandSite: true, holidays: [] }],
  machines: ['M1', 'M2'].map((id) => ({
    id,
    name: id,
    siteId: 'S',
    calendar: { shiftsPerDay: 1, workingWeekdays: [1, 2, 3, 4, 5] },
    smallLineClearMin: 0,
    largeLineClearMin: 0,
    maintenance: [],
  })),
  products: [{ id: 'P', name: 'P', unitsPerCrate: 1, cratesPerPallet: 1 }],
  capabilities: [
    { machineId: 'M1', productId: 'P', ratePerHour: 100, oeePct: 100 },
    { machineId: 'M2', productId: 'P', ratePerHour: 50, oeePct: 100 },
  ],
  demand: [{ productId: 'P', yearlyUnits: weeklyDemand * 52, weekOverrides: {} }],
});

describe('plan LP', () => {
  it('uses the faster machine first', () => {
    // 5000/week: M1 full (4000 in 40 h) + M2 20 h (1000). Shifts: M1 5/wk, M2 2.5/wk.
    const plan = solvePlan(highs, tiny(5000));
    expect(plan.status).toBe('Optimal');
    expect(plan.unmetUnits).toBeCloseTo(0);
    const shifts = Object.fromEntries(plan.shifts.map((s) => [s.machineId, s.shifts]));
    expect(shifts.M1).toBeCloseTo(52 * 5);
    expect(shifts.M2).toBeCloseTo(52 * 2.5);
  });

  it('reports unmet demand when capacity runs out', () => {
    // Max 6000/week; demand 7000/week → 1000/week unmet.
    const plan = solvePlan(highs, tiny(7000));
    expect(plan.status).toBe('Optimal');
    expect(plan.unmetUnits).toBeCloseTo(52 * 1000);
  });

  it('plans the demo data without unmet demand', () => {
    const plan = solvePlan(highs, seedDataset);
    expect(plan.status).toBe('Optimal');
    expect(plan.unmetUnits).toBeLessThan(1);
    for (const [, weeks] of plan.machineWeekShifts) for (const s of weeks) expect(s).toBeLessThanOrEqual(21 + 1e-6);
  });
});
