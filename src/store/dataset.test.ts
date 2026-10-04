import { describe, expect, it } from 'vitest';
import { productName } from '../model/products';
import { seedDataset } from '../model/seed';
import { validateDataset } from '../model/validate';
import { STORAGE_KEY, datasetReducer, exportJson, loadDataset, nextId, parseDataset, saveDataset } from './dataset';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
};

describe('datasetReducer', () => {
  it('updates a capability without touching the seed', () => {
    const ds = datasetReducer(seedDataset, { type: 'updateCapability', machineId: 'B1', productId: 'P01', patch: { oeePct: 50 } });
    expect(ds.capabilities.find((c) => c.machineId === 'B1' && c.productId === 'P01')!.oeePct).toBe(50);
    expect(seedDataset.capabilities.find((c) => c.machineId === 'B1' && c.productId === 'P01')!.oeePct).toBe(78);
  });

  it('adds a capability once and ignores duplicates', () => {
    let ds = datasetReducer(seedDataset, { type: 'addCapability', machineId: 'A1', productId: 'P01' });
    expect(ds.capabilities).toHaveLength(seedDataset.capabilities.length + 1);
    ds = datasetReducer(ds, { type: 'addCapability', machineId: 'A1', productId: 'P01' });
    expect(ds.capabilities).toHaveLength(seedDataset.capabilities.length + 1);
  });

  it('removing a product or machine cascades to its capabilities', () => {
    const noP07 = datasetReducer(seedDataset, { type: 'removeProduct', id: 'P07' });
    expect(noP07.products.some((p) => p.id === 'P07')).toBe(false);
    expect(noP07.capabilities.some((c) => c.productId === 'P07')).toBe(false);
    expect(validateDataset(noP07)).toEqual([]);

    const noB1 = datasetReducer(seedDataset, { type: 'removeMachine', id: 'B1' });
    expect(noB1.capabilities.some((c) => c.machineId === 'B1')).toBe(false);
  });

  it('adds products and machines with fresh ids', () => {
    const ds = datasetReducer(datasetReducer(seedDataset, { type: 'addProduct' }), { type: 'addMachine', siteId: 'B' });
    expect(ds.products.at(-1)!.id).toBe('P23');
    expect(ds.machines.at(-1)).toMatchObject({ id: 'B5', siteId: 'B' });
    // A new product has no capability yet, which validation reports.
    expect(validateDataset(ds)).toEqual(['Product P23: no machine can produce it']);
  });

  it('unlinks SFGs from a pre-SFG that is removed or unflagged (R47)', () => {
    const removed = datasetReducer(seedDataset, { type: 'removeProduct', id: 'P21' });
    expect(removed.products.find((p) => p.id === 'P12')!.preSfgId).toBeUndefined();
    const unflagged = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P22', patch: { isPreSfg: false } });
    expect(unflagged.products.find((p) => p.id === 'P17')!.preSfgId).toBeUndefined();
    expect(validateDataset(unflagged)).toEqual([]);
    const bad = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P01', patch: { preSfgId: 'P02' } });
    expect(validateDataset(bad)).toEqual(['Product P01: "P02" is not a pre-SFG']);
  });

  it('updates machine and product fields; reset restores the seed', () => {
    let ds = datasetReducer(seedDataset, { type: 'updateMachine', id: 'A1', patch: { largeLineClearMin: 200 } });
    ds = datasetReducer(ds, { type: 'updateProduct', id: 'P01', patch: { name: 'Renamed' } });
    expect(ds.machines.find((m) => m.id === 'A1')!.largeLineClearMin).toBe(200);
    expect(ds.products[0].name).toBe('Renamed');
    expect(datasetReducer(ds, { type: 'reset' })).toBe(seedDataset);
  });
});

describe('datasetReducer: sites, storage, trucks, settings', () => {
  it('making a site the demand site clears the flag on the others', () => {
    const ds = datasetReducer(seedDataset, { type: 'updateSite', id: 'B', patch: { isDemandSite: true } });
    expect(ds.sites.map((s) => [s.id, s.isDemandSite])).toEqual([['B', true], ['A', false]]);
    expect(validateDataset(ds)).toEqual([]);
  });

  it('adds, edits and removes storage; edits truck lanes and settings', () => {
    let ds = datasetReducer(seedDataset, { type: 'addStorage', siteId: 'A' });
    expect(ds.storageLocations.at(-1)).toMatchObject({ id: 'A-S1', siteId: 'A' });
    ds = datasetReducer(ds, { type: 'updateStorage', id: 'A-S1', patch: { capacityPallets: 42 } });
    expect(ds.storageLocations.at(-1)!.capacityPallets).toBe(42);
    ds = datasetReducer(ds, { type: 'removeStorage', id: 'A-S1' });
    expect(ds.storageLocations).toEqual(seedDataset.storageLocations);

    ds = datasetReducer(ds, { type: 'updateTruckLane', id: 'B-A', patch: { maxTrucksPerWeek: 7 } });
    ds = datasetReducer(ds, { type: 'updateSettings', patch: { planningYear: 2028 } });
    expect(ds.truckLanes[0].maxTrucksPerWeek).toBe(7);
    expect(ds.settings).toEqual({ ...seedDataset.settings, planningYear: 2028 });
  });

  it('validation flags a non-integer planning year', () => {
    const ds = datasetReducer(seedDataset, { type: 'updateSettings', patch: { planningYear: 2027.5 } });
    expect(validateDataset(ds)).toEqual(['Planning year must be a whole year between 2000 and 2100']);
  });
});

