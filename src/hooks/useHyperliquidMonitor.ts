'use client';

import { useState, useEffect, useRef } from 'react';
import type { MarketRow, HyperliquidMonitorStats } from '@/lib/market-data';

interface MonitorData {
  rows: MarketRow[];
  stats: HyperliquidMonitorStats | null;
  lastUpdate: number;
  cacheData: Array<{ symbol: string; oi: number; vol: number }>;
}

interface CacheEntry {
  oi: number;
  vol: number;
  timestamp: number;
}

interface UseHyperliquidMonitorReturn {
  rows: MarketRow[];
  stats: HyperliquidMonitorStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  countdown: number;
}

const CACHE_KEY = 'hl-monitor-prev-data';
const CACHE_MAX_AGE = 180000; // 3 minutes

function getStoredCache(): Record<string, CacheEntry> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CacheEntry>;
    // Remove old entries
    const now = Date.now();
    const cleaned: Record<string, CacheEntry> = {};
    for (const [symbol, entry] of Object.entries(parsed)) {
      if (now - entry.timestamp < CACHE_MAX_AGE) {
        cleaned[symbol] = entry;
      }
    }
    return cleaned;
  } catch {
    return {};
  }
}

function saveCache(data: Array<{ symbol: string; oi: number; vol: number }>) {
  if (typeof window === 'undefined') return;
  try {
    const now = Date.now();
    const existing = getStoredCache();
    const updated: Record<string, CacheEntry> = {};

    // Update with new data
    for (const item of data) {
      updated[item.symbol] = {
        oi: item.oi,
        vol: item.vol,
        timestamp: now,
      };
    }

    // Keep old entries that aren't too old
    for (const [symbol, entry] of Object.entries(existing)) {
      if (!updated[symbol] && now - entry.timestamp < CACHE_MAX_AGE) {
        updated[symbol] = entry;
      }
    }

    localStorage.setItem(CACHE_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

function getPrevDataParam(): string | null {
  const cache = getStoredCache();
  const data = Object.entries(cache).map(([symbol, entry]) => ({
    symbol,
    oi: entry.oi,
    vol: entry.vol,
  }));

  if (data.length === 0) return null;
  return JSON.stringify(data);
}

export function useHyperliquidMonitor(refreshInterval = 30): UseHyperliquidMonitorReturn {
  const [data, setData] = useState<MonitorData>({ rows: [], stats: null, lastUpdate: 0, cacheData: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(refreshInterval);
  const isFirstFetch = useRef(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build URL with previous data
      const prevParam = isFirstFetch.current ? null : getPrevDataParam();
      let url = '/api/hyperliquid-monitor';
      if (prevParam) {
        url += `?prevData=${encodeURIComponent(prevParam)}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setData({
          rows: json.rows ?? [],
          stats: json.stats ?? null,
          lastUpdate: json.lastUpdate ?? Date.now(),
          cacheData: json.cacheData ?? [],
        });

        // Save cache for next fetch
        if (json.cacheData && json.cacheData.length > 0) {
          saveCache(json.cacheData);
        }
      }

      isFirstFetch.current = false;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setCountdown(refreshInterval);
    }
  };

  useEffect(() => {
    fetchData();

    const interval = setInterval(() => {
      fetchData();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return {
    rows: data.rows,
    stats: data.stats,
    loading,
    error,
    refresh: fetchData,
    countdown,
  };
}
