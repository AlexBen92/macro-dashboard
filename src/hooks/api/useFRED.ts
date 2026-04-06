'use client';
import { useState, useEffect } from 'react';

interface FREDObservation {
  date: string;
  value: number;
  realtime_start: string;
  realtime_end: string;
}

interface FREDData {
  series: {
    id: string;
    units: string;
    name: string;
    description: string;
  };
  observations: FREDObservation[];
  latest: FREDObservation;
  change: number;
}

interface FREDResponse {
  success: boolean;
  data?: FREDData;
  error?: string;
  fallbackData?: FREDData;
}

export function useFRED(seriesId: string) {
  const [data, setData] = useState<FREDData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/fred?series_id=${seriesId}`);
        const result: FREDResponse = await response.json();

        if (result.success && result.data) {
          setData(result.data);
        } else if (result.fallbackData) {
          console.warn('FRED using fallback data:', result.error);
          setData(result.fallbackData);
          setError(result.error || 'Using fallback data');
        } else {
          throw new Error(result.error || 'Unknown error');
        }
      } catch (err) {
        console.error('FRED fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // FRED data doesn't need frequent refresh - every hour is fine
    const interval = setInterval(fetchData, 3600000);

    return () => clearInterval(interval);
  }, [seriesId]);

  return { data, loading, error };
}

// Hook for multiple FRED series
export function useMultipleFRED(seriesIds: string[]) {
  const [data, setData] = useState<Record<string, FREDData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError(null);

      try {
        const promises = seriesIds.map(async (id) => {
          const response = await fetch(`/api/fred?series_id=${id}`);
          const result: FREDResponse = await response.json();
          return { id, data: result.data || result.fallbackData };
        });

        const results = await Promise.all(promises);
        const dataMap = results.reduce((acc, { id, data }) => {
          if (data) acc[id] = data;
          return acc;
        }, {} as Record<string, FREDData>);

        setData(dataMap);
      } catch (err) {
        console.error('FRED multiple fetch error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    const interval = setInterval(fetchAll, 3600000);
    return () => clearInterval(interval);
  }, [seriesIds]);

  return { data, loading, error };
}
