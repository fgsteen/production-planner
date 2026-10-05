// Plan page detail views: the weekly machine plan (R42) and the B → A transport breakdown (R43).
import { useState, type ReactNode } from 'react';
import type { CapacityCheck } from '../model/demand';
import type { Dataset, Id } from '../model/types';
import { fmt, productColor } from '../ui/palette';
import type { PlanResult } from './lp';
import { groupProducts, sumByGroup, type ProductGroup } from '../model/products';
import { GroupBySelect } from '../ui/GroupBy';
import { Panel } from '../ui/Panel';

const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmt1 = (n: number) => one.format(n);

export function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
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

/** Legend of the groups (products, or variants of a characteristic) that hold any of `productIds`. */
export function Legend({ groups, productIds }: { groups: ProductGroup[]; productIds: Set<Id> }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {groups
        .filter((g) => g.productIds.some((id) => productIds.has(id)))
        .map((g) => (
          <li key={g.key} className="inline-flex items-center gap-1 whitespace-nowrap" title={g.productIds.join(', ')}>
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(g.colorIndex) }} />
            {g.label}
          </li>
        ))}
    </ul>
  );
}

/** A column header with the group's colour and label. */
export function GroupHeader({ group }: { group: ProductGroup }) {
  return (
    <th className="whitespace-nowrap px-2 py-1.5 text-right font-medium" title={group.productIds.join(', ')}>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(group.colorIndex) }} />
        {group.label}
      </span>
    </th>
  );
}

