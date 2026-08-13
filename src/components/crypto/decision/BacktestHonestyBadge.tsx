'use client';

import type { BacktestStatus, BacktestVerdict } from '@/lib/decision/types';

const STATUS_STYLE: Record<BacktestVerdict, { color: string; label: string; icon: string }> = {
  NO_EDGE: { color: 'var(--bear)', label: 'NO EDGE', icon: '⚠' },
  EDGE_CONFIRMED: { color: 'var(--bull)', label: 'EDGE CONFIRMED', icon: '✓' },
  UNTESTED: { color: 'var(--muted)', label: 'UNTESTED', icon: '·' },
};

export default function BacktestHonestyBadge({ status }: { status: BacktestStatus }) {
  const style = STATUS_STYLE[status.verdict];
  const title = `Walk-forward OOS · ${status.n_combos_tested} combos testés · best PF ${
    status.best_pf != null ? status.best_pf.toFixed(2) : 'n/a'
  }`;

  return (
    <div
      className="flex items-center justify-between font-mono text-[0.55rem] border-t border-[var(--border)] pt-1 mt-1"
      title={title}
    >
      <span className="text-[var(--label)] uppercase tracking-[1px]">Backtest</span>
      <span className="flex items-center gap-1" style={{ color: style.color }}>
        <span>{style.icon}</span>
        <span>{style.label}</span>
        {status.n_combos_tested > 0 && (
          <span className="text-[var(--dim)]"> · n={status.n_combos_tested}</span>
        )}
        {status.best_pf != null && (
          <span className="text-[var(--dim)]"> · PF {status.best_pf.toFixed(2)}</span>
        )}
      </span>
    </div>
  );
}
