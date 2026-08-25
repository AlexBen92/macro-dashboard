'use client';

import useSWR from 'swr';

import type { CockpitState } from '@/lib/cockpit/payloads';

const URL = '/api/cockpit-state';
const STALE_THRESHOLD_MS = 35 * 60 * 1000;

const fetcher = async (url: string): Promise<CockpitState> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as CockpitState;
};

export function useCockpitState(): {
  data: CockpitState | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<CockpitState>(URL, fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
  const ageMs = data?.as_of ? Date.now() - Date.parse(data.as_of) : null;
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: ageMs !== null && ageMs > STALE_THRESHOLD_MS,
  };
}
