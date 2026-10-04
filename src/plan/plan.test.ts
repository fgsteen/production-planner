import loadHighs from 'highs';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedDataset } from '../model/seed';
import type { Dataset } from '../model/types';
import type { PlanResult } from './lp';
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
  storageLocations: [],
  truckLanes: [],
});

// Two sites, one product (10 units/pallet). MB at B makes 100/h, MA at A 50/h; 40 h/week each.
// Trucks carry 10 pallets (100 units) and run every day; no holidays.
const twoSites = (opts: { trucks: number; storage?: number; initial?: Dataset['initialStock']; demand?: Record<string, number>; yearly?: number }): Dataset => ({
  ...seedDataset,
  sites: [
    { id: 'B', name: 'B', isDemandSite: false, holidays: [] },
    { id: 'A', name: 'A', isDemandSite: true, holidays: [] },
  ],
  machines: [
    ['MB', 'B'],
    ['MA', 'A'],
  ].map(([id, siteId]) => ({
    id,
    name: id,
    siteId,
    calendar: { shiftsPerDay: 1, workingWeekdays: [1, 2, 3, 4, 5] },
    smallLineClearMin: 0,
    largeLineClearMin: 0,
    maintenance: [],
  })),
  products: [{ id: 'P', name: 'P', unitsPerCrate: 10, cratesPerPallet: 1 }],
  capabilities: [
    { machineId: 'MB', productId: 'P', ratePerHour: 100, oeePct: 100 },
    { machineId: 'MA', productId: 'P', ratePerHour: 50, oeePct: 100 },
  ],
  storageLocations: [
    { id: 'B-WH', name: 'B-WH', siteId: 'B', capacityPallets: opts.storage ?? 1e6, accepts: 'local' },
    { id: 'A-IF', name: 'A-IF', siteId: 'A', capacityPallets: opts.storage ?? 1e6, accepts: 'local' },
    { id: 'A-WH', name: 'A-WH', siteId: 'A', capacityPallets: opts.storage ?? 1e6, accepts: 'inbound' },
  ],
  truckLanes: [{ id: 'BA', fromSiteId: 'B', toSiteId: 'A', maxTrucksPerWeek: opts.trucks, palletsPerTruck: 10, runsOnWeekendsAndHolidays: true }],
  demand: [{ productId: 'P', yearlyUnits: opts.yearly ?? 1000 * 52, weekOverrides: opts.demand ?? {} }],
  initialStock: opts.initial ?? [],
});

const shiftsAt = (plan: PlanResult, machineId: string) => plan.shifts.find((s) => s.machineId === machineId)?.shifts ?? 0;

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
    for (const lane of plan.lanes) for (const w of lane.weeks) expect(w.trucksUsed).toBeLessThanOrEqual(w.truckLimit);
    for (const pool of plan.storage) for (const p of pool.pallets) expect(p).toBeLessThanOrEqual(pool.capacityPallets + 1e-6);
  });
});

describe('plan LP: storage and trucks', () => {
  it('ships from the faster B machine when trucks allow', () => {
    // 1000/week: MB needs 10 h, MA would need 20 h. Ship 100 pallets = 10 trucks/week.
    const plan = solvePlan(highs, twoSites({ trucks: 10 }));
    expect(plan.unmetUnits).toBeCloseTo(0);
    expect(shiftsAt(plan, 'MB')).toBeCloseTo(52 * 1.25);
    expect(shiftsAt(plan, 'MA')).toBeCloseTo(0);
    expect(plan.lanes[0].weeks[0]).toEqual({ pallets: expect.closeTo(100), trucksUsed: 10, truckLimit: 10 });
    expect(plan.shipments.filter((s) => s.week === 1)).toEqual([
      expect.objectContaining({ productId: 'P', units: expect.closeTo(1000), pallets: expect.closeTo(100) }),
    ]);
  });

  it('makes the rest at A when the truck cap binds', () => {
    // 4 trucks = 400 units/week from B; the other 600 are made on MA (12 h = 1.5 shifts).
    const plan = solvePlan(highs, twoSites({ trucks: 4 }));
    expect(plan.unmetUnits).toBeCloseTo(0);
    expect(shiftsAt(plan, 'MA')).toBeCloseTo(52 * 1.5);
    expect(plan.lanes[0].weeks.every((w) => w.trucksUsed === 4)).toBe(true);
  });

  it('builds ahead for a peak only as far as storage allows', () => {
    // Week 10 needs 10,000 units; at most 4000 (B) + 2000 (A) = 6000 can be made in it. With ample
    // storage the other 4000 are built earlier. With 100 pallets (1000 units) per pool only 3 × 1000
    // fit (B warehouse, A in-factory, A warehouse), so 1000 go unmet. Trucks (100 × 100 units) never
    // bind here.
    const demand = { '10': 10_000 };
    const yearly = 10_000 + 51 * 1000;
    const roomy = solvePlan(highs, twoSites({ trucks: 100, demand, yearly }));
    expect(roomy.unmetUnits).toBeCloseTo(0);
    const tight = solvePlan(highs, twoSites({ trucks: 100, storage: 100, demand, yearly }));
    expect(tight.unmetUnits).toBeCloseTo(1000);
    for (const pool of tight.storage) expect(Math.max(...pool.pallets)).toBeLessThanOrEqual(100 + 1e-6);
  });

  it('uses initial stock before producing', () => {
    // 3000 units in the A warehouse cover weeks 1–3.
    const plan = solvePlan(highs, twoSites({ trucks: 10, initial: [{ locationId: 'A-WH', productId: 'P', units: 3000 }] }));
    expect(plan.unmetUnits).toBeCloseTo(0);
    expect(shiftsAt(plan, 'MB')).toBeCloseTo(49 * 1.25);
    expect(plan.machineWeekShifts.get('MB')!.slice(0, 3)).toEqual([0, 0, 0]);
  });
});
