import type { Capability, IsoDate, Machine, Product, Settings, Site } from './types';

/** Effective output per hour: rate × OEE. */
export function effectiveRate(cap: Capability): number {
  return (cap.ratePerHour * cap.oeePct) / 100;
}

export type LineClear = 'none' | 'small' | 'large';

/** Output of one lot filling one shift, after the line clear that starts it. */
export function lotOutput(cap: Capability, machine: Machine, settings: Settings, clear: LineClear): number {
  const clearMin = clear === 'small' ? machine.smallLineClearMin : clear === 'large' ? machine.largeLineClearMin : 0;
  const producingHours = Math.max(0, settings.shiftHours - clearMin / 60);
  return producingHours * effectiveRate(cap);
}

export function unitsPerPallet(product: Product): number {
  return product.unitsPerCrate * product.cratesPerPallet;
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a `YYYY-MM-DD` date. */
export function isoWeekday(date: IsoDate): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

/** Each date from `from` to `to`, inclusive. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= end; t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

/** Available shifts = calendar shifts − site holidays − machine maintenance, over [from, to]. Off days recur yearly. */
export function availableShifts(machine: Machine, site: Site, from: IsoDate, to: IsoDate): number {
  const off = new Set([...site.holidays, ...machine.maintenance]);
  const working = new Set(machine.calendar.workingWeekdays);
  return eachDay(from, to).filter((d) => working.has(isoWeekday(d)) && !off.has(d.slice(5))).length * machine.calendar.shiftsPerDay;
}
