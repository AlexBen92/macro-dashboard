'use client';

import useSWR from 'swr';
import type { Timeframe } from '@/lib/options/types';

export interface CryptoBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface CandlesResponse {
  success: boolean;
  source?: string;
  symbol?: string;
  tf?: Timeframe;
  interval?: string;
  bars?: CryptoBar[];
  asOf?: string;
  error?: string;
}

const fetcher = async (url: string): Promise<CandlesResponse> => {
  const res = await fetch(url);
  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}` };
  }
  return res.json();
};

export function useCryptoCandles(
  symbol: 'BTC' | 'ETH',
  tf: Timeframe,
): {
  bars: CryptoBar[];
  source: string | null;
  error: string | null;
  isLoading: boolean;
} {
  const key = `/api/crypto/candles?symbol=${symbol}&tf=${tf}`;
  const { data, error, isLoading } = useSWR<CandlesResponse>(key, fetcher, {
    refreshInterval: 60_000,
    dedupingInterval: 30_000,
    keepPreviousData: true,
    revalidateOnFocus: false,
  });

  return {
    bars: data?.success && data.bars ? data.bars : [],
    source: data?.source ?? null,
    error: !data?.success ? data?.error ?? (error ? String(error) : null) : null,
    isLoading: isLoading && !data,
  };
}
