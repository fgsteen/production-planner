// Generic demo data (R7, R18, R72, R73): one factory, placeholder names and numbers only.
import { WINDOW_SHIFTS, runOutput } from './capacity';
import type { Capability, Characteristic, Dataset, Id, Machine, Product, Run } from './types';

const SHIFT_HOURS = 8;

/** [id, small clear min, large clear min] */
const MACHINES: [string, number, number][] = [
  ['M1', 20, 90], ['M2', 25, 120], ['M3', 15, 75], ['M4', 30, 150],
  ['M5', 20, 100], ['M6', 20, 90], ['M7', 25, 135], ['M8', 15, 80],
];

/** Placeholders (user, S06): X letters from K, Y numbers, Z tree names. */
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

/** Usage per shift (P01 … P20): a few runners and a long tail, ~32k units per shift in all. */
const USAGE = [2560, 1830, 1320, 2920, 2560, 1830, 1460, 2920, 2190, 1100, 1460, 1100, 880, 1610, 1170, 1750, 730, 1460, 880, 580];

/** Where each product's starting stock sits between min and max, cycling. */
const START_AT = [0.15, 0.4, 0.65, 0.3, 0.5];

function variantsOf(combination: string): Record<string, string> {
  const names = combination.split('-');
  return Object.fromEntries(CHARACTERISTICS.map((c, i) => [c.id, c.variants.find((v) => v.name === names[i])!.id]));
}

/** [machine, product, rate units/h, OEE %]. Every product has two or more machines. */
const CAPS: [string, string, number, number][] = [
  ['M1', 'P01', 1200, 78], ['M1', 'P02', 950, 74], ['M1', 'P04', 1100, 80], ['M1', 'P11', 1000, 76], ['M1', 'P16', 1250, 77], ['M1', 'P19', 900, 73],
  ['M2', 'P02', 1000, 76], ['M2', 'P03', 800, 70], ['M2', 'P05', 1300, 82], ['M2', 'P11', 1100, 78], ['M2', 'P14', 1150, 79], ['M2', 'P20', 700, 69],
  ['M3', 'P01', 1400, 81], ['M3', 'P04', 1250, 79], ['M3', 'P06', 900, 72], ['M3', 'P12', 950, 74], ['M3', 'P17', 700, 70],
  ['M4', 'P03', 850, 68], ['M4', 'P05', 1150, 77], ['M4', 'P06', 1000, 75], ['M4', 'P12', 900, 72], ['M4', 'P15', 1050, 75], ['M4', 'P19', 950, 74],
  ['M5', 'P04', 1500, 84], ['M5', 'P07', 700, 73], ['M5', 'P08', 1600, 85], ['M5', 'P13', 800, 75], ['M5', 'P18', 1200, 81], ['M5', 'P17', 750, 72],
  ['M6', 'P05', 1350, 80], ['M6', 'P07', 750, 71], ['M6', 'P09', 1100, 78], ['M6', 'P14', 1250, 80], ['M6', 'P16', 1400, 82],
  ['M7', 'P06', 1050, 76], ['M7', 'P08', 1450, 83], ['M7', 'P10', 600, 66], ['M7', 'P13', 850, 77], ['M7', 'P16', 1300, 80], ['M7', 'P20', 650, 68],
  ['M8', 'P04', 1300, 79], ['M8', 'P09', 1200, 81], ['M8', 'P10', 650, 69], ['M8', 'P15', 1100, 78], ['M8', 'P18', 1150, 79],
];

const pid = (i: number) => `P${String(i + 1).padStart(2, '0')}`;
const roundUp = (x: number, step: number) => Math.ceil(x / step) * step;

const machines: Machine[] = MACHINES.map(([id, small, large]) => ({ id, name: `Machine ${id}`, smallLineClearMin: small, largeLineClearMin: large }));
const capabilities: Capability[] = CAPS.map(([machineId, productId, ratePerHour, oeePct]) => ({ machineId, productId, ratePerHour, oeePct }));

/**
 * Min = 3 shifts of usage. Max leaves room for two of the product's largest runs (after a large
 * clear), so a run never has to overshoot. Starting stock sits partway between the two.
 */
const products: Product[] = COMBINATIONS.map((combination, i) => {
  const usagePerShift = USAGE[i];
  const bestRun = Math.max(
    ...capabilities.filter((c) => c.productId === pid(i)).map((c) => runOutput(c, machines.find((m) => m.id === c.machineId)!, SHIFT_HOURS, false)),
  );
  const min = roundUp(3 * usagePerShift, 100);
  const max = roundUp(min + 2 * bestRun, 100);
  return { id: pid(i), name: '', variants: variantsOf(combination), min, max, initialStock: roundUp(min + START_AT[i % 5] * (max - min), 100), usagePerShift };
});

/**
 * A plausible starting schedule (R73), made once by a simple rule: each shift, each machine makes
 * the capable product whose stock runs out soonest, if it would drop below min within the next 3
 * shifts and the run fits under max. A machine keeps its product when that one still qualifies.
 * Shifts with nothing urgent stay empty, so the replanner has work to do later.
 */
export function makeSeedSchedule(ds: Pick<Dataset, 'machines' | 'products' | 'capabilities' | 'settings'>, shifts = WINDOW_SHIFTS): Run[] {
  const stock = new Map(ds.products.map((p) => [p.id, p.initialStock]));
  const previous = new Map<Id, Id>();
  const runs: Run[] = [];
  for (let shift = 0; shift < shifts; shift++) {
    const made = new Map<Id, number>();
    const current = new Map<Id, Id>();
    for (const m of ds.machines) {
      const options = ds.capabilities
        .filter((c) => c.machineId === m.id && !made.has(c.productId))
        .map((cap) => {
          const p = ds.products.find((x) => x.id === cap.productId)!;
          const s = stock.get(p.id)!;
          const output = runOutput(cap, m, ds.settings.shiftHours, previous.get(m.id) === p.id);
          return { p, output, cover: (s - p.min) / p.usagePerShift, fits: s + output - p.usagePerShift <= p.max };
        })
        .filter((o) => o.fits && o.cover < 3)
        .sort((a, b) => a.cover - b.cover);
      const pick = options.find((o) => o.p.id === previous.get(m.id)) ?? options[0];
      if (!pick) continue;
      made.set(pick.p.id, pick.output);
      current.set(m.id, pick.p.id);
      runs.push({ machineId: m.id, shift, productId: pick.p.id });
    }
    for (const p of ds.products) stock.set(p.id, stock.get(p.id)! + (made.get(p.id) ?? 0) - p.usagePerShift);
    previous.clear();
    for (const [machineId, productId] of current) previous.set(machineId, productId);
  }
  return runs;
}

const base = { version: 2 as const, settings: { shiftHours: SHIFT_HOURS }, characteristics: CHARACTERISTICS, machines, products, capabilities };

export const seedDataset: Dataset = { ...base, schedule: makeSeedSchedule(base) };
