'use client';

import ActionabilityBadge from '@/components/ui/ActionabilityBadge';
import type { VrpCcyBlock, VrpRegime } from '@/lib/types/vol-research';

const REGIME_COLOR: Record<VrpRegime, string> = {
  LOW_VRP: 'var(--bull)',
  MID_VRP: 'var(--dim)',
  HIGH_VRP: 'var(--caution)',
  NA: 'var(--muted)',
};

const REGIME_LABEL: Record<VrpRegime, string> = {
  LOW_VRP: 'LOW',
  MID_VRP: 'MID',
  HIGH_VRP: 'HIGH',
  NA: 'N/A',
};

interface Props {
  ccy: string;
  data: VrpCcyBlock;
  ccyColor: string;
}

export default function VrpCard({ ccy, data, ccyColor }: Props) {
  const history = data.history.slice(-30);
  const hasHistory = history.length >= 2;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold" style={{ color: ccyColor }}>
            {ccy}
          </span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            VRP
          </span>
        </div>
        <ActionabilityBadge variant="validation" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-1">
            VRP actuel
          </div>
          <div className="flex items-baseline gap-1.5">
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color:
                  data.current_value_volpts === null
                    ? 'var(--muted)'
                    : data.current_value_volpts >= 0
                      ? 'var(--text)'
                      : 'var(--bear)',
              }}
            >
              {data.current_value_volpts === null
                ? '—'
                : `${data.current_value_volpts >= 0 ? '+' : ''}${data.current_value_volpts.toFixed(1)}`}
            </span>
            <span className="font-mono text-[0.6rem] text-[var(--muted)]">vol pts</span>
          </div>
          <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5">
            IV {data.iv_atm_30d?.toFixed(1) ?? '—'} − RV {data.rv_30d?.toFixed(1) ?? '—'}
          </div>
        </div>
        <div>
          <div className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-1">
            Régime
          </div>
          <div
            className="font-mono text-2xl font-bold"
            style={{ color: REGIME_COLOR[data.regime] }}
          >
            {REGIME_LABEL[data.regime]}
          </div>
          <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5">
            z {data.regime_thresholds.LOW} / {data.regime_thresholds.MID} / {data.regime_thresholds.HIGH}
          </div>
        </div>
      </div>

      {hasHistory && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[var(--muted)]">
              Historique {history.length}j
            </span>
            <span className="font-mono text-[0.5rem] text-[var(--muted)]">
              VRP daily
            </span>
          </div>
          <VrpSparkline points={history.map((h) => ({ date: h.date, vrp: h.vrp }))} />
        </div>
      )}

      <div className="pt-2 border-t border-[var(--border)]">
        <div className="font-mono text-[0.55rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5">
          Distribution 30j (S32)
        </div>
        <RegimeDistributionBar dist={data.regime_distribution_30d_s32} />
      </div>

      <div className="pt-2 border-t border-[var(--border)]">
        <div className="font-mono text-[0.5rem] leading-snug text-[var(--dim)]">
          {data.robustness.replace(/_/g, ' ').toLowerCase()}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] mt-0.5">
          IV snap {data.iv_snapshot_date ?? '—'} · RV last {data.rv_last_date ?? '—'}
        </div>
      </div>
    </div>
  );
}

function VrpSparkline({ points }: { points: { date: string; vrp: number | null }[] }) {
  const W = 220;
  const H = 40;
  const valid = points.filter((p) => p.vrp !== null) as { date: string; vrp: number }[];
  if (valid.length < 2) {
    return (
      <div className="h-[40px] flex items-center justify-center font-mono text-[0.55rem] text-[var(--muted)]">
        Données insuffisantes
      </div>
    );
  }
  const vals = valid.map((p) => p.vrp);
  const vmin = Math.min(...vals, 0);
  const vmax = Math.max(...vals, 0);
  const vrange = vmax - vmin || 1;
  const zeroY = H - ((0 - vmin) / vrange) * H;

  const pathPts = valid.map((p, i) => {
    const x = (i / (valid.length - 1)) * W;
    const y = H - ((p.vrp - vmin) / vrange) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = valid[valid.length - 1];
  const lastX = W;
  const lastY = H - ((last.vrp - vmin) / vrange) * H;
  const strokeColor = last.vrp >= 0 ? 'var(--bull)' : 'var(--bear)';

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-label="VRP 30j sparkline"
    >
      <line
        x1="0"
        y1={zeroY}
        x2={W}
        y2={zeroY}
        stroke="var(--border)"
        strokeWidth="0.5"
        strokeDasharray="2 3"
      />
      <polyline
        points={pathPts.join(' ')}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={lastX} cy={lastY} r="1.8" fill={strokeColor} />
    </svg>
  );
}

function RegimeDistributionBar({
  dist,
}: {
  dist: VrpCcyBlock['regime_distribution_30d_s32'];
}) {
  if (!dist || !dist.total) {
    return <div className="font-mono text-[0.55rem] text-[var(--muted)]">N/A</div>;
  }
  const segments: { label: string; pct: number; color: string }[] = [
    { label: 'LOW', pct: dist.pct.LOW, color: 'var(--bull)' },
    { label: 'MID', pct: dist.pct.MID, color: 'var(--dim)' },
    { label: 'HIGH', pct: dist.pct.HIGH, color: 'var(--caution)' },
    { label: 'NA', pct: dist.pct.NA, color: 'var(--border)' },
  ];
  return (
    <div>
      <div className="flex h-2 w-full overflow-hidden rounded-[2px]">
        {segments.map((s) => (
          <div
            key={s.label}
            style={{ width: `${s.pct}%`, background: s.color }}
            title={`${s.label}: ${s.pct}%`}
          />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1 mt-1.5">
        {segments.map((s) => (
          <div key={s.label} className="text-center">
            <div
              className="font-mono text-[0.55rem] tabular-nums"
              style={{ color: s.color === 'var(--border)' ? 'var(--muted)' : s.color }}
            >
              {s.pct.toFixed(0)}%
            </div>
            <div className="font-mono text-[0.45rem] uppercase text-[var(--muted)] tracking-[0.05em]">
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
