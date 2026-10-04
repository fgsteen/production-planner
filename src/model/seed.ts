// Generic demo data (R7, R18): placeholder names and numbers only. Holidays and maintenance are
// `MM-DD` and recur every year.
import type { Capability, Characteristic, Dataset, Demand, Machine, Product } from './types';

const ALL_WEEK = { shiftsPerDay: 3, workingWeekdays: [1, 2, 3, 4, 5, 6, 7] };

const COMMON_HOLIDAYS = ['01-01', '03-26', '03-29', '05-06', '12-24', '12-25', '12-26', '12-31'];

function machine(id: string, siteId: string, small: number, large: number, maintenance: string[]): Machine {
  return { id, name: `Machine ${id}`, siteId, calendar: ALL_WEEK, smallLineClearMin: small, largeLineClearMin: large, maintenance };
}

/** Placeholders (user, S06): X letters from K (A and B are site names), Y numbers, Z tree names. */
const characteristic = (id: string, names: string[]): Characteristic => ({
  id,
  name: id,
  variants: names.map((name, i) => ({ id: `${id}${i + 1}`, name })),
});
const CHARACTERISTICS = [
  characteristic('X', ['K', 'L', 'M', 'N']),
  characteristic('Y', ['1', '2', '3']),
  characteristic('Z', ['Alder', 'Birch', 'Cedar', 'Elm', 'Fir', 'Hazel']),
];

/** The 20 demo products (P01 … P20) as `X-Y-Z` variant names: 20 of the 72 combinations. */
const COMBINATIONS = [
  'K-1-Alder', 'K-1-Birch', 'K-2-Cedar', 'K-3-Alder', 'L-1-Elm', 'L-2-Birch', 'L-2-Fir', 'L-3-Hazel', 'M-1-Cedar', 'M-1-Hazel',
  'M-2-Alder', 'M-2-Elm', 'M-3-Fir', 'N-1-Birch', 'N-1-Fir', 'N-2-Cedar', 'N-2-Hazel', 'N-3-Alder', 'N-3-Elm', 'K-2-Fir',
];

function variantsOf(combination: string): Record<string, string> {
  const names = combination.split('-');
  return Object.fromEntries(CHARACTERISTICS.map((c, i) => [c.id, c.variants.find((v) => v.name === names[i])!.id]));
}

/** [machine, product, rate units/h, OEE %] */
const CAPS: [string, string, number, number][] = [
  // Site B. P01–P03, P11, P12, P17 and P19 can only be made here.
  ['B1', 'P01', 1200, 78], ['B1', 'P02', 950, 74], ['B1', 'P04', 1100, 80], ['B1', 'P11', 1000, 76], ['B1', 'P16', 1250, 77], ['B1', 'P19', 900, 73],
  ['B2', 'P02', 1000, 76], ['B2', 'P03', 800, 70], ['B2', 'P05', 1300, 82], ['B2', 'P11', 1100, 78], ['B2', 'P14', 1150, 79], ['B2', 'P20', 700, 69],
  ['B3', 'P01', 1400, 81], ['B3', 'P04', 1250, 79], ['B3', 'P06', 900, 72], ['B3', 'P12', 950, 74], ['B3', 'P17', 700, 70],
  ['B4', 'P03', 850, 68], ['B4', 'P05', 1150, 77], ['B4', 'P06', 1000, 75], ['B4', 'P12', 900, 72], ['B4', 'P15', 1050, 75], ['B4', 'P19', 950, 74],
  // Site A. P07–P10, P13 and P18 can only be made here; P04–P06, P14–P16 and P20 at both sites.
  ['A1', 'P04', 1500, 84], ['A1', 'P07', 700, 73], ['A1', 'P08', 1600, 85], ['A1', 'P13', 800, 75], ['A1', 'P18', 1200, 81],
  ['A2', 'P05', 1350, 80], ['A2', 'P07', 750, 71], ['A2', 'P09', 1100, 78], ['A2', 'P14', 1250, 80], ['A2', 'P16', 1400, 82],
  ['A3', 'P06', 1050, 76], ['A3', 'P08', 1450, 83], ['A3', 'P10', 600, 66], ['A3', 'P13', 850, 77], ['A3', 'P16', 1300, 80], ['A3', 'P20', 650, 68],
  ['A4', 'P04', 1300, 79], ['A4', 'P09', 1200, 81], ['A4', 'P10', 650, 69], ['A4', 'P15', 1100, 78], ['A4', 'P18', 1150, 79],
];

/** Yearly demand per product, in units (P01 … P20): a few runners and a long tail, ~42 M in all. */
const YEARLY_DEMAND = [
  3_500_000, 2_500_000, 1_800_000, 4_000_000, 3_500_000, 2_500_000, 2_000_000, 4_000_000, 3_000_000, 1_500_000,
  2_000_000, 1_500_000, 1_200_000, 2_200_000, 1_600_000, 2_400_000, 1_000_000, 2_000_000, 1_200_000, 800_000,
];

/** P07 sells mostly in summer: weeks 22–33 are pinned higher; the rest of the year shares what is left. */
const SUMMER_PEAK: Record<string, number> = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [String(22 + i), 75_000]));

const pid = (i: number) => `P${String(i + 1).padStart(2, '0')}`;

export const seedDataset: Dataset = {
  version: 1,
  settings: { planningYear: 2027, shiftHours: 8, maxCampaignShifts: 21 },
  sites: [
    { id: 'B', name: 'Site B', isDemandSite: false, holidays: COMMON_HOLIDAYS },
    { id: 'A', name: 'Site A', isDemandSite: true, holidays: [...COMMON_HOLIDAYS, '06-24'] },
  ],
  storageLocations: [
    { id: 'B-WH', name: 'B warehouse', siteId: 'B', capacityPallets: 400, accepts: 'local' },
    { id: 'A-IF', name: 'A in-factory storage', siteId: 'A', capacityPallets: 250, accepts: 'local' },
    { id: 'A-WH', name: 'A warehouse', siteId: 'A', capacityPallets: 600, accepts: 'inbound' },
  ],
  truckLanes: [{ id: 'B-A', fromSiteId: 'B', toSiteId: 'A', maxTrucksPerWeek: 10, palletsPerTruck: 30, runsOnWeekendsAndHolidays: false }],
  characteristics: CHARACTERISTICS,
  machines: [
    machine('B1', 'B', 20, 90, ['02-15', '02-16']),
    machine('B2', 'B', 25, 120, ['04-12']),
    machine('B3', 'B', 15, 75, ['07-05', '07-06', '07-07']),
    machine('B4', 'B', 30, 150, ['09-20']),
    machine('A1', 'A', 20, 100, ['03-08']),
    machine('A2', 'A', 20, 90, ['05-17', '05-18']),
    machine('A3', 'A', 25, 135, ['08-09']),
    machine('A4', 'A', 15, 80, ['10-11', '10-12']),
  ],
  products: COMBINATIONS.map(
    (combination, i): Product => ({
      id: pid(i),
      name: '',
      variants: variantsOf(combination),
      unitsPerCrate: [24, 48, 36, 60, 24][i % 5],
      cratesPerPallet: [40, 32, 36, 24, 48][i % 5],
    }),
  ),
  capabilities: CAPS.map(([machineId, productId, ratePerHour, oeePct]): Capability => ({ machineId, productId, ratePerHour, oeePct })),
  demand: YEARLY_DEMAND.map((yearlyUnits, i): Demand => ({ productId: pid(i), yearlyUnits, weekOverrides: pid(i) === 'P07' ? SUMMER_PEAK : {} })),
  initialStock: [],
};
