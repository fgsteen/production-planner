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

/** One value of a characteristic, e.g. `K` of X. */
export interface Variant {
  id: Id;
  name: string;
}

/** A product dimension (X, Y or Z). Names of characteristics and variants are editable. */
export interface Characteristic {
  id: Id;
  name: string;
  variants: Variant[];
}

export interface Product {
  id: Id;
  /** Custom name; empty means the default, the variant names joined as `X-Y-Z` (see productName). */
  name: string;
  /** Characteristic id → variant id. Each product is one combination; no two products share one. */
  variants: Record<Id, Id>;
  unitsPerCrate: number;
  cratesPerPallet: number;
  /** A pre-SMG (R47): an input consumed where SMGs are made, not demanded at the demand site. */
  isPreSmg?: boolean;
  /** The pre-SMG this SMG consumes, one unit per unit made, at the site that makes it (R47). */
  preSmgId?: Id;
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
  /** Plan priority weights, 0–10 each (R22). */
  priorities: Priorities;
}

/** Weights of the plan's goals (R22). Higher counts more; 0 ignores a goal. */
export interface Priorities {
  /** Keep the busiest machine's utilisation low. */
  balance: number;
  /** Least time lost to line clears. */
  lineClears: number;
  /** Fewest pallets trucked. */
  transport: number;
  /** Least machine time overall (fast machines first), leaving spare capacity. */
  spare: number;
}

export interface Dataset {
  version: 1;
  settings: Settings;
  sites: Site[];
  storageLocations: StorageLocation[];
  truckLanes: TruckLane[];
  /** X, Y and Z, in display order. */
  characteristics: Characteristic[];
  machines: Machine[];
  products: Product[];
  capabilities: Capability[];
  demand: Demand[];
  /** Missing entries mean zero. */
  initialStock: InitialStock[];
}
