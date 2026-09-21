'use client';

import useSWR from 'swr';

export type OfiObiStatus = 'NULL' | 'IN_TEST' | 'IN_VALIDATION' | 'CONFIRMED';

export interface OfiObiBestCell {
  coin: string;
  signal: string;
  n: number | null;
  h: number | null;
  ic_cal: number | null;
  ic_perm_p: number | null;
  val_bps_day: number | null;
  holdout_bps_day: number | null;
  status: OfiObiStatus | null;
}

export interface OfiObiUsageA {
  n_entries?: number;
  verdicts?: Record<string, number>;
  gain_bps_abs_range?: number[];
  taker_cost_bps?: number;
  note?: string;
}

export interface OfiObiUsageB {
  n_cells?: number;
  status_counts?: Record<string, number>;
  ic_abs_range?: number[];
  perm_p_max?: number | null;
  note?: string;
}

export interface OfiObiSpec {
  title?: string;
  data?: { bars?: string; hf_zone?: string; window?: string };
  signals?: Record<string, string>;
  grid?: string;
  usage_a_def?: string;
  usage_b_def?: string;
  combination_def?: string;
  validation?: string[];
  decision?: string[];
  reactivation?: string;
}

export interface OfiObiBackfillCoin {
  bars?: number;
  bars_per_day?: number;
  mid_zero_pct?: number;
  bar_sec_median?: number;
  spread_bps_median?: number;
  obi5_vs_imbalance5_corr?: number;
}

export interface OfiObiStatusPayload {
  as_of: string;
  last_export_success?: string | null;
  stale_threshold_min: number;
  data_window_days: number;
  symbols: string[];
  verdict: { usage_a: string | null; usage_b: string | null };
  usage_a: OfiObiUsageA;
  usage_b: OfiObiUsageB;
  best_by_signal: OfiObiBestCell[];
  incremental_ic: Record<string, unknown>;
  pbo_lot: Record<string, { PBO?: number; interpretation?: string }>;
  protocol: string[];
  costs: string;
  spec?: OfiObiSpec;
  backfill?: Record<string, OfiObiBackfillCoin>;
  config_hash: string;
  error?: string | null;
}

const OFI_OBI_URL = '/api/ofi-obi-status';
const STALE_THRESHOLD_MS = 25 * 60 * 60 * 1000;

const fetcher = async (url: string): Promise<OfiObiStatusPayload> => {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as OfiObiStatusPayload;
};

function computeAgeMs(ts?: string | null): number | null {
  if (!ts) return null;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

export function useOfiObiStatus(): {
  data: OfiObiStatusPayload | null;
  isLoading: boolean;
  error: string | null;
  isStale: boolean;
  lastExportAgeMs: number | null;
} {
  const { data, error, isLoading } = useSWR<OfiObiStatusPayload>(
    OFI_OBI_URL,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );

  const lastExportAgeMs = data?.last_export_success
    ? computeAgeMs(data.last_export_success)
    : null;
  const isStale = lastExportAgeMs !== null && lastExportAgeMs > STALE_THRESHOLD_MS;

  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
    isStale,
    lastExportAgeMs,
  };
}
