// Dataset store: a pure reducer plus JSON (de)serialisation. React wiring lives in DatasetContext.tsx.
import { seedDataset } from '../model/seed';
import type { Capability, Dataset, Id, Machine, Product } from '../model/types';

export type DatasetAction =
  | { type: 'replace'; dataset: Dataset }
  | { type: 'reset' }
  | { type: 'updateMachine'; id: Id; patch: Partial<Omit<Machine, 'id'>> }
  | { type: 'addMachine'; siteId: Id }
  | { type: 'removeMachine'; id: Id }
  | { type: 'updateProduct'; id: Id; patch: Partial<Omit<Product, 'id'>> }
  | { type: 'addProduct' }
  | { type: 'removeProduct'; id: Id }
  | { type: 'updateCapability'; machineId: Id; productId: Id; patch: Partial<Capability> }
  | { type: 'addCapability'; machineId: Id; productId: Id }
  | { type: 'removeCapability'; machineId: Id; productId: Id };

/** Next free id of the form `<prefix><n>`, zero-padded to `width`. */
export function nextId(prefix: string, taken: Iterable<Id>, width = 2): Id {
  const used = new Set(taken);
  for (let n = 1; ; n++) {
    const id = `${prefix}${String(n).padStart(width, '0')}`;
    if (!used.has(id)) return id;
  }
}

const isCap = (machineId: Id, productId: Id) => (c: Capability) => c.machineId === machineId && c.productId === productId;

export function datasetReducer(ds: Dataset, action: DatasetAction): Dataset {
  switch (action.type) {
    case 'replace':
      return action.dataset;
    case 'reset':
      return seedDataset;

    case 'updateMachine':
      return { ...ds, machines: ds.machines.map((m) => (m.id === action.id ? { ...m, ...action.patch } : m)) };
    case 'addMachine': {
      const id = nextId(action.siteId, ds.machines.map((m) => m.id), 1);
      const machine: Machine = {
        id,
        name: `Machine ${id}`,
        siteId: action.siteId,
        calendar: { shiftsPerDay: 3, workingWeekdays: [1, 2, 3, 4, 5, 6, 7] },
        smallLineClearMin: 20,
        largeLineClearMin: 90,
        maintenance: [],
      };
      return { ...ds, machines: [...ds.machines, machine] };
    }
    case 'removeMachine':
      return {
        ...ds,
        machines: ds.machines.filter((m) => m.id !== action.id),
        capabilities: ds.capabilities.filter((c) => c.machineId !== action.id),
      };

    case 'updateProduct':
      return { ...ds, products: ds.products.map((p) => (p.id === action.id ? { ...p, ...action.patch } : p)) };
    case 'addProduct': {
      const id = nextId('P', ds.products.map((p) => p.id));
      return { ...ds, products: [...ds.products, { id, name: `New product ${id}`, unitsPerCrate: 24, cratesPerPallet: 40 }] };
    }
    case 'removeProduct':
      return {
        ...ds,
        products: ds.products.filter((p) => p.id !== action.id),
        capabilities: ds.capabilities.filter((c) => c.productId !== action.id),
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
      return { ...ds, capabilities: ds.capabilities.filter((c) => !isCap(action.machineId, action.productId)(c)) };
  }
}

// --- JSON ---------------------------------------------------------------------------------------

export function exportJson(ds: Dataset): string {
  return JSON.stringify(ds, null, 2);
}

const COLLECTIONS = ['sites', 'storageLocations', 'truckLanes', 'machines', 'products', 'capabilities'] as const;

export type ParseResult = { ok: true; dataset: Dataset } | { ok: false; error: string };

/**
 * Parses a JSON scenario. Rejects anything that isn't structurally a v1 dataset; consistency
 * problems (bad references, out-of-range numbers) are left to `validateDataset`, like edits are.
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
  if (obj.version !== 1) return { ok: false, error: `Unsupported version ${JSON.stringify(obj.version)} (expected 1)` };
  if (typeof obj.settings !== 'object' || obj.settings === null) return { ok: false, error: 'Missing "settings"' };
  for (const key of COLLECTIONS) {
    if (!Array.isArray(obj[key])) return { ok: false, error: `Missing or invalid "${key}" list` };
  }
  return { ok: true, dataset: raw as Dataset };
}

// --- persistence --------------------------------------------------------------------------------

export const STORAGE_KEY = 'production-planner/dataset/v1';

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
