import { describe, expect, it } from 'vitest';
import { WINDOW_SHIFTS, effectiveRate, runOutput } from './capacity';
import { groupProducts, sumByGroup } from './products';
import { makeSeedSchedule, seedDataset } from './seed';
import type { Dataset } from './types';
import { validateDataset } from './validate';

const clone = (): Dataset => structuredClone(seedDataset);

describe('seed dataset (R72, R73)', () => {
  it('is valid', () => {
    expect(validateDataset(seedDataset)).toEqual([]);
  });

  it('has 8 machines and 20 products, each a distinct X-Y-Z combination made by 2+ machines', () => {
    expect(seedDataset.machines).toHaveLength(8);
    expect(seedDataset.products).toHaveLength(20);
    for (const p of seedDataset.products) expect(seedDataset.capabilities.filter((c) => c.productId === p.id).length).toBeGreaterThanOrEqual(2);
  });

  it('starts every product between min and max, with room for a run above min', () => {
    for (const p of seedDataset.products) {
      expect(p.initialStock).toBeGreaterThanOrEqual(p.min);
      expect(p.initialStock).toBeLessThanOrEqual(p.max);
      expect(p.max - p.min).toBeGreaterThan(p.usagePerShift);
    }
  });

  it('schedules runs in the 9-shift window, leaving some shifts empty', () => {
    const { schedule, machines } = seedDataset;
    expect(schedule.length).toBeGreaterThan(10);
    expect(schedule.length).toBeLessThan(machines.length * WINDOW_SHIFTS);
    expect(new Set(schedule.map((r) => r.shift)).size).toBeGreaterThan(1);
  });

  it('never makes one product on two machines in the same shift', () => {
    const seen = new Set(seedDataset.schedule.map((r) => `${r.shift}/${r.productId}`));
    expect(seen.size).toBe(seedDataset.schedule.length);
  });

  it('is deterministic', () => {
    expect(makeSeedSchedule(seedDataset)).toEqual(seedDataset.schedule);
  });
});

describe('validateDataset', () => {
  it('flags a product no machine can produce', () => {
    const ds = clone();
    ds.capabilities = ds.capabilities.filter((c) => c.productId !== 'P07');
    ds.schedule = ds.schedule.filter((r) => r.productId !== 'P07');
    expect(validateDataset(ds)).toEqual(['Product P07: no machine can produce it']);
  });

  it('flags OEE outside (0, 100]', () => {
    const ds = clone();
    ds.capabilities[0].oeePct = 120;
    ds.capabilities[1].oeePct = 0;
    expect(validateDataset(ds).filter((e) => e.includes('OEE'))).toHaveLength(2);
  });

  it('flags dangling references and duplicates', () => {
    const ds = clone();
    ds.capabilities.push({ ...ds.capabilities[0] });
    ds.capabilities.push({ machineId: 'Z9', productId: 'P01', ratePerHour: 1, oeePct: 50 });
    const errors = validateDataset(ds);
    expect(errors).toContain('Duplicate capability M1/P01');
    expect(errors).toContain('Capability Z9/P01: unknown machine');
  });

  it('flags bad stock fields and min above max', () => {
    const ds = clone();
    Object.assign(ds.products[0], { min: 5000, max: 4000, usagePerShift: -1 });
    expect(validateDataset(ds)).toEqual(['Product P01: usage per shift must be ≥ 0', 'Product P01: min is above max']);
  });

  it('flags line clears that are negative, too long or out of order', () => {
    const ds = clone();
    Object.assign(ds.machines[0], { smallLineClearMin: 100, largeLineClearMin: 480 });
    expect(validateDataset(ds)).toEqual(['Machine M1: large line clear must be ≥ 0 and shorter than a shift']);
    ds.machines[0].largeLineClearMin = 90;
    expect(validateDataset(ds)).toEqual(['Machine M1: small line clear is longer than large']);
  });

  it('flags schedule runs outside the window, doubled, or with unknown ids', () => {
    const ds = clone();
    ds.schedule = [
      { machineId: 'M1', shift: 9, productId: 'P01' },
      { machineId: 'M1', shift: 0, productId: 'P01' },
      { machineId: 'M1', shift: 0, productId: 'P02' },
      { machineId: 'Z9', shift: 1, productId: 'P01' },
      { machineId: 'M2', shift: 1, productId: 'P99' },
    ];
    expect(validateDataset(ds)).toEqual([
      'Schedule: shift 10 is outside 1–9',
      'Schedule: M1 shift 1 has two runs',
      'Schedule Z9 shift 2: unknown machine',
      'Schedule M2 shift 2: unknown product "P99"',
    ]);
  });
});

describe('run output (R78)', () => {
  const machine = { id: 'M1', name: 'M1', smallLineClearMin: 20, largeLineClearMin: 90 };
  const cap = { machineId: 'M1', productId: 'P01', ratePerHour: 1000, oeePct: 80 };

  it('computes effective rate as rate × OEE', () => {
    expect(effectiveRate(cap)).toBe(800);
  });

  it('subtracts a small clear for the same product, a large one otherwise', () => {
    expect(runOutput(cap, machine, 8, true)).toBeCloseTo((8 - 20 / 60) * 800);
    expect(runOutput(cap, machine, 8, false)).toBeCloseTo(6.5 * 800);
  });

  it('never goes negative', () => {
    expect(runOutput(cap, { ...machine, largeLineClearMin: 600 }, 8, false)).toBe(0);
  });
});

describe('sumByGroup', () => {
  it('sums per-product values into groups, in group order, leaving out empty groups', () => {
    const groups = groupProducts(seedDataset, seedDataset.products, 'X');
    const [k, l] = seedDataset.products.filter((p) => p.variants.X === 'X1' || p.variants.X === 'X2').reduce<[string[], string[]]>(
      (acc, p) => (acc[p.variants.X === 'X1' ? 0 : 1].push(p.id), acc),
      [[], []],
    );
    const sums = sumByGroup(groups, [[l[0], 2], [k[0], 1], [k[1], 3], ['nope', 9]]);
    expect(sums.map(([g, v]) => [g.label, v])).toEqual([
      ['X K', 4],
      ['X L', 2],
    ]);
  });
});
