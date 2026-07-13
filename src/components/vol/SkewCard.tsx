'use client';

import ActionabilityBadge from '@/components/ui/ActionabilityBadge';
import type { SkewCcyBlock } from '@/lib/types/vol-research';

interface Props {
  data: SkewCcyBlock;
  ccy: string;
  ccyColor: string;
}

const REGIME_META: Record<
  SkewCcyBlock['regime'],
  { color: string; label: string; description: string }
> = {
  PROTECTION_BID: {
    color: 'var(--bear)',
    label: 'PROTECTION BID',
    description: 'Puts chers — marché en couverture, fear dominant',
  },
  CALL_BID: {
    color: 'var(--bull)',
    label: 'CALL BID',
    description: 'Calls chers — marché en appétit, greed dominant',
  },
  NEUTRAL: {
    color: 'var(--dim)',
    label: 'NEUTRAL',
    description: 'Skew équilibré entre puts et calls OTM',
  },
};

export default function SkewCard({ data, ccy, ccyColor }: Props) {
  const meta = REGIME_META[data.regime];
  const spread = data.spread_volpts;
  const isPutHeavy = spread > 0;

  const W = 240;
  const H = 90;
  const cx = W / 2;
  const cy = H * 0.55;
  const amp = 28;

  const skewK = -8 * (isPutHeavy ? 0.5 : -0.5) * (Math.min(Math.abs(spread) / 4, 1));

  const smilePts: string[] = [];
  for (let x = 0; x <= W; x += 6) {
    const k = (x - cx) / (W / 2);
    const y = cy + amp * (k * k) + skewK * k;
    smilePts.push(`${x},${y.toFixed(1)}`);
  }

  const putX = cx - W * 0.32;
  const callX = cx + W * 0.32;
  const putK = (putX - cx) / (W / 2);
  const callK = (callX - cx) / (W / 2);
  const putY = cy + amp * (putK * putK) + skewK * putK;
  const callY = cy + amp * (callK * callK) + skewK * callK;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold" style={{ color: ccyColor }}>
            {ccy}
          </span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Skew 25-delta · {data.expiry}
          </span>
        </div>
        <ActionabilityBadge variant="informational" />
      </div>

      <div>
        <svg
          width="100%"
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          aria-label="Vol smile skew"
        >
          <line
            x1="0"
            y1={cy + amp}
            x2={W}
            y2={cy + amp}
            stroke="var(--border)"
            strokeWidth="0.5"
          />
          <line
            x1={cx}
            y1="0"
            x2={cx}
            y2={H}
            stroke="var(--border)"
            strokeWidth="0.5"
            strokeDasharray="2 3"
          />
          <polyline
            points={smilePts.join(' ')}
            fill="none"
            stroke="var(--text)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx={putX} cy={putY} r="2.5" fill="var(--bear)" />
          <circle cx={callX} cy={callY} r="2.5" fill="var(--bull)" />
          <text
            x={putX}
            y={putY - 6}
            textAnchor="middle"
            fill="var(--bear)"
            fontSize="7"
            fontFamily="monospace"
          >
            PUT
          </text>
          <text
            x={callX}
            y={callY - 6}
            textAnchor="middle"
            fill="var(--bull)"
            fontSize="7"
            fontFamily="monospace"
          >
            CALL
          </text>
          <text
            x={cx}
            y={cy + amp + 8}
            textAnchor="middle"
            fill="var(--muted)"
            fontSize="7"
            fontFamily="monospace"
          >
            ATM
          </text>
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <SkewMetric label="Put 25d" value={data.put_iv_25d_approx.toFixed(1)} color="var(--bear)" />
        <SkewMetric label="Spread" value={`${spread >= 0 ? '+' : ''}${spread.toFixed(2)}`} color={meta.color} />
        <SkewMetric label="Call 25d" value={data.call_iv_25d_approx.toFixed(1)} color="var(--bull)" />
      </div>

      <div className="border-l-2 pl-2" style={{ borderColor: meta.color }}>
        <div
          className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.08em]"
          style={{ color: meta.color }}
        >
          {meta.label}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--dim)] mt-0.5 leading-snug">
          {meta.description}
        </div>
      </div>

      <div className="pt-2 border-t border-[var(--border)]">
        <div className="font-mono text-[0.5rem] text-[var(--muted)] leading-snug">
          IV ATM {data.iv_atm.toFixed(2)} · DTE {data.dte} · {data.method.replace(/_/g, ' ')}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)]">
          Snapshot {data.snapshot_date}
        </div>
      </div>
    </div>
  );
}

function SkewMetric({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-[var(--bg3)] border border-[var(--border)] rounded-[3px] p-2 text-center">
      <div className="font-mono text-[0.5rem] uppercase tracking-[0.08em] text-[var(--muted)] mb-0.5">
        {label}
      </div>
      <div
        className="font-mono text-sm font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </div>
    </div>
  );
}
