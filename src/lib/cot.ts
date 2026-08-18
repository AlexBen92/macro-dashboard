export interface CotAsset {
  market: string;
  code: string;
  net_pct: number;
  z: number | null;
  percentile: number | null;
  n_obs: number;
  as_of: string;
}

export interface CotPayload {
  as_of: string | null;
  last_export_success: string | null;
  window_weeks: number;
  min_obs: number;
  source: string;
  note: string;
  assets: Record<string, CotAsset>;
  errors: Array<{ id: string; error: string }>;
}

/** as_of = mardi du rapport CFTC, publication vendredi — âge pire-cas 11j. */
export const COT_STALE_THRESHOLD_MS = 12 * 24 * 60 * 60 * 1000;

export function isCotStale(payload: CotPayload | null, nowMs = Date.now()): boolean {
  if (!payload?.as_of) return true;
  const t = Date.parse(payload.as_of);
  if (Number.isNaN(t)) return true;
  return nowMs - t > COT_STALE_THRESHOLD_MS;
}

/** Contrarian crowding context — extremes = caution, jamais directionnel. */
export function cotColor(z: number | null): string {
  if (z == null) return 'var(--dim)';
  if (Math.abs(z) >= 2) return 'var(--caution)';
  return 'var(--muted)';
}

export function cotTooltip(a: CotAsset): string {
  return [
    a.market,
    `net non-comm ${a.net_pct > 0 ? '+' : ''}${a.net_pct}% de l'OI`,
    a.percentile != null ? `percentile 3y p${a.percentile}` : '',
    `z-score 3y (${a.n_obs} rapports hebdo)`,
    `rapport CFTC du ${a.as_of} — publication le vendredi suivant (lag ~J-7)`,
    'filtre contrarian de contexte · UNTESTED (jamais passé par le protocole WF/DSR/PBO)',
  ]
    .filter(Boolean)
    .join(' · ');
}
