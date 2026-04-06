'use client';

export type ConfidenceLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'UNPROVEN';

const CONF_STYLES: Record<ConfidenceLevel, { color: string; bg: string; border: string }> = {
  STRONG:   { color: '#4ade80', bg: '#4ade8015', border: '#4ade8040' },
  MODERATE: { color: '#00e5ff', bg: '#00e5ff15', border: '#00e5ff40' },
  WEAK:     { color: '#ffaa00', bg: '#ffaa0015', border: '#ffaa0040' },
  UNPROVEN: { color: '#556680', bg: '#55668015', border: '#55668040' },
};

export default function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const s = CONF_STYLES[level];
  return (
    <span
      className="font-mono text-[0.62rem] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {level}
    </span>
  );
}
