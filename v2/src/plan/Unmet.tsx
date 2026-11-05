// Plan page: unmet demand per product and week, when demand exceeds capacity (R64).
import { productNames } from '../model/products';
import type { CapacityCheck } from '../model/demand';
import type { Dataset } from '../model/types';
import { fmt, productColor } from '../ui/palette';
import { Panel } from '../ui/Panel';
import type { PlanResult } from './lp';

const RED = '#e15759';

export function UnmetPanel({ dataset, plan, check }: { dataset: Dataset; plan: PlanResult; check: CapacityCheck }) {
  const weeks = check.weeks;
  const names = productNames(dataset);
  const pIndex = new Map(dataset.products.map((p, i) => [p.id, i]));
  const byProduct = new Map<string, number[]>();
  for (const u of plan.unmet) {
    if (!byProduct.has(u.productId)) byProduct.set(u.productId, new Array(weeks).fill(0));
    byProduct.get(u.productId)![u.week - 1] += u.units;
  }
  const rows = check.products
    .filter((pc) => pc.yearlyDemand > 0 && !dataset.products.find((p) => p.id === pc.productId)?.isPreSfg)
    .map((pc) => {
      const perWeek = byProduct.get(pc.productId) ?? new Array<number>(weeks).fill(0);
      const units = perWeek.reduce((a, b) => a + b, 0);
      return { pc, perWeek, units, share: units / pc.yearlyDemand };
    })
    .sort((a, b) => b.share - a.share || pIndex.get(a.pc.productId)! - pIndex.get(b.pc.productId)!);
  const short = rows.filter((r) => r.share >= 0.005);
  const totalDemand = rows.reduce((a, r) => a + r.pc.yearlyDemand, 0);

  return (
    <Panel
      title="Unmet demand"
      testId="unmet-panel"
      hint="Demand beyond capacity, per product: share of its yearly demand and units. Capacity is shared out so products fall short by about the same share. Each cell is one ISO week; darker red is a larger share of that week's demand left unmet."
    >
      <p className="mb-3 text-xs text-muted">
        <span className="tabular font-medium text-ink">{fmt(plan.unmetUnits)}</span> units unmet ({fmt((100 * plan.unmetUnits) / Math.max(1, totalDemand))} % of demand), across{' '}
        {short.length} of {rows.length} products.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="unmet-table">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="w-40 py-1.5 pr-3 text-left font-medium">Product</th>
              <th className="w-24 py-1.5 pr-3 text-right font-medium">Demand</th>
              <th className="w-24 py-1.5 pr-3 text-right font-medium">Unmet</th>
              <th className="w-36 py-1.5 pr-3 text-left font-medium">Share</th>
              <th className="py-1.5 text-left font-medium">Per week</th>
            </tr>
          </thead>
          <tbody>
            {short.map(({ pc, perWeek, units, share }) => (
              <tr key={pc.productId} data-testid={`unmet-${pc.productId}`} className="border-b border-line/50">
                <td className="whitespace-nowrap py-1 pr-3 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-2 w-2 rounded-sm" style={{ background: productColor(pIndex.get(pc.productId) ?? 0) }} />
                    {names.get(pc.productId) ?? pc.productId}
                  </span>
                </td>
                <td className="tabular py-1 pr-3 text-right text-muted">{fmt(pc.yearlyDemand)}</td>
                <td className="tabular py-1 pr-3 text-right">{fmt(units)}</td>
                <td className="py-1 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, 100 * share)}%`, background: RED }} />
                    </span>
                    <span className="tabular w-10 text-right">{fmt(100 * share)} %</span>
                  </span>
                </td>
                <td className="py-1">
                  <span className="flex h-4 min-w-[156px] gap-px">
                    {perWeek.map((u, w) => {
                      const d = pc.weeklyDemand[w] ?? 0;
                      const s = d > 0 ? Math.min(1, u / d) : 0;
                      return (
                        <span
                          key={w}
                          title={`Week ${w + 1}: ${fmt(u)} of ${fmt(d)} units unmet (${fmt(100 * s)} %)`}
                          className="min-w-0 flex-1 rounded-[1px] bg-surface-2"
                          style={s >= 0.005 ? { background: `color-mix(in srgb, ${RED} ${Math.round(15 + 85 * s)}%, transparent)` } : undefined}
                        />
                      );
                    })}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
