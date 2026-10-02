'use client';

import useSWR from 'swr';

export interface M15DiagPayload {
  diag: {
    utc: string;
    cap_bps: number;
    divergence_7d: Record<string, {
      n: number; median_bps: number; p90_bps: number; pct_over_cap: number;
    }>;
    slo: {
      orders_placed: number;
      incidents_counted: number;
      incidents_per_100_orders: number | null;
      sl_absent_events_journald: number;
    };
  };
  brake: {
    brake?: {
      n_with_r_sim: number;
      mean_delta_r: number | null;
      pct_delta_positive: number | null;
    };
  } | null;
}

const STALE_MS = 30 * 3600 * 1000;

const fetcher = async (url: string): Promise<M15DiagPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as M15DiagPayload;
};

export function useM15Diag(): {
  data: M15DiagPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<M15DiagPayload>(
    '/api/m15-diag',
    fetcher,
    { refreshInterval: 600_000, revalidateOnFocus: false },
  );
  const ageMs = data?.diag?.utc ? Date.now() - Date.parse(data.diag.utc) : null;
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: ageMs !== null && ageMs > STALE_MS,
  };
}
