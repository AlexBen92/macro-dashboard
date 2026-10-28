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

export interface NasdaqFeed {
  source: string;
  delay_s: number | null;
  bar_ts: string | null;
}

export interface NasdaqSessionNow {
  phase: string;
  ny_time: string;
  paris_time: string;
  mismatch_week: boolean;
  half_day: boolean;
}

export interface NasdaqTrendH1 {
  v: number; // 1 haussière, -1 baissière, 0 neutre
  as_of: string;
  ma20?: number;
  ma50?: number;
  dist_pct?: number;
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
  feed?: NasdaqFeed;
  session?: NasdaqSessionNow;
  trend_h1?: NasdaqTrendH1;
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

export interface NasdaqBucket {
  n: number;
  n_trades: number;
  continuation_pct: number | null;
  mfe_median_pts: number | null;
  mae_median_pts: number | null;
  exp_net_R?: number;
}

export interface NasdaqStats {
  aggregats?: {
    n_days: number;
    periode?: [string, string];
    break_pct: number;
    double_break_pct: number;
    par_classe: Record<string, Record<string, unknown>>;
    par_annee?: Record<string, NasdaqBucket>;
    par_weekday?: Record<string, NasdaqBucket>;
    par_vxn_tercile?: Record<string, NasdaqBucket>;
    semblables?: Record<string, NasdaqBucket>;
    semblables_st?: Record<string, NasdaqBucket>;
    vxn_tercile_cuts?: { p33: number; p66: number };
    random_ref_R?: number;
  };
  badge?: string;
  genere?: string;
}

export interface NasdaqNextSession {
  date: string;
  open_utc: string;
  close_utc: string;
  half_day: boolean;
}

export interface NasdaqSessionCal {
  as_of: string;
  note: string;
  next_sessions: NasdaqNextSession[];
}

// --- Graphique (spec V3 §5) ---------------------------------------------------

export interface NasdaqBars {
  as_of: string;
  bars?: Record<string, number[]>;
  today_vwap?: number[];
  prev_day?: { date: string; h: number; l: number; c: number } | null;
  premarket?: { h: number; l: number; n_bars: number } | null;
}

export type Tf = 'M1' | 'M5' | 'M15';

export interface Candle {
  time: number; // epoch s décalée pour affichage heure ET
  open: number;
  high: number;
  low: number;
  close: number;
}

/** Décalage epoch → epoch « heure ET affichée comme UTC » (DST-safe, tz-agnostic). */
export function etShiftSec(tsSec: number): number {
  const d = new Date(tsSec * 1000);
  const s = d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    timeZoneName: 'longOffset',
  });
  const m = s.match(/GMT([+-]\d{2}):(\d{2})/);
  if (!m) return tsSec;
  const offMin = Number(m[1]) * 60 + (m[1].startsWith('-') ? -Number(m[2]) : Number(m[2]));
  return tsSec + offMin * 60;
}

const TF_MIN: Record<Tf, number> = { M1: 1, M5: 5, M15: 15 };

/** M1 colonnaire → bougies agrégées (tf), jour ou veille. */
export function aggBars(b: NasdaqBars | undefined, tf: Tf, day: 'today' | 'prev'): Candle[] {
  const t = b?.bars?.[`${day}_ts`];
  const o = b?.bars?.[`${day}_o`];
  const h = b?.bars?.[`${day}_h`];
  const l = b?.bars?.[`${day}_l`];
  const c = b?.bars?.[`${day}_c`];
  if (!t || !o || !h || !l || !c) return [];
  const n = TF_MIN[tf];
  const out: Candle[] = [];
  for (let i = 0; i < t.length; i += n) {
    const end = Math.min(i + n, t.length);
    out.push({
      time: etShiftSec(t[end - 1]) as Candle['time'],
      open: o[i],
      high: Math.max(...h.slice(i, end)),
      low: Math.min(...l.slice(i, end)),
      close: c[end - 1],
    });
  }
  return out;
}

/** Série VWAP (jour) alignée sur les M1. */
export function vwapSeries(b: NasdaqBars | undefined): { time: number; value: number }[] {
  const t = b?.bars?.today_ts;
  const v = b?.today_vwap;
  if (!t || !v || t.length !== v.length) return [];
  return t.map((ts, i) => ({ time: etShiftSec(ts), value: v[i] }));
}

