// Master data model. See docs/domain.md for the meaning of each entity.

export type Id = string;
/** Whole-day date as `YYYY-MM-DD`. */
export type IsoDate = string;

export interface Site {
  id: Id;
  name: string;
  /** Demand is consumed here (site A). */
  isDemandSite: boolean;
  holidays: IsoDate[];
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
  maintenance: IsoDate[];
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

export interface Settings {
  /** Calendar year being planned (Jan 1 – Dec 31). */
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
}
