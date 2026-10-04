// What limits the plan (R39): machines, storage pools and truck lanes at their limit, ranked by
// the unmet demand they leave, read straight from a PlanResult (no extra solve).
import type { CapacityCheck } from '../model/demand';
import type { Dataset, Id } from '../model/types';
import type { PlanResult } from './lp';

/** A limit counts as reached from this share of its capacity on. */
export const FULL = 0.995;
/** Products short by less than this share of their yearly demand don't count as short. */
const MIN_SHORT = 0.005;

export interface ShortProduct {
  productId: Id;
  units: number;
  /** Share of the product's yearly demand left unmet, 0–1. */
  share: number;
}

export type Bottleneck =
  | { kind: 'machine'; id: Id; weeksFull: number; weeks: number; short: ShortProduct[]; unmetUnits: number }
  | { kind: 'storage'; id: Id; weeksFull: number; weeks: number; short: ShortProduct[]; unmetUnits: number }
  | { kind: 'lane'; id: Id; weeksFull: number; weeks: number; short: ShortProduct[]; unmetUnits: number }
  /** A short product that no machine, pool or lane above explains: it lists the machines that can make it. */
  | { kind: 'product'; id: Id; machineIds: Id[]; weeksFull: 0; weeks: number; short: ShortProduct[]; unmetUnits: number };

/** Storage pool id: site and kind, e.g. `A/inbound`. */
export const poolId = (pool: Pick<PlanResult['storage'][number], 'siteId' | 'kind'>) => `${pool.siteId}/${pool.kind}`;

/** "B warehouse", or "A warehouse (inbound)" style names for each pool. */
export function poolName(dataset: Dataset, pool: PlanResult['storage'][number]): string {
  const names = pool.locationIds.map((id) => dataset.storageLocations.find((l) => l.id === id)?.name ?? id);
  const site = dataset.sites.find((s) => s.id === pool.siteId)?.name ?? pool.siteId;
  return names.length ? names.join(' + ') : `${site} ${pool.kind} (no storage)`;
}

/**
 * Ranks the limits of a plan: first by the unmet units of the short products they touch, then by
 * the weeks they bind. A machine touches the products it can make; a pool the products it holds in
 * a full week; a lane the products it ships. Short products that none of these touch come last.
 */
export function findBottlenecks(dataset: Dataset, plan: PlanResult, check: CapacityCheck): Bottleneck[] {
  const weeks = check.weeks;
  const unmetBy = new Map<Id, number>();
  for (const u of plan.unmet) unmetBy.set(u.productId, (unmetBy.get(u.productId) ?? 0) + u.units);
  const shortBy = new Map<Id, ShortProduct>();
  const preSfg = new Set(dataset.products.filter((p) => p.isPreSfg).map((p) => p.id));
  for (const pc of check.products) {
    if (preSfg.has(pc.productId)) continue;
    const units = unmetBy.get(pc.productId) ?? 0;
    const share = pc.yearlyDemand > 0 ? units / pc.yearlyDemand : 0;
    if (share >= MIN_SHORT) shortBy.set(pc.productId, { productId: pc.productId, units, share });
  }
  const shortOf = (ids: Iterable<Id>): ShortProduct[] =>
    [...new Set(ids)]
      .flatMap((id) => shortBy.get(id) ?? [])
      .sort((a, b) => b.share - a.share || b.units - a.units);
  const sum = (s: ShortProduct[]) => s.reduce((a, p) => a + p.units, 0);
  const out: Bottleneck[] = [];

  for (const m of dataset.machines) {
    const available = check.machineHours.get(m.id) ?? [];
    const used = plan.machineWeekShifts.get(m.id) ?? [];
    const weeksFull = available.filter((h, w) => h > 0 && (used[w] ?? 0) * dataset.settings.shiftHours >= FULL * h).length;
    if (!weeksFull) continue;
    const short = shortOf(dataset.capabilities.filter((c) => c.machineId === m.id).map((c) => c.productId));
    out.push({ kind: 'machine', id: m.id, weeksFull, weeks, short, unmetUnits: sum(short) });
  }

  for (const pool of plan.storage) {
    if (!pool.locationIds.length || pool.capacityPallets <= 0) continue;
    const full = pool.pallets.flatMap((p, w) => (p >= FULL * pool.capacityPallets ? [w] : []));
    if (!full.length) continue;
    const held = pool.byProduct.filter((b) => full.some((w) => b.pallets[w] > 0)).map((b) => b.productId);
    const short = shortOf(held);
    out.push({ kind: 'storage', id: poolId(pool), weeksFull: full.length, weeks, short, unmetUnits: sum(short) });
  }

  for (const lane of plan.lanes) {
    const weeksFull = lane.weeks.filter((w) => w.truckLimit > 0 && w.trucksUsed >= w.truckLimit).length;
    if (!weeksFull) continue;
    const short = shortOf(plan.shipments.filter((s) => s.laneId === lane.laneId).map((s) => s.productId));
    out.push({ kind: 'lane', id: lane.laneId, weeksFull, weeks, short, unmetUnits: sum(short) });
  }

  const explained = new Set(out.flatMap((b) => b.short.map((s) => s.productId)));
  for (const s of shortBy.values()) {
    if (explained.has(s.productId)) continue;
    const machineIds = dataset.capabilities.filter((c) => c.productId === s.productId).map((c) => c.machineId);
    out.push({ kind: 'product', id: s.productId, machineIds, weeksFull: 0, weeks, short: [s], unmetUnits: s.units });
  }

  const order = { machine: 0, storage: 1, lane: 2, product: 3 };
  return out.sort(
    (a, b) =>
      Number(a.kind === 'product') - Number(b.kind === 'product') ||
      b.unmetUnits - a.unmetUnits ||
      b.weeksFull - a.weeksFull ||
      order[a.kind] - order[b.kind],
  );
}