export interface PriceLine {
  price: number;
  color: string;
  title: string;
  style: 'solid' | 'dashed' | 'dotted';
  width?: 1 | 2;
}

/**
 * Niveaux §5 : range, cassures (hi/lo du range), VWAP hors-ligne non (série),
 * ouverture, veille (C/H/L), pré-marché (H/L), bandes EM ±0,5/±1, entrée/stop
 * théoriques. zéro « signal » : que des faits (spec §12).
 */
export function chartLevels(opts: {
  bars: NasdaqBars | undefined;
  status: NasdaqStatus | undefined;
  emPts: number | undefined;
}): PriceLine[] {
  const { bars, status, emPts } = opts;
  const out: PriceLine[] = [];
  const todayOpen = bars?.bars?.today_o?.[0];
  if (todayOpen && emPts && emPts > 0) {
    for (const k of [0.5, 1]) {
      for (const s of [1, -1]) {
        out.push({
          price: todayOpen + s * k * emPts,
          color: 'rgba(120,120,140,0.35)',
          title: `EM ${s > 0 ? '+' : '−'}${k}`,
          style: 'dotted',
        });
      }
    }
  }
  if (todayOpen) out.push({ price: todayOpen, color: 'rgba(59,130,246,0.7)', title: 'Open', style: 'solid' });
  const r = status?.range;
  if (r) {
    out.push({ price: r.hi, color: 'rgba(245,158,11,0.8)', title: 'Range H', style: 'dashed' });
    out.push({ price: r.lo, color: 'rgba(245,158,11,0.8)', title: 'Range L', style: 'dashed' });
    out.push({ price: r.mid, color: 'rgba(140,140,140,0.5)', title: 'Mid', style: 'dotted' });
  }
  const pd = bars?.prev_day;
  if (pd) {
    out.push({ price: pd.c, color: 'rgba(140,140,140,0.6)', title: 'Clôture V', style: 'solid' });
    out.push({ price: pd.h, color: 'rgba(140,140,140,0.4)', title: 'H V', style: 'dashed' });
    out.push({ price: pd.l, color: 'rgba(140,140,140,0.4)', title: 'B V', style: 'dashed' });
  }
  const pm = bars?.premarket;
  if (pm) {
    out.push({ price: pm.h, color: 'rgba(140,140,140,0.4)', title: 'PM H', style: 'dotted' });
    out.push({ price: pm.l, color: 'rgba(140,140,140,0.4)', title: 'PM B', style: 'dotted' });
  }
  const theo = status?.theo;
  if (theo) {
    out.push({ price: theo.entry, color: 'rgba(59,130,246,0.9)', title: `Entrée ${theo.dir}`, style: 'solid', width: 2 });
    out.push({ price: theo.stop, color: 'rgba(239,68,68,0.9)', title: 'Stop', style: 'solid', width: 2 });
  }
  return out;
}

/** Marqueur cassure (clôture M5 hors range) à l'heure ET donnée. */
export function breakMarker(
  brk: NasdaqStatus['break'],
  todayIso: string
): { time: number; position: 'belowBar' | 'aboveBar'; color: string; shape: 'arrowUp' | 'arrowDown'; text: string } | null {
  if (!brk || brk.state === 'aucune' || !brk.time_et) return null;
  const [hh, mm] = brk.time_et.split(':').map(Number);
  const ts = Math.round(
    Date.parse(`${todayIso}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00`) / 1000
  );
  if (Number.isNaN(ts)) return null;
  const up = brk.state === 'haute';
  return {
    time: etShiftSec(ts) as number,
    position: up ? 'belowBar' : 'aboveBar',
    color: up ? 'rgba(22,163,74,1)' : 'rgba(220,38,38,1)',
    shape: up ? 'arrowUp' : 'arrowDown',
    text: `Cassure ${up ? 'haute' : 'basse'}`,
  };
}

// --- Plan de trade (spec V3 §6) -----------------------------------------------

