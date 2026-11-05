import { describe, expect, it } from 'vitest';
import { seedDataset } from '../model/seed';
import type { Dataset, Run } from '../model/types';
import { constantUsage, initialState, scheduleOutputs } from './output';

// One machine, 8 h shifts, small clear 30 min, large 120 min; A at 100/h, B at 50/h, both 80 % OEE.
const ds: Pick<Dataset, 'machines' | 'capabilities' | 'settings'> = {
  settings: { shiftHours: 8 },
  machines: [{ id: 'm1', name: 'M1', smallLineClearMin: 30, largeLineClearMin: 120 }],
  capabilities: [
    { machineId: 'm1', productId: 'A', ratePerHour: 100, oeePct: 80 },
    { machineId: 'm1', productId: 'B', ratePerHour: 50, oeePct: 80 },
  ],
};
const SMALL_A = 7.5 * 80; // 600
const LARGE_A = 6 * 80; // 480
const LARGE_B = 6 * 40; // 240
const run = (shift: number, productId: string): Run => ({ machineId: 'm1', shift, productId });

describe('scheduleOutputs (R78)', () => {
  it('uses a large clear at the start and a small one when the product repeats', () => {
    const out = scheduleOutputs(ds, { shift: 0, schedule: [run(1, 'A'), run(0, 'A')], lastProduct: { m1: null } });
    expect(out.map((o) => [o.run.shift, o.clear, o.units])).toEqual([
      [0, 'large', LARGE_A],
      [1, 'small', SMALL_A],
    ]);
  });

  it('uses a large clear on a product change and after an idle shift', () => {
    const out = scheduleOutputs(ds, { shift: 0, schedule: [run(0, 'A'), run(1, 'B'), run(3, 'B')], lastProduct: { m1: null } });
    expect(out.map((o) => [o.clear, o.units])).toEqual([
      ['large', LARGE_A],
      ['large', LARGE_B],
      ['large', LARGE_B],
    ]);
  });

  it('takes the first shift’s previous product from lastProduct', () => {
    const out = scheduleOutputs(ds, { shift: 5, schedule: [run(5, 'A')], lastProduct: { m1: 'A' } });
    expect(out[0]).toMatchObject({ clear: 'small', units: SMALL_A });
  });

  it('throws for a run the machine cannot make', () => {
    expect(() => scheduleOutputs(ds, { shift: 0, schedule: [run(0, 'C')], lastProduct: { m1: null } })).toThrow(/m1 → C/);
  });

  it('gives every seeded run a positive output', () => {
    const out = scheduleOutputs(seedDataset, initialState(seedDataset));
    expect(out).toHaveLength(seedDataset.schedule.length);
    for (const o of out) expect(o.units).toBeGreaterThan(0);
  });
});

describe('initialState and constantUsage (R87)', () => {
  it('starts at shift 0 with initial stock, a copy of the schedule and no previous products', () => {
    const s = initialState(seedDataset);
    expect(s.shift).toBe(0);
    expect(Object.keys(s.stock)).toHaveLength(seedDataset.products.length);
    expect(s.stock[seedDataset.products[0].id]).toBe(seedDataset.products[0].initialStock);
    expect(s.schedule).toEqual(seedDataset.schedule);
    expect(s.schedule[0]).not.toBe(seedDataset.schedule[0]);
    expect(Object.values(s.lastProduct).every((p) => p === null)).toBe(true);
  });

  it('returns usagePerShift for any shift', () => {
    const p = seedDataset.products[0];
    expect(constantUsage.usage(p, 0)).toBe(p.usagePerShift);
    expect(constantUsage.usage(p, 42)).toBe(p.usagePerShift);
  });
});
