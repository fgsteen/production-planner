import { WINDOW_SHIFTS } from './capacity';
import { combinationName, combinationKey, productName } from './products';
import type { Dataset, Product } from './types';

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
  const machineIds = uniqueIds('machine', ds.machines);
  const productIds = uniqueIds('product', ds.products);

  if (!(ds.settings.shiftHours > 0 && ds.settings.shiftHours <= 24)) err('Shift length must be in (0, 24] hours');

  for (const m of ds.machines) {
    for (const [label, min] of [['small', m.smallLineClearMin], ['large', m.largeLineClearMin]] as const) {
      if (!(min >= 0 && min < ds.settings.shiftHours * 60)) err(`Machine ${m.id}: ${label} line clear must be ≥ 0 and shorter than a shift`);
    }
    if (m.smallLineClearMin > m.largeLineClearMin) err(`Machine ${m.id}: small line clear is longer than large`);
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
    for (const key of ['min', 'max', 'initialStock', 'usagePerShift'] as const) {
      if (!(Number.isFinite(p[key]) && p[key] >= 0)) err(`Product ${p.id}: ${LABELS[key]} must be ≥ 0`);
    }
    if (p.min > p.max) err(`Product ${p.id}: min is above max`);
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

  const slots = new Set<string>();
  for (const r of ds.schedule) {
    const at = `${r.machineId} shift ${r.shift + 1}`;
    if (!(Number.isInteger(r.shift) && r.shift >= 0 && r.shift < WINDOW_SHIFTS)) err(`Schedule: shift ${r.shift + 1} is outside 1–${WINDOW_SHIFTS}`);
    if (slots.has(at)) err(`Schedule: ${at} has two runs`);
    slots.add(at);
    if (!machineIds.has(r.machineId)) err(`Schedule ${at}: unknown machine`);
    else if (!productIds.has(r.productId)) err(`Schedule ${at}: unknown product "${r.productId}"`);
    else if (!pairs.has(`${r.machineId}/${r.productId}`)) err(`Schedule ${at}: ${r.machineId} can't make ${r.productId}`);
  }

  return errors;
}

const LABELS = { min: 'min', max: 'max', initialStock: 'initial stock', usagePerShift: 'usage per shift' };