/**
 * Protocole pré-enregistré — REPRIS DU CODE backtest.py (règle d'or spec §6 :
 * rien n'est réinterprété ici). Constantes : backtest.py:22-29.
 */
export const PROTOCOL = {
  range: '09:30-09:45 ET (RISK_FREEZE 09:45)',
  cassure: "clôture M5 au-delà du haut/bas ; entrée à l'open M1 suivant (backtest.py:153-177)",
  frequence: '1 entrée/jour, 1re cassure conforme uniquement',
  filtre: 'H1 RTH MA20 > MA50 → longs ; < → shorts (barres H1 complétées avant 09:45)',
  stop: 'distance = max(|entrée − milieu du range|, 0,25 × EM) ; EM = open × VXN veille / √252',
  sortie: '15:55 ET (12:55 demi-séance) ou stop touché',
  filtre_range: 'pas de trade si range > 0,5 × EM',
  dernier_entry: '15:50 ET (12:50 demi-séance)',
  cout: '2 pts NQ aller-retour (sensibilité 4 pts) — le coût qui a basculé le backtest en négatif',
} as const;

export type CheckState = 'ok' | 'ko' | 'wait';

export interface CheckItem {
  id: string;
  label: string;
  state: CheckState;
  detail: string;
}

const etMinLocal = (d: Date): number => {
  const et = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: false,
    timeZone: 'America/New_York',
  }).format(d);
  return Number(et.slice(0, 2)) * 60 + Number(et.slice(3, 5));
};

/** Minutes locales ET (pour bornes de phase côté appelants). */
export function etMinutes(d: Date): number {
  return etMinLocal(d);
}

/**
 * Checklist §6.2. Item 6 (trade du jour) et 8 (limites jour) : non mesurables
 * sans journal d'exécution → « wait » explicite, jamais ok inventé.
 */
export function checklist(opts: {
  delayS: number | null | undefined;
  rangeFrozenMin: number; // minutes ET (≥ 585 = après 09:45)
  rangeOverEm: number | null | undefined;
  breakState: string | undefined;
  theoDir: string | undefined;
  trendV: number | undefined;
  macroInWindow: boolean;
}): CheckItem[] {
  const flux = opts.delayS === null || opts.delayS === undefined
    ? { state: 'wait' as CheckState, detail: 'retard flux inconnu' }
    : opts.delayS <= 30
      ? { state: 'ok' as CheckState, detail: `retard ${opts.delayS} s` }
      : { state: 'ko' as CheckState, detail: `retard ${opts.delayS} s > 30 s — ne pas trader sur ce prix` };
  const fige = opts.rangeFrozenMin >= 9 * 60 + 45
    ? { state: 'ok' as CheckState, detail: 'range figé depuis 09:45 ET' }
    : { state: 'wait' as CheckState, detail: `range en formation (${Math.floor(opts.rangeFrozenMin / 60)}:${String(opts.rangeFrozenMin % 60).padStart(2, '0')} ET)` };
  const taille = opts.rangeOverEm === null || opts.rangeOverEm === undefined
    ? { state: 'wait' as CheckState, detail: 'EM ou range indisponible' }
    : opts.rangeOverEm <= 0.5
      ? { state: 'ok' as CheckState, detail: `range = ${opts.rangeOverEm.toFixed(2)} × EM ≤ 0,5` }
      : { state: 'ko' as CheckState, detail: `range = ${opts.rangeOverEm.toFixed(2)} × EM > 0,5 → pas de trade (protocole)` };
  const cassure = !opts.breakState
    ? { state: 'wait' as CheckState, detail: 'état cassure indisponible' }
    : opts.breakState === 'aucune'
      ? { state: 'wait' as CheckState, detail: 'aucune clôture M5 hors range (le collector ne détecte que des clôtures — jamais une mèche)' }
      : { state: 'ok' as CheckState, detail: `cassure ${opts.breakState} sur clôture M5` };
  const dir = !opts.theoDir
    ? { state: 'wait' as CheckState, detail: 'pas de théorique — pas de cassure conforme au filtre' }
    : opts.trendV === undefined
      ? { state: 'wait' as CheckState, detail: 'tendance H1 indisponible' }
      : (opts.theoDir === 'haute' && opts.trendV === 1) || (opts.theoDir === 'basse' && opts.trendV === -1)
        ? { state: 'ok' as CheckState, detail: `théorique ${opts.theoDir} conforme au filtre H1` }
        : { state: 'ko' as CheckState, detail: `théorique ${opts.theoDir} CONTRAIRE au filtre H1 (ne pas prendre)` };
  return [
    { id: 'flux', label: 'Flux à jour (retard < 30 s)', ...flux },
    { id: 'range_fige', label: 'Range figé (après 09:45 ET)', ...fige },
    { id: 'taille', label: 'Range ≤ 0,5 × EM', ...taille },
    { id: 'cassure', label: 'Cassure sur clôture M5 (pas une mèche)', ...cassure },
    { id: 'direction', label: 'Direction conforme au filtre H1', ...dir },
    {
      id: 'unique',
      label: 'Aucun trade déjà pris aujourd’hui',
      state: 'wait',
      detail: 'non mesurable sans journal d’exécution (incr. journal) — tenir à la main',
    },
    {
      id: 'macro',
      label: 'Publication macro dans la fenêtre ?',
      ...(opts.macroInWindow
        ? { state: 'ko' as CheckState, detail: 'publication listée aujourd’hui — voir calendrier' }
        : { state: 'ok' as CheckState, detail: 'aucune publication listée dans la fenêtre' }),
    },
    {
      id: 'limites',
      label: 'Limites de risque du jour non atteintes',
      state: 'wait',
      detail: 'perte du jour non mesurable sans journal (incr. journal) — rappel FTMO ci-dessous',
    },
  ];
}

