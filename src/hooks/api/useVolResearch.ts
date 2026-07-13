'use client';

import useSWR from 'swr';
import type { VolResearchApiResponse, VolResearchPayload } from '@/lib/types/vol-research';

const fetcher = async (url: string): Promise<VolResearchApiResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    return { success: false, available: false, error: `HTTP ${res.status}` };
  }
  return res.json();
};

export function useVolResearch() {
  const { data, error, isLoading, mutate } = useSWR<VolResearchApiResponse>(
    '/api/vol-research',
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false },
  );

  return {
    payload: data?.success ? (data.data as VolResearchPayload) : null,
    available: data?.success === true && data.available === true,
    error: data?.error || (error ? String(error) : null),
    isLoading: isLoading && !data,
    lastUpdated: data?.data?.last_updated ?? null,
    mutate,
  };
}