describe('datasetReducer: demand', () => {
  const demandOf = (ds: typeof seedDataset, id: string) => ds.demand.find((d) => d.productId === id);

  it('sets totals and week overrides, creating demand for products without any', () => {
    let ds = datasetReducer({ ...seedDataset, demand: [] }, { type: 'setDemandTotal', productId: 'P02', yearlyUnits: 5200 });
    ds = datasetReducer(ds, { type: 'setDemandWeek', productId: 'P02', week: 7, units: 300 });
    ds = datasetReducer(ds, { type: 'setDemandWeek', productId: 'P03', week: 1, units: 0 });
    expect(demandOf(ds, 'P02')).toEqual({ productId: 'P02', yearlyUnits: 5200, weekOverrides: { 7: 300 } });
    expect(demandOf(ds, 'P03')).toEqual({ productId: 'P03', yearlyUnits: 0, weekOverrides: { 1: 0 } });
  });

  it('removes one override or all of them', () => {
    let ds = datasetReducer(seedDataset, { type: 'setDemandWeek', productId: 'P07', week: 22, units: null });
    expect(Object.keys(demandOf(ds, 'P07')!.weekOverrides)).not.toContain('22');
    ds = datasetReducer(ds, { type: 'clearDemandOverrides', productId: 'P07' });
    expect(demandOf(ds, 'P07')!.weekOverrides).toEqual({});
  });

  it('removing a product removes its demand', () => {
    expect(demandOf(datasetReducer(seedDataset, { type: 'removeProduct', id: 'P01' }), 'P01')).toBeUndefined();
  });
});

describe('characteristics', () => {
  const p01 = (ds: typeof seedDataset) => productName(ds, ds.products[0]);

  it('names products X-Y-Z by default; renamed variants carry through, a custom name wins', () => {
    expect(p01(seedDataset)).toBe('K-1-Alder');
    let ds = datasetReducer(seedDataset, { type: 'renameVariant', characteristicId: 'Z', variantId: 'Z1', name: 'Aspen' });
    expect(p01(ds)).toBe('K-1-Aspen');
    ds = datasetReducer(ds, { type: 'updateProduct', id: 'P01', patch: { name: 'Special' } });
    expect(p01(ds)).toBe('Special');
    ds = datasetReducer(ds, { type: 'updateProduct', id: 'P01', patch: { name: '' } });
    expect(p01(ds)).toBe('K-1-Aspen');
    expect(validateDataset(ds)).toEqual([]);
  });

  it('adds variants up to 8 and removes only unused ones', () => {
    let ds = seedDataset;
    for (let i = 0; i < 6; i++) ds = datasetReducer(ds, { type: 'addVariant', characteristicId: 'Y' });
    expect(ds.characteristics[1].variants.map((v) => v.id)).toEqual(['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8']);
    ds = datasetReducer(ds, { type: 'removeVariant', characteristicId: 'Y', variantId: 'Y1' }); // used by P01
    ds = datasetReducer(ds, { type: 'removeVariant', characteristicId: 'Y', variantId: 'Y5' });
    expect(ds.characteristics[1].variants.map((v) => v.id)).toEqual(['Y1', 'Y2', 'Y3', 'Y4', 'Y6', 'Y7', 'Y8']);
  });

  it('gives a new product the first unused combination', () => {
    const ds = datasetReducer(seedDataset, { type: 'addProduct' });
    expect(productName(ds, ds.products.at(-1)!)).toBe('K-1-Cedar'); // K-1-Alder and K-1-Birch are taken
  });

  it('flags duplicate combinations, duplicate names and missing variants', () => {
    let ds = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P02', patch: { variants: { X: 'X1', Y: 'Y1', Z: 'Z1' } } });
    expect(validateDataset(ds)).toEqual(['Products P01 and P02 are both K-1-Alder']);
    ds = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P02', patch: { name: 'K-1-Alder' } });
    expect(validateDataset(ds)).toEqual(['Products P01 and P02 are both named "K-1-Alder"']);
    ds = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P02', patch: { variants: { X: 'X1', Y: 'Y9', Z: 'Z2' } } });
    expect(validateDataset(ds)).toEqual(['Product P02: no Y variant chosen']);
    ds = datasetReducer(seedDataset, { type: 'renameVariant', characteristicId: 'X', variantId: 'X2', name: 'K' });
    expect(validateDataset(ds)).toContain('Characteristic X: duplicate variant "K"');
  });
});

describe('nextId', () => {
  it('fills the first gap', () => {
    expect(nextId('P', ['P01', 'P03'])).toBe('P02');
    expect(nextId('A', ['A1', 'A2'], 1)).toBe('A3');
  });
});

