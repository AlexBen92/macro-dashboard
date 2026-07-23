'use client';

import useSWR from 'swr';

export type CorrWindowKey = '24h' | '7d' | '30d';

export interface CorrMatrixCell {
  a: string;
  b: string;
  r: number;
  window: CorrWindowKey;
  n: number;
}

interface CorrMatrixPayload {
  windows: CorrWindowKey[];
  cells: CorrMatrixCell[];
  asOf: string;
}

interface CorrMatrixError {
  error: string;
}

const fetcher = async (url: string): Promise<CorrMatrixPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as CorrMatrixPayload | CorrMatrixError;
  if ('error' in json) throw new Error(json.error);
  return json;
};

export function useCorrMatrix(windows: CorrWindowKey[] = ['24h', '7d', '30d']): {
  cells: CorrMatrixCell[];
  asOf: string | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, error, isLoading } = useSWR<CorrMatrixPayload>(
    `/api/macro/corr-matrix?windows=${windows.join(',')}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false },
  );
  return {
    cells: data?.cells ?? [],
    asOf: data?.asOf ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
  };
}
