'use client';

import useSWR, { type KeyedMutator } from 'swr';
import type { OptionsExposureSnapshot } from '@/lib/options/types';

export interface OptionsExposureResponse {
  success: boolean;
  available?: boolean;
  data?: OptionsExposureSnapshot;
  error?: string;
  warnings?: string[];
  source?: string;
}

const fetcher = async (url: string): Promise<OptionsExposureResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = (await res.json()) as OptionsExposureResponse;
      if (j.error) msg = `${msg}: ${j.error}`;
    } catch {
      // ignore parse error
    }
    return { success: false, error: msg };
  }
  return (await res.json()) as OptionsExposureResponse;
};

export function useOptionsExposure(
  symbol: 'BTC' | 'ETH',
  expiryBucket: 'all' | '0-7d' | '8-30d' | '31-90d',
): {
  data: OptionsExposureSnapshot | null;
  error: string | null;
  isLoading: boolean;
  isStale: boolean;
  mutate: KeyedMutator<OptionsExposureResponse>;
} {
  const key = `/api/crypto/options/exposure?symbol=${symbol}&expiryBucket=${expiryBucket}`;
  const { data, error, isLoading, mutate } = useSWR<OptionsExposureResponse>(
    key,
    fetcher,
    {
      refreshInterval: 300_000,
      dedupingInterval: 60_000,
      keepPreviousData: true,
      errorRetryCount: 2,
      revalidateOnFocus: false,
    },
  );

  const snapshot = data?.success && data.data ? data.data : null;
  const errMsg = !data?.success ? data?.error ?? (error ? String(error) : null) : null;
  const isStale =
    snapshot?.freshness.status === 'stale' ||
    snapshot?.freshness.status === 'unavailable' ||
    false;

  return {
    data: snapshot,
    error: errMsg,
    isLoading: isLoading && !data,
    isStale,
    mutate,
  };
}
