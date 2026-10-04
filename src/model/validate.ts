import type { Dataset } from './types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(s: string): boolean {
  return ISO_DATE.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
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
  uniqueIds('storage location', ds.storageLocations);
  uniqueIds('truck lane', ds.truckLanes);

  if (!(ds.settings.shiftHours > 0 && ds.settings.shiftHours <= 24)) err('Shift length must be in (0, 24] hours');
  if (!(Number.isInteger(ds.settings.maxCampaignShifts) && ds.settings.maxCampaignShifts >= 1))
    err('Max campaign length must be a whole number of shifts ≥ 1');

  if (ds.sites.filter((s) => s.isDemandSite).length !== 1) err('Exactly one site must be the demand site');
  for (const s of ds.sites) {
    for (const d of s.holidays) if (!isIsoDate(d)) err(`Site ${s.id}: invalid holiday date "${d}"`);
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
    for (const d of m.maintenance) if (!isIsoDate(d)) err(`Machine ${m.id}: invalid maintenance date "${d}"`);
  }

  for (const p of ds.products) {
    if (!(Number.isInteger(p.unitsPerCrate) && p.unitsPerCrate > 0)) err(`Product ${p.id}: units per crate must be a positive integer`);
    if (!(Number.isInteger(p.cratesPerPallet) && p.cratesPerPallet > 0)) err(`Product ${p.id}: crates per pallet must be a positive integer`);
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

  return errors;
}
