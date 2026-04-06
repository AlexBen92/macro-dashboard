'use client';
import { useState, useEffect } from 'react';

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
