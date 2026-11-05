// Dataset store: a pure reducer plus JSON (de)serialisation. React wiring lives in DatasetContext.tsx.
import { firstFreeCombination } from '../model/products';
import { seedDataset } from '../model/seed';
import type { Capability, Characteristic, Dataset, Id, Machine, Product, Settings } from '../model/types';

export type DatasetAction =
  | { type: 'replace'; dataset: Dataset }
  | { type: 'reset' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'renameCharacteristic'; id: Id; name: string }
  | { type: 'addVariant'; characteristicId: Id }
  | { type: 'renameVariant'; characteristicId: Id; variantId: Id; name: string }
  /** Ignored while a product uses the variant. */
  | { type: 'removeVariant'; characteristicId: Id; variantId: Id }
  | { type: 'updateMachine'; id: Id; patch: Partial<Omit<Machine, 'id'>> }
  | { type: 'addMachine' }
  | { type: 'removeMachine'; id: Id }
  | { type: 'updateProduct'; id: Id; patch: Partial<Omit<Product, 'id'>> }
  | { type: 'addProduct' }
  | { type: 'removeProduct'; id: Id }
  | { type: 'updateCapability'; machineId: Id; productId: Id; patch: Partial<Capability> }
  | { type: 'addCapability'; machineId: Id; productId: Id }
  | { type: 'removeCapability'; machineId: Id; productId: Id }
  /** `productId: null` empties the slot. */
  | { type: 'setRun'; machineId: Id; shift: number; productId: Id | null };

/** Next free id of the form `<prefix><n>`, zero-padded to `width`. */
export function nextId(prefix: string, taken: Iterable<Id>, width = 2): Id {
  const used = new Set(taken);
  for (let n = 1; ; n++) {
    const id = `${prefix}${String(n).padStart(width, '0')}`;
    if (!used.has(id)) return id;
  }
}

/** Applies `patch` to the item with `id`. */
function patchById<T extends { id: Id }>(items: T[], id: Id, patch: NoInfer<Partial<Omit<T, 'id'>>>): T[] {
  return items.map((x) => (x.id === id ? { ...x, ...patch } : x));
}

/** Most variants per characteristic (R17). */
export const MAX_VARIANTS = 8;

/** Applies `fn` to the characteristic with `id`. */
function patchCharacteristic(ds: Dataset, id: Id, fn: (c: Characteristic) => Characteristic): Dataset {
  return { ...ds, characteristics: ds.characteristics.map((c) => (c.id === id ? fn(c) : c)) };
}

const isCap = (machineId: Id, productId: Id) => (c: Capability) => c.machineId === machineId && c.productId === productId;

