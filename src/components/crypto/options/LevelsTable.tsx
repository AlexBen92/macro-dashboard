'use client';

import type { OptionLevel } from '@/lib/options/types';
import { fmtStrike } from '@/lib/options/format';

interface LevelsTableProps {
  spot: number | null;
  levels: {
    callWall: OptionLevel | null;
    putWall: OptionLevel | null;
    zeroGamma: OptionLevel | null;
    hvl: OptionLevel | null;
  };
}

const ROWS: { label: string; key: keyof LevelsTableProps['levels'] }[] = [
  { label: 'Call Wall', key: 'callWall' },
  { label: 'Put Wall', key: 'putWall' },
  { label: 'Zero Gamma', key: 'zeroGamma' },
  { label: 'HVL', key: 'hvl' },
];

interface RowStyle {
  bg: string;
  border: string;
  text: string;
  dot: string;
  side: 'above' | 'below' | 'at';
}

function rowStyle(distancePct: number): RowStyle {
  if (distancePct > 0) {
    return {
      bg: 'rgba(74,222,128,0.05)',
      border: 'var(--bull)',
      text: 'var(--bull)',
      dot: 'var(--bull)',
      side: 'above',
    };
  }
  if (distancePct < 0) {
    return {
      bg: 'rgba(255,51,85,0.05)',
      border: 'var(--bear)',
      text: 'var(--bear)',
      dot: 'var(--bear)',
      side: 'below',
    };
  }
  return {
    bg: 'rgba(170,102,255,0.05)',
    border: 'var(--purple)',
    text: 'var(--purple)',
    dot: 'var(--purple)',
    side: 'at',
  };
}

const NEAR_THRESHOLD = 1.5;

export default function LevelsTable({ spot, levels }: LevelsTableProps) {
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Levels
        </div>
        <div className="font-mono text-[0.55rem] text-[var(--muted)]">
          {spot != null ? `Spot ${fmtStrike(spot)}` : 'Spot n/a'}
        </div>
      </div>
      <div className="p-1.5 space-y-1">
        {ROWS.map(({ label, key }) => {
          const lvl = levels[key];
          if (!lvl) {
            return (
              <div
                key={key}
                className="border-l-[3px] rounded-[3px] px-2 py-1.5 flex items-center gap-2 font-mono text-[0.65rem]"
                style={{ background: 'rgba(140,140,160,0.04)', borderColor: 'var(--border)' }}
              >
                <span className="text-[var(--label)] uppercase tracking-[1.5px] text-[0.55rem] w-20 flex-shrink-0">
                  {label}
                </span>
                <span className="ml-auto text-[var(--muted)] italic text-[0.55rem]">
                  Not provided by current data source
                </span>
              </div>
            );
          }
          const near = Math.abs(lvl.distancePct) <= NEAR_THRESHOLD;
          const s = rowStyle(lvl.distancePct);
          return (
            <div
              key={key}
              className={`border-l-[3px] rounded-[3px] px-2 py-1.5 flex items-center gap-2 font-mono text-[0.65rem] ${near ? 'animate-pulse' : ''}`}
              style={{ background: s.bg, borderColor: s.border }}
              title={`${label} · ${s.side} spot · ${near ? 'near spot' : ''}`}
            >
              <span className="text-[var(--label)] uppercase tracking-[1.5px] text-[0.55rem] w-20 flex-shrink-0">
                {label}
              </span>
              <span className="text-[var(--text)] tabular-nums">
                {fmtStrike(lvl.strike)}
              </span>
              <span
                className="ml-auto tabular-nums text-[0.6rem] font-semibold"
                style={{ color: s.text }}
              >
                {lvl.distancePct > 0 ? '+' : ''}
                {lvl.distancePct.toFixed(2)}%
                {near && ' ⚡'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

