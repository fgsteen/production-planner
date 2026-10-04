// ISO 8601 weeks (as used in Sweden): weeks start on Monday, and week 1 is the week that holds the
// year's first Thursday. The planning year is the ISO week-year, so it may start in late December
// and end in early January.
import type { IsoDate } from './types';

const DAY_MS = 86_400_000;

const toIso = (t: number): IsoDate => new Date(t).toISOString().slice(0, 10);

/** Monday of ISO week 1 of `year`, as a UTC timestamp. */
function week1Monday(year: number): number {
  const jan4 = Date.UTC(year, 0, 4); // Jan 4 is always in week 1
  const weekday = new Date(jan4).getUTCDay() || 7;
  return jan4 - (weekday - 1) * DAY_MS;
}

/** 52 or 53. */
export function isoWeeksInYear(year: number): number {
  return Math.round((week1Monday(year + 1) - week1Monday(year)) / (7 * DAY_MS));
}

/** Monday and Sunday of ISO week `week` of `year`. */
export function isoWeekRange(year: number, week: number): { from: IsoDate; to: IsoDate } {
  const monday = week1Monday(year) + (week - 1) * 7 * DAY_MS;
  return { from: toIso(monday), to: toIso(monday + 6 * DAY_MS) };
}

/** First and last day of the ISO week-year. */
export function isoYearRange(year: number): { from: IsoDate; to: IsoDate } {
  return { from: isoWeekRange(year, 1).from, to: isoWeekRange(year, isoWeeksInYear(year)).to };
}

/** `[1, 2, …, 52|53]` */
export function isoWeeks(year: number): number[] {
  return Array.from({ length: isoWeeksInYear(year) }, (_, i) => i + 1);
}
