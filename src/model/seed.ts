// Generic demo data (R7): placeholder names and numbers only.
import type { Capability, Dataset, Machine } from './types';

const ALL_WEEK = { shiftsPerDay: 3, workingWeekdays: [1, 2, 3, 4, 5, 6, 7] };

const COMMON_HOLIDAYS = ['2027-01-01', '2027-03-26', '2027-03-29', '2027-05-06', '2027-12-24', '2027-12-25', '2027-12-26', '2027-12-31'];

function machine(id: string, siteId: string, small: number, large: number, maintenance: string[]): Machine {
  return { id, name: `Machine ${id}`, siteId, calendar: ALL_WEEK, smallLineClearMin: small, largeLineClearMin: large, maintenance };
}

/** [machine, product, rate units/h, OEE %] */
const CAPS: [string, string, number, number][] = [
  // Site B. P01–P03 can only be made here.
  ['B1', 'P01', 1200, 78], ['B1', 'P02', 950, 74], ['B1', 'P04', 1100, 80],
  ['B2', 'P02', 1000, 76], ['B2', 'P03', 800, 70], ['B2', 'P05', 1300, 82],
  ['B3', 'P01', 1400, 81], ['B3', 'P04', 1250, 79], ['B3', 'P06', 900, 72],
  ['B4', 'P03', 850, 68], ['B4', 'P05', 1150, 77], ['B4', 'P06', 1000, 75],
  // Site A. P07–P10 can only be made here; P04–P06 at both sites.
  ['A1', 'P04', 1500, 84], ['A1', 'P07', 700, 73], ['A1', 'P08', 1600, 85],
  ['A2', 'P05', 1350, 80], ['A2', 'P07', 750, 71], ['A2', 'P09', 1100, 78],
  ['A3', 'P06', 1050, 76], ['A3', 'P08', 1450, 83], ['A3', 'P10', 600, 66],
  ['A4', 'P04', 1300, 79], ['A4', 'P09', 1200, 81], ['A4', 'P10', 650, 69],
];

const PRODUCT_NAMES = ['Alder', 'Birch', 'Cedar', 'Dogwood', 'Elm', 'Fir', 'Ginkgo', 'Hazel', 'Ivy', 'Juniper'];

export const seedDataset: Dataset = {
  version: 1,
  settings: { shiftHours: 8, maxCampaignShifts: 21 },
  sites: [
    { id: 'B', name: 'Site B', isDemandSite: false, holidays: COMMON_HOLIDAYS },
    { id: 'A', name: 'Site A', isDemandSite: true, holidays: [...COMMON_HOLIDAYS, '2027-06-24'] },
  ],
  storageLocations: [
    { id: 'B-WH', name: 'B warehouse', siteId: 'B', capacityPallets: 400, accepts: 'local' },
    { id: 'A-IF', name: 'A in-factory storage', siteId: 'A', capacityPallets: 250, accepts: 'local' },
    { id: 'A-WH', name: 'A warehouse', siteId: 'A', capacityPallets: 600, accepts: 'inbound' },
  ],
  truckLanes: [{ id: 'B-A', fromSiteId: 'B', toSiteId: 'A', maxTrucksPerWeek: 5, palletsPerTruck: 30, runsOnWeekendsAndHolidays: false }],
  machines: [
    machine('B1', 'B', 20, 90, ['2027-02-15', '2027-02-16']),
    machine('B2', 'B', 25, 120, ['2027-04-12']),
    machine('B3', 'B', 15, 75, ['2027-07-05', '2027-07-06', '2027-07-07']),
    machine('B4', 'B', 30, 150, ['2027-09-20']),
    machine('A1', 'A', 20, 100, ['2027-03-08']),
    machine('A2', 'A', 20, 90, ['2027-05-17', '2027-05-18']),
    machine('A3', 'A', 25, 135, ['2027-08-09']),
    machine('A4', 'A', 15, 80, ['2027-10-11', '2027-10-12']),
  ],
  products: PRODUCT_NAMES.map((name, i) => {
    const n = String(i + 1).padStart(2, '0');
    return { id: `P${n}`, name: `SF-${n} ${name}`, unitsPerCrate: [24, 48, 36, 60, 24][i % 5], cratesPerPallet: [40, 32, 36, 24, 48][i % 5] };
  }),
  capabilities: CAPS.map(([machineId, productId, ratePerHour, oeePct]): Capability => ({ machineId, productId, ratePerHour, oeePct })),
};
