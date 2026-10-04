import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkCapacity } from '../model/demand';
import { groupProducts } from '../model/products';
import { DEFAULT_PRIORITIES } from '../model/seed';
import type { Dataset, Priorities } from '../model/types';
import { useDataset } from '../store/DatasetContext';
import { fmt, productColor } from '../ui/palette';
import { MIP_REL_GAP, TIME_LIMIT_S, type PlanResult } from './lp';
import { TransportBreakdown, WeeklyMachinePlan } from './PlanDetails';
import type { WorkerRequest, WorkerResponse } from './plan.worker';
import type { SolveStage } from './solve';
import { Panel } from '../ui/Panel';
import { GroupBySelect } from '../ui/GroupBy';
import { BottlenecksPanel } from './Bottlenecks';
import { UnmetPanel } from './Unmet';
import { WarehousePanel } from './Warehouse';

type State =
  | { kind: 'solving'; stage?: SolveStage; since: number }
  | { kind: 'done'; plan: PlanResult }
  | { kind: 'error'; error: string }
  | { kind: 'cancelled' };

const STAGE_LABELS: Record<SolveStage, string> = {
  relax: 'step 1 of 3: relaxed plan and campaign cycles',
  fix: 'step 2 of 3: fixing the runs',
  mip: 'step 3 of 3: improving the plan',
};

/**
 * Re-solves whenever the dataset changes. A change during a solve, or Cancel, terminates the
 * worker (HiGHS can't be interrupted) and the next solve starts a fresh one.
 */
function usePlan(dataset: Dataset, enabled: boolean): { state: State; cancel: () => void } {
  const worker = useRef<Worker | null>(null);
  const busy = useRef(false);
  const lastId = useRef(0);
  const [state, setState] = useState<State>({ kind: 'solving', since: Date.now() });

  const stop = useCallback(() => {
    worker.current?.terminate();
    worker.current = null;
    busy.current = false;
  }, []);
  const start = useCallback(() => {
    const w = new Worker(new URL('./plan.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      if (msg.id !== lastId.current) return;
      if ('stage' in msg) return setState((s) => (s.kind === 'solving' ? { ...s, stage: msg.stage } : s));
      busy.current = false;
      setState(msg.ok ? { kind: 'done', plan: msg.plan } : { kind: 'error', error: msg.error });
    };
    w.onerror = (e) => {
      busy.current = false;
      setState({ kind: 'error', error: e.message || 'Solver failed to load' });
    };
    worker.current = w;
    return w;
  }, []);
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!enabled) return;
    if (busy.current) stop();
    const id = ++lastId.current;
    busy.current = true;
    setState({ kind: 'solving', since: Date.now() });
    (worker.current ?? start()).postMessage({ id, dataset } satisfies WorkerRequest);
  }, [dataset, enabled, start, stop]);

  const cancel = useCallback(() => {
    stop();
    lastId.current++;
    setState({ kind: 'cancelled' });
  }, [stop]);
  return { state, cancel };
}

function SolvingStatus({ state, onCancel }: { state: Extract<State, { kind: 'solving' }>; onCancel: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="flex items-center gap-3 text-sm text-muted" data-testid="plan-status">
      <span>
        Solving… {state.stage ? STAGE_LABELS[state.stage] : 'loading the solver'} · {((now - state.since) / 1000).toFixed(1)} s
      </span>
      <button type="button" onClick={onCancel} className="rounded-md border border-line px-2 py-0.5 text-xs hover:bg-surface">
        Cancel
      </button>
    </p>
  );
}

