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
    const ds = datasetReducer(seedDataset, { type: 'updateCapability', machineId: 'M1', productId: 'P01', patch: { oeePct: 50 } });
    expect(ds.capabilities.find((c) => c.machineId === 'M1' && c.productId === 'P01')!.oeePct).toBe(50);
    expect(seedDataset.capabilities.find((c) => c.machineId === 'M1' && c.productId === 'P01')!.oeePct).toBe(78);
  });

  it('adds a capability once and ignores duplicates', () => {
    let ds = datasetReducer(seedDataset, { type: 'addCapability', machineId: 'M5', productId: 'P01' });
    expect(ds.capabilities).toHaveLength(seedDataset.capabilities.length + 1);
    ds = datasetReducer(ds, { type: 'addCapability', machineId: 'M5', productId: 'P01' });
    expect(ds.capabilities).toHaveLength(seedDataset.capabilities.length + 1);
  });

  it('removing a product or machine cascades to its capabilities', () => {
    const noP07 = datasetReducer(seedDataset, { type: 'removeProduct', id: 'P07' });
    expect(noP07.products.some((p) => p.id === 'P07')).toBe(false);
    expect(noP07.capabilities.some((c) => c.productId === 'P07')).toBe(false);
    expect(validateDataset(noP07)).toEqual([]);

    const noM1 = datasetReducer(seedDataset, { type: 'removeMachine', id: 'M1' });
    expect(noM1.capabilities.some((c) => c.machineId === 'M1')).toBe(false);
    expect(noM1.schedule.some((r) => r.machineId === 'M1')).toBe(false);
    expect(validateDataset(noM1)).toEqual([]);
  });

  it('sets, replaces and clears a run (R73); validation flags a run the machine cannot make', () => {
    let ds = datasetReducer(seedDataset, { type: 'setRun', machineId: 'M1', shift: 8, productId: 'P01' });
    ds = datasetReducer(ds, { type: 'setRun', machineId: 'M1', shift: 8, productId: 'P02' });
    expect(ds.schedule.filter((r) => r.machineId === 'M1' && r.shift === 8)).toEqual([{ machineId: 'M1', shift: 8, productId: 'P02' }]);
    expect(validateDataset(ds)).toEqual([]);
    ds = datasetReducer(ds, { type: 'setRun', machineId: 'M1', shift: 8, productId: null });
    expect(ds.schedule.some((r) => r.machineId === 'M1' && r.shift === 8)).toBe(false);
    ds = datasetReducer(ds, { type: 'setRun', machineId: 'M1', shift: 8, productId: 'P03' });
    expect(validateDataset(ds)).toEqual(["Schedule M1 shift 9: M1 can't make P03"]);
  });

  it('adds products and machines with fresh ids', () => {
    const ds = datasetReducer(datasetReducer(seedDataset, { type: 'addProduct' }), { type: 'addMachine' });
    expect(ds.products.at(-1)!.id).toBe('P21');
    expect(ds.machines.at(-1)).toMatchObject({ id: 'M9', name: 'Machine M9' });
    // A new product has no capability yet, which validation reports.
    expect(validateDataset(ds)).toEqual(['Product P21: no machine can produce it']);
  });

  it('updates machine and product fields; reset restores the seed', () => {
    let ds = datasetReducer(seedDataset, { type: 'updateMachine', id: 'M5', patch: { largeLineClearMin: 200 } });
    ds = datasetReducer(ds, { type: 'updateProduct', id: 'P01', patch: { name: 'Renamed' } });
    expect(ds.machines.find((m) => m.id === 'M5')!.largeLineClearMin).toBe(200);
    expect(ds.products[0].name).toBe('Renamed');
    expect(datasetReducer(ds, { type: 'reset' })).toBe(seedDataset);
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

  it('refuses v1 files and points to /v1/', () => {
    expect(parseDataset(JSON.stringify({ version: 1 }))).toEqual({ ok: false, error: 'This is a v1 (yearly plan) file: open it in v1 at /v1/' });
  });

  it('fills settings missing from the file with defaults', () => {
    const { settings: _, ...rest } = seedDataset;
    const parsed = parseDataset(JSON.stringify({ ...rest, settings: {} }));
    expect(parsed.ok && parsed.dataset.settings).toEqual(seedDataset.settings);
  });
});

describe('persistence', () => {
  it('falls back to the seed, then loads what was saved', () => {
    const storage = memoryStorage();
    expect(loadDataset(storage)).toBe(seedDataset);
    const edited = datasetReducer(seedDataset, { type: 'updateProduct', id: 'P02', patch: { usagePerShift: 10 } });
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
    expect(() => saveDataset({ setItem: () => { throw new Error('quota'); }, removeItem: () => {} }, { ...seedDataset })).not.toThrow();
  });
});
