'use client';
import { useState, useEffect } from 'react';

interface DefiProtocol {
  name: string;
  symbol: string;
  tvl: number;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  chain: string;
  category: string;
}

interface DefiChain {
  name: string;
  tvl: number;
  change_1d: number;
  change_7d: number;
  tokenSymbol: string;
  gecko_id: string;
}

interface DefiYield {
  project: string;
  chain: string;
  token: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  pool: string;
  stablecoin: boolean;
}

interface DefiLlamaResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  fallbackData?: T;
}

export function useDefiLlama(endpoint: 'protocols' | 'chains' | 'yields') {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/defillama?endpoint=${endpoint}`);
        const result: DefiLlamaResponse<any> = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else if (result.fallbackData) {
          console.warn('DefiLlama using fallback data:', result.error);
          setData(result.fallbackData);
          setError(result.error || 'Using fallback data');
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        console.error('DefiLlama fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh intervals vary by endpoint
    const intervalMs = endpoint === 'yields' ? 60000 : endpoint === 'chains' ? 600000 : 600000;
    const interval = setInterval(fetchData, intervalMs);

    return () => clearInterval(interval);
  }, [endpoint]);

  return { data, loading, error };
}

// Specific hooks for common use cases
export function useDefiProtocols() {
  return useDefiLlama('protocols') as { data: DefiProtocol[]; loading: boolean; error: string | null };
}

export function useDefiChains() {
  return useDefiLlama('chains') as { data: DefiChain[]; loading: boolean; error: string | null };
}

export function useDefiYields() {
  return useDefiLlama('yields') as { data: DefiYield[]; loading: boolean; error: string | null };
}