/** Événement du jour dans la fenêtre de décision (09:30-11:00 ET), pour la checklist. */
export function macroInWindow(events: NasdaqEvent[] | undefined, now: Date): { hit: boolean; label: string | null } {
  const todayIso = now.toISOString().slice(0, 10);
  const min = etMinLocal(now);
  const inWin = (events ?? []).filter((e) => {
    if (e.date !== todayIso || !/^\d{1,2}:\d{2}$/.test(e.heure_ny)) return false;
    const [h, m] = e.heure_ny.split(':').map(Number);
    return h * 60 + m >= 9 * 60 + 30 && h * 60 + m <= 11 * 60;
  });
  if (!inWin.length) return { hit: false, label: null };
  // prochaine passée/à venir la plus proche de now
  const next = inWin
    .map((e) => ({ e, m: Number(e.heure_ny.split(':')[0]) * 60 + Number(e.heure_ny.split(':')[1]) }))
    .sort((a, b) => Math.abs(a.m - min) - Math.abs(b.m - min))[0];
  return { hit: true, label: `${next.e.label} ${next.e.heure_ny} ET` };
}

const NY_TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/**
 * Prochaine publication du jour (toutes heures ET) + état de garde ±2 min
 * (restriction news compte financé, spec §6.4).
 */
export function newsGuard(
  events: NasdaqEvent[] | undefined,
  now: Date
): { label: string; timeEt: string; minUntil: number; locked: boolean } | null {
  const todayIso = now.toISOString().slice(0, 10);
  const min = etMinLocal(now);
  let best: { label: string; timeEt: string; minUntil: number } | null = null;
  for (const e of events ?? []) {
    if (e.date !== todayIso) continue;
    const m = e.heure_ny.match(NY_TIME_RE);
    if (!m) continue;
    const em = Number(m[1]) * 60 + Number(m[2]);
    const until = em - min;
    if (until < -2) continue; // passée (+2 min de garde)
    if (!best || until < best.minUntil) best = { label: e.label, timeEt: e.heure_ny, minUntil: until };
  }
  if (!best) return null;
  return { ...best, locked: best.minUntil <= 2 };
}

export interface InstrumentPreset {
  id: string;
  label: string;
  usdPerPoint: number;
}

export const INSTRUMENTS: InstrumentPreset[] = [
  { id: 'nq', label: 'NQ (20 $/pt)', usdPerPoint: 20 },
  { id: 'mnq', label: 'MNQ (2 $/pt)', usdPerPoint: 2 },
];

