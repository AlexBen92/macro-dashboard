'use client';

import type { DataQuality } from '@/lib/decision/types';
import { MetricRow } from './styles';

export default function DataQualityPanel({ dq, stale }: { dq: DataQuality | null; stale: boolean }) {
  if (!dq) return null;
  const color = dq.score >= 70 ? 'var(--bull)' : dq.score >= 50 ? 'var(--caution)' : 'var(--bear)';
  return (
    <div className={`bg-[var(--bg2)] border ${stale ? 'border-[var(--caution)]/50' : 'border-[var(--border)]'} rounded-[4px] p-2`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px]">
          Data quality
        </span>
        <span className="font-mono text-[0.6rem] tabular-nums" style={{ color }}>
          {dq.score}/100
          {stale && <span className="ml-1 text-[var(--caution)]">· STALE</span>}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <MetricRow label="HL" value={dq.sources.hl.fresh ? '✓' : '✗'} />
        <MetricRow label="Binance" value={dq.sources.binance.fresh ? '✓' : '✗'} />
        <MetricRow label="Deribit" value={dq.sources.deribit.fresh ? '✓' : '✗'} />
        <MetricRow label="CoinGlass" value={dq.sources.coinglass.fresh ? '✓' : '✗'} />
        <MetricRow label="Yahoo" value={dq.sources.yahoo.fresh ? '✓' : '✗'} />
      </div>
      {dq.stale_sources.length > 0 && (
        <div className="font-mono text-[0.5rem] text-[var(--caution)] mt-1">
          stale: {dq.stale_sources.join(', ')}
        </div>
      )}
      {dq.missing_fields.length > 0 && (
        <div className="font-mono text-[0.5rem] text-[var(--dim)] mt-0.5 truncate">
          missing: {dq.missing_fields.slice(0, 4).join(', ')}
          {dq.missing_fields.length > 4 && ` +${dq.missing_fields.length - 4}`}
        </div>
      )}
    </div>
  );
}
