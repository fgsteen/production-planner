// Plan page detail views: the weekly machine plan (R42) and the B → A transport breakdown (R43).
import { useState } from 'react';
import type { CapacityCheck } from '../model/demand';
import type { Dataset, Id } from '../model/types';
import { fmt, productColor } from '../ui/palette';
import type { PlanResult } from './lp';
import { productName } from '../model/products';

const card = 'rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmt1 = (n: number) => one.format(n);

function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-line p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={o === value}
          onClick={() => onChange(o)}
          className={`rounded-md px-2.5 py-1 ${o === value ? 'bg-surface-2 font-medium' : 'text-muted hover:text-ink'}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Legend({ dataset, productIds }: { dataset: Dataset; productIds: Set<Id> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {dataset.products.map((p, i) =>
        productIds.has(p.id) ? (
          <li key={p.id} className="inline-flex items-center gap-1 whitespace-nowrap" title={p.id}>
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(i) }} />
            {productName(dataset, p)}
          </li>
        ) : null,
      )}
    </ul>
  );
}

/** Shifts per machine, week and product. */
function useWeekGrid(dataset: Dataset, plan: PlanResult, weeks: number) {
  const grid = new Map<Id, Map<Id, number>[]>(dataset.machines.map((m) => [m.id, Array.from({ length: weeks }, () => new Map())]));
  for (const s of plan.weekShifts) grid.get(s.machineId)?.[s.week - 1].set(s.productId, s.shifts);
  return grid;
}

// --- R42: weekly machine plan --------------------------------------------------------------------

export function WeeklyMachinePlan({ dataset, plan, check }: { dataset: Dataset; plan: PlanResult; check: CapacityCheck }) {
  const [view, setView] = useState<'Chart' | 'Table'>('Chart');
  const [machineId, setMachineId] = useState<Id>(dataset.machines[0]?.id ?? '');
  const { weeks } = check;
  const grid = useWeekGrid(dataset, plan, weeks);
  const available = (id: Id) => (check.machineHours.get(id) ?? []).map((h) => h / dataset.settings.shiftHours);
  const pIndex = new Map(dataset.products.map((p, i) => [p.id, i]));
  const used = new Set(plan.weekShifts.map((s) => s.productId));

  return (
    <section className={card} data-testid="machine-week-plan">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold tracking-tight">Weekly machine plan</h3>
          <p className="mt-0.5 text-xs text-muted">
            Shifts per ISO week, coloured by product. The grey backdrop is the shifts available that week (holidays and maintenance removed).
          </p>
        </div>
        <Toggle label="Weekly machine plan view" value={view} options={['Chart', 'Table'] as const} onChange={setView} />
      </header>

      {view === 'Chart' ? (
        <div className="space-y-1.5" data-testid="machine-week-chart">
          {dataset.machines.map((m) => {
            const avail = available(m.id);
            const max = Math.max(1, ...avail);
            const planned = grid.get(m.id)!.map((w) => [...w.values()].reduce((a, b) => a + b, 0));
            const totalAvail = avail.reduce((a, b) => a + b, 0);
            const util = totalAvail > 0 ? (100 * planned.reduce((a, b) => a + b, 0)) / totalAvail : 0;
            return (
              <div key={m.id} className="flex items-end gap-3" data-testid={`machine-week-${m.id}`}>
                <div className="w-24 shrink-0 text-xs">
                  <div className="font-medium">{m.name}</div>
                  <div className="tabular text-muted">{fmt(util)} % used</div>
                </div>
                <div className="flex h-10 min-w-0 flex-1 items-end gap-px">
                  {grid.get(m.id)!.map((byProduct, w) => {
                    const entries = [...byProduct].sort((a, b) => pIndex.get(a[0])! - pIndex.get(b[0])!);
                    const tip = `${m.name} · week ${w + 1}: ${entries.map(([p, s]) => `${p} ${fmt1(s)}`).join(', ') || 'idle'} (${fmt1(planned[w])} of ${fmt1(avail[w])} shifts)`;
                    return (
                      <div key={w} title={tip} className="relative h-full min-w-0 flex-1">
                        <div className="absolute inset-x-0 bottom-0 rounded-[1px] bg-surface-2" style={{ height: `${(100 * avail[w]) / max}%` }} />
                        <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
                          {entries.map(([p, s]) => (
                            <div key={p} style={{ height: `${(40 * s) / max}px`, background: productColor(pIndex.get(p)!) }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="flex gap-3">
            <div className="w-24 shrink-0" />
            <div className="tabular flex min-w-0 flex-1 gap-px text-[10px] text-faint">
              {Array.from({ length: weeks }, (_, w) => (
                <div key={w} className="min-w-0 flex-1 text-center">
                  {(w + 1) % 4 === 1 ? w + 1 : ''}
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2">
            <Legend dataset={dataset} productIds={used} />
          </div>
        </div>
      ) : (
        <MachineWeekTable dataset={dataset} grid={grid} available={available(machineId)} machineId={machineId} onMachine={setMachineId} />
      )}
    </section>
  );
}

function MachineWeekTable({
  dataset,
  grid,
  available,
  machineId,
  onMachine,
}: {
  dataset: Dataset;
  grid: Map<Id, Map<Id, number>[]>;
  available: number[];
  machineId: Id;
  onMachine: (id: Id) => void;
}) {
  const capable = dataset.products.flatMap((p, i) => (dataset.capabilities.some((c) => c.machineId === machineId && c.productId === p.id) ? [{ p, i }] : []));
  const rows = grid.get(machineId) ?? [];
  return (
    <div>
      <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted">
        Machine
        <select value={machineId} onChange={(e) => onMachine(e.target.value)} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">
          {dataset.machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full text-xs" data-testid="machine-week-table">
          <thead className="sticky top-0 bg-surface">
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 pr-3 text-left font-medium">Week</th>
              {capable.map(({ p, i }) => (
                <th key={p.id} className="whitespace-nowrap px-2 py-1.5 text-right font-medium" title={p.id}>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(i) }} />
                    {productName(dataset, p)}
                  </span>
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-medium">Planned</th>
              <th className="px-2 py-1.5 text-right font-medium">Available</th>
              <th className="py-1.5 pl-2 text-right font-medium">Used</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((byProduct, w) => {
              const planned = [...byProduct.values()].reduce((a, b) => a + b, 0);
              return (
                <tr key={w} className="border-b border-line/50">
                  <td className="tabular py-1 pr-3">{w + 1}</td>
                  {capable.map(({ p }) => {
                    const s = byProduct.get(p.id) ?? 0;
                    return (
                      <td key={p.id} className="tabular px-2 py-1 text-right">
                        {s >= 0.05 ? fmt1(s) : <span className="text-faint">–</span>}
                      </td>
                    );
                  })}
                  <td className="tabular px-2 py-1 text-right font-medium">{fmt1(planned)}</td>
                  <td className="tabular px-2 py-1 text-right text-muted">{fmt1(available[w] ?? 0)}</td>
                  <td className="tabular py-1 pl-2 text-right">{available[w] > 0 ? `${fmt((100 * planned) / available[w])} %` : '–'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- R43: transport breakdown B → A --------------------------------------------------------------

export function TransportBreakdown({ dataset, plan }: { dataset: Dataset; plan: PlanResult }) {
  const [unit, setUnit] = useState<'Pallets' | 'Units'>('Pallets');
  return (
    <>
      {plan.lanes.map((lane) => {
        const def = dataset.truckLanes.find((l) => l.id === lane.laneId)!;
        const from = dataset.sites.find((s) => s.id === def.fromSiteId)?.name ?? def.fromSiteId;
        const to = dataset.sites.find((s) => s.id === def.toSiteId)?.name ?? def.toSiteId;
        const shipments = plan.shipments.filter((s) => s.laneId === lane.laneId);
        const shipped = new Set(shipments.map((s) => s.productId));
        const products = dataset.products.flatMap((p, i) => (shipped.has(p.id) ? [{ p, i }] : []));
        const cell = new Map(shipments.map((s) => [`${s.week}/${s.productId}`, s]));
        const value = (s: { units: number; pallets: number } | undefined) => (s ? (unit === 'Pallets' ? s.pallets : s.units) : 0);
        const totalUnits = shipments.reduce((a, s) => a + s.units, 0);
        const totalPallets = lane.weeks.reduce((a, w) => a + w.pallets, 0);
        const trucks = lane.weeks.reduce((a, w) => a + w.trucksUsed, 0);
        const truckLimit = lane.weeks.reduce((a, w) => a + w.truckLimit, 0);
        const atLimit = lane.weeks.filter((w) => w.truckLimit > 0 && w.trucksUsed >= w.truckLimit).length;
        return (
          <section key={lane.laneId} className={card} data-testid={`transport-${lane.laneId}`}>
            <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold tracking-tight">
                  Transport {from} → {to}
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  Shipped per ISO week and product. Trucks = shipped pallets ÷ {lane.palletsPerTruck}, rounded up.{' '}
                  {def.runsOnWeekendsAndHolidays
                    ? 'This lane runs every day, so the limit is the same each week.'
                    : 'Trucks run on weekdays only, so the limit drops in weeks with weekday holidays.'}
                </p>
              </div>
              <Toggle label="Transport unit" value={unit} options={['Pallets', 'Units'] as const} onChange={setUnit} />
            </header>
            <dl className="mb-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4" data-testid="transport-summary">
              {(
                [
                  ['Units shipped', fmt(totalUnits)],
                  ['Pallets shipped', fmt(totalPallets)],
                  ['Trucks used / allowed', `${fmt(trucks)} / ${fmt(truckLimit)}`],
                  ['Weeks at the truck limit', `${atLimit} of ${lane.weeks.length}`],
                ] as const
              ).map(([label, v]) => (
                <div key={label} className="rounded-lg bg-surface-2/60 px-3 py-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="tabular mt-0.5 text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="max-h-[28rem] overflow-auto">
              <table className="w-full text-xs" data-testid="transport-table">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line text-muted">
                    <th className="py-1.5 pr-3 text-left font-medium">Week</th>
                    {products.map(({ p, i }) => (
                      <th key={p.id} className="whitespace-nowrap px-2 py-1.5 text-right font-medium" title={p.id}>
                        <span className="inline-flex items-center gap-1">
                          <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(i) }} />
                          {productName(dataset, p)}
                        </span>
                      </th>
                    ))}
                    <th className="px-2 py-1.5 text-right font-medium">Total</th>
                    <th className="w-44 py-1.5 pl-3 text-left font-medium">Trucks used / limit</th>
                  </tr>
                </thead>
                <tbody>
                  {lane.weeks.map((w, k) => {
                    const total = unit === 'Pallets' ? w.pallets : products.reduce((a, { p }) => a + value(cell.get(`${k + 1}/${p.id}`)), 0);
                    const full = w.truckLimit > 0 && w.trucksUsed >= w.truckLimit;
                    return (
                      <tr key={k} className="border-b border-line/50" data-testid={`transport-week-${k + 1}`}>
                        <td className="tabular py-1 pr-3">{k + 1}</td>
                        {products.map(({ p }) => {
                          const v = value(cell.get(`${k + 1}/${p.id}`));
                          return (
                            <td key={p.id} className="tabular px-2 py-1 text-right">
                              {v >= 0.5 ? fmt(v) : <span className="text-faint">–</span>}
                            </td>
                          );
                        })}
                        <td className="tabular px-2 py-1 text-right font-medium">{fmt(total)}</td>
                        <td className="py-1 pl-3">
                          <span className="flex items-center gap-2">
                            <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${w.truckLimit > 0 ? Math.min(100, (100 * w.trucksUsed) / w.truckLimit) : 0}%`, background: full ? '#e15759' : 'var(--color-accent, #4e79a7)' }}
                              />
                            </span>
                            <span className="tabular w-12 text-right">
                              {w.trucksUsed} / {w.truckLimit}
                            </span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </>
  );
}
