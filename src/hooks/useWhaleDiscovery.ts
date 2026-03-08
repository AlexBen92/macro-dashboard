'use client';
import { useState, useEffect, useCallback } from 'react';
import type { WhaleInfo, WhalePosition, WhaleDiscoveryResponse } from '@/lib/types';
import { WHALE_REFRESH_MS } from '@/lib/constants';

interface UseWhaleDiscoveryReturn {
  whales: WhaleInfo[];
  positions: WhalePosition[];
  whaleByCoin: Record<string, { l: number; s: number; n: number }>;
  totalLong: number;
  totalShort: number;
  loading: boolean;
  error: string | null;
}

export function useWhaleDiscovery(): UseWhaleDiscoveryReturn {
  const [whales, setWhales] = useState<WhaleInfo[]>([]);
  const [positions, setPositions] = useState<WhalePosition[]>([]);
  const [whaleByCoin, setWhaleByCoin] = useState<Record<string, { l: number; s: number; n: number }>>({});
  const [totalLong, setTotalLong] = useState(0);
  const [totalShort, setTotalShort] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWhales = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whale-discovery');
      const data: WhaleDiscoveryResponse = await res.json();
      if (data.whales) {
        setWhales(data.whales);
        setPositions(data.positions || []);
        setWhaleByCoin(data.whaleByCoin || {});
        setTotalLong(data.totalLong || 0);
        setTotalShort(data.totalShort || 0);
        setError(null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWhales();
    const int = setInterval(fetchWhales, WHALE_REFRESH_MS);
    return () => clearInterval(int);
  }, [fetchWhales]);

  return { whales, positions, whaleByCoin, totalLong, totalShort, loading, error };
}
