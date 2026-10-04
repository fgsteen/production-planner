import { useEffect, useState } from 'react';
import { MasterData } from './data/MasterData';
import { seedDataset } from './model/seed';
import { Overview } from './overview/Overview';
import { DatasetProvider, useDataset } from './store/DatasetContext';

const PAGES = [
  ['overview', 'Overview'],
  ['data', 'Master data'],
] as const;
type Page = (typeof PAGES)[number][0];

// The page lives in the URL hash so reloads and links keep it (and GitHub Pages needs no routing).
const pageFromHash = (): Page => (window.location.hash === '#data' ? 'data' : 'overview');

export function App() {
  return (
    <DatasetProvider>
      <Shell />
    </DatasetProvider>
  );
}

function Shell() {
  const { dataset, errors } = useDataset();
  const [page, setPage] = useState<Page>(pageFromHash);
  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-sm font-bold text-white">PP</span>
          <h1 className="whitespace-nowrap font-semibold tracking-tight">Production Planner</h1>
          <nav className="ml-6 flex gap-1 text-sm">
            {PAGES.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                aria-current={page === id ? 'page' : undefined}
                className={`rounded-md px-3 py-1.5 font-medium transition-colors ${page === id ? 'bg-surface-2' : 'text-muted hover:text-ink'}`}
              >
                {label}
                {id === 'data' && errors.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-[#edc948] px-1.5 text-[11px] font-semibold text-black" title={`${errors.length} problems`}>
                    {errors.length}
                  </span>
                )}
              </a>
            ))}
          </nav>
          <span className="ml-auto hidden text-xs text-faint sm:inline">{dataset === seedDataset ? 'Demo data' : 'Your data (saved in this browser)'}</span>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{page === 'data' ? <MasterData /> : <Overview dataset={dataset} />}</main>
    </div>
  );
}
