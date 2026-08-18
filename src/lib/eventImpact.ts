export interface EventStats {
  n_events: number;
  mean_abs_move_pct: number;
  baseline_mean_pct: number;
  ratio_vs_baseline: number | null;
  hit_rate_vs_median: number | null;
}

export interface UpcomingEvent {
  date: string;
  type: string;
  label: string;
  ratio_vs_baseline: number | null;
  hit_rate_vs_median: number | null;
  mean_abs_move_pct: number | null;
  n_events: number | null;
}

export interface EventImpactPayload {
  as_of: string | null;
  last_export_success: string | null;
  price_source: string;
  upcoming_days: number;
  stats: Record<string, EventStats>;
  upcoming: UpcomingEvent[];
  sources: Record<string, string>;
  note: string;
  errors: Array<{ id: string; error: string }>;
}

export const EVENT_IMPACT_STALE_MS = 26 * 60 * 60 * 1000;

export function isEventImpactStale(payload: EventImpactPayload | null, nowMs = Date.now()): boolean {
  if (!payload?.as_of) return true;
  const t = Date.parse(payload.as_of);
  if (Number.isNaN(t)) return true;
  return nowMs - t > EVENT_IMPACT_STALE_MS;
}

/** Intensité descriptive — jamais directionnel. */
export function ratioColor(ratio: number | null): string {
  if (ratio == null) return 'var(--dim)';
  if (ratio >= 1.3) return 'var(--caution)';
  if (ratio >= 1.1) return 'var(--muted)';
  return 'var(--dim)';
}

export function eventTooltip(e: UpcomingEvent): string {
  return [
    `${e.label} — ${e.date}`,
    e.mean_abs_move_pct != null ? `réaction moyenne ES=F le jour J : ±${e.mean_abs_move_pct}%` : '',
    e.ratio_vs_baseline != null ? `soit ×${e.ratio_vs_baseline} vs jour normal` : '',
    e.hit_rate_vs_median != null ? `${e.hit_rate_vs_median}% des publications ont bougé plus que la journée médiane` : '',
    e.n_events != null ? `historique : ${e.n_events} occurrences` : '',
    'statistique descriptive, UNTESTED — pas un signal',
  ]
    .filter(Boolean)
    .join(' · ');
}

const DAYS_FR = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

export function dayLabel(iso: string): string {
  const t = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(t.getTime())) return iso;
  return `${DAYS_FR[t.getUTCDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
