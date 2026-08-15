'use client';

import useSWR from 'swr';
import {
  isStale,
  type RegimeMatrixPayload,
} from '@/lib/regimeMatrix';

const fetcher = async (url: string): Promise<RegimeMatrixPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as RegimeMatrixPayload;
};

export function useRegimeMatrix(): {
  data: RegimeMatrixPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<RegimeMatrixPayload>(
    '/api/regime-matrix',
    fetcher,
    { refreshInterval: 3_600_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: isStale(data ?? null),
  };
}
