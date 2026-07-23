'use client';

import useSWR from 'swr';
import type { TrendResult } from '@/lib/engines/trend';

export interface MarketSectorsPayload {
  asOf: string;
  trends: Record<string, { daily: TrendResult | null; h4: TrendResult | null }>;
}

const fetcher = async (url: string): Promise<MarketSectorsPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

export function useMarketSectors() {
  const { data, error, isLoading, mutate } = useSWR<MarketSectorsPayload>(
    '/api/markets/sectors',
    fetcher,
    { refreshInterval: 10 * 60 * 1000, revalidateOnFocus: false },
  );
  return { data, error, isLoading, asOf: data?.asOf ?? null, mutate };
}
