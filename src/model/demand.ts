// Weekly demand and a solver-free capacity check (R35). The check gives necessary conditions only:
// it treats each product as if it had its capable machines to itself, so passing it does not prove
// a plan exists. The machine load is an estimate that splits demand across machines by capacity.
import { availableShifts, effectiveRate } from './capacity';
import type { Dataset, Demand, Id } from './types';
import { isoWeekRange, isoWeeksInYear } from './weeks';

/** Units per week (index 0 = week 1): overrides as given, the rest of the total spread evenly. */
export function weeklyDemand(d: Demand | undefined, weeks: number): number[] {
  if (!d) return new Array(weeks).fill(0);
  const pinned = new Map<number, number>();
  for (const [week, units] of Object.entries(d.weekOverrides)) {
    const w = Number(week);
    if (Number.isInteger(w) && w >= 1 && w <= weeks) pinned.set(w, units);
  }
  const pinnedSum = [...pinned.values()].reduce((a, b) => a + b, 0);
  const free = weeks - pinned.size;
  const even = free > 0 ? Math.max(0, d.yearlyUnits - pinnedSum) / free : 0;
  return Array.from({ length: weeks }, (_, i) => pinned.get(i + 1) ?? even);
}

export interface ProductCheck {
  productId: Id;
  yearlyDemand: number;
  /** Most the product's capable machines could make in the year if they made nothing else. */
  maxYearlyOutput: number;
  weeklyDemand: number[];
  weeklyMax: number[];
  /** Weeks whose demand exceeds that week's max output: they need stock built earlier. */
  overWeeks: number[];
  /** Units that cannot be made in time even building ahead from week 1 (0 = fine). */
  shortfall: number;
}

export interface MachineLoad {
  machineId: Id;
  availableHours: number;
  /** Estimated hours needed when each product's demand is split across its machines by capacity. */
  neededHours: number;
  loadPct: number;
}

export interface CapacityCheck {
  weeks: number;
  /** Available hours per machine per week (index 0 = week 1). */
  machineHours: Map<Id, number[]>;
  products: ProductCheck[];
  machines: MachineLoad[];
}

export function checkCapacity(ds: Dataset): CapacityCheck {
  const year = ds.settings.planningYear;
  const weeks = isoWeeksInYear(year);
  const sites = new Map(ds.sites.map((s) => [s.id, s]));
  const machines = new Map(ds.machines.map((m) => [m.id, m]));

  // Available hours per machine per week.
  const hours = new Map<Id, number[]>();
  for (const m of ds.machines) {
    const site = sites.get(m.siteId);
    hours.set(
      m.id,
      Array.from({ length: weeks }, (_, i) => {
        if (!site) return 0;
        const { from, to } = isoWeekRange(year, i + 1);
        return availableShifts(m, site, from, to) * ds.settings.shiftHours;
      }),
    );
  }

  const needed = new Map<Id, number>(ds.machines.map((m) => [m.id, 0]));
  const products = ds.products.map((p): ProductCheck => {
    const caps = ds.capabilities.filter((c) => c.productId === p.id && machines.has(c.machineId));
    const demand = weeklyDemand(
      ds.demand.find((d) => d.productId === p.id),
      weeks,
    );
    const weeklyMax = new Array(weeks).fill(0);
    let cumDemand = 0;
    let cumMax = 0;
    let shortfall = 0;
    for (let w = 0; w < weeks; w++) {
      const outputs = caps.map((c) => hours.get(c.machineId)![w] * effectiveRate(c));
      weeklyMax[w] = outputs.reduce((a, b) => a + b, 0);
      if (weeklyMax[w] > 0) {
        caps.forEach((c, i) => {
          const share = (demand[w] * outputs[i]) / weeklyMax[w];
          needed.set(c.machineId, needed.get(c.machineId)! + share / effectiveRate(c));
        });
      }
      cumDemand += demand[w];
      cumMax += weeklyMax[w];
      shortfall = Math.max(shortfall, cumDemand - cumMax);
    }
    return {
      productId: p.id,
      yearlyDemand: cumDemand,
      maxYearlyOutput: cumMax,
      weeklyDemand: demand,
      weeklyMax,
      overWeeks: demand.flatMap((d, w) => (d > weeklyMax[w] + 1e-9 ? [w + 1] : [])),
      shortfall,
    };
  });

  const machineLoads = ds.machines.map((m): MachineLoad => {
    const availableHours = hours.get(m.id)!.reduce((a, b) => a + b, 0);
    const neededHours = needed.get(m.id)!;
    return { machineId: m.id, availableHours, neededHours, loadPct: availableHours > 0 ? (100 * neededHours) / availableHours : neededHours > 0 ? Infinity : 0 };
  });

  return { weeks, machineHours: hours, products, machines: machineLoads };
}
