'use client';

import VolArbSignalCard from '@/components/crypto/VolArbSignalCard';
import { useVolResearch } from '@/hooks/api/useVolResearch';
import type { VolResearchPayload, S1TearsheetCcy } from '@/lib/types/vol-research';

export default function S1PaperPerformanceSection() {
  const { payload, available, isLoading } = useVolResearch();

  return (
    <div className="space-y-3">
      <VolArbSignalCard />
      {available && payload && <EquityTearsheetBlock payload={payload} />}
      {!available && !isLoading && (
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 font-mono text-[0.6rem] text-[var(--muted)] text-center">
          Equity curve + tearsheet indisponibles (VPS vol-research injoignable)
        </div>
      )}
    </div>
  );
}

function EquityTearsheetBlock({ payload }: { payload: VolResearchPayload }) {
  const paper = payload.s1_paper;
  const tearsheet = payload.s1_tearsheet;
  const curve = paper?.equity_curve_daily ?? [];

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.7rem] font-bold uppercase tracking-[0.12em] text-[var(--label)]">
          S1 · Performance paper trading
        </span>
        <span className="font-mono text-[0.55rem] text-[var(--muted)]">
          {paper?.days_running ?? 0}j · {curve.length} points daily
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <EquityCurve curve={curve} startUsd={paper?.equity_start_usd ?? 10000} />
        </div>
        <div>
          <PaperKpiGrid paper={paper} />
        </div>
      </div>

      <div className="pt-3 border-t border-[var(--border)]">
        <div className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)] mb-3">
          Tearsheet V18 (backtest nested CV 365j)
        </div>
        <div className="grid grid-cols-2 gap-3">
          {tearsheet?.BTC && (
            <TearsheetCcyBlock ccy="BTC" color="var(--caution)" t={tearsheet.BTC} />
          )}
          {tearsheet?.ETH && (
            <TearsheetCcyBlock ccy="ETH" color="var(--info)" t={tearsheet.ETH} />
          )}
        </div>
      </div>
    </div>
  );
}

function EquityCurve({
  curve,
  startUsd,
}: {
  curve: { date: string; equity: number }[];
  startUsd: number;
}) {
  if (curve.length < 2) {
    return (
      <div className="h-[160px] flex items-center justify-center font-mono text-[0.6rem] text-[var(--muted)]">
        Données equity insuffisantes ({curve.length}j)
      </div>
    );
  }

  const W = 600;
  const H = 160;
  const padL = 8;
  const padR = 8;
  const padT = 10;
  const padB = 18;
  const usableW = W - padL - padR;
  const usableH = H - padT - padB;

  const eqs = curve.map((p) => p.equity);
  const eMin = Math.min(...eqs, startUsd);
  const eMax = Math.max(...eqs, startUsd);
  const eRange = eMax - eMin || 1;

  const startY = padT + usableH - ((startUsd - eMin) / eRange) * usableH;

  const pathPts = curve.map((p, i) => {
    const x = padL + (i / (curve.length - 1)) * usableW;
    const y = padT + usableH - ((p.equity - eMin) / eRange) * usableH;
    return { x, y, ...p };
  });
  const path = pathPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pathPts[pathPts.length - 1];
  const lastDelta = curve[curve.length - 1].equity - startUsd;
  const lastColor = lastDelta >= 0 ? 'var(--bull)' : 'var(--bear)';

  return (
    <div>
      <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="Equity curve">
        <line
          x1={padL}
          y1={startY}
          x2={W - padR}
          y2={startY}
          stroke="var(--border)"
          strokeWidth="0.5"
          strokeDasharray="3 3"
        />
        <text x={padL} y={startY - 3} fill="var(--muted)" fontSize="8" fontFamily="monospace">
          start ${startUsd.toFixed(0)}
        </text>
        <polyline
          points={path}
          fill="none"
          stroke={lastColor}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={last.x} cy={last.y} r="2.5" fill={lastColor} />
        <text
          x={last.x}
          y={last.y - 6}
          textAnchor="end"
          fill={lastColor}
          fontSize="9"
          fontFamily="monospace"
        >
          ${curve[curve.length - 1].equity.toFixed(0)}
        </text>
        <text x={padL} y={H - 4} fill="var(--muted)" fontSize="8" fontFamily="monospace">
          {curve[0].date}
        </text>
        <text x={W - padR} y={H - 4} textAnchor="end" fill="var(--muted)" fontSize="8" fontFamily="monospace">
          {curve[curve.length - 1].date}
        </text>
      </svg>
    </div>
  );
}

function PaperKpiGrid({ paper }: { paper: VolResearchPayload['s1_paper'] }) {
  if (!paper) return null;
  return (
    <div className="grid grid-cols-2 gap-2 h-full">
      <Kpi label="Equity" value={`$${paper.equity_current_usd.toFixed(0)}`} />
      <Kpi label="P&L" value={`${(paper.equity_current_usd - paper.equity_start_usd >= 0 ? '+' : '')}$${(paper.equity_current_usd - paper.equity_start_usd).toFixed(2)}`} color={paper.equity_current_usd - paper.equity_start_usd >= 0 ? 'var(--bull)' : 'var(--bear)'} />
      <Kpi label="Signals" value={`${paper.signal_count}`} />
      <Kpi label="Fills" value={`${paper.fill_count}`} />
      <Kpi label="Cancels" value={`${paper.cancel_count}`} />
      <Kpi label="Actifs" value={`${paper.active_count}`} />
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[3px] p-2">
      <div className="font-mono text-[0.5rem] uppercase tracking-[0.08em] text-[var(--muted)] mb-0.5">
        {label}
      </div>
      <div className="font-mono text-sm font-bold tabular-nums" style={{ color: color ?? 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

function TearsheetCcyBlock({
  ccy,
  color,
  t,
}: {
  ccy: string;
  color: string;
  t: S1TearsheetCcy;
}) {
  return (
    <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[3px] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-bold" style={{ color }}>
          {ccy}
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)]">
          thr {t.threshold_pt.toFixed(0)}pt · {t.n_trades} trades
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <KpiInline label="Sh NW" value={t.sharpe_daily_nw_hac.toFixed(2)} highlight={t.sharpe_daily_nw_hac >= 1} />
        <KpiInline label="Sh naive" value={t.sharpe_daily_naive.toFixed(2)} />
        <KpiInline label="Sortino" value={t.sortino_daily.toFixed(2)} />
        <KpiInline label="Win rate" value={`${(t.win_rate * 100).toFixed(0)}%`} />
        <KpiInline label="PF" value={t.profit_factor.toFixed(2)} />
        <KpiInline label="Tail" value={t.tail_ratio.toFixed(2)} />
        <KpiInline
          label="DD réal P95"
          value={`${t.realistic_dd_p95_pct.toFixed(2)}%`}
          color={Math.abs(t.realistic_dd_p95_pct) > 5 ? 'var(--bear)' : 'var(--dim)'}
        />
        <KpiInline label="Mean/trade" value={`${t.mean_per_trade_bps.toFixed(0)} bps`} />
      </div>
    </div>
  );
}

function KpiInline({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="font-mono text-[0.55rem] uppercase tracking-[0.05em] text-[var(--muted)]">
        {label}
      </span>
      <span
        className="font-mono text-[0.7rem] font-bold tabular-nums"
        style={{ color: color ?? (highlight ? 'var(--bull)' : 'var(--text)') }}
      >
        {value}
      </span>
    </div>
  );
}
