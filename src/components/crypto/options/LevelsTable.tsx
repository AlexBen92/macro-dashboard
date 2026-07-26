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

interface Row {
  label: string;
  color: string;
  level: OptionLevel | null;
}

const ROWS: { label: string; color: string; key: keyof LevelsTableProps['levels'] }[] = [
  { label: 'Call Wall', color: 'var(--accent)', key: 'callWall' },
  { label: 'Put Wall', color: 'var(--bear)', key: 'putWall' },
  { label: 'Zero Gamma', color: 'var(--purple)', key: 'zeroGamma' },
  { label: 'HVL', color: 'var(--caution)', key: 'hvl' },
];

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
      <div className="divide-y divide-[var(--border)]">
        {ROWS.map(({ label, color, key }) => {
          const lvl = levels[key];
          return (
            <div
              key={key}
              className="px-3 py-1.5 flex items-center gap-2 font-mono text-[0.65rem]"
            >
              <div
                className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span className="text-[var(--label)] uppercase tracking-[1.5px] text-[0.55rem] w-20 flex-shrink-0">
                {label}
              </span>
              {lvl ? (
                <>
                  <span className="text-[var(--text)] tabular-nums">
                    {fmtStrike(lvl.strike)}
                  </span>
                  <span
                    className="ml-auto tabular-nums text-[0.6rem]"
                    style={{
                      color:
                        lvl.distancePct > 0
                          ? 'var(--bull)'
                          : lvl.distancePct < 0
                            ? 'var(--bear)'
                            : 'var(--muted)',
                    }}
                  >
                    {lvl.distancePct > 0 ? '+' : ''}
                    {lvl.distancePct.toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="ml-auto text-[var(--muted)] italic text-[0.55rem]">
                  Not provided by current data source
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
