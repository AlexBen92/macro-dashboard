'use client';

import useSWR from 'swr';

export interface OhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface OhlcResponse {
  bars: OhlcBar[];
  cached?: boolean;
  error?: string;
}

const fetcher = async (url: string): Promise<OhlcResponse> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useMarketOHLC(
  ticker: string | null | undefined,
  interval: '1d' | '1h' | '1wk' = '1d',
  range: '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y' = '1y',
) {
  const key =
    ticker != null
      ? `/api/markets/ohlc?ticker=${encodeURIComponent(ticker)}&interval=${interval}&range=${range}`
      : null;
  const { data, error, isLoading } = useSWR<OhlcResponse>(key, fetcher, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  });
  return { bars: data?.bars ?? [], error: data?.error ?? error, isLoading };
}
