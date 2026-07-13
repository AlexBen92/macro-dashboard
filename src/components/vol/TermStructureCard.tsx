'use client';

import ActionabilityBadge from '@/components/ui/ActionabilityBadge';
import type { TermCcyBlock } from '@/lib/types/vol-research';

interface Props {
  data: TermCcyBlock;
  ccy: string;
  ccyColor: string;
}

export default function TermStructureCard({ data, ccy, ccyColor }: Props) {
  const pts = data.points;
  const shapeColor =
    data.shape === 'CONTANGO'
      ? 'var(--dim)'
      : data.shape === 'BACKWARDATION'
        ? 'var(--bear)'
        : 'var(--muted)';

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-bold" style={{ color: ccyColor }}>
            {ccy}
          </span>
          <span className="font-mono text-[0.55rem] uppercase tracking-[0.12em] text-[var(--muted)]">
            Term structure ATM
          </span>
        </div>
        <ActionabilityBadge variant="informational" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <div className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-0.5">
            Shape
          </div>
          <div
            className="font-mono text-base font-bold"
            style={{ color: shapeColor }}
          >
            {data.shape}
          </div>
        </div>
        <div>
          <div className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-0.5">
            Pente
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[var(--text)]">
            {data.slope_volpts_per_dte > 0 ? '+' : ''}
            {data.slope_volpts_per_dte.toFixed(3)}
          </div>
          <div className="font-mono text-[0.45rem] text-[var(--muted)]">vol pt / dte</div>
        </div>
        <div>
          <div className="font-mono text-[0.5rem] uppercase tracking-[0.1em] text-[var(--muted)] mb-0.5">
            Spot
          </div>
          <div className="font-mono text-base font-bold tabular-nums text-[var(--text)]">
            {data.spot.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <TermCurve points={pts} />

      {data.short_end_inversion && (
        <div className="font-mono text-[0.55rem] uppercase tracking-[0.08em] text-[var(--bear)] border-l-2 border-[var(--bear)] pl-2">
          Inversion short-end (IV {`d+1`} {`>`} IV {`d+7`}) — signe de stress court terme
        </div>
      )}

      <div className="pt-2 border-t border-[var(--border)] overflow-x-auto">
        <table className="w-full font-mono text-[0.55rem] tabular-nums">
          <thead>
            <tr className="text-[var(--muted)] text-[0.5rem] uppercase tracking-[0.08em]">
              <th className="text-left py-1 font-medium">Expiry</th>
              <th className="text-right py-1 font-medium">DTE</th>
              <th className="text-right py-1 font-medium">IV ATM</th>
            </tr>
          </thead>
          <tbody>
            {pts.slice(0, 6).map((p) => (
              <tr key={p.expiry} className="border-t border-[var(--border)]">
                <td className="py-0.5 text-[var(--text)]">{p.expiry}</td>
                <td className="py-0.5 text-right text-[var(--dim)]">{p.dte}</td>
                <td className="py-0.5 text-right text-[var(--text)]">
                  {p.iv_atm.toFixed(2)}
                </td>
              </tr>
            ))}
            {pts.length > 6 && (
              <tr>
                <td colSpan={3} className="py-0.5 text-center text-[var(--muted)]">
                  +{pts.length - 6} expiries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="font-mono text-[0.5rem] text-[var(--muted)]">
        Snapshot {data.snapshot_date}
      </div>
    </div>
  );
}

function TermCurve({ points }: { points: TermCcyBlock['points'] }) {
  if (points.length < 2) {
    return (
      <div className="h-[80px] flex items-center justify-center font-mono text-[0.55rem] text-[var(--muted)]">
        Données insuffisantes
      </div>
    );
  }
  const W = 260;
  const H = 80;
  const maxDte = Math.max(...points.map((p) => p.dte), 1);
  const ivs = points.map((p) => p.iv_atm);
  const ivMin = Math.min(...ivs);
  const ivMax = Math.max(...ivs);
  const ivRange = ivMax - ivMin || 1;
  const padBottom = 8;
  const padTop = 8;
  const usableH = H - padBottom - padTop;

  const pathPts = points.map((p) => {
    const x = (p.dte / maxDte) * W;
    const y = padTop + usableH - ((p.iv_atm - ivMin) / ivRange) * usableH;
    return { x, y, ...p };
  });

  const path = pathPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div>
      <svg
        width="100%"
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        aria-label="Term structure curve"
      >
        <line
          x1="0"
          y1={H - padBottom}
          x2={W}
          y2={H - padBottom}
          stroke="var(--border)"
          strokeWidth="0.5"
        />
        <polyline
          points={path}
          fill="none"
          stroke="var(--text)"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
        {pathPts.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="1.8"
            fill={i === 0 ? 'var(--bull)' : i === pathPts.length - 1 ? 'var(--caution)' : 'var(--dim)'}
          />
        ))}
      </svg>
      <div className="flex justify-between font-mono text-[0.45rem] text-[var(--muted)] mt-1">
        <span>
          {ivMin.toFixed(1)} vol pt min
        </span>
        <span>
          DTE 0 → {maxDte}d
        </span>
        <span>
          {ivMax.toFixed(1)} vol pt max
        </span>
      </div>
    </div>
  );
}
