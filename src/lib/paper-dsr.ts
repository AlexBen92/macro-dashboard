export interface PaperDsrStrat {
  strategy: string;
  open_trades: number;
  total_trades: number;
  closed_trades: number;
  status: string;
  reason?: string;
  sr_daily_all?: number | null;
  sr_ann_all?: number | null;
  psr_vs0?: number | null;
  psr_vs_lot?: number | null;
  days?: number | null;
  window?: number | null;
  rolling_sr_daily?: number | null;
  dsr_vs_lot?: number | null;
  pnl_abs?: number | null;
  win_pct?: number | null;
  first_close?: string | null;
  last_close?: string | null;
}

export interface PaperDsrPayload {
  generated_utc: string;
  sr_star_lot39_daily: number;
  window_days: number;
  strats: Record<string, PaperDsrStrat>;
}

export type PaperDsrTone = 'ok' | 'warn' | 'bad' | 'muted';

export interface PaperDsrStratView {
  name: string;
  status: string;
  reason: string | null;
  closedTrades: number;
  openTrades: number;
  pnlAbs: number | null;
  winPct: number | null;
  srAnn: number | null;
  rollingSrAnn: number | null;
  psrVsLot: number | null;
  dsr: number | null;
  dsrTone: PaperDsrTone;
  firstClose: string | null;
  lastClose: string | null;
}

export interface PaperDsrView {
  generatedAt: string;
  ageMs: number;
  isStale: boolean;
  srStar: number;
  srStarAnn: number;
  windowDays: number;
  rows: PaperDsrStratView[];
}

export const PAPER_DSR_STALE_MS = 26 * 60 * 60 * 1000;

export function computePaperDsrAgeMs(payload: PaperDsrPayload, nowMs: number): number {
  const t = Date.parse(payload.generated_utc);
  if (!Number.isFinite(t)) return Number.POSITIVE_INFINITY;
  return Math.max(0, nowMs - t);
}

export function dsrTone(dsr: number | null): PaperDsrTone {
  if (dsr === null || !Number.isFinite(dsr)) return 'muted';
  if (dsr >= 0.7) return 'ok';
  if (dsr >= 0.5) return 'warn';
  return 'bad';
}

export function buildPaperDsrView(
  payload: PaperDsrPayload,
  nowMs: number,
  staleThresholdMs: number = PAPER_DSR_STALE_MS,
): PaperDsrView {
  const ageMs = computePaperDsrAgeMs(payload, nowMs);
  const rows: PaperDsrStratView[] = Object.values(payload.strats ?? {}).map((s) => ({
    name: s.strategy,
    status: s.status,
    reason: s.reason ?? null,
    closedTrades: s.closed_trades ?? 0,
    openTrades: s.open_trades ?? 0,
    pnlAbs: s.pnl_abs ?? null,
    winPct: s.win_pct ?? null,
    srAnn: s.sr_ann_all ?? null,
    rollingSrAnn: s.rolling_sr_daily !== null && s.rolling_sr_daily !== undefined
      ? s.rolling_sr_daily * Math.sqrt(365)
      : null,
    psrVsLot: s.psr_vs_lot ?? null,
    dsr: s.dsr_vs_lot ?? null,
    dsrTone: s.status === 'OK' ? dsrTone(s.dsr_vs_lot ?? null) : 'muted',
    firstClose: s.first_close ?? null,
    lastClose: s.last_close ?? null,
  }));
  return {
    generatedAt: payload.generated_utc,
    ageMs,
    isStale: ageMs > staleThresholdMs,
    srStar: payload.sr_star_lot39_daily,
    srStarAnn: payload.sr_star_lot39_daily * Math.sqrt(365),
    windowDays: payload.window_days,
    rows,
  };
}

export const PAPER_DSR_TONE_COLOR: Record<PaperDsrTone, string> = {
  ok: 'var(--green, #22c55e)',
  warn: 'var(--yellow, #eab308)',
  bad: 'var(--red, #ef4444)',
  muted: 'var(--muted, #888)',
};
