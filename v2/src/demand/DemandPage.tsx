import { useMemo, useState } from 'react';
import { checkCapacity, type CapacityCheck, type ProductCheck } from '../model/demand';
import type { Dataset } from '../model/types';
import { isoWeekRange, isoWeeks } from '../model/weeks';
import { useDataset } from '../store/DatasetContext';
import { OptionalNumberCell } from '../ui/cells';
import { fmt, productColor } from '../ui/palette';
import { groupProducts, productName } from '../model/products';
import { GroupBySelect } from '../ui/GroupBy';
import { Panel } from '../ui/Panel';

const RED = '#e15759';
const AMBER = '#edc948';

/** `115 385`: space-grouped, so the decimal-comma parser reads it back unchanged. */
const units = (n: number) => Math.round(n).toLocaleString('sv-SE').replace(/\s/g, ' ');

const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function DemandPage() {
  const { dataset, errors } = useDataset();
  const check = useMemo(() => checkCapacity(dataset), [dataset]);
  const demandErrors = errors.filter((e) => e.startsWith('Demand'));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight">Demand {dataset.settings.planningYear}</h2>
        <p className="text-sm text-muted">
          Units per ISO week. Enter a yearly total per product; it spreads over the weeks in proportion to the days the demand site is open, so holiday weeks get less. Type in a week to pin it — the rest of the total
          spreads over the other weeks. Clear a pinned week to unpin it.
        </p>
      </div>
      {demandErrors.length > 0 && (
        <div role="alert" data-testid="demand-problems" className="rounded-xl border border-[#edc948]/60 bg-[#edc948]/10 px-4 py-3 text-sm">
          <ul className="list-disc pl-5 text-muted">
            {demandErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      <Summary check={check} />
      <div className="grid gap-6 lg:grid-cols-2">
        <ProductCheckTable dataset={dataset} check={check} />
        <MachineLoadTable check={check} />
      </div>
      <WeeklyTable dataset={dataset} check={check} />
    </div>
  );
}


function Summary({ check }: { check: CapacityCheck }) {
  const short = check.products.filter((p) => p.shortfall > 0.5);
  const peaks = check.products.filter((p) => p.overWeeks.length > 0);
  const overloaded = check.machines.filter((m) => m.loadPct > 100);
  const maxLoad = Math.max(0, ...check.machines.map((m) => m.loadPct));
  const items: [string, string, string | undefined][] = [
    ['Total demand', `${fmt(check.products.reduce((s, p) => s + p.yearlyDemand, 0))} units`, undefined],
    ['Products short', String(short.length), short.length ? RED : undefined],
    ['Products with peak weeks', String(peaks.length), peaks.length ? AMBER : undefined],
    ['Machines over 100 %', String(overloaded.length), overloaded.length ? RED : undefined],
    ['Highest machine load', `${fmt(maxLoad)} %`, maxLoad > 100 ? RED : maxLoad > 90 ? AMBER : undefined],
  ];
  return (
    <dl data-testid="demand-summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {items.map(([label, value, color]) => (
        <div key={label} className="rounded-xl border border-line bg-surface px-4 py-3" style={color ? { borderColor: color } : undefined}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="tabular mt-0.5 text-lg font-semibold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function WeeklyTable({ dataset, check }: { dataset: Dataset; check: CapacityCheck }) {
  const { dispatch } = useDataset();
  const year = dataset.settings.planningYear;
  const demandOf = (productId: string) => dataset.demand.find((d) => d.productId === productId);
  const checkOf = new Map(check.products.map((p) => [p.productId, p]));
  const [groupBy, setGroupBy] = useState<string | null>(null);
  // Pre-SFGs have no demand of their own: B consumes them (R47).
  const sfgs = dataset.products.filter((p) => !p.isPreSfg);
  if (groupBy) return <GroupedWeeklyTable dataset={dataset} check={check} groupBy={groupBy} setGroupBy={setGroupBy} />;

  return (
    <Panel
      title="Weekly demand"
      hint="Bold = pinned week. Red = more than the product's machines can make that week (needs stock built earlier)."
      actions={<GroupBySelect characteristics={dataset.characteristics} value={groupBy} onChange={setGroupBy} />}
    >
      <div className="max-h-[75vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th className="border-b border-line px-2 py-1.5 text-left font-medium text-muted">Week</th>
              {sfgs.map((p) => (
                <th key={p.id} className="min-w-[5.5rem] whitespace-nowrap border-b border-line px-1 py-1.5 text-right font-medium" title={p.id}>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(dataset.products.indexOf(p)) }} />
                    {productName(dataset, p)}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              <th className="border-b border-line px-2 py-1 text-left font-medium text-muted">Year total</th>
              {sfgs.map((p) => {
                const d = demandOf(p.id);
                const pins = d ? Object.keys(d.weekOverrides).length : 0;
                return (
                  <th key={p.id} className="border-b border-line px-0.5 py-1 font-normal">
                    <OptionalNumberCell
                      label={`${p.id} yearly demand`}
                      value={d?.yearlyUnits ?? 0}
                      display={units(d?.yearlyUnits ?? 0)}
                      className="font-semibold text-ink"
                      onCommit={(v) => dispatch({ type: 'setDemandTotal', productId: p.id, yearlyUnits: v ?? 0 })}
                    />
                    {pins > 0 && (
                      <button
                        type="button"
                        className="mt-0.5 w-full text-right text-[10px] text-accent hover:underline"
                        onClick={() => dispatch({ type: 'clearDemandOverrides', productId: p.id })}
                      >
                        unpin {pins} {pins === 1 ? 'week' : 'weeks'}
                      </button>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {isoWeeks(year).map((week) => (
              <tr key={week} className="hover:bg-surface-2/60">
                <td className="tabular whitespace-nowrap border-b border-line/50 px-2 py-0.5 text-muted">
                  <span className="font-medium text-ink">W{week}</span> <span className="text-faint">{shortDate(isoWeekRange(year, week).from)}</span>
                </td>
                {sfgs.map((p) => {
                  const pc = checkOf.get(p.id)!;
                  const pinned = demandOf(p.id)?.weekOverrides[week];
                  const value = pc.weeklyDemand[week - 1];
                  const max = pc.weeklyMax[week - 1];
                  const over = value > max + 1e-9;
                  return (
                    <td key={p.id} className="border-b border-line/50 p-0" style={over ? { background: `color-mix(in srgb, ${RED} 18%, transparent)` } : undefined}>
                      <OptionalNumberCell
                        label={`${p.id} week ${week}`}
                        value={pinned ?? null}
                        display={units(value)}
                        title={`Max ${units(max)} units this week${pinned !== undefined ? ' · pinned' : ''}`}
                        className={pinned !== undefined ? 'font-semibold text-ink' : 'text-muted'}
                        onCommit={(v) => dispatch({ type: 'setDemandWeek', productId: p.id, week, units: v })}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function GroupedWeeklyTable({ dataset, check, groupBy, setGroupBy }: { dataset: Dataset; check: CapacityCheck; groupBy: string; setGroupBy: (v: string | null) => void }) {
  const year = dataset.settings.planningYear;
  const checkOf = new Map(check.products.map((p) => [p.productId, p]));
  const groups = groupProducts(dataset, dataset.products.filter((p) => !p.isPreSfg), groupBy);
  const sum = (ids: string[], f: (pc: ProductCheck) => number) => ids.reduce((a, id) => a + f(checkOf.get(id)!), 0);
  return (
    <Panel
      title="Weekly demand"
      hint="Summed per group (read-only). Group by product to edit."
      actions={<GroupBySelect characteristics={dataset.characteristics} value={groupBy} onChange={setGroupBy} />}
    >
      <div className="max-h-[75vh] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-xs" data-testid="demand-grouped">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr>
              <th className="border-b border-line px-2 py-1.5 text-left font-medium text-muted">Week</th>
              {groups.map((g) => (
                <th key={g.key} className="min-w-[5.5rem] whitespace-nowrap border-b border-line px-2 py-1.5 text-right font-medium" title={`${g.productIds.length} products`}>
                  <span className="inline-flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(g.colorIndex) }} />
                    {g.label}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              <th className="border-b border-line px-2 py-1 text-left font-medium text-muted">Year total</th>
              {groups.map((g) => (
                <th key={g.key} className="tabular border-b border-line px-2 py-1 text-right font-semibold">
                  {units(sum(g.productIds, (pc) => pc.yearlyDemand))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isoWeeks(year).map((week) => (
              <tr key={week} className="hover:bg-surface-2/60">
                <td className="tabular whitespace-nowrap border-b border-line/50 px-2 py-0.5 text-muted">
                  <span className="font-medium text-ink">W{week}</span> <span className="text-faint">{shortDate(isoWeekRange(year, week).from)}</span>
                </td>
                {groups.map((g) => (
                  <td key={g.key} className="tabular border-b border-line/50 px-2 py-0.5 text-right text-muted">
                    {units(sum(g.productIds, (pc) => pc.weeklyDemand[week - 1]))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function ProductCheckTable({ dataset, check }: { dataset: Dataset; check: CapacityCheck }) {
  return (
    <Panel title="Capacity check: products" hint="Max = all capable machines making only this product. A shortfall means the demand can't be met even building stock from week 1.">
      <table className="w-full text-xs" data-testid="product-check">
        <thead>
          <tr className="border-b border-line text-left text-muted">
            <th className="py-1.5 font-medium">Product</th>
            <th className="py-1.5 text-right font-medium">Demand</th>
            <th className="py-1.5 text-right font-medium">% of max</th>
            <th className="py-1.5 pl-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {check.products.map((p, i) => {
            if (dataset.products[i]?.isPreSfg) return null;
            const pct = p.maxYearlyOutput > 0 ? (100 * p.yearlyDemand) / p.maxYearlyOutput : p.yearlyDemand > 0 ? Infinity : 0;
            const status =
              p.shortfall > 0.5 ? (
                <span style={{ color: RED }} className="font-medium">
                  short {units(p.shortfall)}
                </span>
              ) : p.overWeeks.length > 0 ? (
                <span title={`Weeks ${p.overWeeks.join(', ')}`}>peak in {p.overWeeks.length} wk — build stock</span>
              ) : (
                <span className="text-faint">ok</span>
              );
            return (
              <tr key={p.productId} data-testid={`check-${p.productId}`} className="border-b border-line/50">
                <td className="py-1">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(i) }} />
                    {dataset.products[i] ? productName(dataset, dataset.products[i]) : p.productId}
                  </span>
                </td>
                <td className="tabular py-1 text-right">{units(p.yearlyDemand)}</td>
                <td className="tabular py-1 text-right">{Number.isFinite(pct) ? `${fmt(pct)} %` : '∞'}</td>
                <td className="py-1 pl-3">{status}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function MachineLoadTable({ check }: { check: CapacityCheck }) {
  return (
    <Panel title="Estimated machine load" hint="Each product's weekly demand split over its machines in proportion to their output. No line clears yet, so real load will be higher.">
      <ul className="space-y-1.5 text-xs" data-testid="machine-load">
        {check.machines.map((m) => {
          const pct = m.loadPct;
          const color = pct > 100 ? RED : pct > 90 ? AMBER : 'var(--accent)';
          return (
            <li key={m.machineId} data-testid={`load-${m.machineId}`} className="grid grid-cols-[2.5rem_1fr_3.5rem] items-center gap-2">
              <span className="font-medium">{m.machineId}</span>
              <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
              </span>
              <span className="tabular text-right" style={pct > 100 ? { color: RED } : undefined}>
                {Number.isFinite(pct) ? `${fmt(pct)} %` : '∞'}
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
