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
