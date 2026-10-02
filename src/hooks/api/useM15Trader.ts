'use client';

import useSWR from 'swr';

export interface M15TraderStatus {
  as_of: string;
  mode: string;
  live_gate: string;
  config_hash: string;
  hash_untracked_keys?: string[];
  measurement?: {
    registry_status: string;
    budget_usdc: number | null;
    baseline_usdc: number | null;
    end_rule: string;
  };
  brake: string | null;
  equity: number | null;
  open_setups: Array<{
    id: number;
    symbol: string;
    side: string;
    entry_price: number;
    stop_price: number;
    size: { risk_usd?: number; notional_usd?: number } | null;
  }>;
  protected_sl: number | null;
  positions_seen: number | null;
  blind_flag: boolean;
  net_beta?: {
    ts_utc: string;
    net_exposure_usdc: number;
    net_beta_usdc: number;
    gross_usdc: number;
    n_open: number;
  } | null;
  reconcile_events: string[];
  stats: Record<string, unknown>;
  errors: string[];
}

const STALE_MS = 10 * 60 * 1000;

const fetcher = async (url: string): Promise<M15TraderStatus> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as M15TraderStatus;
};

export function useM15Trader(): {
  data: M15TraderStatus | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
} {
  const { data, error, isLoading } = useSWR<M15TraderStatus>(
    '/api/m15-trader',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
  const ageMs = data?.as_of ? Date.now() - Date.parse(data.as_of) : null;
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale: ageMs !== null && ageMs > STALE_MS,
  };
}
