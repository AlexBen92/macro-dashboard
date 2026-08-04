'use client';

import useSWR from 'swr';

export type EdgeGlobal = 'RANGE_MR' | 'BREAKOUT' | 'NO_EDGE' | 'TRANSITION' | 'NO_DATA';
export type RegimeLabel = 'CALM' | 'BUILDING' | 'STRESS' | 'CRISIS';

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
}

export interface CandleM15 {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface EdgeM15Status {
  as_of: string;
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
  error?: string;
}

const fetcher = async (url: string): Promise<EdgeM15Status> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as EdgeM15Status;
};

export function useEdgeM15Status(): {
  data: EdgeM15Status | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, error, isLoading } = useSWR<EdgeM15Status>(
    '/data/edge_m15_status.json',
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
  };
}
