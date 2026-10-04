import { seedDataset } from './model/seed';
import { Overview } from './overview/Overview';

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">PP</span>
          <h1 className="whitespace-nowrap font-semibold tracking-tight">Production Planner</h1>
          <nav className="ml-6 text-sm">
            <span className="rounded-md bg-surface-2 px-3 py-1.5 font-medium">Overview</span>
          </nav>
          <span className="ml-auto hidden text-xs text-faint sm:inline">Demo data</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Overview dataset={seedDataset} />
      </main>
    </div>
  );
}