describe('JSON round trip', () => {
  it('export → parse gives an equal dataset', () => {
    const parsed = parseDataset(exportJson(seedDataset));
    expect(parsed).toEqual({ ok: true, dataset: seedDataset });
  });

  it('adds the A → B lane to files from before S07 (R48)', () => {
    const parsed = parseDataset(JSON.stringify({ ...seedDataset, truckLanes: seedDataset.truckLanes.filter((l) => l.fromSiteId === 'B') }));
    expect(parsed.ok && parsed.dataset.truckLanes.map((l) => `${l.id}:${l.fromSiteId}>${l.toSiteId}`)).toEqual(['B-A:B>A', 'A-B:A>B']);
    // A file that has it keeps it as is.
    const same = parseDataset(JSON.stringify(seedDataset));
    expect(same.ok && same.dataset.truckLanes).toEqual(seedDataset.truckLanes);
  });

  it('reads pre-SFG fields saved under their S07 names (isPreSmg, preSmgId)', () => {
    const old = { ...seedDataset, products: seedDataset.products.map(({ isPreSfg, preSfgId, ...p }) => ({ ...p, ...(isPreSfg && { isPreSmg: true }), ...(preSfgId && { preSmgId: preSfgId }) })) };
    const parsed = parseDataset(JSON.stringify(old));
    expect(parsed.ok && parsed.dataset.products).toEqual(seedDataset.products);
  });

  it('fills settings missing from older files with defaults', () => {
    const { planningYear: _omit, ...oldSettings } = seedDataset.settings;
    const parsed = parseDataset(JSON.stringify({ ...seedDataset, settings: { ...oldSettings, shiftHours: 6 } }));
    expect(parsed.ok && parsed.dataset.settings).toEqual({ planningYear: 2027, shiftHours: 6, maxCampaignShifts: 21, priorities: seedDataset.settings.priorities });
  });

  it('upgrades pre-S04 files: no demand, holidays and maintenance as full dates', () => {
    const { demand: _omit, ...old } = seedDataset;
    const file = {
      ...old,
      sites: old.sites.map((s) => ({ ...s, holidays: ['2027-12-25', '2028-12-25', '2027-01-01'] })),
      machines: old.machines.map((m) => ({ ...m, maintenance: ['2027-02-15'] })),
    };
    const parsed = parseDataset(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.dataset.demand).toEqual([]);
    expect(parsed.dataset.sites[0].holidays).toEqual(['12-25', '01-01']);
    expect(parsed.dataset.machines[0].maintenance).toEqual(['02-15']);
    expect(validateDataset(parsed.dataset)).toEqual([]);
  });

  it('upgrades pre-S06 files: demo characteristics, a combination per product, old names kept', () => {
    const { characteristics: _omit, ...old } = seedDataset;
    const file = { ...old, products: old.products.slice(0, 3).map(({ variants: _v, ...p }, i) => ({ ...p, name: `Old ${i}` })) };
    const parsed = parseDataset(JSON.stringify(file));
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.dataset.characteristics).toEqual(seedDataset.characteristics);
    expect(parsed.dataset.products.map((p) => p.variants)).toEqual([
      { X: 'X1', Y: 'Y1', Z: 'Z1' },
      { X: 'X1', Y: 'Y1', Z: 'Z2' },
      { X: 'X1', Y: 'Y1', Z: 'Z3' },
    ]);
    expect(parsed.dataset.products.map((p) => productName(parsed.dataset, p))).toEqual(['Old 0', 'Old 1', 'Old 2']);
  });

  it.each([
    ['not json', 'Not valid JSON'],
    ['[]', 'Expected a JSON object'],
    ['{"version":2}', 'Unsupported version 2 (expected 1)'],
    ['{"version":1}', 'Missing "settings"'],
    ['{"version":1,"settings":{},"sites":[]}', 'Missing or invalid "storageLocations" list'],
  ])('rejects %s', (text, error) => {
    expect(parseDataset(text)).toEqual({ ok: false, error });
  });
});

const edited = () => datasetReducer(seedDataset, { type: 'updateProduct', id: 'P01', patch: { name: 'x' } });

describe('persistence', () => {
  it('falls back to the seed, then loads what was saved', () => {
    const storage = memoryStorage();
    expect(loadDataset(storage)).toBe(seedDataset);
    const edited = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P02', patch: { cratesPerPallet: 10 } });
    saveDataset(storage, edited);
    expect(loadDataset(storage)).toEqual(edited);
    saveDataset(storage, datasetReducer(edited, { type: 'reset' }));
    expect(storage.data.has(STORAGE_KEY)).toBe(false);
  });

  it('ignores corrupt saved data and blocked storage', () => {
    const storage = memoryStorage();
    storage.data.set(STORAGE_KEY, '{oops');
    expect(loadDataset(storage)).toBe(seedDataset);
    const throwing = { getItem: () => { throw new Error('blocked'); } };
    expect(loadDataset(throwing)).toBe(seedDataset);
    expect(() => saveDataset({ setItem: () => { throw new Error('quota'); }, removeItem: () => {} }, edited())).not.toThrow();
  });
});
