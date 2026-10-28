/**
 * Helpers ORB Nasdaq — types + fraîcheur + mise en forme.
 * Mission §6 : aucune valeur affichée sans source ni horodatage (loi L10),
 * badge "Outil de lecture — edge non validé" tant que le backtest strict
 * (2010+, hors-échantillon) n'a pas tourné sur de vraies données NQ.
 */

export const BADGE_UNVALIDATED =
  'Outil de lecture — hypothèse ORB §2 rejetée en dev+WF (2026-10-28, NO-GO)';

export interface NasdaqRange {
  hi: number;
  lo: number;
  mid: number;
  pts: number;
  classe: string;
  pct_em: number | null;
}

export interface NasdaqTheo {
  dir: string;
  entry: number;
  stop: number;
  pnl_pts: number;
  pnl_R: number | null;
  mfe_pts: number | null;
  mae_pts: number | null;
  regle_stop: string;
}

export interface NasdaqStatus {
  as_of: string;
  as_of_et: string;
  phase: string;
  badge: string;
  edge_valide: boolean;
  range: NasdaqRange | null;
  break: { state: string; time_et: string | null; px: number | null } | null;
  theo: NasdaqTheo | null;
  em_pts: number | null;
  vxn: number | null;
}

export interface NasdaqContext {
  score: number;
  vol_mult: number;
  composantes: Record<string, { w: number; v: number | null; note?: string }>;
  corr?: {
    correlations: Record<string, { c20: number; c60: number }>;
    changement_signe: string[];
  };
  vxn: { level: number; date: string; pct_1y: number };
  em_pts: number | null;
  as_of: string;
  badge: string;
}

export interface NasdaqStats {
  aggregats?: {
    n_days: number;
    break_pct: number;
    double_break_pct: number;
    par_classe: Record<string, Record<string, unknown>>;
  };
  badge?: string;
  genere?: string;
}

export interface NasdaqNightDay {
  as_of: string;
  def: string;
  cumuls: {
    last_day: string;
    windows: Record<string, { n: number; nuit_pct: number; jour_pct: number; bh_pct: number }>;
  };
}

export interface NasdaqEvent {
  date: string;
  type: string;
  label: string;
  heure_ny: string;
  heure_paris: string;
  source: string;
}

export interface NasdaqEvents {
  as_of: string;
  note: string;
  events: NasdaqEvent[];
}

export interface NasdaqStrategy {
  id: string;
  famille?: string;
  statut: string;
  essais: number;
  verdict: string | null;
  maj?: string;
  note?: string;
}

export interface NasdaqStrategies {
  as_of: string;
  note: string;
  strategies: NasdaqStrategy[];
}

/** État cassure affichable : aucune / haute / basse / double. */
export function breakLabel(b: NasdaqStatus['break']): string {
  if (!b) return '—';
  if (b.state === 'aucune') return 'Aucune';
  if (b.state === 'haute') return `Cassure haute${b.time_et ? ` · ${b.time_et} ET` : ''}`;
  if (b.state === 'basse') return `Cassure basse${b.time_et ? ` · ${b.time_et} ET` : ''}`;
  return b.state;
}

/** Fraîcheur : seuil en minutes selon le type d'export. */
export function staleThresholdMin(
  kind: 'status' | 'context' | 'stats' | 'panels'
): number {
  if (kind === 'status') return 15; // tick toutes les 2 min pendant RTH
  return 26 * 60; // premarket / stats / panneaux = quotidiens
}

export function isStale(
  asOf: string | undefined,
  kind: 'status' | 'context' | 'stats' | 'panels'
): boolean {
  if (!asOf) return true;
  const ms = Date.parse(asOf.endsWith('Z') ? asOf : `${asOf}Z`);
  if (Number.isNaN(ms)) return true;
  return Date.now() - ms > staleThresholdMin(kind) * 60_000;
}

/** Badge échantillon faible (mission §6.3 : < 30 jours). */
export function sampleBadge(n: number | undefined): string | null {
  if (n === undefined || n < 30) return `échantillon faible (${n ?? 0} j < 30)`;
  return null;
}

/** Événements à venir (date >= aujourd'hui), triés, `limit` premiers. */
export function upcomingEvents(events: NasdaqEvent[] | undefined, limit = 8): NasdaqEvent[] {
  if (!events) return [];
  const today = new Date().toISOString().slice(0, 10);
  return events.filter((e) => e.date >= today).slice(0, limit);
}

/** Couleur de statut stratégie : NO-GO rouge, non testée neutre, autre ambre. */
export function strategyTone(statut: string): 'no-go' | 'untested' | 'other' {
  const s = statut.toLowerCase();
  if (s.includes('no-go') || s.includes('rejet')) return 'no-go';
  if (s.includes('non testée')) return 'untested';
  return 'other';
}
