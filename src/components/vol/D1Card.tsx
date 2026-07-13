'use client';

import { AlertTriangle } from 'lucide-react';
import ActionabilityBadge from '@/components/ui/ActionabilityBadge';
import type { D1CcyBlock } from '@/lib/types/vol-research';

interface Props {
  data: D1CcyBlock;
  ccy: string;
  ccyColor: string;
}

export default function D1Card({ data, ccy, ccyColor }: Props) {
  const pct = data.rv_30d_pct_current;
  const compressed = data.compression_detected;
  const thresholdPct = (data.threshold_pct * 100).toFixed(0);
  const pctDisplay = pct !== null ? (pct * 100).toFixed(1) : '—';
  const pctRelative = pct !== null ? Math.min(100, (pct / (data.threshold_pct * 2.5)) * 100) : 0;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold" style={{ color: ccyColor }}>
            {ccy}
          </span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            D1 · Compression
          </span>
        </div>
        <ActionabilityBadge variant="options_required" />
      </div>

      <div>
        <div className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-1">
          RV 30d percentile
        </div>
        <div className="flex items-baseline gap-2">
          <span
            className="font-mono text-2xl font-bold tabular-nums"
            style={{ color: compressed ? 'var(--bull)' : 'var(--text)' }}
          >
            {pctDisplay}
          </span>
          <span className="font-mono text-[0.6rem] text-[var(--muted)]">
            / seuil {thresholdPct}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-[var(--bg3)] rounded-[1px] overflow-hidden relative">
          <div
            className="h-full"
            style={{
              width: `${pctRelative}%`,
              background: compressed ? 'var(--bull)' : 'var(--dim)',
              transition: 'width 250ms',
            }}
          />
          <div
            className="absolute top-0 bottom-0 w-px bg-[var(--caution)]"
            style={{ left: `${(data.threshold_pct / (data.threshold_pct * 2.5)) * 100}%` }}
            title="Threshold"
          />
        </div>
      </div>

      {compressed && (
        <div className="flex items-center gap-2 p-2 border border-[var(--bull)] bg-[var(--bg3)] rounded-[3px]">
          <AlertTriangle size={12} color="var(--bull)" strokeWidth={2} />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.08em] text-[var(--bull)]">
            Compression détectée · expansion observée historiquement (n&lt;30, proxy optimiste)
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Metric
          label="Verdict h14"
          value={data.verdict_h14 ?? '—'}
          color={data.verdict_h14 === 'PASS' ? 'var(--bull)' : 'var(--caution)'}
        />
        <Metric
          label="Verdict h30"
          value={data.verdict_h30 ?? '—'}
          color={data.verdict_h30 === 'PASS' ? 'var(--bull)' : 'var(--caution)'}
        />
        <Metric
          label="Expansion hold h14"
          value={`${data.mean_expansion_hold_volpt_h14.toFixed(1)} vol pt`}
        />
        <Metric
          label="Straddle hold h30"
          value={`${data.straddle_pnl_hold_bps_h30.toFixed(0)} bps`}
          color={
            data.straddle_pnl_hold_bps_h30 > 0 ? 'var(--text)' : 'var(--bear)'
          }
        />
      </div>

      <div className="pt-2 border-t border-[var(--border)]">
        <div className="font-mono text-[0.5rem] leading-snug text-[var(--dim)]">
          {data.robustness.replace(/_/g, ' ').toLowerCase()}
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[3px] p-2">
      <div className="font-mono text-[0.5rem] uppercase tracking-[0.08em] text-[var(--muted)] mb-0.5">
        {label}
      </div>
      <div
        className="font-mono text-[0.7rem] font-semibold tabular-nums"
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  );
}