export function datasetReducer(ds: Dataset, action: DatasetAction): Dataset {
  switch (action.type) {
    case 'replace':
      return action.dataset;
    case 'reset':
      return seedDataset;

    case 'updateSettings':
      return { ...ds, settings: { ...ds.settings, ...action.patch } };

    case 'renameCharacteristic':
      return patchCharacteristic(ds, action.id, (c) => ({ ...c, name: action.name }));
    case 'addVariant':
      return patchCharacteristic(ds, action.characteristicId, (c) => {
        if (c.variants.length >= MAX_VARIANTS) return c;
        const id = nextId(c.id, c.variants.map((v) => v.id), 1);
        return { ...c, variants: [...c.variants, { id, name: `New ${id}` }] };
      });
    case 'renameVariant':
      return patchCharacteristic(ds, action.characteristicId, (c) => ({
        ...c,
        variants: c.variants.map((v) => (v.id === action.variantId ? { ...v, name: action.name } : v)),
      }));
    case 'removeVariant':
      if (ds.products.some((p) => p.variants[action.characteristicId] === action.variantId)) return ds;
      return patchCharacteristic(ds, action.characteristicId, (c) => ({ ...c, variants: c.variants.filter((v) => v.id !== action.variantId) }));

    case 'updateMachine':
      return { ...ds, machines: patchById(ds.machines, action.id, action.patch) };
    case 'addMachine': {
      const id = nextId('M', ds.machines.map((m) => m.id), 1);
      const machine: Machine = { id, name: `Machine ${id}`, smallLineClearMin: 20, largeLineClearMin: 90 };
      return { ...ds, machines: [...ds.machines, machine] };
    }
    case 'removeMachine':
      return {
        ...ds,
        machines: ds.machines.filter((m) => m.id !== action.id),
        capabilities: ds.capabilities.filter((c) => c.machineId !== action.id),
        schedule: ds.schedule.filter((r) => r.machineId !== action.id),
      };

    case 'updateProduct':
      return { ...ds, products: patchById(ds.products, action.id, action.patch) };
    case 'addProduct': {
      const id = nextId('P', ds.products.map((p) => p.id));
      // The first unused combination, named after it; if all are taken, a duplicate that validation flags.
      const variants = firstFreeCombination(ds.characteristics, ds.products) ?? Object.fromEntries(ds.characteristics.map((c) => [c.id, c.variants[0]?.id ?? '']));
      const product: Product = { id, name: '', variants, min: 3000, max: 15000, initialStock: 8000, usagePerShift: 1000 };
      return { ...ds, products: [...ds.products, product] };
    }
    case 'removeProduct':
      return {
        ...ds,
        products: ds.products.filter((p) => p.id !== action.id),
        capabilities: ds.capabilities.filter((c) => c.productId !== action.id),
        schedule: ds.schedule.filter((r) => r.productId !== action.id),
      };

    case 'updateCapability': {
      const match = isCap(action.machineId, action.productId);
      return { ...ds, capabilities: ds.capabilities.map((c) => (match(c) ? { ...c, ...action.patch } : c)) };
    }
    case 'addCapability':
      if (ds.capabilities.some(isCap(action.machineId, action.productId))) return ds;
      return {
        ...ds,
        capabilities: [...ds.capabilities, { machineId: action.machineId, productId: action.productId, ratePerHour: 1000, oeePct: 75 }],
      };
    case 'removeCapability':
      // Runs of that product on that machine stay; validation flags them.
      return { ...ds, capabilities: ds.capabilities.filter((c) => !isCap(action.machineId, action.productId)(c)) };

    case 'setRun': {
      const { machineId, shift, productId } = action;
      const rest = ds.schedule.filter((r) => !(r.machineId === machineId && r.shift === shift));
      return { ...ds, schedule: productId === null ? rest : [...rest, { machineId, shift, productId }] };
    }
  }
}

// --- JSON ---------------------------------------------------------------------------------------

export function exportJson(ds: Dataset): string {
  return JSON.stringify(ds, null, 2);
}

const COLLECTIONS = ['characteristics', 'machines', 'products', 'capabilities', 'schedule'] as const;

export type ParseResult = { ok: true; dataset: Dataset } | { ok: false; error: string };

/**
 * Parses a JSON scenario. Rejects anything that isn't structurally a v2 dataset (v1 files belong
 * to v1 at /v1/); consistency problems are left to `validateDataset`, like edits are.
 */
export function parseDataset(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, error: 'Expected a JSON object' };
  const obj = raw as Record<string, unknown>;
  if (obj.version === 1) return { ok: false, error: 'This is a v1 (yearly plan) file: open it in v1 at /v1/' };
  if (obj.version !== 2) return { ok: false, error: `Unsupported version ${JSON.stringify(obj.version)} (expected 2)` };
  if (typeof obj.settings !== 'object' || obj.settings === null) return { ok: false, error: 'Missing "settings"' };
  for (const key of COLLECTIONS) {
    if (!Array.isArray(obj[key])) return { ok: false, error: `Missing or invalid "${key}" list` };
  }
  const ds = raw as Dataset;
  return { ok: true, dataset: { ...ds, settings: { ...seedDataset.settings, ...(obj.settings as Partial<Settings>) } } };
}

// --- persistence --------------------------------------------------------------------------------

/** v1 at /v1/ keeps its own key on the same origin. */
export const STORAGE_KEY = 'production-planner/dataset/v2';

/** Loads the saved dataset, falling back to the demo seed if none is saved or it is unreadable. */
export function loadDataset(storage: Pick<Storage, 'getItem'> | undefined): Dataset {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    if (text) {
      const parsed = parseDataset(text);
      if (parsed.ok) return parsed.dataset;
    }
  } catch {
    // Storage blocked (private mode etc.): use the seed.
  }
  return seedDataset;
}

/** Saves the dataset; the untouched demo seed is not stored, so the app keeps tracking seed updates. */
export function saveDataset(storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined, ds: Dataset): void {
  try {
    if (ds === seedDataset) storage?.removeItem(STORAGE_KEY);
    else storage?.setItem(STORAGE_KEY, JSON.stringify(ds));
  } catch {
    // Quota or blocked storage: editing still works in memory.
  }
}
