// Planning LP (ADR 0003): continuous machine-hours per product × machine × ISO week, stock per
// storage pool, shipments B → A on the truck lane, and penalised unmet demand. No line clears or
// priority weights yet.
//
// Storage pools: each site has one *local* pool (its storage locations that accept local goods,
// capacities summed); the demand site also has an *inbound* pool (locations that accept trucked
// goods). Products are interchangeable within a pool, so pooling loses nothing in a continuous LP.
//
//   hours[p,m,w] ≥ 0        time machine m spends on product p in week w
//   local[p,s,w] ≥ 0        units of p in site s's local pool at the end of week w
//   inbound[p,w] ≥ 0        units of p in the demand site's inbound pool at the end of week w
//   ship[p,k,w]  ≥ 0        units of p trucked on lane k (to the demand site) in week w
//   drawL/drawI[p,w] ≥ 0    units of p taken from the demand site's local / inbound pool
//   short[p,w]   ≥ 0        demand of p in week w that is not met
//
//   Σ_p hours[p,m,w] ≤ available hours of m in w
//   site s ≠ demand:  local[p,s,w-1] + made at s − Σ_k from s ship[p,k,w] = local[p,s,w]
//   demand site:      local[p,D,w-1] + made at D − drawL[p,w]             = local[p,D,w]
//                     inbound[p,w-1] + Σ_k ship[p,k,w] − drawI[p,w]       = inbound[p,w]
//                     drawL[p,w] + drawI[p,w] + short[p,w]                 = demand[p,w]
//   Σ_p stock[p,·,w] / unitsPerPallet(p) ≤ pool capacity (pallets)
//   Σ_p ship[p,k,w] / unitsPerPallet(p)  ≤ truck limit(k,w) × pallets per truck
//
//   minimise  SHORT · Σ short + HOLD · Σ stock + SHIP · Σ ship + Σ hours
//
// Unmet demand costs far more than anything else; holding stock costs a little so production
// happens just in time; shipping costs a tiny bit so goods are not trucked for nothing; machine-hours
// cost 1 so faster machines are preferred. Week 0 stock is the initial stock (a constant).
import { effectiveRate, truckLimit, unitsPerPallet } from '../model/capacity';
import type { CapacityCheck } from '../model/demand';
import type { Dataset, Id } from '../model/types';
import { isoWeekRange } from '../model/weeks';

const SHORT = 1000;
const HOLD = 0.001;
const SHIP = 0.0001;

export type PoolKind = 'local' | 'inbound';

export interface StoragePool {
  siteId: Id;
  kind: PoolKind;
  /** Storage locations pooled together. */
  locationIds: Id[];
  capacityPallets: number;
}

type Col =
  | { kind: 'hours'; productId: Id; machineId: Id; week: number }
  | { kind: 'stock'; productId: Id; pool: number; week: number }
  | { kind: 'ship'; productId: Id; laneId: Id; week: number }
  | { kind: 'short'; productId: Id; week: number };

export interface PlanModel {
  lp: string;
  /** Column name → what it is, for reading the solution back (draw columns are not listed). */
  cols: Map<string, Col>;
  pools: StoragePool[];
  /** Truck limit per lane per week (index 0 = week 1). */
  truckLimits: Map<Id, number[]>;
  columnCount: number;
  rowCount: number;
}

/** Local pool per site, plus the demand site's inbound pool. */
export function storagePools(ds: Dataset): StoragePool[] {
  const demandSite = ds.sites.find((s) => s.isDemandSite);
  const pool = (siteId: Id, kind: PoolKind): StoragePool => {
    const locations = ds.storageLocations.filter((l) => l.siteId === siteId && l.accepts === kind);
    return { siteId, kind, locationIds: locations.map((l) => l.id), capacityPallets: locations.reduce((a, l) => a + l.capacityPallets, 0) };
  };
  return [...ds.sites.map((s) => pool(s.id, 'local')), ...(demandSite ? [pool(demandSite.id, 'inbound')] : [])];
}

