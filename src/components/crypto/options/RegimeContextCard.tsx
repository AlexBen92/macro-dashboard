'use client';

import { useRegimeStatus, type RegimeLabel, type StrategyRow } from '@/hooks/api/useRegimeStatus';

interface RegimeStyle {
  bg: string;
  border: string;
  text: string;
  label: string;
  emoji: string;
  blurb: string;
}

const REGIME_STYLE: Record<RegimeLabel, RegimeStyle> = {
  CALM: {
    bg: 'rgba(74,222,128,0.06)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    label: 'CALM',
    emoji: '🟢',
    blurb: 'Low vol percentile — mean-reversion & range strategies favored.',
  },
  BUILDING: {
    bg: 'rgba(100,160,255,0.06)',
    border: 'rgb(100,160,255)',
    text: 'rgb(140,180,255)',
    label: 'BUILDING',
    emoji: '🔵',
    blurb: 'Vol rising mid-range — trend & breakout strategies favored.',
  },
  STRESS: {
    bg: 'rgba(255,170,0,0.08)',
    border: 'var(--caution)',
    text: 'var(--caution)',
    label: 'STRESS',
    emoji: '🟡',
    blurb: 'High vol / sharp drawdown — lead-lag & carry strategies favored.',
  },
  CRISIS: {
    bg: 'rgba(255,51,85,0.08)',
    border: 'var(--bear)',
    text: 'var(--bear)',
    label: 'CRISIS',
    emoji: '🔴',
    blurb: 'Tail regime — small sample, treat any signal with caution.',
  },
};

const STRATEGY_LABEL: Record<string, string> = {
  S1_V16_thr5: 'S1 · IV straddle arb',
  S10_V26_h24_agg: 'S10 · SPX lead-lag',
  C2_V21_revert_ADA: 'C2 · ADA range-revert',
};

function confidenceBadge(row: StrategyRow, regime: RegimeLabel): {
  text: string;
  tag: 'STRONG' | 'OK' | 'LOW-N' | 'LOW-DSR' | 'NONE';
} {
  const cell = row.regimes.find((c) => c.regime === regime);
  if (!cell) {
    return { text: 'no exposure in this regime', tag: 'NONE' };
  }
  if (!cell.passes_min_n) {
    return { text: `N=${cell.n_obs} < 30 under-powered`, tag: 'LOW-N' };
  }
  if (!cell.passes_dsr) {
    return { text: `DSR ${cell.dsr_probability.toFixed(2)} < 0.95`, tag: 'LOW-DSR' };
  }
  if (cell.sharpe_annual >= 1.0 && cell.dsr_probability >= 0.999) {
    return { text: 'robust', tag: 'STRONG' };
  }
  return { text: 'actionable', tag: 'OK' };
}

const TAG_STYLE: Record<string, { bg: string; text: string }> = {
  STRONG: { bg: 'rgba(74,222,128,0.10)', text: 'var(--bull)' },
  OK: { bg: 'rgba(140,180,255,0.08)', text: 'rgb(140,180,255)' },
  'LOW-N': { bg: 'rgba(255,170,0,0.08)', text: 'var(--caution)' },
  'LOW-DSR': { bg: 'rgba(255,170,0,0.08)', text: 'var(--caution)' },
  NONE: { bg: 'rgba(140,140,160,0.05)', text: 'var(--muted)' },
};