export function PlanPage() {
  const { dataset, errors } = useDataset();
  const { state, cancel } = usePlan(dataset, errors.length === 0);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Draft plan {dataset.settings.planningYear}</h2>
        <p className="text-sm text-muted">
          Solved in your browser (HiGHS): shifts per product per machine that meet weekly demand, building stock ahead only as far as storage allows,
          trucking B goods to A and pre-SFGs to B within the weekly truck limits. Each campaign (a product on a machine, over one or more weeks in a
          row) starts with a large line clear, each further lot (max one shift) with a small one. The priorities below weigh the goals. The solver stops within {100 * MIP_REL_GAP} % of the
          best plan or after {TIME_LIMIT_S} s.
        </p>
      </div>
      <PrioritiesPanel />
      {errors.length > 0 ? (
        <p role="alert" className="rounded-xl border border-[#edc948]/60 bg-[#edc948]/10 px-4 py-3 text-sm">
          Fix the {errors.length} {errors.length === 1 ? 'problem' : 'problems'} on the Master data or Demand page first.
        </p>
      ) : state.kind === 'solving' ? (
        <SolvingStatus state={state} onCancel={cancel} />
      ) : state.kind === 'cancelled' ? (
        <p className="text-sm text-muted" data-testid="plan-status">
          Solve cancelled. Change a priority or any data to solve again.
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

const PRIORITY_LABELS: [keyof Priorities, string, string][] = [
  ['balance', 'Balanced load', "Keep the busiest machine's yearly utilisation low."],
  ['lineClears', 'Few line clears', 'Least time lost to line clears: longer campaigns, more stock.'],
  ['transport', 'Little transport', 'Fewest pallets trucked between the sites.'],
  ['spare', 'Spare capacity', 'Least machine time overall: fast machines first.'],
];

/** Priority weights (R22): edited as sliders, saved (and re-solved) shortly after the last change. */
function PrioritiesPanel() {
  const { dataset, dispatch } = useDataset();
  const key = JSON.stringify({ ...DEFAULT_PRIORITIES, ...dataset.settings.priorities });
  const [draft, setDraft] = useState<Priorities>(() => JSON.parse(key));
  useEffect(() => setDraft(JSON.parse(key)), [key]);
  useEffect(() => {
    if (JSON.stringify(draft) === key) return;
    const t = setTimeout(() => dispatch({ type: 'updateSettings', patch: { priorities: draft } }), 500);
    return () => clearTimeout(t);
  }, [draft, key, dispatch]);
  const isDefault = PRIORITY_LABELS.every(([k]) => draft[k] === DEFAULT_PRIORITIES[k]);

  return (
    <Panel
      title="Priorities"
      testId="priorities"
      hint="How much each goal counts, 0–10. Unmet demand always counts far more than any of them."
      actions={
        <button
          type="button"
          disabled={isDefault}
          onClick={() => setDraft(DEFAULT_PRIORITIES)}
          className="text-xs text-accent hover:underline disabled:text-faint disabled:no-underline"
        >
          Reset to default
        </button>
      }
    >
      <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {PRIORITY_LABELS.map(([k, label, hint]) => (
          <label key={k} className="block text-xs">
            <span className="flex justify-between">
              <span className="font-medium">{label}</span>
              <span className="tabular text-muted">{draft[k]}</span>
            </span>
            <input
              type="range"
              min={0}
              max={10}
              step={1}
              aria-label={`${label} weight`}
              value={draft[k]}
              onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })}
              className="w-full accent-[var(--color-accent)]"
            />
            <span className="text-faint">{hint}</span>
          </label>
        ))}
      </div>
    </Panel>
  );
}

