// Runs HiGHS off the main thread so the UI stays responsive while solving.
import loadHighs from 'highs';
import wasmUrl from 'highs/runtime?url';
import type { Dataset } from '../model/types';
import type { PlanResult } from './lp';
import { solvePlan } from './solve';

export type WorkerRequest = { id: number; dataset: Dataset };
export type WorkerResponse = { id: number } & ({ ok: true; plan: PlanResult } | { ok: false; error: string });

let highs: ReturnType<typeof loadHighs> | null = null;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, dataset } = e.data;
  let response: WorkerResponse;
  try {
    highs ??= loadHighs({ locateFile: () => wasmUrl });
    response = { id, ok: true, plan: solvePlan(await highs, dataset) };
  } catch (err) {
    highs = null; // a failed solve can leave the Wasm instance unusable: start fresh next time
    response = { id, ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  self.postMessage(response);
};
