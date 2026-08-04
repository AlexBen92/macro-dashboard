'use client';

import { useRegimeStatus, type RegimeLabel } from '@/hooks/api/useRegimeStatus';

const REGIME_STYLE: Record<RegimeLabel, {
  bg: string; border: string; text: string; emoji: string; blurb: string;
}> = {
  CALM: {
    bg: 'rgba(74,222,128,0.08)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    emoji: '🟢',
    blurb: 'Low vol pct — mean-reversion & range favored',
  },
  BUILDING: {
    bg: 'rgba(100,160,255,0.08)',
    border: 'rgb(100,160,255)',
    text: 'rgb(140,180,255)',
    emoji: '🔵',
    blurb: 'Vol rising — trend & breakout favored',
  },
  STRESS: {
    bg: 'rgba(255,170,0,0.08)',
    border: 'var(--caution)',
    text: 'var(--caution)',
    emoji: '🟡',
    blurb: 'High vol / sharp DD — lead-lag & carry only',
  },
  CRISIS: {
    bg: 'rgba(255,51,85,0.08)',
    border: 'var(--bear)',
    text: 'var(--bear)',
    emoji: '🔴',
    blurb: 'Tail regime — no trade',
  },
};

export default function RegimeSummaryCard() {
  const { data, isLoading, error } = useRegimeStatus();

  if (isLoading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[110px] animate-pulse" />
    );
  }
  if (error || !data || !data.current_regime) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 font-mono text-[0.6rem] text-[var(--muted)]">
        Régime indisponible — export cron 05:17 UTC en attente
      </div>
    );
  }

  const regime = data.current_regime;
  const style = REGIME_STYLE[regime];
  const volPct = data.regime_distribution?.CALM ?? 0;
  const streak = data.days_in_regime ?? 0;

  return (
    <div
      className="bg-[var(--bg2)] border rounded-[4px] p-3 flex flex-col gap-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Régime WF
        </span>
        <span className="font-mono text-[0.55rem]" style={{ color: style.text }}>
          {style.emoji} {regime}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[1.4rem] font-bold leading-none"
          style={{ color: style.text }}
        >
          {regime}
        </span>
        <span className="font-mono text-[0.6rem] text-[var(--muted)]">
          {streak}d streak
        </span>
      </div>

      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between font-mono text-[0.55rem]">
          <span className="text-[var(--muted)] uppercase tracking-[1px]">CALM distribution</span>
          <span className="text-[var(--text)]">{(volPct * 100).toFixed(1)}%</span>
        </div>
        <div className="h-1 bg-[var(--bg3)] rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.min(100, volPct * 100)}%`,
              background: style.border,
            }}
          />
        </div>
      </div>

      <div className="font-mono text-[0.6rem] text-[var(--muted)] leading-tight">
        {style.blurb}
      </div>
    </div>
  );
}
