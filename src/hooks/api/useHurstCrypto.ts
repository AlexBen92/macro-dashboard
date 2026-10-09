'use client';

import useSWR from 'swr';

import type { HurstCryptoPayload } from '@/lib/hurst';

const REFRESH_MS = 10 * 60 * 1000;

const fetcher = async (url: string): Promise<HurstCryptoPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as HurstCryptoPayload;
};

export function useHurstCrypto(): {
  data: HurstCryptoPayload | null;
  isLoading: boolean;
  error: Error | null;
  asOf: string | null;
} {
  const { data, error, isLoading } = useSWR<HurstCryptoPayload>(
    '/api/hurst-crypto',
    fetcher,
    { refreshInterval: REFRESH_MS, revalidateOnFocus: false },
  );
  return { data: data ?? null, isLoading, error: error ?? null, asOf: data?.as_of ?? null };
}
