import { useMemo, useState } from 'react';
import { availableShifts, effectiveRate, unitsPerPallet } from '../model/capacity';
import type { Dataset, Machine, Site } from '../model/types';
import { fmt, productColor, siteColor } from '../ui/palette';
import { SiteMap } from './SiteMap';

// Calendar year used for the "available shifts" figure until planning periods exist.
const YEAR = 2027;

export function Overview({ dataset }: { dataset: Dataset }) {
  const [focus, setFocus] = useState<string | null>(null);
  const productColors = useMemo(() => new Map(dataset.products.map((p, i) => [p.id, productColor(i)])), [dataset]);
  const maxRate = Math.max(...dataset.capabilities.map(effectiveRate));

  return (
    <div className="space-y-8">
      <Stats dataset={dataset} />

      <Section title="Network" hint="Machines feed local storage. Trucks move B output to the A warehouse; A consumes from both A stores.">
        <SiteMap dataset={dataset} productColors={productColors} />
      </Section>

      <Section title="Machines by site" hint={`Effective rate = rate × OEE. Available shifts in ${YEAR} after holidays and maintenance.`}>
        <div className="grid gap-6 lg:grid-cols-2">
          {dataset.sites.map((site) => (
            <SitePanel key={site.id} site={site} dataset={dataset} productColors={productColors} maxRate={maxRate} focus={focus} />
          ))}
        </div>
      </Section>

      <Section title="Products" hint="Hover a product to highlight the machines that can make it.">
        <ProductTable dataset={dataset} productColors={productColors} focus={focus} setFocus={setFocus} />
      </Section>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <header className="mb-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-0.5 text-sm text-muted">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

function Stats({ dataset }: { dataset: Dataset }) {
  const lane = dataset.truckLanes[0];
  const items = [
    ['Sites', dataset.sites.length],
    ['Machines', dataset.machines.length],
    ['Products', dataset.products.length],
    ['Machine–product pairs', dataset.capabilities.length],
    ['Storage (pallets)', fmt(dataset.storageLocations.reduce((s, l) => s + l.capacityPallets, 0))],
    ['Truck capacity / wk', lane ? `${fmt(lane.maxTrucksPerWeek * lane.palletsPerTruck)} pallets` : '—'],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-line bg-surface px-4 py-3">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="tabular mt-1 text-xl font-semibold tracking-tight">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

interface PanelProps {
  site: Site;
  dataset: Dataset;
  productColors: Map<string, string>;
  maxRate: number;
  focus: string | null;
}

function SitePanel({ site, dataset, productColors, maxRate, focus }: PanelProps) {
  const machines = dataset.machines.filter((m) => m.siteId === site.id);
  const stores = dataset.storageLocations.filter((l) => l.siteId === site.id);
  return (
    <div data-testid={`site-${site.id}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="h-3 w-3 rounded-full" style={{ background: siteColor(site.id) }} />
        <h3 className="font-semibold">{site.name}</h3>
        <span className="text-sm text-muted">{site.isDemandSite ? 'production + demand' : 'production'}</span>
        <span className="ml-auto flex flex-wrap gap-1.5">
          {stores.map((l) => (
            <span key={l.id} className="tabular rounded-md bg-surface-2 px-2 py-0.5 text-xs text-muted">
              {l.name}: {fmt(l.capacityPallets)} pal
            </span>
          ))}
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {machines.map((m) => (
          <MachineCard key={m.id} machine={m} site={site} dataset={dataset} productColors={productColors} maxRate={maxRate} focus={focus} />
        ))}
      </div>
    </div>
  );
}

function MachineCard({ machine, site, dataset, productColors, maxRate, focus }: Omit<PanelProps, 'site'> & { machine: Machine; site: Site }) {
  const caps = dataset.capabilities.filter((c) => c.machineId === machine.id);
  const canMakeFocus = focus !== null && caps.some((c) => c.productId === focus);
  const dimmed = focus !== null && !canMakeFocus;
  const shifts = availableShifts(machine, site, `${YEAR}-01-01`, `${YEAR}-12-31`);
  return (
    <article
      data-testid={`machine-${machine.id}`}
      className="rounded-xl border bg-surface p-4 transition-all duration-200"
      style={{
        borderColor: canMakeFocus ? productColors.get(focus!) : 'var(--border)',
        opacity: dimmed ? 0.35 : 1,
        boxShadow: canMakeFocus ? `0 0 0 3px color-mix(in srgb, ${productColors.get(focus!)} 25%, transparent)` : undefined,
      }}
    >
      <header className="flex items-baseline justify-between">
        <h4 className="font-semibold">{machine.name}</h4>
        <span className="tabular text-xs text-muted">{fmt(shifts)} shifts</span>
      </header>
      <p className="tabular mt-0.5 text-xs text-faint">
        Line clear: small {machine.smallLineClearMin} min · large {machine.largeLineClearMin} min
      </p>
      <ul className="mt-3 space-y-2.5">
        {caps.map((c) => {
          const product = dataset.products.find((p) => p.id === c.productId)!;
          const color = productColors.get(c.productId)!;
          const eff = effectiveRate(c);
          return (
            <li key={c.productId} className="transition-opacity" style={{ opacity: canMakeFocus && c.productId !== focus ? 0.4 : 1 }}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 truncate">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />
                  {product.name}
                </span>
                <span className="tabular shrink-0 font-medium">{fmt(eff)}/h</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${(eff / maxRate) * 100}%`, background: color }} />
                </div>
                <span className="tabular w-28 shrink-0 text-right text-[11px] text-faint">
                  {fmt(c.ratePerHour)} × {c.oeePct}%
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function ProductTable({
  dataset,
  productColors,
  focus,
  setFocus,
}: {
  dataset: Dataset;
  productColors: Map<string, string>;
  focus: string | null;
  setFocus: (id: string | null) => void;
}) {
  const siteOf = new Map(dataset.machines.map((m) => [m.id, m.siteId]));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" onMouseLeave={() => setFocus(null)}>
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-4 font-medium">Product</th>
            <th className="py-2 pr-4 text-right font-medium">Units / pallet</th>
            <th className="py-2 pr-4 font-medium">Made at</th>
            <th className="py-2 font-medium">Machines</th>
          </tr>
        </thead>
        <tbody>
          {dataset.products.map((p) => {
            const caps = dataset.capabilities.filter((c) => c.productId === p.id);
            const sites = [...new Set(caps.map((c) => siteOf.get(c.machineId)!))].sort();
            return (
              <tr
                key={p.id}
                data-testid={`product-${p.id}`}
                onMouseEnter={() => setFocus(p.id)}
                className="cursor-default border-b border-line/60 last:border-0"
                style={{ background: focus === p.id ? `color-mix(in srgb, ${productColors.get(p.id)} 10%, transparent)` : undefined }}
              >
                <td className="py-2 pr-4">
                  <span className="flex items-center gap-2 font-medium">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: productColors.get(p.id) }} />
                    {p.name}
                  </span>
                </td>
                <td className="tabular py-2 pr-4 text-right text-muted">
                  {fmt(unitsPerPallet(p))} <span className="text-faint">({p.unitsPerCrate} × {p.cratesPerPallet})</span>
                </td>
                <td className="py-2 pr-4">
                  <span className="flex gap-1">
                    {sites.map((s) => (
                      <span key={s} className="rounded px-1.5 py-0.5 text-xs font-semibold text-white" style={{ background: siteColor(s) }}>
                        {s}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="tabular py-2 text-muted">{caps.map((c) => c.machineId).join(', ')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
