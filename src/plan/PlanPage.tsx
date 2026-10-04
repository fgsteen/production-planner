import { useEffect, useMemo, useRef, useState } from 'react';
import { checkCapacity } from '../model/demand';
import type { Dataset } from '../model/types';
import { useDataset } from '../store/DatasetContext';
import { fmt, productColor } from '../ui/palette';
import type { PlanResult } from './lp';
import { TransportBreakdown, WeeklyMachinePlan } from './PlanDetails';
import type { WorkerRequest, WorkerResponse } from './plan.worker';
import { productName } from '../model/products';
import { Panel } from '../ui/Panel';

type State = { kind: 'solving' } | { kind: 'done'; plan: PlanResult } | { kind: 'error'; error: string };

/** Re-solves whenever the dataset changes; stale answers are dropped. */
function usePlan(dataset: Dataset, enabled: boolean): State {
  const worker = useRef<Worker | null>(null);
  const lastId = useRef(0);
  const [state, setState] = useState<State>({ kind: 'solving' });

  useEffect(() => {
    const w = new Worker(new URL('./plan.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      if (e.data.id !== lastId.current) return;
      setState(e.data.ok ? { kind: 'done', plan: e.data.plan } : { kind: 'error', error: e.data.error });
    };
    w.onerror = (e) => setState({ kind: 'error', error: e.message || 'Solver failed to load' });
    worker.current = w;
    return () => w.terminate();
  }, []);

  useEffect(() => {
    if (!enabled || !worker.current) return;
    const id = ++lastId.current;
    setState({ kind: 'solving' });
    worker.current.postMessage({ id, dataset } satisfies WorkerRequest);
  }, [dataset, enabled]);

  return state;
}

export function PlanPage() {
  const { dataset, errors } = useDataset();
  const state = usePlan(dataset, errors.length === 0);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Draft plan {dataset.settings.planningYear}</h2>
        <p className="text-sm text-muted">
          Solved in your browser (HiGHS): shifts per product per machine that meet weekly demand at the least machine time, building stock ahead only
          as far as storage allows and trucking B goods to A within the weekly truck limit. Not yet included: line clears, priorities.
        </p>
      </div>
      {errors.length > 0 ? (
        <p role="alert" className="rounded-xl border border-[#edc948]/60 bg-[#edc948]/10 px-4 py-3 text-sm">
          Fix the {errors.length} {errors.length === 1 ? 'problem' : 'problems'} on the Master data or Demand page first.
        </p>
      ) : state.kind === 'solving' ? (
        <p className="text-sm text-muted" data-testid="plan-status">
          Solving…
        </p>
      ) : state.kind === 'error' ? (
        <p role="alert" className="text-sm text-[#e15759]" data-testid="plan-status">
          Solver error: {state.error}
        </p>
      ) : (
        <PlanView dataset={dataset} plan={state.plan} />
      )}
    </div>
  );
}

function PlanView({ dataset, plan }: { dataset: Dataset; plan: PlanResult }) {
  const check = useMemo(() => checkCapacity(dataset), [dataset]);
  const shiftsOf = new Map(plan.shifts.map((s) => [`${s.machineId}/${s.productId}`, s.shifts]));
  const capable = new Set(dataset.capabilities.map((c) => `${c.machineId}/${c.productId}`));
  const products = dataset.products;
  const totalShifts = plan.shifts.reduce((a, s) => a + s.shifts, 0);

  return (
    <>
      <dl data-testid="plan-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ['Status', plan.status],
            ['Unmet demand', `${fmt(plan.unmetUnits)} units`],
            ['Shifts planned', fmt(totalShifts)],
            ['Trucks B → A', fmt(plan.lanes.reduce((a, l) => a + l.weeks.reduce((b, w) => b + w.trucksUsed, 0), 0))],
            ['Solve time', `${fmt(plan.solveMs)} ms`],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border border-line bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="tabular mt-0.5 text-lg font-semibold" style={label === 'Unmet demand' && plan.unmetUnits >= 1 ? { color: '#e15759' } : undefined}>
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <Panel title="Shifts per machine and product" hint="Shifts over the year. Utilisation = planned ÷ available shifts. Grey cells: the machine can't make that product.">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="plan-table">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 text-left font-medium">Machine</th>
                {products.map((p, i) => (
                  <th key={p.id} className="whitespace-nowrap px-1 py-1.5 text-right font-medium" title={p.id}>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(i) }} />
                      {productName(dataset, p)}
                    </span>
                  </th>
                ))}
                <th className="py-1.5 pl-3 text-right font-medium">Total</th>
                <th className="w-40 py-1.5 pl-3 text-left font-medium">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {dataset.machines.map((m) => {
                const total = products.reduce((a, p) => a + (shiftsOf.get(`${m.id}/${p.id}`) ?? 0), 0);
                const available = (check.machineHours.get(m.id) ?? []).reduce((a, b) => a + b, 0) / dataset.settings.shiftHours;
                const util = available > 0 ? (100 * total) / available : 0;
                return (
                  <tr key={m.id} data-testid={`plan-row-${m.id}`} className="border-b border-line/50">
                    <td className="py-1 pr-3 font-medium">{m.name}</td>
                    {products.map((p, i) => {
                      const key = `${m.id}/${p.id}`;
                      const s = shiftsOf.get(key) ?? 0;
                      return (
                        <td
                          key={p.id}
                          className={`tabular px-1 py-1 text-right ${capable.has(key) ? '' : 'bg-surface-2/70'}`}
                          style={s >= 0.5 ? { background: `color-mix(in srgb, ${productColor(i)} ${Math.min(45, 8 + s / 15)}%, transparent)` } : undefined}
                        >
                          {s >= 0.5 ? fmt(s) : capable.has(key) ? <span className="text-faint">0</span> : ''}
                        </td>
                      );
                    })}
                    <td className="tabular py-1 pl-3 text-right font-medium">{fmt(total)}</td>
                    <td className="py-1 pl-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, util)}%` }} />
                        </span>
                        <span className="tabular w-10 text-right">{fmt(util)} %</span>
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <WeeklyMachinePlan dataset={dataset} plan={plan} check={check} />
      <TransportBreakdown dataset={dataset} plan={plan} />
    </>
  );
}