/** Panel actions side by side, e.g. "Group by" and a view toggle. */
export function Actions({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
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
  const [groupBy, setGroupBy] = useState<Id | null>(null);
  const groups = groupProducts(dataset, dataset.products, groupBy);
  const { weeks } = check;
  const grid = useWeekGrid(dataset, plan, weeks);
  const available = (id: Id) => (check.machineHours.get(id) ?? []).map((h) => h / dataset.settings.shiftHours);
  const used = new Set(plan.weekShifts.map((s) => s.productId));

  return (
    <Panel
      title="Weekly machine plan"
      testId="machine-week-plan"
      hint="Shifts per ISO week, coloured by product (or group). The grey backdrop is the shifts available that week (holidays and maintenance removed)."
      actions={
        <Actions>
          <GroupBySelect characteristics={dataset.characteristics} value={groupBy} onChange={setGroupBy} />
          <Toggle label="Weekly machine plan view" value={view} options={['Chart', 'Table'] as const} onChange={setView} />
        </Actions>
      }
    >

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
                    const entries = sumByGroup(groups, byProduct);
                    const tip = `${m.name} · week ${w + 1}: ${entries.map(([g, s]) => `${g.label} ${fmt1(s)}`).join(', ') || 'idle'} (${fmt1(planned[w])} of ${fmt1(avail[w])} shifts)`;
                    return (
                      <div key={w} title={tip} className="relative h-full min-w-0 flex-1">
                        <div className="absolute inset-x-0 bottom-0 rounded-[1px] bg-surface-2" style={{ height: `${(100 * avail[w]) / max}%` }} />
                        <div className="absolute inset-x-0 bottom-0 flex flex-col-reverse">
                          {entries.map(([g, s]) => (
                            <div key={g.key} style={{ height: `${(40 * s) / max}px`, background: productColor(g.colorIndex) }} />
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
            <Legend groups={groups} productIds={used} />
          </div>
        </div>
      ) : (
        <MachineWeekTable dataset={dataset} groups={groups} grid={grid} available={available(machineId)} machineId={machineId} onMachine={setMachineId} />
      )}
    </Panel>
  );
}

function MachineWeekTable({
  dataset,
  groups,
  grid,
  available,
  machineId,
  onMachine,
}: {
  dataset: Dataset;
  groups: ProductGroup[];
  grid: Map<Id, Map<Id, number>[]>;
  available: number[];
  machineId: Id;
  onMachine: (id: Id) => void;
}) {
  const capable = groups.filter((g) => g.productIds.some((id) => dataset.capabilities.some((c) => c.machineId === machineId && c.productId === id)));
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
              {capable.map((g) => (
                <GroupHeader key={g.key} group={g} />
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
                  {capable.map((g) => {
                    const s = g.productIds.reduce((a, id) => a + (byProduct.get(id) ?? 0), 0);
                    return (
                      <td key={g.key} className="tabular px-2 py-1 text-right">
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
  const [groupBy, setGroupBy] = useState<Id | null>(null);
  const groups = groupProducts(dataset, dataset.products, groupBy);
  return (
    <>
      {plan.lanes.map((lane) => {
        const def = dataset.truckLanes.find((l) => l.id === lane.laneId)!;
        const from = dataset.sites.find((s) => s.id === def.fromSiteId)?.name ?? def.fromSiteId;
        const to = dataset.sites.find((s) => s.id === def.toSiteId)?.name ?? def.toSiteId;
        const shipments = plan.shipments.filter((s) => s.laneId === lane.laneId);
        const shipped = new Set(shipments.map((s) => s.productId));
        const columns = groups.filter((g) => g.productIds.some((id) => shipped.has(id)));
        const cell = new Map(shipments.map((s) => [`${s.week}/${s.productId}`, s]));
        const value = (s: { units: number; pallets: number } | undefined) => (s ? (unit === 'Pallets' ? s.pallets : s.units) : 0);
        const groupValue = (week: number, g: ProductGroup) => g.productIds.reduce((a, id) => a + value(cell.get(`${week}/${id}`)), 0);
        const totalUnits = shipments.reduce((a, s) => a + s.units, 0);
        const totalPallets = lane.weeks.reduce((a, w) => a + w.pallets, 0);
        const trucks = lane.weeks.reduce((a, w) => a + w.trucksUsed, 0);
        const truckLimit = lane.weeks.reduce((a, w) => a + w.truckLimit, 0);
        const atLimit = lane.weeks.filter((w) => w.truckLimit > 0 && w.trucksUsed >= w.truckLimit).length;
        return (
          <Panel
            key={lane.laneId}
            title={`Transport ${from} → ${to}`}
            testId={`transport-${lane.laneId}`}
            hint={
              <>
                Shipped per ISO week and product. Trucks = shipped pallets ÷ {lane.palletsPerTruck}, rounded up.{' '}
                {def.runsOnWeekendsAndHolidays
                  ? 'This lane runs every day, so the limit is the same each week.'
                  : 'Trucks run on weekdays only, so the limit drops in weeks with weekday holidays.'}
              </>
            }
            actions={
              <Actions>
                <GroupBySelect characteristics={dataset.characteristics} value={groupBy} onChange={setGroupBy} />
                <Toggle label="Transport unit" value={unit} options={['Pallets', 'Units'] as const} onChange={setUnit} />
              </Actions>
            }
          >
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
                    {columns.map((g) => (
                      <GroupHeader key={g.key} group={g} />
                    ))}
                    <th className="px-2 py-1.5 text-right font-medium">Total</th>
                    <th className="w-44 py-1.5 pl-3 text-left font-medium">Trucks used / limit</th>
                  </tr>
                </thead>
                <tbody>
                  {lane.weeks.map((w, k) => {
                    const total = unit === 'Pallets' ? w.pallets : columns.reduce((a, g) => a + groupValue(k + 1, g), 0);
                    const full = w.truckLimit > 0 && w.trucksUsed >= w.truckLimit;
                    return (
                      <tr key={k} className="border-b border-line/50" data-testid={`transport-week-${k + 1}`}>
                        <td className="tabular py-1 pr-3">{k + 1}</td>
                        {columns.map((g) => {
                          const v = groupValue(k + 1, g);
                          return (
                            <td key={g.key} className="tabular px-2 py-1 text-right">
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
          </Panel>
        );
      })}
    </>
  );
}
