'use client';

import type { AssetDecision } from '@/lib/decision/types';
import { verdictColor, entryStateColor, setupKindLabel, MetricRow, Pill } from './styles';

function ContributionRow({ source, delta, reason }: {
  source: string; delta: number; reason: string;
}) {
  const color = delta > 0 ? 'var(--bull)' : delta < 0 ? 'var(--bear)' : 'var(--muted)';
  const sign = delta > 0 ? '+' : '';
  return (
    <div className="flex items-center gap-2 font-mono text-[0.55rem] py-0.5">
      <span className="text-[var(--dim)] uppercase tracking-[1px] w-[120px] truncate">{source}</span>
      <span className="tabular-nums w-[36px] text-right" style={{ color }}>
        {sign}{delta}
      </span>
      <span className="text-[var(--muted)] flex-1 truncate">{reason}</span>
    </div>
  );
}

function WhyChecklist({ items }: { items: AssetDecision['why_checklist'] }) {
  if (!items || items.length === 0) {
    return <div className="text-[var(--dim)] font-mono text-[0.55rem]">No checklist</div>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      {items.map((c) => (
        <div key={c.label} className="flex items-center gap-2 font-mono text-[0.55rem]">
          <span style={{ color: c.pass ? 'var(--bull)' : 'var(--bear)' }}>
            {c.pass ? '✓' : '✗'}
          </span>
          <span className="text-[var(--text)] flex-1">{c.label}</span>
          <span className="text-[var(--dim)] w-7 text-right tabular-nums">w={c.weight}</span>
        </div>
      ))}
    </div>
  );
}

export default function DecisionVerdictCard({ asset }: { asset: AssetDecision | null }) {
  if (!asset) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[300px] animate-pulse" />
    );
  }

  const style = verdictColor(asset.verdict);
  const entryColor = entryStateColor(asset.entry.state);
  const dq = asset.data_quality;
  const dqColor = dq.score >= 70 ? 'var(--bull)' : dq.score >= 50 ? 'var(--caution)' : 'var(--bear)';
  const rr1 = asset.tp.rr_tp1;

  return (
    <div
      className="bg-[var(--bg2)] border rounded-[4px] p-3 flex flex-col gap-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          M15 Decision · {asset.symbol}
        </span>
        <Pill text={asset.entry.state} color={entryColor} bg="rgba(0,0,0,0.3)" border={entryColor} />
      </div>

      <div className="flex items-baseline gap-3">
        <span
          className="font-mono text-[1.4rem] font-bold tracking-[1px]"
          style={{ color: style.text }}
        >
          {asset.verdict}
        </span>
        <span className="font-mono text-[0.85rem] text-[var(--text)] tabular-nums">
          {asset.score}/100
        </span>
        <span className="font-mono text-[0.55rem] text-[var(--dim)] uppercase tracking-[1px]">
          conf {asset.confidence}/100
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-0">
        <MetricRow label="Regime" value={asset.regime.label} />
        <MetricRow label="Trend" value={asset.regime.trend_direction} />
        <MetricRow label="ADX" value={asset.regime.adx} />
        <MetricRow label="Vol ratio" value={asset.regime.vol_ratio} />
        <MetricRow label="Setup" value={setupKindLabel(asset.setup.kind)} />
        <MetricRow label="MTF align" value={asset.mtf_alignment.score} />
      </div>

      <div className="border-t border-[var(--border)] pt-2 grid grid-cols-2 gap-x-3">
        <MetricRow label="Entry" value={asset.entry.price ? `$${asset.entry.price.toFixed(2)}` : null} />
        <MetricRow label="Stop" value={asset.stop.price ? `$${asset.stop.price.toFixed(2)}` : null} hint={asset.stop.bps ? `${asset.stop.bps}bps` : undefined} />
        <MetricRow label="TP1" value={asset.tp.tp1 ? `$${asset.tp.tp1.toFixed(2)}` : null} />
        <MetricRow label="R:R (TP1)" value={rr1 ?? null} />
        <MetricRow label="TP2" value={asset.tp.tp2 ? `$${asset.tp.tp2.toFixed(2)}` : null} />
        <MetricRow label="TP3" value={asset.tp.tp3 ? `$${asset.tp.tp3.toFixed(2)}` : null} />
      </div>

      <div className="border-t border-[var(--border)] pt-2 grid grid-cols-2 gap-x-3">
        <MetricRow label="Size" value={asset.risk.size_mult > 0 ? `${(asset.risk.size_mult * 100).toFixed(0)}%` : '0'} />
        <MetricRow label="Notional" value={asset.risk.notional_usd > 0 ? `$${asset.risk.notional_usd.toFixed(0)}` : null} />
        <MetricRow label="Max loss" value={asset.risk.max_loss_usd > 0 ? `$${asset.risk.max_loss_usd.toFixed(0)}` : null} />
        <MetricRow label="Kelly cap" value={asset.risk.kelly_capped} />
        {asset.risk.blocked && (
          <div className="col-span-2 text-[var(--bear)] font-mono text-[0.5rem] mt-1">
            BLOCKED · {asset.risk.block_reasons.join(' · ')}
          </div>
        )}
      </div>

      <div className="border-t border-[var(--border)] pt-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px]">
            Why · contributions
          </span>
          <span
            className="font-mono text-[0.5rem] uppercase tracking-[1px]"
            style={{ color: dqColor }}
          >
            DQ {dq.score}/100
          </span>
        </div>
        {asset.setup.contributions.slice(0, 6).map((c, i) => (
          <ContributionRow key={`${c.source}-${i}`} source={c.source} delta={c.delta_pts} reason={c.reason} />
        ))}
      </div>

      <div className="border-t border-[var(--border)] pt-2">
        <div className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px] mb-1">
          Why · checklist
        </div>
        <WhyChecklist items={asset.why_checklist} />
      </div>

      {asset.risks.length > 0 && (
        <div className="border-t border-[var(--border)] pt-2">
          <div className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px] mb-1">
            Risks
          </div>
          <ul className="flex flex-col gap-0.5">
            {asset.risks.slice(0, 5).map((r, i) => (
              <li key={i} className="font-mono text-[0.5rem] text-[var(--caution)]">
                ⚠ {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-[var(--border)] pt-1 flex items-center justify-between">
        <span className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px]">
          {asset.session.name} · cal n={asset.calibration.n_predictions}
          {asset.calibration.brier != null && ` · brier ${asset.calibration.brier}`}
        </span>
        {asset.entry.reason && (
          <span className="font-mono text-[0.5rem] text-[var(--dim)] italic truncate max-w-[50%]">
            {asset.entry.reason}
          </span>
        )}
      </div>
    </div>
  );
}
