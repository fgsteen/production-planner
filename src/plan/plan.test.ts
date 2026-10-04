import loadHighs from 'highs';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedDataset } from '../model/seed';
import type { Dataset } from '../model/types';
import type { PlanResult } from './lp';
import { campaignCycles, solvePlan } from './solve';

let highs: Awaited<ReturnType<typeof loadHighs>>;
beforeAll(async () => {
  highs = await loadHighs();
});

// Two machines, one product. M1 makes 100/h, M2 50/h; 40 h/week each (1 × 8 h shift, Mon–Fri).
/** Only "least machine time": the small cases below test the flows, not the trade-offs. */
const SPARE_ONLY = { ...seedDataset.settings, priorities: { balance: 0, lineClears: 0, transport: 0, spare: 1 } };

const tiny = (weeklyDemand: number): Dataset => ({
  ...seedDataset,
  settings: SPARE_ONLY,
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
  characteristics: [],
  products: [{ id: 'P', name: 'P', variants: {}, unitsPerCrate: 1, cratesPerPallet: 1 }],
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
  settings: SPARE_ONLY,
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
  characteristics: [],
  products: [{ id: 'P', name: 'P', variants: {}, unitsPerCrate: 10, cratesPerPallet: 1 }],
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
    expect(['Optimal', 'Time limit reached']).toContain(plan.status);
    expect(plan.unmetUnits).toBeLessThan(1);
    for (const [, weeks] of plan.machineWeekShifts) for (const s of weeks) expect(s).toBeLessThanOrEqual(21 + 1e-6);
    for (const lane of plan.lanes) for (const w of lane.weeks) expect(w.trucksUsed).toBeLessThanOrEqual(w.truckLimit);
    for (const pool of plan.storage) for (const p of pool.pallets) expect(p).toBeLessThanOrEqual(pool.capacityPallets + 1e-6);
    // Pre-SFGs (R47): P22 is made only at A, so it is trucked A → B for P17.
    expect(plan.shipments.some((s) => s.laneId === 'A-B' && s.productId === 'P22')).toBe(true);
  }, 30_000);
});

