'use client';

import { useState, useEffect, useRef } from 'react';
import type { TradeOpportunity } from '@/lib/opportunities';

interface OpportunityStats {
  total: number;
  byDirection: {
    long: number;
    short: number;
    watch: number;
  };
  avgScore: number;
}

interface UseIntradayOpportunitiesReturn {
  opportunities: TradeOpportunity[];
  stats: OpportunityStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  setFilter: (filter: string) => void;
  currentFilter: string;
  setCount: (count: number) => void;
  currentCount: number;
  countdown: number;
}

const CACHE_KEY = 'hl-opp-prev-data';
const CACHE_MAX_AGE = 180000;

function getStoredCache(): Record<string, { oi: number; vol: number; timestamp: number }> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, { oi: number; vol: number; timestamp: number }>;
    const now = Date.now();
    const cleaned: Record<string, { oi: number; vol: number; timestamp: number }> = {};
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
    const updated: Record<string, { oi: number; vol: number; timestamp: number }> = {};

    for (const item of data) {
      updated[item.symbol] = {
        oi: item.oi,
        vol: item.vol,
        timestamp: now,
      };
    }

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

export function useIntradayOpportunities(refreshInterval = 30): UseIntradayOpportunitiesReturn {
  const [opportunities, setOpportunities] = useState<TradeOpportunity[]>([]);
  const [stats, setStats] = useState<OpportunityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentFilter, setFilter] = useState('all');
  const [currentCount, setCount] = useState(10);
  const [countdown, setCountdown] = useState(refreshInterval);
  const isFirstFetch = useRef(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build URL with previous data
      const prevParam = isFirstFetch.current ? null : getPrevDataParam();
      let url = `/api/opportunities?count=${currentCount}`;
      if (currentFilter !== 'all') {
        url += `&filter=${currentFilter}`;
      }
      if (prevParam) {
        url += `&prevData=${encodeURIComponent(prevParam)}`;
      }

      const res = await fetch(url);
      const json = await res.json();

      if (json.error) {
        setError(json.error);
      } else {
        setOpportunities(json.opportunities ?? []);
        setStats(json.stats ?? null);

        if (json.cacheData && json.cacheData.length > 0) {
          saveCache(json.cacheData);
        }
      }

      if (isFirstFetch.current) {
        isFirstFetch.current = false;
      }
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
  }, [refreshInterval, currentCount, currentFilter]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  return {
    opportunities,
    stats,
    loading,
    error,
    refresh: fetchData,
    setFilter,
    currentFilter,
    setCount,
    currentCount,
    countdown,
  };
}
