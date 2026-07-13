'use client';
import { useState, useEffect, useCallback } from 'react';

export interface HLCandle {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}

export interface FundingHistoryPoint {
  t: number;
  funding: number;
}

interface HyperliquidMeta {
  symbol: string;
  name: string;
  price: number;
  volume24h: number;
  openInterest: number;
  fundingRate: number;
  maxLeverage: number;
}

interface HyperliquidResponse {
  success: boolean;
  data?: HyperliquidMeta[];
  error?: string;
}

export function useHyperliquid() {
  const [data, setData] = useState<HyperliquidMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetadata = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/hyperliquid?method=meta');
        const result: HyperliquidResponse = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        console.error('Hyperliquid fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchMetadata();

    // Refresh every 60 seconds
    const interval = setInterval(fetchMetadata, 60000);

    return () => clearInterval(interval);
  }, []);

  return { data, loading, error };
}

const HL_INFO = 'https://api.hyperliquid.xyz/info';

async function hlInfo<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Snapshot 1-shot de N dernières bougies HL pour un symbol.
 * Utilisé pour realized vol 24h (intervalle 1h, limit 24) et rolling high 20d (intervalle 1d, limit 20).
 */
export function useCandleSnapshot(
  symbol: string | null,
  interval: string,
  limit: number,
): { candles: HLCandle[]; loading: boolean; error: string | null } {
  const [candles, setCandles] = useState<HLCandle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCandles = useCallback(async () => {
    if (!symbol) {
      setCandles([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // endTime = now, startTime calculé à partir de l'interval + limit
      const end = Date.now();
      const intervalMs = interval.endsWith('h')
        ? parseInt(interval, 10) * 3_600_000
        : interval.endsWith('m')
          ? parseInt(interval, 10) * 60_000
          : interval.endsWith('d')
            ? parseInt(interval, 10) * 86_400_000
            : 3_600_000;
      const start = end - intervalMs * limit;
      const res = await hlInfo<{ candleSnapshot: HLCandle[] }>({
        type: 'candleSnapshot',
        req: { coin: symbol, interval, startTime: Math.floor(start / 1000), endTime: Math.floor(end / 1000) },
      });
      setCandles(res?.candleSnapshot ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
      setCandles([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, limit]);

  useEffect(() => {
    fetchCandles();
  }, [fetchCandles]);

  return { candles, loading, error };
}

/**
 * Récupère l'historique des funding rates pour 1 symbol. Retourne ~lastN rates 8h (default 90).
 */
export function useFundingHistory(
  symbol: string | null,
  lastN = 90,
): { history: FundingHistoryPoint[]; loading: boolean; error: string | null } {
  const [history, setHistory] = useState<FundingHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!symbol) {
      setHistory([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const end = Date.now();
      // 8h funding interval, on veut lastN points
      const start = end - lastN * 8 * 3_600_000;
      const res = await hlInfo<Array<{ t: number; funding: string }>>({
        type: 'fundingHistory',
        coin: symbol,
        startTime: Math.floor(start / 1000),
        endTime: Math.floor(end / 1000),
      });
      if (Array.isArray(res)) {
        const points = res
          .map(p => ({ t: p.t, funding: parseFloat(p.funding ?? '0') }))
          .filter(p => Number.isFinite(p.funding));
        setHistory(points);
      } else {
        setHistory([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [symbol, lastN]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return { history, loading, error };
}
