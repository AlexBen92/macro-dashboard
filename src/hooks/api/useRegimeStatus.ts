'use client';

import useSWR from 'swr';

export type RegimeLabel = 'CALM' | 'BUILDING' | 'STRESS' | 'CRISIS';

export interface RegimeCell {
  regime: RegimeLabel;
  n_obs: number;
  mean_bps: number;
  sharpe_annual: number;
  dsr_probability: number;
  passes_dsr: boolean;
  passes_min_n: boolean;
}

export interface StrategyRow {
  strategy: string;
  pooled_sharpe: number;
  pooled_dsr: number;
  pooled_n: number;
  pooled_mean_bps: number;
  regimes: RegimeCell[];
  regime_distribution: Record<string, number>;
}

export interface ExcludedRow {
  strategy: string;
  reason: string;
}

export interface RegimeStatus {
  as_of: string | null;
  current_regime: RegimeLabel | null;
  regime_since: string | null;
  days_in_regime: number | null;
  regime_distribution: Record<RegimeLabel, number>;
  matrix: StrategyRow[];
  matrix_excluded: ExcludedRow[];
  rule_version: string;
}

const fetcher = async (url: string): Promise<RegimeStatus> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as RegimeStatus;
};

export function useRegimeStatus(): {
  data: RegimeStatus | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, error, isLoading } = useSWR<RegimeStatus>(
    '/api/regime-status',
    fetcher,
    { refreshInterval: 600_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
  };
}
