// Planning MILP (ADR 0003, 0005, 0007): machine-hours per product × machine × ISO week, a binary
// "runs this week" per product × machine × week that costs a large line clear, stock per storage
// pool, shipments on the truck lanes, pre-SFG consumption, and penalised unmet demand. The goals
// are weighted by the dataset's priorities (R22).
//
// Storage pools: each site has one *local* pool (its storage locations that accept local goods,
// capacities summed) and, if it is the demand site or has locations that accept trucked goods, an
// *inbound* pool. Goods trucked to a site without an inbound pool go into its local pool (so at B,
// pre-SFGs from A share the B warehouse with B's own goods, R47).
//
//   hours[p,m,w] ≥ 0        producing time of machine m on product p in week w
//   run[p,m,w] ∈ {0,1}      m makes p in week w: one large line clear
//   stock[p,k,w] ≥ 0        units of p in pool k at the end of week w
//   ship[p,l,w]  ≥ 0        units of p trucked on lane l in week w (lanes to a non-demand site
//                           carry pre-SFGs only)
//   draw[p,k,w]  ≥ 0        units of p taken from pool k by consumption at its site
//   short[p,w]   ≥ 0        demand of p in week w that is not met
//   U ≥ 0                   the busiest machine's yearly utilisation
//
// Line clears (R23, R28): lots are at most one shift; every lot starts with a small line clear,
// except the first of a run in a week, which starts with a large one. Lots are counted
// continuously (hours ÷ producing hours per lot), so machine time is
//   busy[m,w] = Σ_p (1 + f_m) hours + (large_m − small_m) run,   f_m = small_m ÷ (shift − small_m)
//
//   busy[m,w] ≤ available hours;   hours ≤ max producing hours × run
//   balance:  stock[w-1] + made (local pools) + shipped in − shipped out − draw = stock[w]
//   consumption at site s:  Σ_k∈s draw[p,k,w] (+ short) = demand          (SFGs, demand site)
//                                                        + Σ_{q uses p} made of q at s   (pre-SFGs)
//   Σ_p stock / unitsPerPallet ≤ pool capacity;  Σ_p ship / unitsPerPallet ≤ trucks × pallets/truck
//   Σ_w busy[m,w] ≤ U × available hours of m in the year
//
//   minimise  SHORT·Σ short + balance·U + lineClears·LC/LC₀ + transport·pallets/D
//             + spare·Σ(1+f)hours/H₀ + HOLD·Σ pallet-weeks/D
// Each goal is scaled to about 0–1: LC₀ is one large line clear per machine-week, D the yearly
// demand in pallets, H₀ the estimated machine-hours needed. Unmet demand costs far more than any
// goal; a small holding cost makes production happen just in time.
import { effectiveRate, truckLimit, unitsPerPallet } from '../model/capacity';
import type { CapacityCheck } from '../model/demand';
import { DEFAULT_PRIORITIES } from '../model/seed';
import type { Dataset, Id, Machine, Settings } from '../model/types';
import { isoWeekRange } from '../model/weeks';

const SHORT = 100;
const HOLD = 0.05;
/** Transport always costs a little, so goods are not trucked for nothing. */
const MIN_TRANSPORT = 0.01;


/** Mixed-integer options: stop within 1 % of the optimum, or after the time limit with the best plan found. */
export const MIP_REL_GAP = 0.01;
export const TIME_LIMIT_S = 6;

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
  | { kind: 'run'; productId: Id; machineId: Id; week: number }
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
  binaryCount: number;
  /** Run column → producing hours of one full lot on its machine (the smallest worthwhile run). */
  minRunHours: Map<string, number>;
}

/** Line clear hours of a machine, producing hours per (one-shift) lot, and small-clear overhead per producing hour. */
export function lineClearHours(m: Machine, settings: Settings) {
  const small = m.smallLineClearMin / 60;
  const large = m.largeLineClearMin / 60;
  const perLot = Math.max(1e-6, settings.shiftHours - small);
  return { small, large, perLot, overhead: small / perLot };
}

/** Local pool per site, plus an inbound pool for the demand site and any site with inbound locations. */
export function storagePools(ds: Dataset): StoragePool[] {
  const pool = (siteId: Id, kind: PoolKind): StoragePool => {
    const locations = ds.storageLocations.filter((l) => l.siteId === siteId && l.accepts === kind);
    return { siteId, kind, locationIds: locations.map((l) => l.id), capacityPallets: locations.reduce((a, l) => a + l.capacityPallets, 0) };
  };
  const inboundSites = ds.sites.filter((s) => s.isDemandSite || ds.storageLocations.some((l) => l.siteId === s.id && l.accepts === 'inbound'));
  return [...ds.sites.map((s) => pool(s.id, 'local')), ...inboundSites.map((s) => pool(s.id, 'inbound'))];
}

