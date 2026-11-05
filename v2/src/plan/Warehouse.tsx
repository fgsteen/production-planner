// Plan page: stock per storage location and week, by product, against capacity (R46).
import { useState } from 'react';
import { groupProducts, sumByGroup, type ProductGroup } from '../model/products';
import type { Dataset, Id } from '../model/types';
import { GroupBySelect } from '../ui/GroupBy';
import { fmt, productColor } from '../ui/palette';
import { Panel } from '../ui/Panel';
import { poolName } from './limits';
import type { PlanResult } from './lp';
import { Actions, GroupHeader, Legend, Toggle } from './PlanDetails';

const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const fmt1 = (n: number) => one.format(n);

const RED = '#e15759';

export function WarehousePanel({ dataset, plan }: { dataset: Dataset; plan: PlanResult }) {
  const [view, setView] = useState<'Chart' | 'Table'>('Chart');
  const pools = plan.storage.filter((p) => p.locationIds.length > 0);
  const [poolIdx, setPoolIdx] = useState(0);
  const [groupBy, setGroupBy] = useState<Id | null>(null);
  const groups = groupProducts(dataset, dataset.products, groupBy);
  const used = new Set(pools.flatMap((p) => p.byProduct.map((b) => b.productId)));
  const weeks = pools[0]?.pallets.length ?? 0;

  return (
    <Panel
      title="Warehouses"
      testId="warehouse-panel"
      hint="Pallets in stock at the end of each ISO week, coloured by product (or group). The line is the location's capacity. Locations at a site that take the same goods are pooled."
      actions={
        <Actions>
          <GroupBySelect characteristics={dataset.characteristics} value={groupBy} onChange={setGroupBy} />
          <Toggle label="Warehouse view" value={view} options={['Chart', 'Table'] as const} onChange={setView} />
        </Actions>
      }
    >
      {view === 'Chart' ? (
        <div className="space-y-4" data-testid="warehouse-chart">
          {pools.map((pool, k) => {
            const peak = Math.max(...pool.pallets);
            const max = Math.max(1, pool.capacityPallets, peak);
            return (
              <div key={k} data-testid={`warehouse-${pool.siteId}-${pool.kind}`}>
                <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium">{poolName(dataset, pool)}</span>
                  <span className="tabular text-muted">
                    peak {fmt(peak)} of {fmt(pool.capacityPallets)} pallets ({pool.capacityPallets > 0 ? fmt((100 * peak) / pool.capacityPallets) : '–'} %)
                  </span>
                </div>
                <div className="relative flex h-20 items-end gap-px">
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed"
                    style={{ bottom: `${(100 * pool.capacityPallets) / max}%`, borderColor: RED }}
                    title={`Capacity ${fmt(pool.capacityPallets)} pallets`}
                  />
                  {Array.from({ length: weeks }, (_, w) => {
                    const entries = sumByGroup(
                      groups,
                      pool.byProduct.map((b) => [b.productId, b.pallets[w]] as const),
                    ).filter(([, v]) => v >= 0.05);
                    const tip = `Week ${w + 1}: ${fmt1(pool.pallets[w])} pallets${entries.length ? ` — ${entries.map(([g, v]) => `${g.label} ${fmt1(v)}`).join(', ')}` : ''}`;
                    return (
                      <div key={w} title={tip} className="flex h-full min-w-0 flex-1 flex-col-reverse bg-surface-2/50">
                        {entries.map(([g, v]) => (
                          <div key={g.key} style={{ height: `${(100 * v) / max}%`, background: productColor(g.colorIndex) }} />
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="tabular flex gap-px text-[10px] text-faint">
            {Array.from({ length: weeks }, (_, w) => (
              <div key={w} className="min-w-0 flex-1 text-center">
                {(w + 1) % 4 === 1 ? w + 1 : ''}
              </div>
            ))}
          </div>
          <Legend groups={groups} productIds={used} />
        </div>
      ) : (
        <div>
          <label className="mb-2 inline-flex items-center gap-2 text-xs text-muted">
            Location
            <select value={poolIdx} onChange={(e) => setPoolIdx(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1 text-ink">
              {pools.map((pool, k) => (
                <option key={k} value={k}>
                  {poolName(dataset, pool)}
                </option>
              ))}
            </select>
          </label>
          {pools[poolIdx] && <WarehouseTable groups={groups} pool={pools[poolIdx]} />}
        </div>
      )}
    </Panel>
  );
}

function WarehouseTable({ groups, pool }: { groups: ProductGroup[]; pool: PlanResult['storage'][number] }) {
  const held = new Map(pool.byProduct.map((b) => [b.productId, b.pallets]));
  const columns = groups
    .filter((g) => g.productIds.some((id) => held.has(id)))
    .map((g) => ({ g, pallets: pool.pallets.map((_, w) => g.productIds.reduce((a, id) => a + (held.get(id)?.[w] ?? 0), 0)) }));
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full text-xs" data-testid="warehouse-table">
        <thead className="sticky top-0 bg-surface">
          <tr className="border-b border-line text-muted">
            <th className="py-1.5 pr-3 text-left font-medium">Week</th>
            {columns.map(({ g }) => (
              <GroupHeader key={g.key} group={g} />
            ))}
            <th className="px-2 py-1.5 text-right font-medium">Total</th>
            <th className="py-1.5 pl-2 text-right font-medium">Full</th>
          </tr>
        </thead>
        <tbody>
          {pool.pallets.map((total, w) => (
            <tr key={w} className="border-b border-line/50">
              <td className="tabular py-1 pr-3">{w + 1}</td>
              {columns.map(({ g, pallets }) => (
                <td key={g.key} className="tabular px-2 py-1 text-right">
                  {pallets[w] >= 0.05 ? fmt1(pallets[w]) : <span className="text-faint">–</span>}
                </td>
              ))}
              <td className="tabular px-2 py-1 text-right font-medium">{fmt1(total)}</td>
              <td className="tabular py-1 pl-2 text-right">{pool.capacityPallets > 0 ? `${fmt((100 * total) / pool.capacityPallets)} %` : '–'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