export interface PositionCalc {
  distPts: number;
  size: number; // contrats, arrondi vers le bas (protocole)
  lossUsd: number;
  rtCostR: number; // coût aller-retour 2 pts exprimé en R — LE chiffre qui a tué le backtest
  target1R: number;
  target2R: number;
}

/** Calculateur §6.3. Entrée/stop = théoriques par défaut, surchargeables. */
export function positionSize(opts: {
  capitalUsd: number;
  riskPct: number;
  usdPerPoint: number;
  entry: number;
  stop: number;
}): PositionCalc | null {
  const dist = Math.abs(opts.entry - opts.stop);
  if (!(dist > 0) || !(opts.capitalUsd > 0) || !(opts.usdPerPoint > 0)) return null;
  const riskUsd = (opts.capitalUsd * opts.riskPct) / 100;
  const size = Math.floor(riskUsd / (dist * opts.usdPerPoint));
  return {
    distPts: dist,
    size,
    lossUsd: size * dist * opts.usdPerPoint,
    rtCostR: 2 / dist,
    target1R: opts.entry + (opts.entry >= opts.stop ? dist : -dist),
    target2R: opts.entry + (opts.entry >= opts.stop ? 2 * dist : -2 * dist),
  };
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

// --- Barre de session (spec V3 §4) -------------------------------------------

export const PHASE_LABEL: Record<string, string> = {
  pre_open: 'Pré-ouverture',
  premarket: 'Pré-marché 09:25',
  range_forming: 'Range en formation 09:30-09:45',
  surveillance: 'Surveillance',
  session_end: 'Fin de séance 15:55',
  closed: 'Marché fermé',
};

/** Horloges NY / Paris + écart en heures (6 h normal, 5 h semaine de décalage). */
export function horloges(now: Date): { ny: string; paris: string; ecartH: number } {
  const fmt = (tz: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: tz,
    }).format(now);
  const off = (tz: string): number => {
    const s = now.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'longOffset' });
    const m = s.match(/GMT([+-]\d{2}):(\d{2})/);
    if (!m) return NaN;
    return Number(m[1]) + Number(m[2]) / 60;
  };
  const nyOff = off('America/New_York');
  const paOff = off('Europe/Paris');
  const ecart = Number.isNaN(nyOff) || Number.isNaN(paOff) ? 6 : Math.abs(nyOff - paOff);
  return { ny: fmt('America/New_York'), paris: fmt('Europe/Paris'), ecartH: ecart };
}

/**
 * Phase calculée côté client depuis le calendrier de séances (nasdaq_session.json) :
 * couvre les jours où les collecteurs n'écrivent pas (férié, week-end, nuit).
 */
export function sessionPhaseLocal(
  now: Date,
  cal: NasdaqSessionCal | undefined
): { phase: string; nextOpen: string | null } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const sessions = cal?.next_sessions ?? [];
  const today = sessions.find((s) => s.date === iso(now));
  const openT = today ? Date.parse(today.open_utc) : NaN;
  const closeT = today ? Date.parse(today.close_utc) : NaN;
  const t = now.getTime();
  const etMinutes = (d: Date): number => {
    const et = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false,
      timeZone: 'America/New_York',
    }).format(d);
    return Number(et.slice(0, 2)) * 60 + Number(et.slice(3, 5));
  };
  if (today && t < openT) {
    // matin : pré-ouverture, sauf 09:25-09:30 ET = pré-marché
    if (etMinutes(now) >= 9 * 60 + 25) return { phase: 'premarket', nextOpen: null };
    return { phase: 'pre_open', nextOpen: today.open_utc };
  }
  if (today && t >= openT && t < closeT) {
    const mins = etMinutes(now);
    const endExit = today.half_day ? 12 * 60 + 55 : 15 * 60 + 55;
    if (mins < 9 * 60 + 25) return { phase: 'pre_open', nextOpen: null };
    if (mins < 9 * 60 + 30) return { phase: 'premarket', nextOpen: null };
    if (mins < 9 * 60 + 45) return { phase: 'range_forming', nextOpen: null };
    if (mins < endExit) return { phase: 'surveillance', nextOpen: null };
    return { phase: 'session_end', nextOpen: null };
  }
  const next = sessions.find((s) => Date.parse(s.open_utc) > t) ?? null;
  return { phase: 'closed', nextOpen: next ? next.open_utc : null };
}

