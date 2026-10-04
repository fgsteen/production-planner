// "Group by" selector for views with many products (R44): none, or one of the characteristics.
import type { Characteristic, Id } from '../model/types';

export function GroupBySelect({ characteristics, value, onChange }: { characteristics: Characteristic[]; value: Id | null; onChange: (v: Id | null) => void }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs text-muted">
      Group by
      <select
        aria-label="Group by"
        className="cursor-pointer rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs text-ink"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">product</option>
        {characteristics.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
