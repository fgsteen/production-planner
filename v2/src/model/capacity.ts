import type { Capability, Machine } from './types';

/** Shifts in the planning window (3 days of 3 shifts). */
export const WINDOW_SHIFTS = 9;

/** Effective output per hour: rate × OEE. */
export function effectiveRate(cap: Capability): number {
  return (cap.ratePerHour * cap.oeePct) / 100;
}

/**
 * Output of one run (R78): rate × OEE × (shift length − clear time). The clear is small when the
 * machine made the same product in its previous shift, large otherwise (also when it was idle or
 * the simulation just started).
 */
export function runOutput(cap: Capability, machine: Machine, shiftHours: number, sameAsPrevious: boolean): number {
  const clearMin = sameAsPrevious ? machine.smallLineClearMin : machine.largeLineClearMin;
  return Math.max(0, shiftHours - clearMin / 60) * effectiveRate(cap);
}
