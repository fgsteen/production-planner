import { runOutput } from '../model/capacity';
import type { Dataset, Id, Product } from '../model/types';
import type { RunOutput, SimState, UsageModel } from './types';

/** Constant usage per product (R87). */
export const constantUsage: UsageModel = { usage: (p: Product) => p.usagePerShift };

/** State at shift 0: initial stock, the seeded schedule, no previous product on any machine. */
export function initialState(ds: Dataset): SimState {
  return {
    shift: 0,
    stock: Object.fromEntries(ds.products.map((p) => [p.id, p.initialStock])),
    schedule: ds.schedule.map((r) => ({ ...r })),
    lastProduct: Object.fromEntries(ds.machines.map((m) => [m.id, null])),
  };
}

/**
 * Output of every run in `state.schedule` (R78), sorted by shift then machine. The clear is small
 * when the machine ran the same product in the shift before (from the schedule, or
 * `state.lastProduct` for the first shift), large otherwise, also after an idle shift.
 */
export function scheduleOutputs(ds: Pick<Dataset, 'machines' | 'capabilities' | 'settings'>, state: Pick<SimState, 'schedule' | 'lastProduct'> & { shift: number }): RunOutput[] {
  const machines = new Map(ds.machines.map((m) => [m.id, m]));
  const caps = new Map(ds.capabilities.map((c) => [`${c.machineId}|${c.productId}`, c]));
  const byMachineShift = new Map(state.schedule.map((r) => [`${r.machineId}|${r.shift}`, r.productId]));
  const previous = (machineId: Id, shift: number): Id | null =>
    shift === state.shift ? (state.lastProduct[machineId] ?? null) : (byMachineShift.get(`${machineId}|${shift - 1}`) ?? null);

  return [...state.schedule]
    .sort((a, b) => a.shift - b.shift || a.machineId.localeCompare(b.machineId))
    .map((run) => {
      const machine = machines.get(run.machineId);
      const cap = caps.get(`${run.machineId}|${run.productId}`);
      if (!machine || !cap) throw new Error(`No capability for ${run.machineId} → ${run.productId}`);
      const same = previous(run.machineId, run.shift) === run.productId;
      return { run, clear: same ? 'small' : 'large', units: runOutput(cap, machine, ds.settings.shiftHours, same) };
    });
}
