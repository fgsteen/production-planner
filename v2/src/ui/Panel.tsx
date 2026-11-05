// A card with a title, an optional hint and actions, and a download-as-PNG button (R45).
import { toPng } from 'html-to-image';
import { useRef, useState, type ReactNode } from 'react';

const CARD = 'rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * Renders `node` to a PNG at 2× in the page's current theme, on the panel's own background, with
 * scroll areas expanded so wide or long tables come out whole. Elements marked `data-export-ignore`
 * (the panel's controls) are left out.
 */
export async function downloadPng(node: HTMLElement, name: string): Promise<void> {
  const width = node.offsetWidth;
  node.classList.add('png-export');
  node.style.minWidth = `${width}px`;
  try {
    // One frame, so the expanded layout is in place before measuring.
    await new Promise((r) => requestAnimationFrame(r));
    const url = await toPng(node, {
      pixelRatio: 2,
      backgroundColor: getComputedStyle(node).backgroundColor,
      width: node.scrollWidth,
      height: node.scrollHeight,
      filter: (el) => !(el instanceof HTMLElement && el.dataset.exportIgnore !== undefined),
    });
    const a = Object.assign(document.createElement('a'), { href: url, download: `${slug(name)}-${new Date().toISOString().slice(0, 10)}.png` });
    a.click();
  } finally {
    node.classList.remove('png-export');
    node.style.minWidth = '';
  }
}

export function Panel({
  title,
  exportName,
  hint,
  actions,
  heading = 'h3',
  testId,
  children,
}: {
  title: ReactNode;
  /** File and button name when `title` is not plain text. */
  exportName?: string;
  hint?: ReactNode;
  /** Controls shown at the top right, before the download button (e.g. a view toggle). */
  actions?: ReactNode;
  heading?: 'h2' | 'h3';
  testId?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const [busy, setBusy] = useState(false);
  const Heading = heading;
  const name = exportName ?? (typeof title === 'string' ? title : 'panel');

  const download = async () => {
    if (!ref.current) return;
    setBusy(true);
    try {
      await downloadPng(ref.current, name);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section ref={ref} className={CARD} data-testid={testId}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Heading className={`font-semibold tracking-tight ${heading === 'h2' ? 'text-base' : ''}`}>{title}</Heading>
          {hint && <p className={`mt-0.5 text-muted ${heading === 'h2' ? 'text-sm' : 'text-xs'}`}>{hint}</p>}
        </div>
        <div className="flex items-center gap-2" data-export-ignore>
          {actions}
          <button
            type="button"
            aria-label={`Download ${name} as PNG`}
            title="Download as PNG"
            disabled={busy}
            onClick={() => void download()}
            className="rounded-md p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 11v2.5h11V11" />
            </svg>
          </button>
        </div>
      </header>
      {children}
    </section>
  );
}
