import { describe, expect, it } from 'vitest';
import type { CapacityCheck } from '../model/demand';
import { seedDataset } from '../model/seed';
import type { Dataset } from '../model/types';
import { findBottlenecks } from './limits';
import type { PlanResult } from './lp';

// Two weeks, 8 h shifts. M1 makes P1 and P2, M2 makes P3. Each product has 1000 units of demand.
const W = 2;
const ds: Dataset = {
  ...seedDataset,
  settings: { ...seedDataset.settings, shiftHours: 8 },
  machines: ['M1', 'M2'].map((id) => ({ ...seedDataset.machines[0], id, name: id })),
  products: ['P1', 'P2', 'P3'].map((id) => ({ id, name: id, variants: {}, unitsPerCrate: 1, cratesPerPallet: 1 })),
  capabilities: [
    { machineId: 'M1', productId: 'P1', ratePerHour: 10, oeePct: 100 },
    { machineId: 'M1', productId: 'P2', ratePerHour: 10, oeePct: 100 },
    { machineId: 'M2', productId: 'P3', ratePerHour: 10, oeePct: 100 },
  ],
};
const check: CapacityCheck = {
  weeks: W,
  machineHours: new Map([
    ['M1', [40, 40]],
    ['M2', [40, 40]],
  ]),
  products: ['P1', 'P2', 'P3'].map((productId) => ({
    productId,
    yearlyDemand: 1000,
    maxYearlyOutput: 800,
    weeklyDemand: [500, 500],
    weeklyMax: [400, 400],
    overWeeks: [],
    shortfall: 0,
  })),
  machines: [],
};
const plan = (over: Partial<PlanResult>): PlanResult => ({
  status: 'Optimal',
  shifts: [],
  machineWeekShifts: new Map([
    ['M1', [5, 5]],
    ['M2', [2, 2]],
  ]),
  weekShifts: [],
  lineClears: [],
  shipments: [],
  lanes: [],
  storage: [],
  unmetUnits: 0,
  unmet: [],
  maxUtilisation: 1,
  columnCount: 0,
  rowCount: 0,
  binaryCount: 0,
  solveMs: 0,
  ...over,
});

describe('findBottlenecks', () => {
  it('lists a full machine with the short products it can make, worst first', () => {
    const list = findBottlenecks(ds, plan({ unmet: [{ productId: 'P1', week: 1, units: 100 }, { productId: 'P2', week: 2, units: 300 }] }), check);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ kind: 'machine', id: 'M1', weeksFull: 2, weeks: 2, unmetUnits: 400 });
    expect(list[0].short.map((s) => [s.productId, s.share])).toEqual([
      ['P2', 0.3],
      ['P1', 0.1],
    ]);
  });

  it('ranks by unmet units, then by weeks full; limits with no unmet demand come after', () => {
    const list = findBottlenecks(
      ds,
      plan({
        machineWeekShifts: new Map([
          ['M1', [5, 4]],
          ['M2', [5, 5]],
        ]),
        unmet: [{ productId: 'P1', week: 1, units: 200 }],
        lanes: [{ laneId: 'L', palletsPerTruck: 20, weeks: [{ pallets: 40, trucksUsed: 2, truckLimit: 2 }, { pallets: 0, trucksUsed: 0, truckLimit: 2 }] }],
      }),
      check,
    );
    expect(list.map((b) => [b.kind, b.id, b.weeksFull, b.unmetUnits])).toEqual([
      ['machine', 'M1', 1, 200],
      ['machine', 'M2', 2, 0],
      ['lane', 'L', 1, 0],
    ]);
  });

  it('counts a pool as full at capacity and links the products it holds then', () => {
    const list = findBottlenecks(
      ds,
      plan({
        machineWeekShifts: new Map(),
        unmet: [{ productId: 'P3', week: 2, units: 50 }],
        storage: [
          {
            siteId: 'A',
            kind: 'inbound',
            locationIds: ['WA'],
            capacityPallets: 10,
            pallets: [10, 3],
            byProduct: [
              { productId: 'P3', pallets: [10, 0] },
              { productId: 'P1', pallets: [0, 3] },
            ],
          },
        ],
      }),
      check,
    );
    expect(list[0]).toMatchObject({ kind: 'storage', id: 'A/inbound', weeksFull: 1, unmetUnits: 50 });
    expect(list[0].short.map((s) => s.productId)).toEqual(['P3']);
  });

  it('lists a short product that no limit explains, with the machines that can make it', () => {
    const list = findBottlenecks(ds, plan({ machineWeekShifts: new Map(), unmet: [{ productId: 'P3', week: 1, units: 10 }] }), check);
    expect(list).toEqual([{ kind: 'product', id: 'P3', machineIds: ['M2'], weeksFull: 0, weeks: 2, short: [{ productId: 'P3', units: 10, share: 0.01 }], unmetUnits: 10 }]);
  });

  it('ignores tiny shortfalls and machines just below full', () => {
    const list = findBottlenecks(
      ds,
      plan({
        machineWeekShifts: new Map([['M1', [4.9, 4.9]]]),
        unmet: [{ productId: 'P1', week: 1, units: 4 }],
      }),
      check,
    );
    expect(list).toEqual([]);
  });
});
