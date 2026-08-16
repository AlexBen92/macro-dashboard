export type HurstRegime = 'trend' | 'neutral' | 'mean_revert';
export type SuperTrendDir = 'bull' | 'bear';
export type StationarityRegime = 'stationary' | 'non_stationary' | 'uncertain';

export interface RegimeMatrixAsset {
  id: string;
  source: 'yahoo' | 'hyperliquid';
  name: string;
  sector: string | null;
  last_close: number | null;
  volume_24h: number | null;
  bars: number;
  status: 'ok' | 'insufficient_history' | 'fetch_error';
  /** v2 payload (DFA dual windows). hurst_252 = legacy v1 field. */
  hurst_struct?: number | null;
  hurst_short?: number | null;
  hurst_short_regime?: HurstRegime | null;
  hurst_divergence?: number | null;
  hurst_method?: string | null;
  hurst_windows?: { short: number; structural: number } | null;
  hurst_252?: number | null;
  hurst_regime: HurstRegime | null;
  supertrend_dir: SuperTrendDir | null;
  st_flips_30d: number | null;
  atr_pct: number | null;
  adx_14: number | null;
  adf_p: number | null;
  kpss_p: number | null;
  stationarity: StationarityRegime | null;
  trend_score: number | null;
}

export interface RegimeMatrixPayload {
  as_of: string | null;
  rule_version: string;
  universe: {
    macro_n: number;
    hl_n: number;
    hl_selected_at: string | null;
    stable_excluded: string[];
  };
  assets: RegimeMatrixAsset[];
  errors: Array<{ id: string; error: string }>;
  last_export_success: string | null;
}

export const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;

export function isStale(payload: RegimeMatrixPayload | null, nowMs = Date.now()): boolean {
  if (!payload?.last_export_success) return true;
  const t = Date.parse(payload.last_export_success);
  if (Number.isNaN(t)) return true;
  return nowMs - t > STALE_THRESHOLD_MS;
}

export function hurstColor(regime: HurstRegime | null): string {
  if (!regime) return 'var(--dim)';
  if (regime === 'trend') return 'var(--bull)';
  if (regime === 'mean_revert') return 'var(--info)';
  return 'var(--muted)';
}

export function superTrendColor(dir: SuperTrendDir | null): string {
  if (dir === 'bull') return 'var(--bull)';
  if (dir === 'bear') return 'var(--bear)';
  return 'var(--dim)';
}

export function stationarityColor(regime: StationarityRegime | null): string {
  if (!regime) return 'var(--dim)';
  if (regime === 'stationary') return 'var(--bull)';
  if (regime === 'non_stationary') return 'var(--caution)';
  return 'var(--muted)';
}

export function trendScoreColor(score: number | null): string {
  if (score == null) return 'var(--dim)';
  if (score >= 60) return 'var(--bull)';
  if (score >= 35) return 'var(--muted)';
  return 'var(--dim)';
}

export function hurstStruct(a: RegimeMatrixAsset): number | null {
  return a.hurst_struct ?? a.hurst_252 ?? null;
}

export function hurstShort(a: RegimeMatrixAsset): number | null {
  return a.hurst_short ?? null;
}

export const HURST_DIVERGENCE_THRESHOLD = 0.08;

/** Regime-shift signal: strong short/structural divergence means the
 * underlying regime is transitioning (non-stationarity inside window). */
export function hurstDivergenceState(
  a: RegimeMatrixAsset,
): { label: string; arrow: string | null; strong: boolean } {
  const s = hurstShort(a);
  const st = hurstStruct(a);
  if (s == null || st == null || a.hurst_divergence == null) {
    return { label: '—', arrow: null, strong: false };
  }
  const d = s - st; // >0: recent regime more persistent than background
  if (Math.abs(d) < HURST_DIVERGENCE_THRESHOLD) {
    return { label: 'alignés', arrow: '→', strong: false };
  }
  return { label: 'divergence', arrow: d > 0 ? '↗' : '↘', strong: true };
}

export function assetsBySource(
  payload: RegimeMatrixPayload | null,
  source: 'yahoo' | 'hyperliquid',
): RegimeMatrixAsset[] {
  if (!payload) return [];
  return payload.assets
    .filter((a) => a.source === source)
    .sort((a, b) => (b.trend_score ?? -1) - (a.trend_score ?? -1));
}
