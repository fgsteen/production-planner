// Master data model (v2: one factory). See docs/domain.md for the meaning of each entity.

export type Id = string;

export interface Machine {
  id: Id;
  name: string;
  /** Changeover when the machine runs the same product as in its previous shift, in minutes. */
  smallLineClearMin: number;
  /** Changeover to a different product, in minutes. */
  largeLineClearMin: number;
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
  /** Stock limits, in units (R72). */
  min: number;
  max: number;
  /** Units on hand when the simulation starts. */
  initialStock: number;
  /** Units drawn from stock each shift (constant usage, R87). */
  usagePerShift: number;
}

/** Machine can produce product. */
export interface Capability {
  machineId: Id;
  productId: Id;
  ratePerHour: number;
  /** Overall equipment effectiveness, in percent (0–100]. */
  oeePct: number;
}

/** One machine making one product for one whole shift (R73). */
export interface Run {
  machineId: Id;
  /** Shift index from the start of the simulation, 0-based (shown as 1, 2, …). */
  shift: number;
  productId: Id;
}

export interface Settings {
  shiftHours: number;
}

export interface Dataset {
  version: 2;
  settings: Settings;
  /** X, Y and Z, in display order. */
  characteristics: Characteristic[];
  machines: Machine[];
  products: Product[];
  capabilities: Capability[];
  /** The starting schedule for the first WINDOW_SHIFTS shifts; at most one run per machine and shift. */
  schedule: Run[];
}
