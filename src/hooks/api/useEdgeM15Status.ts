'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';

export type EdgeGlobal = 'RANGE_MR' | 'BREAKOUT' | 'NO_EDGE' | 'TRANSITION' | 'NO_DATA';
export type RegimeLabel = 'CALM' | 'BUILDING' | 'STRESS' | 'CRISIS';
export type ValidationStatus = 'BACKTEST' | 'PAPER' | 'LIVE' | 'EN_VALIDATION';
export type DecayState = 'HEALTHY' | 'WARNING' | 'DECAYED' | 'LOW-N' | 'LOW-DSR' | 'NO_DATA';

export interface VerdictBTC {
  label: string;
  reason: string;
  adx: number;
  vol_ratio: number | null;
  rsi: number;
  delta_proxy: number;
  recent_trades_delta: number;
  bb_upper?: number | null;
  bb_lower?: number | null;
  bb_bw_expanding?: boolean;
  close?: number;
}

export interface VolHeatmap {
  as_of: string | null;
  lookback_days: number;
  sessions: Record<'ASIA' | 'LONDON' | 'NY' | 'OFFHOURS', number>;
  current_session: string | null;
}

export interface SessionPlan {
  name: string;
  start_utc: string;
  end_utc: string;
  hour_utc: number;
  as_of: string;
  rule_text: string;
  max_trades_session: number;
  regime: RegimeLabel;
}

export interface SizingSuggestion {
  fraction: number;
  kelly_raw: number;
  capped: boolean;
  vol_target: number;
  reason?: string;
}

export interface SetupRow {
  strategy: string;
  regime: RegimeLabel;
  n_obs: number;
  mean_bps: number;
  sharpe: number;
  dsr: number;
  passes_dsr: boolean;
  passes_min_n: boolean;
  tag: 'STRONG' | 'OK' | 'LOW-N' | 'LOW-DSR';
  active: boolean;
  cluster_id?: number | null;
  sizing_suggestion?: SizingSuggestion | null;
  validation_status?: ValidationStatus;
  paper_pnl_vs_backtest_bps?: number | null;
}

export interface CandleM15 {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface FamilyCluster {
  id: number;
  members: string[];
  max_abs_corr: number;
}

export interface FamilySummary {
  symbol?: string;
  timestamp?: string;
  git_commit_hash?: string;
  params_hash?: string;
  total_trials: number;
  family_pbo?: { PBO: number | null; reason?: string; interpretation?: string };
  clusters_corr_gt_0p6?: FamilyCluster[];
  strategies_passing?: string[];
  strategies_failing?: string[];
}

export interface AlphaDecayStrategy {
  strategy: string;
  state: DecayState;
  n_recent: number;
  n_baseline_days: number;
  dsr_probability: number | null;
  cusum?: { p_value: number; break_detected: boolean };
  recent_mean_bps?: number;
  baseline_mean_bps?: number;
  recent_sharpe?: number;
}

export interface AlphaDecay {
  as_of?: string;
  strategies?: Record<string, AlphaDecayStrategy>;
}

export interface EdgeM15Status {
  as_of: string;
  last_export_success?: string;
  stale_threshold_min?: number;
  regime: RegimeLabel;
  regime_since?: string | null;
  days_in_regime?: number | null;
  regime_change_recent: boolean;
  edge_global: EdgeGlobal;
  verdict_btc: VerdictBTC;
  vol_heatmap: VolHeatmap;
  session: SessionPlan;
  max_trades_session: number;
  setups_actifs: SetupRow[];
  candles_m15_last: CandleM15[];
  matrix_excluded?: { strategy: string; reason: string }[];
  family_summary?: FamilySummary | null;
  alpha_decay?: AlphaDecay | null;
  error?: string;
}

const DATA_BASE = process.env.NEXT_PUBLIC_DASH_DATA_URL ?? '';
const EDGE_M15_URL = DATA_BASE
  ? `${DATA_BASE.replace(/\/$/, '')}/edge_m15_status.json`
  : '/data/edge_m15_status.json';

const STALE_THRESHOLD_MS = 20 * 60 * 1000;

const fetcher = async (url: string): Promise<EdgeM15Status> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as EdgeM15Status;
};

function computeAgeMs(ts?: string | null): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

export function useEdgeM15Status(): {
  data: EdgeM15Status | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  lastExportAgeMs: number | null;
} {
  const { data, error, isLoading } = useSWR<EdgeM15Status>(
    EDGE_M15_URL,
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
