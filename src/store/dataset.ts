// Dataset store: a pure reducer plus JSON (de)serialisation. React wiring lives in DatasetContext.tsx.
import { seedDataset } from '../model/seed';
import type { Capability, Dataset, Demand, Id, Machine, Product, Settings, Site, StorageLocation, TruckLane } from '../model/types';

export type DatasetAction =
  | { type: 'replace'; dataset: Dataset }
  | { type: 'reset' }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'updateSite'; id: Id; patch: Partial<Omit<Site, 'id'>> }
  | { type: 'updateStorage'; id: Id; patch: Partial<Omit<StorageLocation, 'id'>> }
  | { type: 'addStorage'; siteId: Id }
  | { type: 'removeStorage'; id: Id }
  | { type: 'updateTruckLane'; id: Id; patch: Partial<Omit<TruckLane, 'id'>> }
  | { type: 'updateMachine'; id: Id; patch: Partial<Omit<Machine, 'id'>> }
  | { type: 'addMachine'; siteId: Id }
  | { type: 'removeMachine'; id: Id }
  | { type: 'updateProduct'; id: Id; patch: Partial<Omit<Product, 'id'>> }
  | { type: 'addProduct' }
  | { type: 'removeProduct'; id: Id }
  | { type: 'updateCapability'; machineId: Id; productId: Id; patch: Partial<Capability> }
  | { type: 'addCapability'; machineId: Id; productId: Id }
  | { type: 'removeCapability'; machineId: Id; productId: Id }
  | { type: 'setDemandTotal'; productId: Id; yearlyUnits: number }
  /** `units: null` removes the override, so the week goes back to the even spread. */
  | { type: 'setDemandWeek'; productId: Id; week: number; units: number | null }
  | { type: 'clearDemandOverrides'; productId: Id };

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

/** Applies `fn` to the product's demand, creating an empty one if needed. */
function patchDemand(ds: Dataset, productId: Id, fn: (d: Demand) => Demand): Dataset {
  const current = ds.demand.find((d) => d.productId === productId) ?? { productId, yearlyUnits: 0, weekOverrides: {} };
  return { ...ds, demand: [...ds.demand.filter((d) => d.productId !== productId), fn(current)] };
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
    case 'updateSite': {
      let sites = patchById(ds.sites, action.id, action.patch);
      // Exactly one demand site: choosing a new one clears the others.
      if (action.patch.isDemandSite) sites = sites.map((s) => (s.id === action.id ? s : { ...s, isDemandSite: false }));
      return { ...ds, sites };
    }
    case 'updateStorage':
      return { ...ds, storageLocations: patchById(ds.storageLocations, action.id, action.patch) };
    case 'addStorage': {
      const id = nextId(`${action.siteId}-S`, ds.storageLocations.map((l) => l.id), 1);
      const location: StorageLocation = { id, name: `New storage ${id}`, siteId: action.siteId, capacityPallets: 100, accepts: 'local' };
      return { ...ds, storageLocations: [...ds.storageLocations, location] };
    }
    case 'removeStorage':
      return { ...ds, storageLocations: ds.storageLocations.filter((l) => l.id !== action.id) };
    case 'updateTruckLane':
      return { ...ds, truckLanes: patchById(ds.truckLanes, action.id, action.patch) };

    case 'updateMachine':
      return { ...ds, machines: patchById(ds.machines, action.id, action.patch) };
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
      return { ...ds, products: patchById(ds.products, action.id, action.patch) };
    case 'addProduct': {
      const id = nextId('P', ds.products.map((p) => p.id));
      return { ...ds, products: [...ds.products, { id, name: `New product ${id}`, unitsPerCrate: 24, cratesPerPallet: 40 }] };
    }
    case 'removeProduct':
      return {
        ...ds,
        products: ds.products.filter((p) => p.id !== action.id),
        capabilities: ds.capabilities.filter((c) => c.productId !== action.id),
        demand: ds.demand.filter((d) => d.productId !== action.id),
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

    case 'setDemandTotal':
      return patchDemand(ds, action.productId, (d) => ({ ...d, yearlyUnits: action.yearlyUnits }));
    case 'setDemandWeek':
      return patchDemand(ds, action.productId, (d) => {
        const { [action.week]: _, ...rest } = d.weekOverrides;
        return { ...d, weekOverrides: action.units === null ? rest : { ...rest, [action.week]: action.units } };
      });
    case 'clearDemandOverrides':
      return patchDemand(ds, action.productId, (d) => ({ ...d, weekOverrides: {} }));
  }
}

// --- JSON ---------------------------------------------------------------------------------------

export function exportJson(ds: Dataset): string {
  return JSON.stringify(ds, null, 2);
}

const COLLECTIONS = ['sites', 'storageLocations', 'truckLanes', 'machines', 'products', 'capabilities'] as const;

/** `YYYY-MM-DD` → `MM-DD` (dropping duplicates); anything else is kept for validation to report. */
function toMonthDays(days: string[] | undefined): string[] {
  const out = (days ?? []).map((d) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.slice(5) : d));
  return [...new Set(out)];
}

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
  if (obj.demand !== undefined && !Array.isArray(obj.demand)) return { ok: false, error: 'Invalid "demand" list' };
  const ds = raw as Dataset;
  const dataset: Dataset = {
    ...ds,
    // Settings added after v1 shipped (e.g. planningYear) fall back to the demo defaults.
    settings: { ...seedDataset.settings, ...(obj.settings as Partial<Settings>) },
    // Files from before S04: no demand, and holidays/maintenance as full dates.
    demand: (ds.demand ?? []).map((d) => ({ ...d, weekOverrides: d.weekOverrides ?? {} })),
    sites: ds.sites.map((s) => ({ ...s, holidays: toMonthDays(s.holidays) })),
    machines: ds.machines.map((m) => ({ ...m, maintenance: toMonthDays(m.maintenance) })),
  };
  return { ok: true, dataset };
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
