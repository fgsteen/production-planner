import { describe, expect, it } from 'vitest';
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
    expect(ds.products.at(-1)!.id).toBe('P11');
    expect(ds.machines.at(-1)).toMatchObject({ id: 'B5', siteId: 'B' });
    // A new product has no capability yet, which validation reports.
    expect(validateDataset(ds)).toEqual(['Product P11: no machine can produce it']);
  });

  it('updates machine and product fields; reset restores the seed', () => {
    let ds = datasetReducer(seedDataset, { type: 'updateMachine', id: 'A1', patch: { largeLineClearMin: 200 } });
    ds = datasetReducer(ds, { type: 'updateProduct', id: 'P01', patch: { name: 'Renamed' } });
    expect(ds.machines.find((m) => m.id === 'A1')!.largeLineClearMin).toBe(200);
    expect(ds.products[0].name).toBe('Renamed');
    expect(datasetReducer(ds, { type: 'reset' })).toBe(seedDataset);
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
