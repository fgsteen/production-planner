import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { Dataset } from '../model/types';
import { validateDataset } from '../model/validate';
import { datasetReducer, loadDataset, saveDataset, type DatasetAction } from './dataset';

interface DatasetStore {
  dataset: Dataset;
  dispatch: Dispatch<DatasetAction>;
  errors: string[];
}

const Ctx = createContext<DatasetStore | null>(null);

const browserStorage = () => (typeof window === 'undefined' ? undefined : window.localStorage);

export function DatasetProvider({ children }: { children: ReactNode }) {
  const [dataset, dispatch] = useReducer(datasetReducer, undefined, () => loadDataset(browserStorage()));
  useEffect(() => saveDataset(browserStorage(), dataset), [dataset]);
  const errors = useMemo(() => validateDataset(dataset), [dataset]);
  const value = useMemo(() => ({ dataset, dispatch, errors }), [dataset, errors]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDataset(): DatasetStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useDataset must be used inside <DatasetProvider>');
  return store;
}