/** LP names must avoid spaces and operators; ids are user-editable, so index them instead. */
export function buildPlanLp(ds: Dataset, check: CapacityCheck): PlanModel {
  const { weeks, machineHours } = check;
  const year = ds.settings.planningYear;
  const prio = { ...DEFAULT_PRIORITIES, ...ds.settings.priorities };
  const pIdx = new Map(ds.products.map((p, i) => [p.id, i]));
  const mIdx = new Map(ds.machines.map((m, i) => [m.id, i]));
  const products = new Map(ds.products.map((p) => [p.id, p]));
  const siteOf = new Map(ds.machines.map((m) => [m.id, m.siteId]));
  const lc = new Map(ds.machines.map((m) => [m.id, lineClearHours(m, ds.settings)]));
  const caps = ds.capabilities.filter((c) => pIdx.has(c.productId) && mIdx.has(c.machineId) && effectiveRate(c) > 0);
  const demandSite = ds.sites.find((s) => s.isDemandSite)!;
  const isPre = (id: Id) => !!products.get(id)?.isPreSfg;
  const pools = storagePools(ds);
  const poolsAt = (siteId: Id) => pools.flatMap((pl, k) => (pl.siteId === siteId ? [k] : []));
  const localPool = new Map(pools.flatMap((pl, k) => (pl.kind === 'local' ? [[pl.siteId, k] as const] : [])));
  const inboundPool = new Map(pools.flatMap((pl, k) => (pl.kind === 'inbound' ? [[pl.siteId, k] as const] : [])));
  const lanes = ds.truckLanes.filter((l) => l.fromSiteId !== l.toSiteId && localPool.has(l.fromSiteId) && localPool.has(l.toSiteId));
  const laneCarries = (lane: (typeof lanes)[number], productId: Id) => lane.toSiteId === demandSite.id || isPre(productId);
  const intoPool = (siteId: Id) => inboundPool.get(siteId) ?? localPool.get(siteId)!;

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
    if (k === undefined || !pIdx.has(s.productId)) continue;
    const key = `${k}/${s.productId}`;
    initial.set(key, (initial.get(key) ?? 0) + s.units);
  }

  // Who consumes what where: SFG demand at the demand site, pre-SFGs where their SFGs are made.
  const users = new Map<Id, Id[]>(); // pre-SFG → SFGs that use it
  for (const p of ds.products) if (p.preSfgId && p.preSfgId !== p.id && isPre(p.preSfgId)) users.set(p.preSfgId, [...(users.get(p.preSfgId) ?? []), p.id]);
  /** Capabilities whose output consumes the product at the site; `null` if it isn't consumed there. */
  const consumers = (productId: Id, siteId: Id) => {
    if (!isPre(productId)) return siteId === demandSite.id ? [] : null;
    const uses = caps.filter((c) => users.get(productId)?.includes(c.productId) && siteOf.get(c.machineId) === siteId);
    return uses.length ? uses : null;
  };

  // Goal scales (each goal ≈ 0–1).
  const D = Math.max(1, check.products.reduce((a, pc) => a + (isPre(pc.productId) ? 0 : pc.yearlyDemand / unitsPerPallet(products.get(pc.productId)!)), 0));
  const H0 = Math.max(1, check.machines.reduce((a, m) => a + m.neededHours, 0));
  const LC0 = Math.max(1, ds.machines.reduce((a, m) => a + weeks * lc.get(m.id)!.large, 0));
  const wT = Math.max(MIN_TRANSPORT, prio.transport);

  const cols = new Map<string, Col>();
  const objective = new Map<string, number>();
  const cost = (name: string, c: number) => c !== 0 && objective.set(name, (objective.get(name) ?? 0) + c);
  const rows: string[] = [];
  const binaries: string[] = [];
  const minRunHours = new Map<string, number>();
  const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toPrecision(12));
  const h = (p: number, m: number, w: number) => `h_${p}_${m}_${w}`;
  const r = (p: number, m: number, w: number) => `r_${p}_${m}_${w}`;
  const st = (p: number, k: number, w: number) => `s_${p}_${k}_${w}`;
  const sh = (p: number, l: number, w: number) => `x_${p}_${l}_${w}`;
  const dr = (p: number, k: number, w: number) => `d_${p}_${k}_${w}`;
  const un = (p: number, w: number) => `u_${p}_${w}`;
  let drawCols = 0;
  const avail = (machineId: Id, w: number) => machineHours.get(machineId)?.[w - 1] ?? 0;

  for (let w = 1; w <= weeks; w++) {
    for (const c of caps) {
      const [i, j] = [pIdx.get(c.productId)!, mIdx.get(c.machineId)!];
      const l = lc.get(c.machineId)!;
      cols.set(h(i, j, w), { kind: 'hours', productId: c.productId, machineId: c.machineId, week: w });
      cost(h(i, j, w), (prio.spare * (1 + l.overhead)) / H0 + (prio.lineClears * l.overhead) / LC0);
      if (avail(c.machineId, w) > 0) {
        cols.set(r(i, j, w), { kind: 'run', productId: c.productId, machineId: c.machineId, week: w });
        binaries.push(r(i, j, w));
        // A run worth its large line clear, for the warm start (solve.ts): weight ÷ 2 lots (a day at the
        // default 4 … two days at 10), or the whole week if shorter; none without line clears.
        const minLots = l.large > 0 ? prio.lineClears / 2 : 0;
        minRunHours.set(r(i, j, w), Math.min(minLots * l.perLot, avail(c.machineId, w) / (1 + l.overhead)));
        // A tiny cost so a run without production is never chosen.
        cost(r(i, j, w), (prio.lineClears * Math.max(0, l.large - l.small)) / LC0 + 1e-5);
      }
    }
    for (const p of ds.products) {
      const i = pIdx.get(p.id)!;
      const upp = unitsPerPallet(p);
      if (!p.isPreSfg) {
        cols.set(un(i, w), { kind: 'short', productId: p.id, week: w });
        cost(un(i, w), SHORT);
      }
      pools.forEach((_, k) => {
        cols.set(st(i, k, w), { kind: 'stock', productId: p.id, pool: k, week: w });
        cost(st(i, k, w), HOLD / D / upp);
      });
      lanes.forEach((lane, l) => {
        if (!laneCarries(lane, p.id)) return;
        cols.set(sh(i, l, w), { kind: 'ship', productId: p.id, laneId: lane.id, week: w });
        cost(sh(i, l, w), wT / D / upp);
      });
    }
  }
  cost('U', Math.max(prio.balance, 1e-6));

  // Machine capacity, run links and yearly utilisation.
  for (const m of ds.machines) {
    const j = mIdx.get(m.id)!;
    const l = lc.get(m.id)!;
    const mCaps = caps.filter((c) => c.machineId === m.id);
    if (mCaps.length === 0) continue;
    const busyTerms = (w: number) =>
      mCaps.flatMap((c) => {
        const i = pIdx.get(c.productId)!;
        const terms = [`+ ${num(1 + l.overhead)} ${h(i, j, w)}`];
        if (avail(m.id, w) > 0 && l.large > l.small) terms.push(`+ ${num(l.large - l.small)} ${r(i, j, w)}`);
        return terms;
      });
    const yearly: string[] = [];
    for (let w = 1; w <= weeks; w++) {
      const a = avail(m.id, w);
      rows.push(` cap_${j}_${w}: ${busyTerms(w).join(' ')} <= ${num(a)}`);
      yearly.push(...busyTerms(w));
      if (a <= 0) continue;
      for (const c of mCaps) {
        const i = pIdx.get(c.productId)!;
        rows.push(` run_${i}_${j}_${w}: + ${h(i, j, w)} - ${num(a / (1 + l.overhead))} ${r(i, j, w)} <= 0`);
      }
    }
    const availYear = (machineHours.get(m.id) ?? []).reduce((x, y) => x + y, 0);
    if (availYear > 0) rows.push(` util_${j}: ${yearly.join(' ')} - ${num(availYear)} U <= 0`);
  }

  // Stock balances and consumption.
  for (const p of ds.products) {
    const i = pIdx.get(p.id)!;
    const pc = check.products.find((x) => x.productId === p.id);
    const pCaps = caps.filter((c) => c.productId === p.id);
    for (let w = 1; w <= weeks; w++) {
      pools.forEach((pool, k) => {
        // prev + inflow − outflow − draw − stock = 0, with initial stock moved to the right-hand side.
        const terms: string[] = [];
        const rhs = w === 1 ? -(initial.get(`${k}/${p.id}`) ?? 0) : 0;
        if (w > 1) terms.push(`+ ${st(i, k, w - 1)}`);
        if (pool.kind === 'local') {
          for (const c of pCaps) if (siteOf.get(c.machineId) === pool.siteId) terms.push(`+ ${num(effectiveRate(c))} ${h(i, mIdx.get(c.machineId)!, w)}`);
          lanes.forEach((lane, l) => lane.fromSiteId === pool.siteId && laneCarries(lane, p.id) && terms.push(`- ${sh(i, l, w)}`));
        }
        lanes.forEach((lane, l) => intoPool(lane.toSiteId) === k && laneCarries(lane, p.id) && terms.push(`+ ${sh(i, l, w)}`));
        if (consumers(p.id, pool.siteId)) {
          terms.push(`- ${dr(i, k, w)}`);
          drawCols++;
        }
        terms.push(`- ${st(i, k, w)}`);
        rows.push(` bal_${i}_${k}_${w}: ${terms.join(' ')} = ${num(rhs)}`);
      });
      ds.sites.forEach((site, si) => {
        const uses = consumers(p.id, site.id);
        if (!uses) return;
        const terms = poolsAt(site.id).map((k) => `+ ${dr(i, k, w)}`);
        if (!p.isPreSfg) terms.push(`+ ${un(i, w)}`);
        for (const c of uses) terms.push(`- ${num(effectiveRate(c))} ${h(pIdx.get(c.productId)!, mIdx.get(c.machineId)!, w)}`);
        const demand = p.isPreSfg ? 0 : (pc?.weeklyDemand[w - 1] ?? 0);
        rows.push(` use_${i}_${si}_${w}: ${terms.join(' ')} = ${num(demand)}`);
      });
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
    const carried = ds.products.filter((p) => laneCarries(lane, p.id));
    if (carried.length === 0) return;
    for (let w = 1; w <= weeks; w++) {
      const terms = carried.map((p) => `+ ${num(1 / unitsPerPallet(p))} ${sh(pIdx.get(p.id)!, l, w)}`).join(' ');
      rows.push(` truck_${l}_${w}: ${terms} <= ${num(truckLimits.get(lane.id)![w - 1] * lane.palletsPerTruck)}`);
    }
  });

  // Wrap long expressions: the LP reader has a line length limit.
  const wrap = (s: string) => s.replace(/((?:\S+\s+){40})/g, '$1\n  ');
  const obj = [...objective].map(([name, c]) => `+ ${num(c)} ${name}`).join(' ');
  const lp = ['Minimize', ` obj: ${wrap(obj)}`, 'Subject To', ...rows.map(wrap), ...(binaries.length ? ['Binary', ...binaries.map((b) => ` ${b}`)] : []), 'End'].join(
    '\n',
  );
  return { lp, cols, pools, truckLimits, columnCount: cols.size + drawCols + 1, rowCount: rows.length, binaryCount: binaries.length, minRunHours };
}

