'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

import type { DecisionStatusPayload } from '@/lib/decision/types';

const ENDPOINT = '/api/decision-status';
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

const fetcher = async (url: string): Promise<DecisionStatusPayload> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as DecisionStatusPayload;
};

function computeAgeMs(ts?: string | null): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

export interface UseDecisionStatusResult {
  data: DecisionStatusPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  lastExportAgeMs: number | null;
}

export function useDecisionStatus(): UseDecisionStatusResult {
  const { data, error, isLoading } = useSWR<DecisionStatusPayload>(
    ENDPOINT,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lastExportAgeMs = data?.last_export_success ? computeAgeMs(data.last_export_success) : null;
  // tick `now` dependency so re-render every 30s for stale re-eval
  void now;
  const isStale = lastExportAgeMs !== null && lastExportAgeMs > STALE_THRESHOLD_MS;

  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale,
    lastExportAgeMs,
  };
}