describe('plan MILP: line clears and priorities', () => {
  // One machine, two products of 1000 units/week each (10 h at 100/h); a large line clear is 4 h.
  const twoProducts = (priorities: Dataset['settings']['priorities']): Dataset => {
    const ds = tiny(0);
    return {
      ...ds,
      settings: { ...ds.settings, priorities },
      machines: [{ ...ds.machines[0], largeLineClearMin: 240 }],
      products: ['P', 'Q'].map((id) => ({ id, name: id, variants: {}, unitsPerCrate: 1, cratesPerPallet: 1 })),
      capabilities: ['P', 'Q'].map((productId) => ({ machineId: 'M1', productId, ratePerHour: 100, oeePct: 100 })),
      demand: ['P', 'Q'].map((productId) => ({ productId, yearlyUnits: 52_000, weekOverrides: {} })),
      storageLocations: [{ id: 'S-L', name: 'S-L', siteId: 'S', capacityPallets: 1e6, accepts: 'local' }],
    };
  };

  it('a large line clear per run takes machine time (R28)', () => {
    const plan = solvePlan(highs, twoProducts({ balance: 0, lineClears: 0, transport: 0, spare: 1 }));
    expect(plan.unmetUnits).toBeCloseTo(0);
    const lc = plan.lineClears.find((l) => l.machineId === 'M1')!;
    expect(lc.large).toBeGreaterThan(0);
    // Planned shifts = producing hours + 4 h per run.
    const shifts = plan.shifts.reduce((a, s) => a + s.shifts, 0);
    expect(shifts * 8).toBeCloseTo(52 * 20 + lc.large * 4, 3);
  });

  it('the line clear weight makes campaigns longer (R22, R31)', () => {
    const weak = solvePlan(highs, twoProducts({ balance: 0, lineClears: 0, transport: 0, spare: 1 }));
    const strong = solvePlan(highs, twoProducts({ balance: 0, lineClears: 10, transport: 0, spare: 1 }), 3);
    const large = (plan: PlanResult) => plan.lineClears.find((l) => l.machineId === 'M1')!.large;
    expect(strong.unmetUnits).toBeCloseTo(0);
    expect(large(strong)).toBeLessThan(large(weak) / 2);
  }, 20_000);

  it('a campaign across weeks pays one large line clear (ADR 0008)', () => {
    const ds = tiny(1000);
    const plan = solvePlan(highs, { ...ds, machines: [{ ...ds.machines[0], largeLineClearMin: 240 }], capabilities: ds.capabilities.slice(0, 1) });
    expect(plan.unmetUnits).toBeCloseTo(0);
    expect(plan.lineClears.find((l) => l.machineId === 'M1')!.large).toBeCloseTo(1);
  });

  it('only one product continues across a week boundary (ADR 0008)', () => {
    // Three products of 9 h every week and no storage: week 1 starts three campaigns, every later week two.
    const ds = twoProducts({ balance: 0, lineClears: 4, transport: 0, spare: 1 });
    const ids = ['P', 'Q', 'R'];
    const plan = solvePlan(highs, {
      ...ds,
      storageLocations: [],
      products: ids.map((id) => ({ id, name: id, variants: {}, unitsPerCrate: 1, cratesPerPallet: 1 })),
      capabilities: ids.map((productId) => ({ machineId: 'M1', productId, ratePerHour: 100, oeePct: 100 })),
      demand: ids.map((productId) => ({ productId, yearlyUnits: 52 * 900, weekOverrides: {} })),
    });
    expect(plan.unmetUnits).toBeCloseTo(0);
    expect(plan.lineClears.find((l) => l.machineId === 'M1')!.large).toBeCloseTo(3 + 51 * 2);
  });

  it('the transport weight moves production to the demand site (R22)', () => {
    const base = twoSites({ trucks: 10 });
    const cheap = solvePlan(highs, base);
    const dear = solvePlan(highs, { ...base, settings: { ...base.settings, priorities: { balance: 0, lineClears: 0, transport: 10, spare: 1 } } });
    expect(shiftsAt(cheap, 'MA')).toBeCloseTo(0);
    expect(shiftsAt(dear, 'MA')).toBeGreaterThan(52);
  });

  it('pre-SFGs are made at A, trucked A → B and consumed 1:1 where their SFG is made (R47, R48)', () => {
    // SFG P is made only at B and uses pre-SFG R, made only at A.
    const base = twoSites({ trucks: 10 });
    const ds: Dataset = {
      ...base,
      products: [
        { id: 'P', name: 'P', variants: {}, unitsPerCrate: 10, cratesPerPallet: 1, preSfgId: 'R' },
        { id: 'R', name: 'R', variants: {}, unitsPerCrate: 10, cratesPerPallet: 1, isPreSfg: true },
      ],
      capabilities: [
        { machineId: 'MB', productId: 'P', ratePerHour: 100, oeePct: 100 },
        { machineId: 'MA', productId: 'R', ratePerHour: 100, oeePct: 100 },
      ],
      truckLanes: [...base.truckLanes, { id: 'AB', fromSiteId: 'A', toSiteId: 'B', maxTrucksPerWeek: 10, palletsPerTruck: 10, runsOnWeekendsAndHolidays: true }],
    };
    const plan = solvePlan(highs, ds);
    expect(plan.unmetUnits).toBeCloseTo(0);
    const shipped = (laneId: string, productId: string) => plan.shipments.filter((s) => s.laneId === laneId && s.productId === productId).reduce((a, s) => a + s.units, 0);
    expect(shipped('AB', 'R')).toBeCloseTo(52_000);
    expect(shipped('BA', 'P')).toBeCloseTo(52_000);
    // Without the A → B lane, P can't be made.
    const noLane = solvePlan(highs, { ...ds, truckLanes: base.truckLanes });
    expect(noLane.unmetUnits).toBeCloseTo(52_000);
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

describe('campaign cycles (warm start)', () => {
  // Pairs P–M and Q–M over 6 weeks; P makes 2 h a week, Q 20 h; a campaign is 8 h.
  const names = [1, 2, 3, 4, 5, 6].flatMap((w) => [`r_0_0_${w}`, `r_1_0_${w}`]);
  const hours = (k: number) => (k % 2 === 0 ? 2 : 20);

  it('runs a small pair every k weeks and leaves a large one alone', () => {
    const allowed = campaignCycles(names, hours, () => 8);
    expect(allowed.filter((_, k) => k % 2 === 0)).toEqual([1, 0, 0, 0, 1, 0]); // k = 8 ÷ 2 = 4
    expect(allowed.filter((_, k) => k % 2 === 1)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('allows everything without line clears', () => {
    expect(campaignCycles(names, hours, () => 0).every((a) => a === 1)).toBe(true);
  });
});
