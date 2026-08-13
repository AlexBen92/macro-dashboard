'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

export type OfiStatus = 'ON' | 'OFF' | 'ALPHA_DECAY' | 'NULL';
export type Verdict = 'EDGE_CONFIRMED' | 'BORDERLINE' | 'NULL' | 'INCONCLUSIVE';

export interface OfiStrategyMetrics {
  sh_oos: number;
  mc_p5_bps: number;
  pbo: number;
  n_trades: number;
  per_fold_worst_bps: number;
  dsr_probability: number;
}

export interface OfiStrategyEntry {
  name: string;
  symbol: string;
  horizon: string;
  status: OfiStatus;
  regime_allowed: string[];
  fee_scenario: string;
  metrics: OfiStrategyMetrics;
  alpha_decay_flag: boolean;
  verdict: Verdict;
  capacity_usd: number;
}

export interface OfiRealtimeEntry {
  ofi_z_1m: number;
  mlofi_z_1m: number;
  voi: number;
  microprice_dev_bps: number;
  spread_bps: number;
  n_trades_last: number;
  mid_close: number;
  as_of: string | null;
  stale: boolean;
  error?: string;
}

export interface BestModelEntry {
  model: string;
  horizon: string;
  sh_oos: number;
  verdict: Verdict;
}

export interface OrderflowStatus {
  as_of: string;
  last_export_success?: string;
  last_wf_run?: string | null;
  stale_threshold_min: number;
  data_window_days: number;
  symbols: string[];
  alpha_term_structure_snapshot: Record<string, Record<string, Record<string, number>>>;
  best_model_per_asset: Record<string, BestModelEntry>;
  ofi_realtime: Record<string, OfiRealtimeEntry>;
  strategies: OfiStrategyEntry[];
  validation_status: {
    wf_complete: boolean;
    gates_passed?: number;
    gates_failed?: number;
    n_strategy_runs?: number;
    wf_run_at?: string;
    error?: string;
  };
  error?: string;
}

const ORDERFLOW_URL = '/api/orderflow-status';
const STALE_THRESHOLD_MS = 15 * 60 * 1000;

const fetcher = async (url: string): Promise<OrderflowStatus> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as OrderflowStatus;
};

function computeAgeMs(ts?: string | null): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

export function useOrderflowStatus(): {
  data: OrderflowStatus | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  lastExportAgeMs: number | null;
} {
  const { data, error, isLoading } = useSWR<OrderflowStatus>(
    ORDERFLOW_URL,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const lastExportAgeMs = data?.last_export_success ? computeAgeMs(data.last_export_success) : null;
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
