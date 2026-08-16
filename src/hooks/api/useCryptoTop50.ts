'use client';

import useSWR from 'swr';

export interface Top50Coin {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  chg_24h: number | null;
  chg_7d: number | null;
  volume_24h: number | null;
  market_cap: number | null;
  funding_apr: number | null;
}

interface Top50Payload {
  asOf: string;
  coins: Top50Coin[];
}

const fetcher = async (url: string): Promise<Top50Payload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Top50Payload;
};

export function useCryptoTop50() {
  const { data, error, isLoading } = useSWR<Top50Payload>(
    '/api/crypto/top50',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
  return { data: data ?? null, error: error ? String(error) : null, isLoading };
}
