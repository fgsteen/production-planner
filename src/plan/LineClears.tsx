// Plan page: line clears per machine — large and small counts, their hours, and the weeks where
// campaigns start (R65).
import type { CapacityCheck } from '../model/demand';
import type { Dataset } from '../model/types';
import { fmt } from '../ui/palette';
import { Panel } from '../ui/Panel';
import { lineClearHours, type PlanResult } from './lp';

const one = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

export function LineClearPanel({ dataset, plan, check }: { dataset: Dataset; plan: PlanResult; check: CapacityCheck }) {
  const shiftH = dataset.settings.shiftHours;
  const rows = dataset.machines.map((m) => {
    const lc = plan.lineClears.find((l) => l.machineId === m.id);
    const large = lc?.large ?? 0;
    const hours = lc?.hours ?? 0;
    const largeHours = large * lineClearHours(m, dataset.settings).large;
    const used = (plan.machineWeekShifts.get(m.id) ?? []).reduce((a, b) => a + b, 0) * shiftH;
    return {
      m,
      large,
      small: lc?.small ?? 0,
      largeHours,
      smallHours: Math.max(0, hours - largeHours),
      hours,
      share: used > 0 ? hours / used : 0,
      perCampaign: large > 0 ? used / shiftH / large : 0,
      perWeek: lc?.largePerWeek ?? new Array<number>(check.weeks).fill(0),
    };
  });
  const sum = (k: 'large' | 'small' | 'largeHours' | 'smallHours' | 'hours') => rows.reduce((a, r) => a + r[k], 0);
  const maxShare = Math.max(0.01, ...rows.map((r) => r.share));

  return (
    <Panel
      title="Line clears per machine"
      testId="line-clear-panel"
      hint="Large line clears start a campaign: a product change, or a clean-down when a campaign reaches the max length. Small ones fall between lots of the same product. Hours are machine time lost to clearing. Share = clear hours ÷ planned machine time. Shifts per campaign = planned shifts ÷ large clears. Each cell of the strip is one ISO week; shaded weeks start a campaign, darker ones start more."
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs" data-testid="line-clear-table">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="py-1.5 pr-3 text-left font-medium">Machine</th>
              <th className="py-1.5 pr-3 text-right font-medium">Large</th>
              <th className="py-1.5 pr-3 text-right font-medium">Large h</th>
              <th className="py-1.5 pr-3 text-right font-medium">Small</th>
              <th className="py-1.5 pr-3 text-right font-medium">Small h</th>
              <th className="py-1.5 pr-3 text-right font-medium">Total h</th>
              <th className="w-32 py-1.5 pr-3 text-left font-medium">Share of time</th>
              <th className="whitespace-nowrap py-1.5 pr-3 text-right font-medium">Shifts / campaign</th>
              <th className="py-1.5 text-left font-medium">Campaign starts per week</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.m.id} data-testid={`line-clear-${r.m.id}`} className="border-b border-line/50">
                <td className="whitespace-nowrap py-1 pr-3 font-medium">{r.m.name}</td>
                <td className="tabular py-1 pr-3 text-right">{fmt(r.large)}</td>
                <td className="tabular py-1 pr-3 text-right text-muted">{fmt(r.largeHours)}</td>
                <td className="tabular py-1 pr-3 text-right">{fmt(r.small)}</td>
                <td className="tabular py-1 pr-3 text-right text-muted">{fmt(r.smallHours)}</td>
                <td className="tabular py-1 pr-3 text-right font-medium">{fmt(r.hours)}</td>
                <td className="py-1 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${(100 * r.share) / maxShare}%` }} />
                    </span>
                    <span className="tabular w-10 text-right">{one.format(100 * r.share)} %</span>
                  </span>
                </td>
                <td className="tabular py-1 pr-3 text-right">{r.large > 0 ? one.format(r.perCampaign) : '–'}</td>
                <td className="py-1">
                  <span className="flex h-4 min-w-[156px] items-center gap-px">
                    {r.perWeek.map((n, w) => (
                      <span
                        key={w}
                        title={`Week ${w + 1}: ${fmt(n)} campaign start${Math.round(n) === 1 ? '' : 's'}`}
                        className="grid h-full min-w-0 flex-1 place-items-center rounded-[1px] bg-surface-2"
                        style={n >= 0.5 ? { background: `color-mix(in srgb, var(--color-accent) ${Math.min(100, 30 + 25 * n)}%, transparent)` } : undefined}
                      />
                    ))}
                  </span>
                </td>
              </tr>
            ))}
            <tr className="font-medium" data-testid="line-clear-total">
              <td className="py-1.5 pr-3">Total</td>
              <td className="tabular py-1.5 pr-3 text-right">{fmt(sum('large'))}</td>
              <td className="tabular py-1.5 pr-3 text-right text-muted">{fmt(sum('largeHours'))}</td>
              <td className="tabular py-1.5 pr-3 text-right">{fmt(sum('small'))}</td>
              <td className="tabular py-1.5 pr-3 text-right text-muted">{fmt(sum('smallHours'))}</td>
              <td className="tabular py-1.5 pr-3 text-right">{fmt(sum('hours'))}</td>
              <td colSpan={3} />
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