/** LP names must avoid spaces and operators; ids are user-editable, so index them instead. */
export function buildPlanLp(ds: Dataset, check: CapacityCheck): PlanModel {
  const { weeks, machineHours } = check;
  const year = ds.settings.planningYear;
  const pIdx = new Map(ds.products.map((p, i) => [p.id, i]));
  const mIdx = new Map(ds.machines.map((m, i) => [m.id, i]));
  const siteOf = new Map(ds.machines.map((m) => [m.id, m.siteId]));
  const caps = ds.capabilities.filter((c) => pIdx.has(c.productId) && mIdx.has(c.machineId) && effectiveRate(c) > 0);
  const demandSite = ds.sites.find((s) => s.isDemandSite)!;
  const pools = storagePools(ds);
  const localPool = new Map(pools.flatMap((pl, k) => (pl.kind === 'local' ? [[pl.siteId, k] as const] : [])));
  const lanes = ds.truckLanes.filter((l) => l.toSiteId === demandSite.id && l.fromSiteId !== demandSite.id && localPool.has(l.fromSiteId));

  const truckLimits = new Map(
    lanes.map((l) => [
      l.id,
      Array.from({ length: weeks }, (_, i) => {
        const { from, to } = isoWeekRange(year, i + 1);
        return truckLimit(l, ds.sites, from, to);
      }),
    ]),
  );

  // Initial stock per pool and product.
  const initial = new Map<string, number>();
  const poolOfLocation = new Map(pools.flatMap((pl, k) => pl.locationIds.map((id) => [id, k] as const)));
  for (const s of ds.initialStock) {
    const k = poolOfLocation.get(s.locationId);
    if (k === undefined || !pIdx.has(s.productId)) continue; // e.g. an inbound location at site B: nothing flows there
    const key = `${k}/${s.productId}`;
    initial.set(key, (initial.get(key) ?? 0) + s.units);
  }

  const cols = new Map<string, Col>();
  const objective: string[] = [];
  const rows: string[] = [];
  const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toPrecision(12));
  const h = (p: number, m: number, w: number) => `h_${p}_${m}_${w}`;
  const st = (p: number, k: number, w: number) => `s_${p}_${k}_${w}`;
  const sh = (p: number, l: number, w: number) => `x_${p}_${l}_${w}`;
  const dr = (p: number, k: number, w: number) => `d_${p}_${k}_${w}`;
  const un = (p: number, w: number) => `u_${p}_${w}`;
  let drawCols = 0;

  for (let w = 1; w <= weeks; w++) {
    for (const c of caps) {
      const name = h(pIdx.get(c.productId)!, mIdx.get(c.machineId)!, w);
      cols.set(name, { kind: 'hours', productId: c.productId, machineId: c.machineId, week: w });
      objective.push(`+ ${name}`);
    }
    for (const p of ds.products) {
      const i = pIdx.get(p.id)!;
      cols.set(un(i, w), { kind: 'short', productId: p.id, week: w });
      objective.push(`+ ${SHORT} ${un(i, w)}`);
      pools.forEach((_, k) => {
        cols.set(st(i, k, w), { kind: 'stock', productId: p.id, pool: k, week: w });
        objective.push(`+ ${HOLD} ${st(i, k, w)}`);
      });
      lanes.forEach((lane, l) => {
        cols.set(sh(i, l, w), { kind: 'ship', productId: p.id, laneId: lane.id, week: w });
        objective.push(`+ ${SHIP} ${sh(i, l, w)}`);
      });
    }
  }

  // Machine capacity.
  for (const m of ds.machines) {
    const j = mIdx.get(m.id)!;
    const mCaps = caps.filter((c) => c.machineId === m.id);
    if (mCaps.length === 0) continue;
    for (let w = 1; w <= weeks; w++) {
      const terms = mCaps.map((c) => `+ ${h(pIdx.get(c.productId)!, j, w)}`).join(' ');
      rows.push(` cap_${j}_${w}: ${terms} <= ${num(machineHours.get(m.id)?.[w - 1] ?? 0)}`);
    }
  }

  // Stock balances and demand.
  for (const pc of check.products) {
    const i = pIdx.get(pc.productId)!;
    const pCaps = caps.filter((c) => c.productId === pc.productId);
    for (let w = 1; w <= weeks; w++) {
      pools.forEach((pool, k) => {
        // prev + inflow − outflow − stock = 0, with initial stock moved to the right-hand side.
        const terms: string[] = [];
        const rhs = w === 1 ? -(initial.get(`${k}/${pc.productId}`) ?? 0) : 0;
        if (w > 1) terms.push(`+ ${st(i, k, w - 1)}`);
        if (pool.kind === 'local') {
          for (const c of pCaps) if (siteOf.get(c.machineId) === pool.siteId) terms.push(`+ ${num(effectiveRate(c))} ${h(i, mIdx.get(c.machineId)!, w)}`);
          lanes.forEach((lane, l) => lane.fromSiteId === pool.siteId && terms.push(`- ${sh(i, l, w)}`));
        } else {
          lanes.forEach((_, l) => terms.push(`+ ${sh(i, l, w)}`));
        }
        if (pool.siteId === demandSite.id) {
          terms.push(`- ${dr(i, k, w)}`);
          drawCols++;
        }
        terms.push(`- ${st(i, k, w)}`);
        rows.push(` bal_${i}_${k}_${w}: ${terms.join(' ')} = ${num(rhs)}`);
      });
      const draws = pools.flatMap((pool, k) => (pool.siteId === demandSite.id ? [`+ ${dr(i, k, w)}`] : [])).join(' ');
      rows.push(` dem_${i}_${w}: ${draws} + ${un(i, w)} = ${num(pc.weeklyDemand[w - 1])}`);
    }
  }

  // Storage capacity in pallets.
  pools.forEach((pool, k) => {
    for (let w = 1; w <= weeks; w++) {
      const terms = ds.products.map((p) => `+ ${num(1 / unitsPerPallet(p))} ${st(pIdx.get(p.id)!, k, w)}`).join(' ');
      rows.push(` stor_${k}_${w}: ${terms} <= ${num(pool.capacityPallets)}`);
    }
  });

  // Trucks: pallets shipped per week.
  lanes.forEach((lane, l) => {
    for (let w = 1; w <= weeks; w++) {
      const terms = ds.products.map((p) => `+ ${num(1 / unitsPerPallet(p))} ${sh(pIdx.get(p.id)!, l, w)}`).join(' ');
      rows.push(` truck_${l}_${w}: ${terms} <= ${num(truckLimits.get(lane.id)![w - 1] * lane.palletsPerTruck)}`);
    }
  });

  // Wrap long expressions: the LP reader has a line length limit.
  const wrap = (s: string) => s.replace(/((?:\S+\s+){40})/g, '$1\n  ');
  const lp = ['Minimize', ` obj: ${wrap(objective.join(' '))}`, 'Subject To', ...rows.map(wrap), 'End'].join('\n');
  return { lp, cols, pools, truckLimits, columnCount: cols.size + drawCols, rowCount: rows.length };
}

