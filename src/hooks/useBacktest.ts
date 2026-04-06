'use client';
import { useState, useEffect, useCallback } from 'react';
import type { BacktestResult } from '@/lib/backtest';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type BacktestMode = 'crypto' | 'ftmo';

interface BacktestCache {
  results: BacktestResult[];
  fetchedAt: string;
}

function storageKey(mode: BacktestMode) {
  return `backtest_results_v3_${mode}`;
}

function loadCache(mode: BacktestMode): BacktestCache | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(storageKey(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BacktestCache;
    const age = Date.now() - new Date(parsed.fetchedAt).getTime();
    if (age > CACHE_TTL_MS) return null; // expired
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(mode: BacktestMode, data: BacktestCache) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey(mode), JSON.stringify(data));
  } catch { /* storage full */ }
}

export function useBacktest(mode: BacktestMode = 'crypto') {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const apiRoute = mode === 'ftmo' ? '/api/backtest-ftmo' : '/api/backtest';

  const runBacktest = useCallback(async (forceRefresh = false) => {
    // Try cache first
    if (!forceRefresh) {
      const cached = loadCache(mode);
      if (cached) {
        setResults(cached.results);
        setFetchedAt(cached.fetchedAt);
        setFromCache(true);
        return;
      }
    }

    setLoading(true);
    setError(null);
    setFromCache(false);

    try {
      const res = await fetch(apiRoute);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { results: BacktestResult[]; fetchedAt: string };
      const cache: BacktestCache = { results: data.results, fetchedAt: data.fetchedAt };
      saveCache(mode, cache);
      setResults(data.results);
      setFetchedAt(data.fetchedAt);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [mode, apiRoute]);

  // Auto-run on mount (uses cache if fresh)
  useEffect(() => {
    runBacktest(false);
  }, [runBacktest]);

  // Also store individual trades in a separate key so they persist across refreshes
  // (backtest trades are read-only, no delete)
  const allTrades = results.flatMap(r => r.trades);

  return { results, allTrades, loading, error, fetchedAt, fromCache, refresh: () => runBacktest(true) };
}
