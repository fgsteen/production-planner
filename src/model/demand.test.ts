import { describe, expect, it } from 'vitest';
import { checkCapacity, weeklyDemand } from './demand';
import { seedDataset } from './seed';
import type { Dataset } from './types';
import { validateDataset } from './validate';
import { isoWeekRange, isoWeeksInYear, isoYearRange } from './weeks';

describe('ISO weeks', () => {
  it('counts 52 or 53 weeks', () => {
    expect(isoWeeksInYear(2027)).toBe(52);
    expect(isoWeeksInYear(2026)).toBe(53); // starts on a Thursday
    expect(isoWeeksInYear(2020)).toBe(53); // leap year starting on a Wednesday
  });

  it('starts week 1 on the Monday of the week holding the first Thursday', () => {
    expect(isoWeekRange(2027, 1)).toEqual({ from: '2027-01-04', to: '2027-01-10' });
    expect(isoWeekRange(2026, 1)).toEqual({ from: '2025-12-29', to: '2026-01-04' });
    expect(isoYearRange(2027)).toEqual({ from: '2027-01-04', to: '2028-01-02' });
  });
});

describe('weeklyDemand', () => {
  it('spreads the yearly total evenly', () => {
    expect(weeklyDemand({ productId: 'P', yearlyUnits: 520, weekOverrides: {} }, 52)).toEqual(new Array(52).fill(10));
  });

  it('pins overridden weeks and spreads the rest over the other weeks', () => {
    const w = weeklyDemand({ productId: 'P', yearlyUnits: 1000, weekOverrides: { '1': 490, '52': 0 } }, 52);
    expect(w[0]).toBe(490);
    expect(w[51]).toBe(0);
    expect(w[1]).toBeCloseTo(510 / 50);
    expect(w.reduce((a, b) => a + b, 0)).toBeCloseTo(1000);
  });

  it('is zero without demand, and ignores weeks outside the year', () => {
    expect(weeklyDemand(undefined, 52)).toEqual(new Array(52).fill(0));
    expect(weeklyDemand({ productId: 'P', yearlyUnits: 520, weekOverrides: { '53': 100 } }, 52)[0]).toBe(10);
  });
});

describe('demand validation', () => {
  const withDemand = (yearlyUnits: number, weekOverrides: Record<string, number>): Dataset => ({
    ...seedDataset,
    demand: [{ productId: 'P01', yearlyUnits, weekOverrides }],
  });

  it('flags overrides above the total, weeks outside the year and unknown products', () => {
    expect(validateDataset(withDemand(100, { '3': 150 }))).toContain('Demand P01: weekly overrides (150) exceed the yearly total (100)');
    expect(validateDataset(withDemand(100, { '53': 1 }))).toContain('Demand P01: week 53 is not in 2027 (1–52)');
    expect(validateDataset({ ...seedDataset, demand: [{ productId: 'X', yearlyUnits: 1, weekOverrides: {} }] })).toContain('Demand: unknown product "X"');
  });

  it('flags a fully pinned year that does not sum to the total', () => {
    const all = Object.fromEntries(Array.from({ length: 52 }, (_, i) => [String(i + 1), 1]));
    expect(validateDataset(withDemand(52, all))).toEqual([]);
    expect(validateDataset(withDemand(60, all))).toContain('Demand P01: all weeks are set but sum to 52, not the yearly total 60');
  });
});

describe('checkCapacity', () => {
  // One product on one machine: 1 shift/day, Mon–Fri, 8 h, 125 units/h × 80 % → 4000 units/week.
  const tiny = (yearlyUnits: number, weekOverrides: Record<string, number> = {}): Dataset => ({
    ...seedDataset,
    sites: [{ id: 'S', name: 'S', isDemandSite: true, holidays: [] }],
    machines: [
      { id: 'M', name: 'M', siteId: 'S', calendar: { shiftsPerDay: 1, workingWeekdays: [1, 2, 3, 4, 5] }, smallLineClearMin: 0, largeLineClearMin: 0, maintenance: [] },
    ],
    products: [{ id: 'P', name: 'P', unitsPerCrate: 1, cratesPerPallet: 1 }],
    capabilities: [{ machineId: 'M', productId: 'P', ratePerHour: 125, oeePct: 80 }],
    demand: [{ productId: 'P', yearlyUnits, weekOverrides }],
  });

  it('computes max output and machine load', () => {
    const c = checkCapacity(tiny(52 * 3000));
    expect(c.products[0].maxYearlyOutput).toBe(52 * 4000);
    expect(c.products[0].shortfall).toBe(0);
    expect(c.products[0].overWeeks).toEqual([]);
    expect(c.machines[0].loadPct).toBeCloseTo(75);
  });

  it('flags peak weeks that need stock, but no shortfall if earlier weeks can build ahead', () => {
    const c = checkCapacity(tiny(52 * 3000, { '10': 6000 }));
    expect(c.products[0].overWeeks).toEqual([10]);
    expect(c.products[0].shortfall).toBe(0);
  });

  it('reports a shortfall when demand comes before capacity can catch up', () => {
    expect(checkCapacity(tiny(10_000, { '1': 10_000 })).products[0].shortfall).toBe(6000);
    expect(checkCapacity(tiny(52 * 5000)).products[0].shortfall).toBe(52 * 1000);
  });

  it('passes the demo data', () => {
    const c = checkCapacity(seedDataset);
    expect(c.products.every((p) => p.shortfall === 0)).toBe(true);
    expect(c.machines.every((m) => m.loadPct < 100)).toBe(true);
  });
});
