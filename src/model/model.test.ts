import { describe, expect, it } from 'vitest';
import { availableShifts, effectiveRate, eachDay, isoWeekday, lotOutput, unitsPerPallet } from './capacity';
import { seedDataset } from './seed';
import type { Dataset } from './types';
import { validateDataset } from './validate';

const clone = (): Dataset => structuredClone(seedDataset);

describe('seed dataset', () => {
  it('is valid', () => {
    expect(validateDataset(seedDataset)).toEqual([]);
  });

  it('has sites B and A with A as the demand site', () => {
    expect(seedDataset.sites.map((s) => s.id)).toEqual(['B', 'A']);
    expect(seedDataset.sites.find((s) => s.isDemandSite)?.id).toBe('A');
  });

  it('has products made at both sites and products made at only one', () => {
    const siteOf = new Map(seedDataset.machines.map((m) => [m.id, m.siteId]));
    const sitesPerProduct = seedDataset.products.map(
      (p) => new Set(seedDataset.capabilities.filter((c) => c.productId === p.id).map((c) => siteOf.get(c.machineId))),
    );
    expect(sitesPerProduct.some((s) => s.size === 2)).toBe(true);
    expect(sitesPerProduct.some((s) => s.size === 1 && s.has('B'))).toBe(true);
    expect(sitesPerProduct.some((s) => s.size === 1 && s.has('A'))).toBe(true);
  });

  it('has the three storage locations and a B → A truck lane with defaults', () => {
    expect(seedDataset.storageLocations.map((l) => `${l.siteId}:${l.accepts}`).sort()).toEqual(['A:inbound', 'A:local', 'B:local']);
    expect(seedDataset.truckLanes).toEqual([expect.objectContaining({ fromSiteId: 'B', toSiteId: 'A', maxTrucksPerWeek: 5, palletsPerTruck: 30 })]);
  });
});

describe('validateDataset', () => {
  it('flags a product no machine can produce', () => {
    const ds = clone();
    ds.capabilities = ds.capabilities.filter((c) => c.productId !== 'P07');
    expect(validateDataset(ds)).toContain('Product P07: no machine can produce it');
  });

  it('flags OEE outside (0, 100]', () => {
    const ds = clone();
    ds.capabilities[0].oeePct = 120;
    ds.capabilities[1].oeePct = 0;
    expect(validateDataset(ds).filter((e) => e.includes('OEE'))).toHaveLength(2);
  });

  it('flags dangling references and duplicates', () => {
    const ds = clone();
    ds.machines[0].siteId = 'X';
    ds.capabilities.push({ ...ds.capabilities[0] });
    ds.capabilities.push({ machineId: 'Z9', productId: 'P01', ratePerHour: 1, oeePct: 50 });
    const errors = validateDataset(ds);
    expect(errors).toContain('Machine B1: unknown site "X"');
    expect(errors).toContain('Duplicate capability B1/P01');
    expect(errors).toContain('Capability Z9/P01: unknown machine');
  });

  it('flags invalid dates, line clears and demand sites', () => {
    const ds = clone();
    ds.sites[0].holidays.push('02-30');
    ds.machines[1].smallLineClearMin = 500;
    ds.sites[0].isDemandSite = true;
    const errors = validateDataset(ds);
    expect(errors).toContain('Site B: invalid holiday "02-30" (expected MM-DD)');
    expect(errors.some((e) => e.startsWith('Machine B2: small line clear must be'))).toBe(true);
    expect(errors).toContain('Exactly one site must be the demand site');
  });

  it('reports (does not throw on) dates the Date parser rejects', () => {
    const ds = clone();
    ds.sites[0].holidays.push('13-01', '2027-01-01');
    ds.machines[0].maintenance.push('00-10', '02-29');
    const errors = validateDataset(ds);
    expect(errors).toContain('Site B: invalid holiday "13-01" (expected MM-DD)');
    expect(errors).toContain('Site B: invalid holiday "2027-01-01" (expected MM-DD)');
    expect(errors).toContain('Machine B1: invalid maintenance day "00-10" (expected MM-DD)');
    expect(errors.some((e) => e.includes('"02-29"'))).toBe(false); // valid; counts in leap years only
  });
});

describe('capacity', () => {
  const machine = seedDataset.machines[0]; // B1: small 20 min, large 90 min
  const cap = { machineId: 'B1', productId: 'P01', ratePerHour: 1000, oeePct: 80 };

  it('computes effective rate as rate × OEE', () => {
    expect(effectiveRate(cap)).toBe(800);
  });

  it('subtracts the line clear from the shift', () => {
    const settings = seedDataset.settings; // 8 h shifts
    expect(lotOutput(cap, machine, settings, 'none')).toBe(6400);
    expect(lotOutput(cap, machine, settings, 'small')).toBeCloseTo((8 - 20 / 60) * 800);
    expect(lotOutput(cap, machine, settings, 'large')).toBeCloseTo(6.5 * 800);
  });

  it('computes units per pallet', () => {
    expect(unitsPerPallet({ id: 'x', name: 'x', unitsPerCrate: 24, cratesPerPallet: 40 })).toBe(960);
  });

  it('handles dates and weekdays', () => {
    expect(isoWeekday('2027-01-04')).toBe(1); // Monday
    expect(isoWeekday('2027-01-03')).toBe(7); // Sunday
    expect(eachDay('2027-02-27', '2027-03-02')).toEqual(['2027-02-27', '2027-02-28', '2027-03-01', '2027-03-02']);
  });

  it('removes holidays, maintenance and non-working days from available shifts', () => {
    const site = { id: 'B', name: 'B', isDemandSite: false, holidays: ['01-01'] };
    const m = { ...machine, maintenance: ['01-05'], calendar: { shiftsPerDay: 3, workingWeekdays: [1, 2, 3, 4, 5] } };
    // 2027-01-01 (Fri) … 2027-01-07 (Thu): weekdays Fri, Mon–Thu = 5; minus holiday Fri and maintenance Tue = 3 days.
    expect(availableShifts(m, site, '2027-01-01', '2027-01-07')).toBe(9);
    expect(availableShifts(machine, { ...site, holidays: [] }, '2027-01-01', '2027-12-31')).toBe((365 - 2) * 3);
  });

  it('repeats holidays and maintenance every year; 02-29 only in leap years', () => {
    const site = { id: 'B', name: 'B', isDemandSite: false, holidays: ['12-25', '02-29'] };
    const m = { ...machine, maintenance: [] };
    expect(availableShifts(m, site, '2027-12-20', '2028-01-02')).toBe((14 - 1) * 3);
    expect(availableShifts(m, site, '2028-12-20', '2029-01-02')).toBe((14 - 1) * 3);
    expect(availableShifts(m, site, '2027-02-27', '2027-03-01')).toBe(3 * 3);
    expect(availableShifts(m, site, '2028-02-27', '2028-03-01')).toBe(3 * 3); // 4 days, 02-29 off
  });
});
