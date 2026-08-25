/**
 * Logique d'affichage cockpit — pure, testable (feux, badges, barres
 * d'attribution, filtres journal).
 */
import type {
  AttributionBreakdown,
  Compliance,
  GateLight,
  GateStrategyState,
  JournalEvent,
} from './payloads';

export const LIGHT_ORDER: Record<GateLight, number> = {
  GREEN: 0,
  ORANGE: 1,
  RED: 2,
};

export function worstLight(a: GateLight, b: GateLight): GateLight {
  return LIGHT_ORDER[a] >= LIGHT_ORDER[b] ? a : b;
}

export function lightColor(light: GateLight | null | undefined): string {
  switch (light) {
    case 'GREEN':
      return 'var(--bull)';
    case 'ORANGE':
      return 'var(--caution)';
    case 'RED':
      return 'var(--bear)';
    default:
      return 'var(--dim)';
  }
}

export function lightLabel(light: GateLight | null | undefined): string {
  switch (light) {
    case 'GREEN':
      return 'M15 AUTORISÉ';
    case 'ORANGE':
      return 'SHADOW SEULEMENT';
    case 'RED':
      return 'BLOCAGE TOTAL';
    default:
      return 'INDISPONIBLE';
  }
}

export function gateStateBadge(state: GateStrategyState): {
  text: string;
  color: string;
} {
  switch (state) {
    case 'ALLOWED':
      return { text: 'OK', color: 'var(--bull)' };
    case 'SHADOW_ONLY':
      return { text: 'EN_TEST', color: 'var(--caution)' };
    case 'EN_TEST':
      return { text: 'EN_TEST', color: 'var(--caution)' };
    case 'BLOCKED':
      return { text: 'REJETÉ', color: 'var(--bear)' };
    default:
      return { text: '—', color: 'var(--dim)' };
  }
}

export function complianceColor(c: Compliance): string {
  switch (c) {
    case 'OK':
      return 'var(--bull)';
    case 'EN_TEST':
      return 'var(--caution)';
    case 'REJETÉ':
      return 'var(--bear)';
    default:
      return 'var(--dim)';
  }
}

export interface AttributionBar {
  label: string;
  value: number;
  color: string;
  widthPct: number;
}

/** Barres delta/funding/basis/fees normalisées — |v| / Σ|v|, signes gardés. */
export function attributionBars(a: AttributionBreakdown): AttributionBar[] {
  const parts: Array<[string, number, string]> = [
    ['delta', a.delta_pct, 'var(--label)'],
    ['funding', a.funding_pct, 'var(--bull)'],
    ['basis', a.basis_pct, '#7aa2f7'],
    ['fees', -a.fees_pct, 'var(--bear)'],
  ];
  if (a.residual_pct !== undefined && Math.abs(a.residual_pct) > 1e-9) {
    parts.push(['résidu', a.residual_pct, 'var(--caution)']);
  }
  const total = parts.reduce((s, [, v]) => s + Math.abs(v), 0) || 1;
  return parts.map(([label, value, color]) => ({
    label,
    value,
    color,
    widthPct: (Math.abs(value) / total) * 100,
  })) as AttributionBar[];
}

/** Trade dominé par le delta (structure non exploitée). */
export function isDeltaDominated(a: AttributionBreakdown): boolean {
  const total = Math.abs(a.total_pct);
  if (total <= 0) return false;
  return Math.abs(a.delta_pct) / total > 0.8;
}

export function journalKindColor(kind: string): string {
  if (kind.includes('REJECT')) return 'var(--bear)';
  if (kind.startsWith('ALERT')) return 'var(--caution)';
  if (kind.startsWith('CARRY')) return 'var(--bull)';
  if (kind.startsWith('M15')) return '#7aa2f7';
  return 'var(--label)';
}

export function journalKindLabel(kind: string): string {
  const map: Record<string, string> = {
    DECISION: 'Décision agent',
    M15_DECISION: 'Décision M15',
    M15_SIGNAL: 'Signal M15 paper',
    M15_REJECT: 'Rejet M15',
    M15_TRADE_OPEN: 'Trade M15 ouvert',
    M15_TRADE_CLOSE: 'Trade M15 fermé',
    CONTRACT_REJECT: 'Rejet contrat',
    CARRY_ENTER: 'Entrée carry D1',
    ALERT_REGIME_SWITCH: 'Switch régime',
    ALERT_BASIS_DRIFT: 'Dérive basis',
  };
  return map[kind] ?? kind;
}

export function formatBps(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${x >= 0 ? '+' : ''}${x.toFixed(digits)}bps`;
}

export function formatPct(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return '—';
  return `${(x * 100).toFixed(digits)}%`;
}

/** Filtre timeline par source (tous / hl-agent / m15-agent / carry / alertes). */
export function filterJournal(events: JournalEvent[], source: string): JournalEvent[] {
  if (source === 'all') return events;
  if (source === 'alerts') return events.filter((e) => e.kind.startsWith('ALERT') || e.kind.includes('REJECT'));
  return events.filter((e) => e.source === source);
}
