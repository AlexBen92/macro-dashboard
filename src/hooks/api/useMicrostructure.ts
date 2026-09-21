'use client';

import useSWR from 'swr';

import type { MicrostructurePayload } from '@/lib/microstructure/payloads';
import { isPayloadStale } from '@/lib/microstructure/payloads';

const MICRO_URL = '/api/microstructure';
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

async function fetcher(url: string): Promise<MicrostructurePayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`microstructure HTTP ${res.status}`);
  return (await res.json()) as MicrostructurePayload;
}

export function useMicrostructure(): {
  data: MicrostructurePayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<MicrostructurePayload>(
    MICRO_URL,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: isPayloadStale(data ?? null, STALE_THRESHOLD_MS),
  };
}
