'use client';

import { useState, useEffect } from 'react';
import type { MarketRow, HyperliquidMonitorStats } from '@/lib/market-data';

interface MonitorData {
  rows: MarketRow[];
  stats: HyperliquidMonitorStats | null;
  lastUpdate: number;
}

interface UseHyperliquidMonitorReturn {
  rows: MarketRow[];
  stats: HyperliquidMonitorStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  countdown: number;
}

export function useHyperliquidMonitor(refreshInterval = 30): UseHyperliquidMonitorReturn {
  const [data, setData] = useState<MonitorData>({ rows: [], stats: null, lastUpdate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(refreshInterval);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/hyperliquid-monitor', {
        next: { revalidate: 30 },
      });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setData({ rows: json.rows ?? [], stats: json.stats ?? null, lastUpdate: json.lastUpdate ?? Date.now() });
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
