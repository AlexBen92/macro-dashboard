'use client';
import { useState, useEffect } from 'react';

interface CoinGlassData {
  symbol: string;
  price: number;
  price_change_24h: number;
  volume_24h: number;
  open_interest: number;
  open_interest_change_24h: number;
  funding_rate: number;
  next_funding_time: number;
}

interface CoinGlassResponse {
  success: boolean;
  data?: CoinGlassData[];
  error?: string;
  fallbackData?: CoinGlassData[];
}

export function useCoinGlass(endpoint: 'funding_rate' | 'liquidation' | 'open_interest' = 'funding_rate') {
  const [data, setData] = useState<CoinGlassData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/coinglass?endpoint=${endpoint}`);
        const result: CoinGlassResponse = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else if (result.fallbackData) {
          console.warn('CoinGlass using fallback data:', result.error);
          setData(result.fallbackData);
          setError(result.error || 'Using fallback data');
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        console.error('CoinGlass fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Refresh every 30 seconds for funding_rate, 60 seconds for others
    const interval = setInterval(fetchData, endpoint === 'funding_rate' ? 30000 : 60000);

    return () => clearInterval(interval);
  }, [endpoint]);

  return { data, loading, error };
}
