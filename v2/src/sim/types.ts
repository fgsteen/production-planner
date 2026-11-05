// Simulation types for the step loop (R74–R79). step() itself comes in S13.
import type { Id, Product, Run } from '../model/types';

/** Units drawn from stock per product and shift (R87). Constant first; noise or replay later (R88, R89). */
export interface UsageModel {
  usage(product: Product, shift: number): number;
}

/** Where the simulation stands before a step. */
export interface SimState {
  /** Index of the next shift to run, which is also the first (frozen) shift of the window. */
  shift: number;
  /** Units on hand per product at the start of `shift`. */
  stock: Record<Id, number>;
  /** Runs for shifts `shift` … `shift + WINDOW_SHIFTS − 1`; at most one per machine and shift. */
  schedule: Run[];
  /** Product each machine made in shift `shift − 1`; null when idle or at the start. Picks the clear for the next run. */
  lastProduct: Record<Id, Id | null>;
}

/** A run with what it makes (R78). */
export interface RunOutput {
  run: Run;
  clear: 'small' | 'large';
  units: number;
}

/** A product's first shift outside its limits in the projection (R77). */
export interface Breach {
  productId: Id;
  shift: number;
  kind: 'below-min' | 'above-max';
  stock: number;
}

/** What step() returns: the new state and what happened in the shift that ran. */
export interface StepResult {
  state: SimState;
  /** Runs of the shift that just ran, with their output. */
  made: RunOutput[];
  /** Projected stock per product at the end of each window shift, from `state.shift` on. */
  projection: Record<Id, number[]>;
  breaches: Breach[];
}
