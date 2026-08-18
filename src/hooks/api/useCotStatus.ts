'use client';

import useSWR from 'swr';
import { isCotStale, type CotPayload } from '@/lib/cot';

const fetcher = async (url: string): Promise<CotPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CotPayload;
};

export function useCotStatus(): {
  data: CotPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<CotPayload>(
    '/api/cot-status',
    fetcher,
    { refreshInterval: 6 * 3_600_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: isCotStale(data ?? null),
  };
}
