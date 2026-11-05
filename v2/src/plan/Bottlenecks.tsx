// Plan page: what limits the plan, ranked (R39).
import { productNames } from '../model/products';
import type { CapacityCheck } from '../model/demand';
import type { Dataset } from '../model/types';
import { fmt } from '../ui/palette';
import { Panel } from '../ui/Panel';
import { findBottlenecks, poolId, poolName, type Bottleneck } from './limits';
import type { PlanResult } from './lp';

const RED = '#e15759';
/** Short products named per entry; the rest are counted. */
const MAX_NAMES = 4;

export function BottlenecksPanel({ dataset, plan, check }: { dataset: Dataset; plan: PlanResult; check: CapacityCheck }) {
  const list = findBottlenecks(dataset, plan, check);
  const names = productNames(dataset);
  const siteName = new Map(dataset.sites.map((s) => [s.id, s.name.replace(/^Site /, '')]));
  const machineName = new Map(dataset.machines.map((m) => [m.id, m.name]));

  const title = (b: Bottleneck): string => {
    if (b.kind === 'machine') return machineName.get(b.id) ?? b.id;
    if (b.kind === 'product') return names.get(b.id) ?? b.id;
    if (b.kind === 'storage') {
      const pool = plan.storage.find((p) => poolId(p) === b.id);
      return pool ? poolName(dataset, pool) : b.id;
    }
    const lane = dataset.truckLanes.find((l) => l.id === b.id);
    return lane ? `Trucks ${siteName.get(lane.fromSiteId)} → ${siteName.get(lane.toSiteId)}` : b.id;
  };
  const limit = (b: Bottleneck): string => {
    if (b.kind === 'product') return `no machine at its limit; made on ${b.machineIds.map((id) => machineName.get(id) ?? id).join(', ') || 'no machine'}`;
    const what = b.kind === 'machine' ? 'full' : b.kind === 'storage' ? 'at capacity' : 'trucks maxed';
    return `${what} in ${b.weeksFull}/${b.weeks} weeks`;
  };

  return (
    <Panel
      title="What limits the plan"
      testId="bottlenecks-panel"
      hint="Machines, storage and truck lanes that reach their limit, and the short products they could help. Ranked by the unmet units of those products, then by the weeks at the limit. Short products that no limit explains come last."
    >
      {list.length === 0 ? (
        <p className="text-xs text-muted" data-testid="bottlenecks-none">
          Nothing reaches its limit: no machine is full, no storage at capacity and no truck lane maxed in any week.
        </p>
      ) : (
        <ol className="space-y-1.5 text-xs" data-testid="bottlenecks-list">
          {list.map((b, i) => {
            const shown = b.short.slice(0, MAX_NAMES);
            return (
              <li key={`${b.kind}/${b.id}`} data-testid={`bottleneck-${i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-line/50 pb-1.5">
                <span className="tabular w-5 text-right text-muted">{i + 1}.</span>
                <span className="w-32 truncate font-medium" title={title(b)}>{title(b)}</span>
                <span className="w-44 text-muted">{limit(b)}</span>
                {b.kind !== 'product' && (
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2" title={`${b.weeksFull} of ${b.weeks} weeks at the limit`}>
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(100 * b.weeksFull) / Math.max(1, b.weeks)}%` }} />
                  </span>
                )}
                {shown.length > 0 && (
                  <span style={{ color: RED }}>
                    · {shown.map((s) => `${names.get(s.productId) ?? s.productId} ${fmt(100 * s.share)} %`).join(', ')}
                    {b.short.length > shown.length && ` +${b.short.length - shown.length} more`} short ({fmt(b.unmetUnits)} units)
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
