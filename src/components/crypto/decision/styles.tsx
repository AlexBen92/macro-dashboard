import type { Verdict, EntryState, SetupKind, RiskState } from '@/lib/decision/types';

export function verdictColor(v: Verdict | null | undefined): {
  text: string; bg: string; border: string;
} {
  if (v === 'LONG') {
    return { text: 'var(--bull)', bg: 'rgba(74,222,128,0.10)', border: 'var(--bull)' };
  }
  if (v === 'SHORT') {
    return { text: 'var(--bear)', bg: 'rgba(248,113,113,0.10)', border: 'var(--bear)' };
  }
  if (v === 'WAIT') {
    return { text: 'var(--caution)', bg: 'rgba(255,170,0,0.07)', border: 'var(--caution)' };
  }
  return { text: 'var(--muted)', bg: 'rgba(140,140,160,0.05)', border: 'var(--muted)' };
}

export function entryStateColor(s: EntryState | null | undefined): string {
  switch (s) {
    case 'ARMED': return 'var(--caution)';
    case 'TRIGGERED': return 'var(--bull)';
    case 'ACTIVE': return 'var(--bull)';
    case 'INVALIDATED': return 'var(--bear)';
    case 'EXPIRED': return 'var(--muted)';
    default: return 'var(--dim)';
  }
}

export function setupKindLabel(k: SetupKind): string {
  return k.replace(/_/g, ' ');
}

export function riskStateColor(s: RiskState): string {
  if (s === 'RISK_ON') return 'var(--bull)';
  if (s === 'RISK_OFF') return 'var(--bear)';
  return 'var(--caution)';
}

export function MetricRow({ label, value, hint }: {
  label: string;
  value: string | number | null | undefined;
  hint?: string;
}) {
  const display = value == null || value === ''
    ? '—'
    : typeof value === 'number'
      ? Number.isInteger(value) ? String(value) : value.toFixed(2)
      : value;
  return (
    <div className="flex items-center justify-between font-mono text-[0.6rem] py-0.5">
      <span className="text-[var(--muted)] uppercase tracking-[1px]">
        {label}
        {hint ? <span className="text-[var(--dim)] ml-1 normal-case">{hint}</span> : null}
      </span>
      <span className="tabular-nums text-[var(--text)] text-right">{display}</span>
    </div>
  );
}

export function Pill({ text, color, bg, border }: {
  text: string; color: string; bg: string; border?: string;
}) {
  return (
    <span
      className="font-mono text-[0.55rem] uppercase tracking-[1.5px] px-1.5 py-0.5 rounded-[2px]"
      style={{ color, background: bg, border: border ? `1px solid ${border}` : 'none' }}
    >
      {text}
    </span>
  );
}