export interface WeekShifts {
  machineId: Id;
  productId: Id;
  week: number;
  shifts: number;
}

export interface Shipment {
  laneId: Id;
  productId: Id;
  week: number;
  units: number;
  pallets: number;
}

export interface LaneWeek {
  pallets: number;
  /** Whole trucks needed for the pallets shipped. */
  trucksUsed: number;
  truckLimit: number;
}

export interface PlanResult {
  status: string;
  /** Shifts per machine → product → total over the year. */
  shifts: { machineId: Id; productId: Id; shifts: number }[];
  /** Shifts per machine per week (index 0 = week 1), summed over products. */
  machineWeekShifts: Map<Id, number[]>;
  /** Shifts per machine, product and week (non-zero only): the weekly machine plan (R42). */
  weekShifts: WeekShifts[];
  /** Units shipped per lane, product and week (non-zero only): the transport breakdown (R43). */
  shipments: Shipment[];
  /** Per lane, per week (index 0 = week 1). */
  lanes: { laneId: Id; palletsPerTruck: number; weeks: LaneWeek[] }[];
  /** Pallets in each storage pool at the end of each week, vs its capacity. */
  storage: (StoragePool & { pallets: number[] })[];
  unmetUnits: number;
  columnCount: number;
  rowCount: number;
  solveMs: number;
}

/** Column values from a HiGHS solution, by name. */
export type ColumnValues = Record<string, number>;

const EPS = 1e-6;

export function readPlan(model: PlanModel, ds: Dataset, weeks: number, status: string, columns: ColumnValues, solveMs: number): PlanResult {
  const products = new Map(ds.products.map((p) => [p.id, p]));
  const totals = new Map<string, number>();
  const machineWeekShifts = new Map<Id, number[]>(ds.machines.map((m) => [m.id, new Array(weeks).fill(0)]));
  const weekShifts: WeekShifts[] = [];
  const shipments: Shipment[] = [];
  const storage = model.pools.map((pool) => ({ ...pool, pallets: new Array<number>(weeks).fill(0) }));
  const lanePallets = new Map<Id, number[]>([...model.truckLimits.keys()].map((id) => [id, new Array(weeks).fill(0)]));
  let unmetUnits = 0;

  for (const [name, col] of model.cols) {
    const v = columns[name] ?? 0;
    if (v < EPS) continue;
    const upp = unitsPerPallet(products.get(col.productId)!);
    switch (col.kind) {
      case 'hours': {
        const shifts = v / ds.settings.shiftHours;
        const key = `${col.machineId}\u0000${col.productId}`;
        totals.set(key, (totals.get(key) ?? 0) + shifts);
        machineWeekShifts.get(col.machineId)![col.week - 1] += shifts;
        weekShifts.push({ machineId: col.machineId, productId: col.productId, week: col.week, shifts });
        break;
      }
      case 'stock':
        storage[col.pool].pallets[col.week - 1] += v / upp;
        break;
      case 'ship':
        shipments.push({ laneId: col.laneId, productId: col.productId, week: col.week, units: v, pallets: v / upp });
        lanePallets.get(col.laneId)![col.week - 1] += v / upp;
        break;
      case 'short':
        unmetUnits += v;
        break;
    }
  }

  const lanes = ds.truckLanes.flatMap((lane) => {
    const pallets = lanePallets.get(lane.id);
    if (!pallets) return [];
    const limits = model.truckLimits.get(lane.id)!;
    const weekly = pallets.map((p, i): LaneWeek => ({ pallets: p, trucksUsed: Math.ceil(p / lane.palletsPerTruck - EPS), truckLimit: limits[i] }));
    return [{ laneId: lane.id, palletsPerTruck: lane.palletsPerTruck, weeks: weekly }];
  });
  const shifts = [...totals].map(([key, s]) => {
    const [machineId, productId] = key.split('\u0000');
    return { machineId, productId, shifts: s };
  });
  return { status, shifts, machineWeekShifts, weekShifts, shipments, lanes, storage, unmetUnits, columnCount: model.columnCount, rowCount: model.rowCount, solveMs };
}
