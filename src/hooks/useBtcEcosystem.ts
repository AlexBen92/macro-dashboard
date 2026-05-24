'use client';
import { useState, useEffect, useCallback, useRef } from 'react';

interface BtcEcosystemAsset {
  ticker: string;
  label: string;
  category: string;
  baseCorr: number;
  beta: number;
  price: number;
  change24h: number;
}

interface BtcEcosystemData {
  btc: { price: number; change24h: number };
  assets: BtcEcosystemAsset[];
  updatedAt: string;
  stale: boolean;
}

interface UseBtcEcosystemReturn {
  data: BtcEcosystemData | null;
  isLoading: boolean;
  isStale: boolean;
  error: string | null;
  lastUpdate: Date | null;
  refresh: () => void;
}

const REFRESH_INTERVAL = 5 * 60 * 1000;

export function useBtcEcosystem(): UseBtcEcosystemReturn {
  const [data, setData] = useState<BtcEcosystemData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/btc-ecosystem');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, REFRESH_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchData]);

  const lastUpdate = data?.updatedAt ? new Date(data.updatedAt) : null;

  return {
    data,
    isLoading,
    isStale: data?.stale ?? false,
    error,
    lastUpdate,
    refresh: fetchData,
  };
}
