// Master data model. See docs/domain.md for the meaning of each entity.

export type Id = string;
/** Whole-day date as `YYYY-MM-DD`. */
export type IsoDate = string;
/** Recurring day of the year as `MM-DD` (holidays and maintenance repeat every year). */
export type MonthDay = string;

export interface Site {
  id: Id;
  name: string;
  /** Demand is consumed here (site A). */
  isDemandSite: boolean;
  holidays: MonthDay[];
}

/** `local`: goods produced at this site. `inbound`: goods arriving by truck. */
export type StorageAccepts = 'local' | 'inbound';

export interface StorageLocation {
  id: Id;
  name: string;
  siteId: Id;
  capacityPallets: number;
  accepts: StorageAccepts;
}

export interface TruckLane {
  id: Id;
  fromSiteId: Id;
  toSiteId: Id;
  maxTrucksPerWeek: number;
  palletsPerTruck: number;
  runsOnWeekendsAndHolidays: boolean;
}

export interface ShiftCalendar {
  shiftsPerDay: number;
  /** ISO weekdays the machine runs: 1 = Monday … 7 = Sunday. */
  workingWeekdays: number[];
}

export interface Machine {
  id: Id;
  name: string;
  siteId: Id;
  calendar: ShiftCalendar;
  /** Changeover between two lots of the same product, in minutes. */
  smallLineClearMin: number;
  /** Changeover to a different product, in minutes. */
  largeLineClearMin: number;
  maintenance: MonthDay[];
}

export interface Product {
  id: Id;
  name: string;
  unitsPerCrate: number;
  cratesPerPallet: number;
}

/** Machine can produce product. */
export interface Capability {
  machineId: Id;
  productId: Id;
  ratePerHour: number;
  /** Overall equipment effectiveness, in percent (0–100]. */
  oeePct: number;
}

/**
 * Forecast for one product over the planning year, in units. By default the yearly total is spread
 * over the ISO weeks in proportion to the demand site's open days (days that are not its holidays); `weekOverrides` (week number → units) pins chosen weeks, and the rest
 * of the total is spread evenly over the other weeks.
 */
export interface Demand {
  productId: Id;
  yearlyUnits: number;
  weekOverrides: Record<string, number>;
}

/** Units of a product on hand in a storage location at the start of week 1. */
export interface InitialStock {
  locationId: Id;
  productId: Id;
  units: number;
}

export interface Settings {
  /** ISO week-year being planned: Monday of week 1 to Sunday of week 52/53. */
  planningYear: number;
  shiftHours: number;
  /** Max consecutive shifts of one product on a machine. */
  maxCampaignShifts: number;
}

export interface Dataset {
  version: 1;
  settings: Settings;
  sites: Site[];
  storageLocations: StorageLocation[];
  truckLanes: TruckLane[];
  machines: Machine[];
  products: Product[];
  capabilities: Capability[];
  demand: Demand[];
  /** Missing entries mean zero. */
  initialStock: InitialStock[];
}
