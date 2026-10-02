'use client';

import useSWR from 'swr';

export interface M15ShadowVariant {
  desc?: string;
  n?: number;
  n_eff?: number;
  avg_r?: number | null;
  ci95?: [number, number] | null;
  verdict?: string;
}

export interface M15ShadowPayload {
  utc: string;
  variants: Record<string, M15ShadowVariant>;
  capacity_sims?: {
    n_stream?: number;
    'CAP-FCFS'?: { n_admitted: number; avg_r: number | null };
    'CAP-SCORE'?: { n_admitted: number; avg_r: number | null };
    orisk?: { status: string; be_bar_rows: number };
    note?: string;
  };
  lenses?: {
    side_split?: Record<string, { n: number; avg_r: number | null; sl_rate: number | null }>;
    sizing_lens?: { expectancy_r: number | null; expectancy_usd: number | null; sign_agreement?: boolean | null };
    beta_hedged?: { n_ok: number; avg_r_residual_beta1: number | null };
    funding_lens?: { total_r: number | null };
  };
  fee_gate_v0?: { pct: number | null };
}

const STALE_MS = 30 * 3600 * 1000;

const fetcher = async (url: string): Promise<M15ShadowPayload> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as M15ShadowPayload;
};

export function useM15Shadow(): {
  data: M15ShadowPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<M15ShadowPayload>(
    '/api/m15-shadow',
    fetcher,
    { refreshInterval: 600_000, revalidateOnFocus: false },
  );
  const ageMs = data?.utc ? Date.now() - Date.parse(data.utc) : null;
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: ageMs !== null && ageMs > STALE_MS,
  };
}
