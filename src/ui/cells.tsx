// Inline-edit cells for master data tables. Text inputs keep a local draft and commit on blur or
// Enter (Escape reverts), so half-typed values never reach the store.
import { useEffect, useState, type KeyboardEvent } from 'react';

const INPUT =
  'w-full rounded-md border border-transparent bg-transparent px-2 py-1 outline-none transition-colors hover:border-line focus:border-accent focus:bg-surface';

function useDraft(value: string, commit: (draft: string) => boolean) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const finish = () => {
    if (draft !== value && !commit(draft)) setDraft(value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
    if (e.key === 'Escape') {
      setDraft(value);
      // Blur after the reset has rendered, so finish() sees the original value.
      const el = e.currentTarget;
      requestAnimationFrame(() => el.blur());
    }
  };
  return { value: draft, onChange: (e: { target: { value: string } }) => setDraft(e.target.value), onBlur: finish, onKeyDown };
}

export function TextCell({ value, onCommit, label }: { value: string; onCommit: (v: string) => void; label: string }) {
  const props = useDraft(value, (d) => {
    const v = d.trim();
    if (!v) return false;
    onCommit(v);
    return true;
  });
  return <input aria-label={label} className={INPUT} {...props} />;
}

export function NumberCell({ value, onCommit, label, suffix }: { value: number; onCommit: (v: number) => void; label: string; suffix?: string }) {
  const props = useDraft(String(value), (d) => {
    const n = Number(d.replace(',', '.'));
    if (d.trim() === '' || !Number.isFinite(n)) return false;
    onCommit(n);
    return true;
  });
  return (
    <span className="flex items-center justify-end gap-1">
      <input aria-label={label} inputMode="decimal" className={`${INPUT} tabular w-24 text-right`} {...props} />
      {suffix && <span className="w-6 text-xs text-faint">{suffix}</span>}
    </span>
  );
}

/** Comma/space-separated list of `YYYY-MM-DD` dates. Format checks are left to validation. */
export function DateListCell({ value, onCommit, label }: { value: string[]; onCommit: (v: string[]) => void; label: string }) {
  const props = useDraft(value.join(', '), (d) => {
    onCommit(d.split(/[\s,;]+/).filter(Boolean).sort());
    return true;
  });
  return <input aria-label={label} placeholder="none" className={`${INPUT} tabular min-w-56 text-xs`} {...props} />;
}

export function SelectCell<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <select aria-label={label} className={`${INPUT} cursor-pointer`} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export function WeekdaysCell({ value, onChange, label }: { value: number[]; onChange: (v: number[]) => void; label: string }) {
  const on = new Set(value);
  return (
    <span role="group" aria-label={label} className="flex gap-0.5">
      {WEEKDAYS.map((d, i) => {
        const day = i + 1;
        const active = on.has(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={active}
            title={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}
            onClick={() => onChange(active ? value.filter((x) => x !== day) : [...value, day].sort())}
            className={`h-6 w-6 rounded text-[11px] font-semibold transition-colors ${active ? 'bg-accent text-white' : 'bg-surface-2 text-faint hover:text-muted'}`}
          >
            {d}
          </button>
        );
      })}
    </span>
  );
}

export function CheckboxCell({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <span className="flex justify-center">
      <input type="checkbox" aria-label={label} className="h-4 w-4 cursor-pointer accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </span>
  );
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-faint transition-colors hover:bg-surface-2 hover:text-[#e15759]"
    >
      ✕
    </button>
  );
}
