import { combinationName, combinationKey, productName } from './products';
import type { Dataset, Product } from './types';
import { isoWeeksInYear } from './weeks';

const MONTH_DAY = /^\d{2}-\d{2}$/;

/** A real `MM-DD`; `02-29` is allowed (it only takes effect in leap years). */
function isMonthDay(s: string): boolean {
  if (!MONTH_DAY.test(s)) return false;
  const t = Date.parse(`2000-${s}T00:00:00Z`); // NaN for e.g. month 13; toISOString() would throw
  return !Number.isNaN(t) && new Date(t).toISOString().startsWith(`2000-${s}`);
}

/** Returns a list of human-readable problems; empty means the dataset is consistent. */
export function validateDataset(ds: Dataset): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);

  const uniqueIds = (kind: string, items: { id: string }[]) => {
    const seen = new Set<string>();
    for (const { id } of items) {
      if (seen.has(id)) err(`Duplicate ${kind} id "${id}"`);
      seen.add(id);
    }
    return seen;
  };
  const siteIds = uniqueIds('site', ds.sites);
  const machineIds = uniqueIds('machine', ds.machines);
  const productIds = uniqueIds('product', ds.products);
  const locationIds = uniqueIds('storage location', ds.storageLocations);
  uniqueIds('truck lane', ds.truckLanes);

  if (!(Number.isInteger(ds.settings.planningYear) && ds.settings.planningYear >= 2000 && ds.settings.planningYear <= 2100))
    err('Planning year must be a whole year between 2000 and 2100');
  if (!(ds.settings.shiftHours > 0 && ds.settings.shiftHours <= 24)) err('Shift length must be in (0, 24] hours');
  if (!(Number.isInteger(ds.settings.maxCampaignShifts) && ds.settings.maxCampaignShifts >= 1))
    err('Max campaign length must be a whole number of shifts ≥ 1');

  if (ds.sites.filter((s) => s.isDemandSite).length !== 1) err('Exactly one site must be the demand site');
  for (const s of ds.sites) {
    for (const d of s.holidays) if (!isMonthDay(d)) err(`Site ${s.id}: invalid holiday "${d}" (expected MM-DD)`);
  }

  for (const m of ds.machines) {
    if (!siteIds.has(m.siteId)) err(`Machine ${m.id}: unknown site "${m.siteId}"`);
    const { shiftsPerDay, workingWeekdays } = m.calendar;
    if (!(Number.isInteger(shiftsPerDay) && shiftsPerDay >= 1 && shiftsPerDay * ds.settings.shiftHours <= 24))
      err(`Machine ${m.id}: shifts per day must be ≥ 1 and fit in 24 h`);
    if (workingWeekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) err(`Machine ${m.id}: weekdays must be 1–7`);
    for (const [label, min] of [['small', m.smallLineClearMin], ['large', m.largeLineClearMin]] as const) {
      if (!(min >= 0 && min < ds.settings.shiftHours * 60)) err(`Machine ${m.id}: ${label} line clear must be ≥ 0 and shorter than a shift`);
    }
    if (m.smallLineClearMin > m.largeLineClearMin) err(`Machine ${m.id}: small line clear is longer than large`);
    for (const d of m.maintenance) if (!isMonthDay(d)) err(`Machine ${m.id}: invalid maintenance day "${d}" (expected MM-DD)`);
  }

  const charIds = uniqueIds('characteristic', ds.characteristics);
  for (const c of ds.characteristics) {
    if (!c.name.trim()) err(`Characteristic ${c.id}: name is empty`);
    if (c.variants.length === 0) err(`Characteristic ${c.name}: needs at least one variant`);
    const ids = new Set<string>();
    const names = new Set<string>();
    for (const v of c.variants) {
      if (ids.has(v.id)) err(`Characteristic ${c.name}: duplicate variant id "${v.id}"`);
      ids.add(v.id);
      // Names make up product names, so they must be unique and non-empty.
      if (!v.name.trim()) err(`Characteristic ${c.name}: a variant has no name`);
      else if (names.has(v.name)) err(`Characteristic ${c.name}: duplicate variant "${v.name}"`);
      names.add(v.name);
    }
  }

  const byCombination = new Map<string, string>();
  for (const p of ds.products) {
    for (const c of ds.characteristics) {
      if (!c.variants.some((v) => v.id === p.variants[c.id])) err(`Product ${p.id}: no ${c.name} variant chosen`);
    }
    for (const id of Object.keys(p.variants)) if (!charIds.has(id)) err(`Product ${p.id}: unknown characteristic "${id}"`);
    const key = combinationKey(ds.characteristics, p.variants);
    const other = byCombination.get(key);
    if (other) err(`Products ${other} and ${p.id} are both ${combinationName(ds.characteristics, p.variants)}`);
    else byCombination.set(key, p.id);
  }
  const named = new Map<string, Product>();
  for (const p of ds.products) {
    const name = productName(ds, p);
    const other = named.get(name);
    // Two default names are equal only for equal combinations, flagged above.
    if (other && (p.name.trim() || other.name.trim())) err(`Products ${other.id} and ${p.id} are both named "${name}"`);
    else if (!other) named.set(name, p);
  }

  for (const p of ds.products) {
    if (!(Number.isInteger(p.unitsPerCrate) && p.unitsPerCrate > 0)) err(`Product ${p.id}: units per crate must be a positive integer`);
    if (!(Number.isInteger(p.cratesPerPallet) && p.cratesPerPallet > 0)) err(`Product ${p.id}: crates per pallet must be a positive integer`);
  }

  const byId = new Map(ds.products.map((p) => [p.id, p]));
  for (const p of ds.products) {
    if (!p.preSfgId) continue;
    if (p.isPreSfg) err(`Product ${p.id}: a pre-SFG can't use a pre-SFG`);
    else if (!byId.get(p.preSfgId)?.isPreSfg) err(`Product ${p.id}: "${p.preSfgId}" is not a pre-SFG`);
  }

  const pairs = new Set<string>();
  for (const c of ds.capabilities) {
    const key = `${c.machineId}/${c.productId}`;
    if (pairs.has(key)) err(`Duplicate capability ${key}`);
    pairs.add(key);
    if (!machineIds.has(c.machineId)) err(`Capability ${key}: unknown machine`);
    if (!productIds.has(c.productId)) err(`Capability ${key}: unknown product`);
    if (!(c.ratePerHour > 0)) err(`Capability ${key}: rate must be > 0`);
    if (!(c.oeePct > 0 && c.oeePct <= 100)) err(`Capability ${key}: OEE must be in (0, 100] %`);
  }
  for (const p of ds.products) {
    if (!ds.capabilities.some((c) => c.productId === p.id)) err(`Product ${p.id}: no machine can produce it`);
  }

  for (const l of ds.storageLocations) {
    if (!siteIds.has(l.siteId)) err(`Storage ${l.id}: unknown site "${l.siteId}"`);
    if (!(l.capacityPallets >= 0)) err(`Storage ${l.id}: capacity must be ≥ 0`);
  }

  for (const t of ds.truckLanes) {
    if (!siteIds.has(t.fromSiteId) || !siteIds.has(t.toSiteId)) err(`Truck lane ${t.id}: unknown site`);
    if (t.fromSiteId === t.toSiteId) err(`Truck lane ${t.id}: from and to are the same site`);
    if (!(t.maxTrucksPerWeek >= 0)) err(`Truck lane ${t.id}: trucks per week must be ≥ 0`);
    if (!(t.palletsPerTruck > 0)) err(`Truck lane ${t.id}: pallets per truck must be > 0`);
  }

  const weeks = isoWeeksInYear(ds.settings.planningYear);
  const demanded = new Set<string>();
  for (const d of ds.demand) {
    if (demanded.has(d.productId)) err(`Duplicate demand for product ${d.productId}`);
    demanded.add(d.productId);
    if (!productIds.has(d.productId)) err(`Demand: unknown product "${d.productId}"`);
    if (!(d.yearlyUnits >= 0)) err(`Demand ${d.productId}: yearly total must be ≥ 0`);
    const entries = Object.entries(d.weekOverrides);
    for (const [week, units] of entries) {
      const w = Number(week);
      if (!(Number.isInteger(w) && w >= 1 && w <= weeks)) err(`Demand ${d.productId}: week ${week} is not in ${ds.settings.planningYear} (1–${weeks})`);
      if (!(units >= 0)) err(`Demand ${d.productId}: week ${week} must be ≥ 0`);
    }
    const pinned = entries.reduce((sum, [, u]) => sum + u, 0);
    if (pinned > d.yearlyUnits + 1e-6) err(`Demand ${d.productId}: weekly overrides (${pinned}) exceed the yearly total (${d.yearlyUnits})`);
    else if (entries.length >= weeks && Math.abs(pinned - d.yearlyUnits) > 1e-6)
      err(`Demand ${d.productId}: all weeks are set but sum to ${pinned}, not the yearly total ${d.yearlyUnits}`);
  }

  const stocked = new Set<string>();
  const palletsAt = new Map<string, number>();
  const products = new Map(ds.products.map((p) => [p.id, p]));
  for (const s of ds.initialStock) {
    const key = `${s.locationId}/${s.productId}`;
    if (stocked.has(key)) err(`Duplicate initial stock ${key}`);
    stocked.add(key);
    if (!locationIds.has(s.locationId)) err(`Initial stock ${key}: unknown storage location`);
    const p = products.get(s.productId);
    if (!p) err(`Initial stock ${key}: unknown product`);
    if (!(s.units >= 0)) err(`Initial stock ${key}: units must be ≥ 0`);
    else if (p && p.unitsPerCrate > 0 && p.cratesPerPallet > 0)
      palletsAt.set(s.locationId, (palletsAt.get(s.locationId) ?? 0) + s.units / (p.unitsPerCrate * p.cratesPerPallet));
  }
  for (const l of ds.storageLocations) {
    const pallets = palletsAt.get(l.id) ?? 0;
    if (pallets > l.capacityPallets + 1e-6) err(`Storage ${l.id}: initial stock (${Math.ceil(pallets)} pallets) exceeds its capacity (${l.capacityPallets})`);
  }

  return errors;
}