/** Prochaine borne de phase (min locales ET) pour le compte à rebours. */
export function nextBoundary(halfDay: boolean): Array<{ min: number; label: string }> {
  return halfDay
    ? [
        { min: 9 * 60 + 25, label: 'pré-marché' },
        { min: 9 * 60 + 30, label: 'ouverture' },
        { min: 9 * 60 + 45, label: 'range figé' },
        { min: 12 * 60 + 55, label: 'sortie' },
        { min: 13 * 60, label: 'clôture' },
      ]
    : [
        { min: 9 * 60 + 25, label: 'pré-marché' },
        { min: 9 * 60 + 30, label: 'ouverture' },
        { min: 9 * 60 + 45, label: 'range figé' },
        { min: 15 * 60 + 55, label: 'sortie' },
        { min: 16 * 60, label: 'clôture' },
      ];
}

/** Retard flux > 30 s pendant la fenêtre de décision (09:30-10:30 ET) → ambre. */
export function feedSlow(delayS: number | null | undefined, nyTime: string): boolean {
  if (delayS === null || delayS === undefined) return false;
  const [h, m] = nyTime.split(':').map(Number);
  const mins = h * 60 + m;
  return delayS > 30 && mins >= 9 * 60 + 30 && mins < 10 * 60 + 30;
}

/** Minutes écoulées depuis as_of (null si parsable non). */
export function staleSinceMin(asOf: string | undefined): number | null {
  if (!asOf) return null;
  const ms = Date.parse(asOf.endsWith('Z') ? asOf : `${asOf}Z`);
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round((Date.now() - ms) / 60_000));
}

// --- Jours semblables (spec V3 §9) --------------------------------------------

export function vxnTercile(v: number, cuts: { p33: number; p66: number }): string {
  if (v < cuts.p33) return 'T1';
  if (v < cuts.p66) return 'T2';
  return 'T3';
}

const WEEKDAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];

export function weekdayLabel(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

export const TREND_LABEL: Record<number, string> = {
  1: 'haussiere',
  [-1]: 'baissiere',
  0: 'neutre',
};

export interface SimilarKeys {
  tercile: string;
  classe: string;
  trend: string;
  weekday: string;
}

/**
 * Clés du jour pour le lookup « jours semblables ». Classe utilisée seulement
 * après 09:45 ET (range figé) — avant : bucket partiel sans classe.
 */
export function similarKeys(opts: {
  vxnLevel: number | undefined;
  cuts: { p33: number; p66: number } | undefined;
  classe: string | undefined;
  trend: number | undefined;
  now: Date;
}): { full: SimilarKeys; partial: Omit<SimilarKeys, 'classe'> } | null {
  if (!opts.vxnLevel || !opts.cuts || opts.trend === undefined) return null;
  const base = {
    tercile: vxnTercile(opts.vxnLevel, opts.cuts),
    trend: TREND_LABEL[opts.trend] ?? 'neutre',
    weekday: weekdayLabel(opts.now),
  };
  return {
    full: { ...base, classe: opts.classe ?? 'normal' },
    partial: base,
  };
}

export function lookupBucket(
  ag: NasdaqStats['aggregats'],
  keys: { full: SimilarKeys; partial: Omit<SimilarKeys, 'classe'> } | null
): { bucket: NasdaqBucket; key: string; granularite: 'complete' | 'sans_classe' } | null {
  if (!ag || !keys) return null;
  const kf = `${keys.full.tercile}|${keys.full.classe}|${keys.full.trend}|${keys.full.weekday}`;
  if (ag.semblables?.[kf]) return { bucket: ag.semblables[kf], key: kf, granularite: 'complete' };
  const kp = `${keys.partial.tercile}|${keys.partial.trend}|${keys.partial.weekday}`;
  if (ag.semblables_st?.[kp])
    return { bucket: ag.semblables_st[kp], key: kp, granularite: 'sans_classe' };
  return null;
}