export default function RegimeContextCard() {
  const { data, isLoading, error } = useRegimeStatus();

  if (isLoading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
        <div className="px-3 py-1.5 border-b border-[var(--border)] font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Regime · Walk-forward
        </div>
        <div className="h-32 animate-pulse bg-[var(--bg3)] m-2 rounded-[3px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
        <div className="px-3 py-1.5 border-b border-[var(--border)] font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Regime · Walk-forward
        </div>
        <div className="p-3 font-mono text-[0.65rem] text-[var(--muted)] italic">
          Regime data unavailable — {error ?? 'no payload'}
        </div>
      </div>
    );
  }

  const regime = data.current_regime;
  const style = regime ? REGIME_STYLE[regime] : null;

  return (
    <div
      className="border border-[var(--border)] border-l-[3px] rounded-[4px]"
      style={{ background: 'var(--bg2)', borderLeftColor: style?.border ?? 'var(--border)' }}
    >
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Regime · Walk-forward
        </div>
        <span className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px]">
          rule {data.rule_version}
        </span>
      </div>

      <div
        className="px-3 py-2 border-b border-[var(--border)]"
        style={{ background: style?.bg ?? 'transparent' }}
      >
        <div className="flex items-baseline gap-2">
          <span className="text-base">{style?.emoji ?? '—'}</span>
          <div
            className="font-mono text-[0.85rem] uppercase tracking-[2px] font-semibold"
            style={{ color: style?.text ?? 'var(--muted)' }}
          >
            {regime ?? '—'}
          </div>
          <span className="font-mono text-[0.55rem] text-[var(--dim)] ml-auto">
            {data.days_in_regime != null ? `${data.days_in_regime}d in regime` : ''}
          </span>
        </div>
        <div className="font-mono text-[0.55rem] text-[var(--muted)] mt-1 leading-snug">
          {style?.blurb ?? 'Regime not computed yet.'}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--dim)] mt-1">
          since {data.regime_since?.slice(0, 10) ?? '—'} · as of {data.as_of?.slice(0, 10) ?? '—'}
        </div>
      </div>

      <div className="p-2 space-y-1">
        <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px] px-1 pb-1">
          Strategy edge in this regime
        </div>
        {regime && data.matrix.length > 0 ? (
          data.matrix.map((row) => {
            const cell = row.regimes.find((c) => c.regime === regime);
            const conf = confidenceBadge(row, regime);
            const tagStyle = TAG_STYLE[conf.tag];
            const label = STRATEGY_LABEL[row.strategy] ?? row.strategy;
            return (
              <div
                key={row.strategy}
                className="border-l-[2px] border-[var(--border)] rounded-[3px] px-2 py-1.5 bg-[var(--bg3)]/40"
                title={conf.text}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[0.6rem] text-[var(--text)] truncate">
                    {label}
                  </span>
                  <span
                    className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
                    style={{ background: tagStyle.bg, color: tagStyle.text }}
                  >
                    {conf.tag}
                  </span>
                </div>
                <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5 flex gap-3">
                  {cell ? (
                    <>
                      <span>Sh {isFinite(cell.sharpe_annual) ? cell.sharpe_annual.toFixed(2) : '—'}</span>
                      <span>{cell.mean_bps >= 0 ? '+' : ''}{cell.mean_bps.toFixed(1)}bps</span>
                      <span>N {cell.n_obs}</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </div>
                <div className="font-mono text-[0.5rem] text-[var(--muted)] mt-0.5 italic">
                  {conf.text}
                </div>
              </div>
            );
          })
        ) : (
          <div className="font-mono text-[0.6rem] text-[var(--muted)] italic px-2 py-2">
            No matrix data
          </div>
        )}

        {data.matrix_excluded.length > 0 && (
          <details className="mt-1 px-1">
            <summary className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px] cursor-pointer">
              excluded ({data.matrix_excluded.length})
            </summary>
            <div className="mt-1 space-y-1">
              {data.matrix_excluded.map((x) => (
                <div
                  key={x.strategy}
                  className="font-mono text-[0.55rem] text-[var(--muted)] bg-[var(--bg3)]/30 rounded-[2px] px-2 py-1"
                >
                  <div className="text-[var(--dim)]">{x.strategy}</div>
                  <div className="italic mt-0.5 leading-snug">{x.reason}</div>
                </div>
              ))}
            </div>
          </details>
        )}

        <div className="font-mono text-[0.5rem] text-[var(--muted)] pt-1 border-t border-[var(--border)]">
          Historical edge · not a live signal · DSR ≥ 0.95, N ≥ 30
        </div>
      </div>
    </div>
  );
}