function PlanView({ dataset, plan }: { dataset: Dataset; plan: PlanResult }) {
  const check = useMemo(() => checkCapacity(dataset), [dataset]);
  const [groupBy, setGroupBy] = useState<string | null>(null);
  const shiftsOf = new Map(plan.shifts.map((s) => [`${s.machineId}/${s.productId}`, s.shifts]));
  const capable = new Set(dataset.capabilities.map((c) => `${c.machineId}/${c.productId}`));
  const groups = groupProducts(dataset, dataset.products, groupBy);
  const totalShifts = plan.shifts.reduce((a, s) => a + s.shifts, 0);
  const lineClears = new Map(plan.lineClears.map((l) => [l.machineId, l]));
  const siteName = new Map(dataset.sites.map((s) => [s.id, s.name.replace(/^Site /, '')]));
  const trucks = plan.lanes.map((l) => {
    const lane = dataset.truckLanes.find((t) => t.id === l.laneId)!;
    return [`Trucks ${siteName.get(lane.fromSiteId)} → ${siteName.get(lane.toSiteId)}`, fmt(l.weeks.reduce((a, w) => a + w.trucksUsed, 0))] as const;
  });

  return (
    <>
      <dl data-testid="plan-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {(
          [
            ['Status', plan.status === 'Optimal' ? 'Optimal' : 'Best found'],
            ['Unmet demand', `${fmt(plan.unmetUnits)} units`],
            ['Shifts planned', fmt(totalShifts)],
            ['Busiest machine', `${fmt(100 * plan.maxUtilisation)} %`],
            ['Large line clears', fmt(plan.lineClears.reduce((a, l) => a + l.large, 0))],
            ['Line clear hours', fmt(plan.lineClears.reduce((a, l) => a + l.hours, 0))],
            ...trucks,
            ['Solve time', `${(plan.solveMs / 1000).toFixed(1)} s`],
            ['Gap to optimum', plan.mipGap === undefined ? '–' : plan.mipGap >= 0.999 ? 'not proven' : `≤ ${plan.mipGap < 0.001 ? '0.1' : fmt(100 * plan.mipGap)} %`],
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

      <BottlenecksPanel dataset={dataset} plan={plan} check={check} />

      {plan.unmetUnits >= 1 && <UnmetPanel dataset={dataset} plan={plan} check={check} />}

      <Panel
        title="Shifts per machine and product"
        hint="Shifts over the year, line clears included. Utilisation = planned ÷ available shifts. Grey cells: the machine can't make that product. Line clears: large (product changes) / small (between lots). Red: the machine is fully used."
        actions={<GroupBySelect characteristics={dataset.characteristics} value={groupBy} onChange={setGroupBy} />}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-xs" data-testid="plan-table">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="py-1.5 pr-3 text-left font-medium">Machine</th>
                {groups.map((g) => (
                  <th key={g.key} className="whitespace-nowrap px-1 py-1.5 text-right font-medium" title={g.productIds.join(', ')}>
                    <span className="inline-flex items-center gap-1">
                      <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(g.colorIndex) }} />
                      {g.label}
                    </span>
                  </th>
                ))}
                <th className="py-1.5 pl-3 text-right font-medium">Total</th>
                <th className="whitespace-nowrap py-1.5 pl-3 text-right font-medium">Line clears</th>
                <th className="whitespace-nowrap py-1.5 pl-3 text-right font-medium">Clear time</th>
                <th className="w-40 py-1.5 pl-3 text-left font-medium">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {dataset.machines.map((m) => {
                const total = dataset.products.reduce((a, p) => a + (shiftsOf.get(`${m.id}/${p.id}`) ?? 0), 0);
                const lc = lineClears.get(m.id);
                const available = (check.machineHours.get(m.id) ?? []).reduce((a, b) => a + b, 0) / dataset.settings.shiftHours;
                const util = available > 0 ? (100 * total) / available : 0;
                const full = util >= 99.5;
                return (
                  <tr key={m.id} data-testid={`plan-row-${m.id}`} className="border-b border-line/50">
                    <td className="py-1 pr-3 font-medium">{m.name}</td>
                    {groups.map((g) => {
                      const can = g.productIds.some((id) => capable.has(`${m.id}/${id}`));
                      const s = g.productIds.reduce((a, id) => a + (shiftsOf.get(`${m.id}/${id}`) ?? 0), 0);
                      return (
                        <td
                          key={g.key}
                          className={`tabular px-1 py-1 text-right ${can ? '' : 'bg-surface-2/70'}`}
                          style={s >= 0.5 ? { background: `color-mix(in srgb, ${productColor(g.colorIndex)} ${Math.min(45, 8 + s / 15)}%, transparent)` } : undefined}
                        >
                          {s >= 0.5 ? fmt(s) : can ? <span className="text-faint">0</span> : ''}
                        </td>
                      );
                    })}
                    <td className="tabular py-1 pl-3 text-right font-medium">{fmt(total)}</td>
                    <td className="tabular whitespace-nowrap py-1 pl-3 text-right" data-testid={`line-clears-${m.id}`}>
                      {lc ? `${fmt(lc.large)} / ${fmt(lc.small)}` : '–'}
                    </td>
                    <td className="tabular whitespace-nowrap py-1 pl-3 text-right text-muted">{lc ? `${fmt(lc.hours)} h` : '–'}</td>
                    <td className="py-1 pl-3">
                      <span className="flex items-center gap-2">
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className={`block h-full rounded-full ${full ? '' : 'bg-accent'}`} style={{ width: `${Math.min(100, util)}%`, ...(full && { background: '#e15759' }) }} />
                        </span>
                        <span className="tabular w-10 text-right" data-testid={full ? `full-${m.id}` : undefined} style={full ? { color: '#e15759', fontWeight: 600 } : undefined}>
                          {fmt(util)} %
                        </span>
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
      <WarehousePanel dataset={dataset} plan={plan} />
      <TransportBreakdown dataset={dataset} plan={plan} />
    </>
  );
}
