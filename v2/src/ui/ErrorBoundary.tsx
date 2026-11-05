import { Component, type ReactNode } from 'react';
import { STORAGE_KEY } from '../store/dataset';

/**
 * Last line of defence: if saved data makes the app crash on render, the user would hit the same
 * crash on every reload. Offer to download the saved data and fall back to the demo data.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const saved = readSaved();
    return (
      <div role="alert" className="mx-auto mt-16 max-w-lg rounded-2xl border border-line bg-surface p-6">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">The app could not show your data. This is usually caused by saved data it doesn't understand.</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs text-muted">{error.message}</pre>
        <div className="mt-4 flex flex-wrap gap-2">
          {saved && (
            <a
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-surface-2"
              href={`data:application/json;charset=utf-8,${encodeURIComponent(saved)}`}
              download="production-planner-recovered.json"
            >
              Download saved data
            </a>
          )}
          <button
            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
            onClick={() => {
              try {
                localStorage.removeItem(STORAGE_KEY);
              } catch {
                // nothing saved we can clear
              }
              location.reload();
            }}
          >
            Reset to demo data
          </button>
        </div>
      </div>
    );
  }
}

function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