export interface WeekShifts {
  machineId: Id;
  productId: Id;
  week: number;
  /** Machine time in shifts, line clears included. */
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

/** Line clears of one machine over the year (R31). */
export interface MachineLineClears {
  machineId: Id;
  small: number;
  large: number;
  hours: number;
  /** Large line clears per week (index 0 = week 1). */
  largePerWeek: number[];
}

export interface PlanResult {
  status: string;
  /** Shifts per machine → product → total over the year, line clears included. */
  shifts: { machineId: Id; productId: Id; shifts: number }[];
  /** Shifts per machine per week (index 0 = week 1), summed over products. */
  machineWeekShifts: Map<Id, number[]>;
  /** Shifts per machine, product and week (non-zero only): the weekly machine plan (R42). */
  weekShifts: WeekShifts[];
  lineClears: MachineLineClears[];
  /** Units shipped per lane, product and week (non-zero only): the transport breakdown (R43). */
  shipments: Shipment[];
  /** Per lane, per week (index 0 = week 1). */
  lanes: { laneId: Id; palletsPerTruck: number; weeks: LaneWeek[] }[];
  /** Pallets in each storage pool at the end of each week, total and per product (non-zero products only). */
  storage: (StoragePool & { pallets: number[]; byProduct: { productId: Id; pallets: number[] }[] })[];
  unmetUnits: number;
  /** Unmet units per product and week (non-zero only). */
  unmet: { productId: Id; week: number; units: number }[];
  /** Utilisation of the busiest machine, 0–1. */
  maxUtilisation: number;
  columnCount: number;
  rowCount: number;
  binaryCount: number;
  /** Relative MIP gap of the plan: how far from optimal it may be, at most. */
  mipGap?: number;
  solveMs: number;
}

/** Column values from a HiGHS solution, by name. */
export type ColumnValues = Record<string, number>;

const EPS = 1e-6;

export function readPlan(model: PlanModel, ds: Dataset, weeks: number, status: string, columns: ColumnValues, solveMs: number): PlanResult {
  const products = new Map(ds.products.map((p) => [p.id, p]));
  const lc = new Map(ds.machines.map((m) => [m.id, lineClearHours(m, ds.settings)]));
  const shiftH = ds.settings.shiftHours;
  const totals = new Map<string, number>();
  const machineWeekShifts = new Map<Id, number[]>(ds.machines.map((m) => [m.id, new Array(weeks).fill(0)]));
  const lineClears = new Map<Id, MachineLineClears>(ds.machines.map((m) => [m.id, { machineId: m.id, small: 0, large: 0, hours: 0, largePerWeek: new Array(weeks).fill(0) }]));
  const weekShifts: WeekShifts[] = [];
  const shipments: Shipment[] = [];
  const storage = model.pools.map((pool) => ({ ...pool, pallets: new Array<number>(weeks).fill(0), byProduct: new Map<Id, number[]>() }));
  const lanePallets = new Map<Id, number[]>([...model.truckLimits.keys()].map((id) => [id, new Array(weeks).fill(0)]));
  let unmetUnits = 0;
  const unmet: PlanResult['unmet'] = [];

  for (const [name, col] of model.cols) {
    const v = columns[name] ?? 0;
    if (v < EPS) continue;
    const upp = unitsPerPallet(products.get(col.productId)!);
    switch (col.kind) {
      case 'hours': {
        // Lots of at most one shift: the first starts with a large line clear, the rest with a small
        // one. Machine time matches the MILP (lots counted continuously); counts are whole lots.
        const l = lc.get(col.machineId)!;
        const clearHours = v * l.overhead + Math.max(0, l.large - l.small);
        const shifts = (v + clearHours) / shiftH;
        const mlc = lineClears.get(col.machineId)!;
        mlc.large += 1;
        mlc.largePerWeek[col.week - 1] += 1;
        mlc.small += Math.max(0, Math.ceil(v / l.perLot - 1e-6) - 1);
        mlc.hours += clearHours;
        const key = `${col.machineId}\u0000${col.productId}`;
        totals.set(key, (totals.get(key) ?? 0) + shifts);
        machineWeekShifts.get(col.machineId)![col.week - 1] += shifts;
        weekShifts.push({ machineId: col.machineId, productId: col.productId, week: col.week, shifts });
        break;
      }
      case 'stock': {
        const pool = storage[col.pool];
        pool.pallets[col.week - 1] += v / upp;
        if (!pool.byProduct.has(col.productId)) pool.byProduct.set(col.productId, new Array(weeks).fill(0));
        pool.byProduct.get(col.productId)![col.week - 1] += v / upp;
        break;
      }
      case 'ship':
        shipments.push({ laneId: col.laneId, productId: col.productId, week: col.week, units: v, pallets: v / upp });
        lanePallets.get(col.laneId)![col.week - 1] += v / upp;
        break;
      case 'short':
        unmetUnits += v;
        if (v >= 0.5) unmet.push({ productId: col.productId, week: col.week, units: v });
        break;
      case 'run':
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
  const productOrder = new Map(ds.products.map((p, i) => [p.id, i]));
  return {
    status,
    shifts,
    machineWeekShifts,
    weekShifts,
    lineClears: [...lineClears.values()],
    shipments,
    lanes,
    storage: storage.map((s) => ({
      ...s,
      byProduct: [...s.byProduct]
        .sort(([a], [b]) => productOrder.get(a)! - productOrder.get(b)!)
        .map(([productId, pallets]) => ({ productId, pallets })),
    })),
    unmetUnits,
    unmet,
    maxUtilisation: columns.U ?? 0,
    columnCount: model.columnCount,
    rowCount: model.rowCount,
    binaryCount: model.binaryCount,
    solveMs,
  };
}
