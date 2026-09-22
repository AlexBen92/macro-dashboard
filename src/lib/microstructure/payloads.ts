/**
 * Types + helpers payload microstructure HL (source: /root/projects/hl-toxicity-collector,
 * service systemd → /dash-data/microstructure_status.json).
 * Un seul endroit pour route, hook, composants et tests.
 */

export type MicroHealthStatus = 'CONNECTED' | 'STALE' | 'DISCONNECTED';

export interface WebSocketHealth {
  connected: boolean;
  last_message_at: string | null;
  subscriptions: string[];
  messages_received: { l2: number; trades: number; invalid: number };
  reconnect_count: number;
  stale: boolean;
  error: string | null;
}

export interface ToxicityComponents {
  trade_imbalance: number;
  intensity_norm: number;
  concentration: number;
  impact_norm: number;
  spread_norm: number;
  slippage_norm: number;
  obi: number;
  depth_stress: number;
}

export interface SymbolMetrics {
  available: boolean;
  mid: number | null;
  spread_bps: number | null;
  depth_imbalance: number;
  slippage_bps: number | null;
  kappa: number;
  epsilon: number;
  toxicity: number;
  display_score: number;
  regime: string;
  components: ToxicityComponents;
  series: [number, number][];
  book_last_update: number | null;
  /** v2 payload — absent sur payload ancien → UI garde optionnels */
  execution_risk_score?: number;
  execution_risk_tier?: string;
  series_spread?: [number, number][];
  series_slip?: [number, number][];
}

export interface MicrostructurePayload {
  generated_at: string;
  status: MicroHealthStatus;
  threshold: number;
  threshold_note: string;
  config: {
    short_window_s: number;
    long_window_s: number;
    depth_levels: number;
    impact_horizon_ms: number;
    slippage_notional_usd: number;
  };
  health: WebSocketHealth;
  symbols: Record<string, SymbolMetrics>;
  disclaimer: string;
}

/** Âge (ms) du dernier export; null si timestamp absent/illisible. */
export function payloadAgeMs(p: MicrostructurePayload | null, now = Date.now()): number | null {
  if (!p?.generated_at) return null;
  const t = Date.parse(p.generated_at);
  if (Number.isNaN(t)) return null;
  return now - t;
}

/** Payload trop vieux (exporteur mort) → l'UI doit afficher UNAVAILABLE. */
export function isPayloadStale(p: MicrostructurePayload | null, thresholdMs: number, now = Date.now()): boolean {
  const age = payloadAgeMs(p, now);
  return age === null || age > thresholdMs;
}

export type MicroDisplayState = 'LIVE' | 'UNAVAILABLE';

/**
 * État d'affichage: scores seulement si flux réellement connecté, payload frais
 * et symbole disponible (warmup/données insuffisantes → UNAVAILABLE).
 */
export function displayState(p: MicrostructurePayload | null, staleThresholdMs: number, coin?: string): MicroDisplayState {
  if (!p) return 'UNAVAILABLE';
  if (isPayloadStale(p, staleThresholdMs)) return 'UNAVAILABLE';
  if (p.status !== 'CONNECTED') return 'UNAVAILABLE';
  if (coin) {
    const s = p.symbols[coin];
    if (!s || !s.available) return 'UNAVAILABLE';
  }
  return 'LIVE';
}

/** Score d'affichage borné 0–100 (défense en profondeur côté client). */
export function clampDisplayScore(raw: number | null | undefined): number {
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(100, raw));
}

export const REGIME_ORDER = ['FAIBLE', 'MODÉRÉ', 'ÉLEVÉ', 'EXTRÊME'] as const;

export function regimeColor(regime: string): string {
  switch (regime) {
    case 'FAIBLE':
      return 'var(--bull)';
    case 'MODÉRÉ':
      return 'var(--warn, #d4a017)';
    case 'ÉLEVÉ':
      return '#e07000';
    case 'EXTRÊME':
      return 'var(--bear)';
    default:
      return 'var(--muted)';
  }
}

/** Tiers execution risk (collector exec_risk.py) — seuils configurés, non universels. */
export const EXEC_TIER_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] as const;
export type ExecTier = (typeof EXEC_TIER_ORDER)[number];

export function tierColor(tier: string): string {
  switch (tier) {
    case 'LOW':
      return 'var(--bull)';
    case 'MEDIUM':
      return 'var(--caution)';
    case 'HIGH':
      return '#e07000';
    case 'EXTREME':
      return 'var(--bear)';
    default:
      return 'var(--muted)';
  }
}

/** Multiplicateur sizing m15-agent (contrat partagé collector↔agent). */
export const EXEC_TIER_MULTIPLIER: Record<ExecTier, number> = {
  LOW: 1.0,
  MEDIUM: 0.7,
  HIGH: 0.4,
  EXTREME: 0.25,
};

export type MicroTrend = 'STABLE' | 'DÉGRADATION' | 'STRESS' | 'AMÉLIORATION';

function median(vals: number[]): number {
  const s = [...vals].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Tendance récente κ×ε : médiane 2e moitié vs 1re moitié de la fenêtre.
 * ≥+40% ou tier EXTREME → STRESS ; ≥+10% DÉGRADATION ; ≤−10% AMÉLIORATION ; sinon STABLE.
 * Aucune valeur directionnelle — état d'exécution uniquement.
 */
export function microTrend(series: [number, number][] | undefined, tier?: string): MicroTrend {
  if (tier === 'EXTREME') return 'STRESS';
  if (!series || series.length < 6) return 'STABLE';
  const vals = series.map(([, v]) => v);
  const mid = Math.floor(vals.length / 2);
  const m1 = median(vals.slice(0, mid));
  const m2 = median(vals.slice(mid));
  if (m1 <= 0) return 'STABLE';
  const delta = (m2 - m1) / m1;
  if (delta >= 0.4) return 'STRESS';
  if (delta >= 0.1) return 'DÉGRADATION';
  if (delta <= -0.1) return 'AMÉLIORATION';
  return 'STABLE';
}

export function trendGlyph(t: MicroTrend): string {
  switch (t) {
    case 'AMÉLIORATION':
      return '↗ AMÉLIORATION';
    case 'DÉGRADATION':
      return '↘ DÉGRADATION';
    case 'STRESS':
      return '↘↘ STRESS';
    default:
      return '→ STABLE';
  }
}
