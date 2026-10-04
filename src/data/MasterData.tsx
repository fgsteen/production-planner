import { useRef, useState, type ReactNode } from 'react';
import { effectiveRate, unitsPerPallet } from '../model/capacity';
import type { Dataset, Machine } from '../model/types';
import { exportJson, parseDataset } from '../store/dataset';
import { useDataset } from '../store/DatasetContext';
import { DateListCell, NumberCell, RemoveButton, SelectCell, TextCell, WeekdaysCell } from '../ui/cells';
import { fmt, productColor, siteColor } from '../ui/palette';

const TABS = [
  ['machines', 'Machines'],
  ['products', 'Products'],
  ['capabilities', 'Capabilities'],
] as const;
type Tab = (typeof TABS)[number][0];

export function MasterData() {
  const { errors } = useDataset();
  const [tab, setTab] = useState<Tab>('capabilities');
  return (
    <div className="space-y-5">
      <Toolbar />
      {errors.length > 0 && <Problems errors={errors} />}
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <nav role="tablist" className="mb-4 flex gap-1 border-b border-line">
          {TABS.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${tab === id ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        {tab === 'machines' && <MachinesTable />}
        {tab === 'products' && <ProductsTable />}
        {tab === 'capabilities' && <CapabilitiesTable />}
      </section>
    </div>
  );
}

// --- toolbar: export / import / reset ----------------------------------------------------------

const BUTTON = 'rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50';

function Toolbar() {
  const { dataset, dispatch } = useDataset();
  const fileInput = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const doExport = () => {
    const url = URL.createObjectURL(new Blob([exportJson(dataset)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `production-planner-${new Date().toISOString().slice(0, 10)}.json` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const doImport = async (file: File) => {
    const result = parseDataset(await file.text());
    if (!result.ok) return setMessage({ kind: 'error', text: `Could not import ${file.name}: ${result.error}.` });
    if (!confirm(`Replace the current data with ${file.name}?`)) return;
    dispatch({ type: 'replace', dataset: result.dataset });
    setMessage({ kind: 'ok', text: `Imported ${file.name}.` });
  };

  const doReset = () => {
    if (!confirm('Replace all your changes with the built-in demo data?')) return;
    dispatch({ type: 'reset' });
    setMessage({ kind: 'ok', text: 'Demo data restored.' });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="mr-auto">
        <h2 className="text-base font-semibold tracking-tight">Master data</h2>
        <p className="text-sm text-muted">Changes save in this browser automatically. Export a JSON file to keep or share a scenario.</p>
      </div>
      {message && (
        <span role="status" className={`text-sm ${message.kind === 'error' ? 'text-[#e15759]' : 'text-muted'}`}>
          {message.text}
        </span>
      )}
      <button className={BUTTON} onClick={doExport}>
        Export JSON
      </button>
      <button className={BUTTON} onClick={() => fileInput.current?.click()}>
        Import JSON
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        data-testid="import-file"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void doImport(file);
        }}
      />
      <button className={BUTTON} onClick={doReset}>
        Reset to demo data
      </button>
    </div>
  );
}

function Problems({ errors }: { errors: string[] }) {
  return (
    <div role="alert" data-testid="problems" className="rounded-xl border border-[#edc948]/60 bg-[#edc948]/10 px-4 py-3 text-sm">
      <p className="font-medium">
        {errors.length} {errors.length === 1 ? 'problem' : 'problems'} in the data
      </p>
      <ul className="mt-1 list-disc pl-5 text-muted">
        {errors.slice(0, 8).map((e) => (
          <li key={e}>{e}</li>
        ))}
        {errors.length > 8 && <li>… and {errors.length - 8} more</li>}
      </ul>
    </div>
  );
}

// --- tables ------------------------------------------------------------------------------------

/** `numeric`: indexes of right-aligned (number) columns. */
function Table({ head, numeric = [], children, footer }: { head: ReactNode[]; numeric?: number[]; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className={`whitespace-nowrap px-2 py-2 font-medium ${numeric.includes(i) ? 'pr-9 text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line/60 [&_td]:px-1 [&_td]:py-1">{children}</tbody>
      </table>
      {footer && <div className="mt-3 flex flex-wrap gap-2">{footer}</div>}
    </div>
  );
}

const Dot = ({ color }: { color: string }) => <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: color }} />;

const countCaps = (ds: Dataset, key: 'machineId' | 'productId', id: string) => ds.capabilities.filter((c) => c[key] === id).length;

function MachinesTable() {
  const { dataset, dispatch } = useDataset();
  const siteOptions = dataset.sites.map((s) => ({ value: s.id, label: s.name }));
  return (
    <Table
      head={['ID', 'Name', 'Site', 'Shifts/day', 'Working days', 'Small clear', 'Large clear', 'Maintenance days', '']}
      numeric={[3, 5, 6]}
      footer={dataset.sites.map((s) => (
        <button key={s.id} className={BUTTON} onClick={() => dispatch({ type: 'addMachine', siteId: s.id })}>
          + Machine at {s.name}
        </button>
      ))}
    >
      {dataset.machines.map((m) => {
        const update = (patch: Partial<Omit<Machine, 'id'>>) => dispatch({ type: 'updateMachine', id: m.id, patch });
        return (
          <tr key={m.id} data-testid={`machine-row-${m.id}`}>
            <td className="tabular whitespace-nowrap px-2 font-medium">
              <span className="flex items-center gap-2">
                <Dot color={siteColor(m.siteId)} />
                {m.id}
              </span>
            </td>
            <td className="min-w-36">
              <TextCell label={`${m.id} name`} value={m.name} onCommit={(name) => update({ name })} />
            </td>
            <td className="min-w-28">
              <SelectCell label={`${m.id} site`} value={m.siteId} options={siteOptions} onChange={(siteId) => update({ siteId })} />
            </td>
            <td>
              <NumberCell
                label={`${m.id} shifts per day`}
                value={m.calendar.shiftsPerDay}
                onCommit={(shiftsPerDay) => update({ calendar: { ...m.calendar, shiftsPerDay } })}
              />
            </td>
            <td>
              <WeekdaysCell
                label={`${m.id} working days`}
                value={m.calendar.workingWeekdays}
                onChange={(workingWeekdays) => update({ calendar: { ...m.calendar, workingWeekdays } })}
              />
            </td>
            <td>
              <NumberCell label={`${m.id} small line clear`} suffix="min" value={m.smallLineClearMin} onCommit={(smallLineClearMin) => update({ smallLineClearMin })} />
            </td>
            <td>
              <NumberCell label={`${m.id} large line clear`} suffix="min" value={m.largeLineClearMin} onCommit={(largeLineClearMin) => update({ largeLineClearMin })} />
            </td>
            <td>
              <DateListCell label={`${m.id} maintenance days`} value={m.maintenance} onCommit={(maintenance) => update({ maintenance })} />
            </td>
            <td>
              <RemoveButton
                label={`Remove ${m.id}`}
                onClick={() => {
                  const n = countCaps(dataset, 'machineId', m.id);
                  if (confirm(`Remove ${m.name}${n ? ` and its ${n} capabilities` : ''}?`)) dispatch({ type: 'removeMachine', id: m.id });
                }}
              />
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function ProductsTable() {
  const { dataset, dispatch } = useDataset();
  return (
    <Table
      head={['ID', 'Name', 'Units / crate', 'Crates / pallet', 'Units / pallet', 'Machines', '']}
      numeric={[2, 3]}
      footer={
        <button className={BUTTON} onClick={() => dispatch({ type: 'addProduct' })}>
          + Product
        </button>
      }
    >
      {dataset.products.map((p, i) => {
        const machines = dataset.capabilities.filter((c) => c.productId === p.id).map((c) => c.machineId);
        return (
          <tr key={p.id} data-testid={`product-row-${p.id}`}>
            <td className="tabular whitespace-nowrap px-2 font-medium">
              <span className="flex items-center gap-2">
                <Dot color={productColor(i)} />
                {p.id}
              </span>
            </td>
            <td className="min-w-48">
              <TextCell label={`${p.id} name`} value={p.name} onCommit={(name) => dispatch({ type: 'updateProduct', id: p.id, patch: { name } })} />
            </td>
            <td>
              <NumberCell
                label={`${p.id} units per crate`}
                value={p.unitsPerCrate}
                onCommit={(unitsPerCrate) => dispatch({ type: 'updateProduct', id: p.id, patch: { unitsPerCrate } })}
              />
            </td>
            <td>
              <NumberCell
                label={`${p.id} crates per pallet`}
                value={p.cratesPerPallet}
                onCommit={(cratesPerPallet) => dispatch({ type: 'updateProduct', id: p.id, patch: { cratesPerPallet } })}
              />
            </td>
            <td className="tabular px-2 text-right text-muted">{fmt(unitsPerPallet(p))}</td>
            <td className="tabular px-2 text-muted">{machines.length ? machines.join(', ') : <span className="text-[#e15759]">none</span>}</td>
            <td>
              <RemoveButton
                label={`Remove ${p.id}`}
                onClick={() => {
                  const n = machines.length;
                  if (confirm(`Remove ${p.name}${n ? ` and its ${n} capabilities` : ''}?`)) dispatch({ type: 'removeProduct', id: p.id });
                }}
              />
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function CapabilitiesTable() {
  const { dataset, dispatch } = useDataset();
  const productIndex = new Map(dataset.products.map((p, i) => [p.id, i]));
  const productName = new Map(dataset.products.map((p) => [p.id, p.name]));
  const machineIndex = new Map(dataset.machines.map((m, i) => [m.id, i]));
  const machineById = new Map(dataset.machines.map((m) => [m.id, m]));
  const rows = [...dataset.capabilities].sort(
    (a, b) =>
      (machineIndex.get(a.machineId) ?? 0) - (machineIndex.get(b.machineId) ?? 0) ||
      (productIndex.get(a.productId) ?? 0) - (productIndex.get(b.productId) ?? 0),
  );
  return (
    <Table head={['Machine', 'Product', 'Rate', 'OEE', 'Effective rate', '']} numeric={[2, 3]} footer={<AddCapability />}>
      {rows.map((c) => {
        const key = `${c.machineId}-${c.productId}`;
        const machine = machineById.get(c.machineId);
        const update = (patch: { ratePerHour?: number; oeePct?: number }) =>
          dispatch({ type: 'updateCapability', machineId: c.machineId, productId: c.productId, patch });
        return (
          <tr key={key} data-testid={`cap-row-${key}`}>
            <td className="whitespace-nowrap px-2">
              <span className="flex items-center gap-2">
                <Dot color={siteColor(machine?.siteId ?? '')} />
                {machine?.name ?? c.machineId}
              </span>
            </td>
            <td className="whitespace-nowrap px-2">
              <span className="flex items-center gap-2">
                <Dot color={productColor(productIndex.get(c.productId) ?? 0)} />
                {productName.get(c.productId) ?? c.productId}
              </span>
            </td>
            <td>
              <NumberCell label={`${key} rate`} suffix="/h" value={c.ratePerHour} onCommit={(ratePerHour) => update({ ratePerHour })} />
            </td>
            <td>
              <NumberCell label={`${key} OEE`} suffix="%" value={c.oeePct} onCommit={(oeePct) => update({ oeePct })} />
            </td>
            <td className="tabular px-2 text-right font-medium">{fmt(effectiveRate(c))}/h</td>
            <td>
              <RemoveButton label={`Remove ${key}`} onClick={() => dispatch({ type: 'removeCapability', machineId: c.machineId, productId: c.productId })} />
            </td>
          </tr>
        );
      })}
    </Table>
  );
}

function AddCapability() {
  const { dataset, dispatch } = useDataset();
  const [machineId, setMachineId] = useState(dataset.machines[0]?.id ?? '');
  const [productId, setProductId] = useState('');
  const free = dataset.products.filter((p) => !dataset.capabilities.some((c) => c.machineId === machineId && c.productId === p.id));
  const chosen = free.some((p) => p.id === productId) ? productId : (free[0]?.id ?? '');
  if (dataset.machines.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Add:</span>
      <span className="w-40">
        <SelectCell label="New capability machine" value={machineId} options={dataset.machines.map((m) => ({ value: m.id, label: m.name }))} onChange={setMachineId} />
      </span>
      <span className="text-faint">can make</span>
      <span className="w-48">
        {free.length > 0 ? (
          <SelectCell label="New capability product" value={chosen} options={free.map((p) => ({ value: p.id, label: p.name }))} onChange={setProductId} />
        ) : (
          <span className="px-2 text-faint">every product already</span>
        )}
      </span>
      <button className={BUTTON} disabled={!chosen} onClick={() => dispatch({ type: 'addCapability', machineId, productId: chosen })}>
        + Capability
      </button>
    </div>
  );
}
