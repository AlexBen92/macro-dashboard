'use client';

import useSWR from 'swr';

import type { VolSurfaceState } from '@/lib/cockpit/payloads';

const URL = '/api/vol-surface';
const STALE_THRESHOLD_MS = 3 * 60 * 60 * 1000;

const fetcher = async (url: string): Promise<VolSurfaceState> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as VolSurfaceState;
};

export function useVolSurface(): {
  data: VolSurfaceState | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<VolSurfaceState>(URL, fetcher, {
    refreshInterval: 300_000,
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
