'use client';

import { useMemo } from 'react';
import { useCorrMatrix } from '@/hooks/api/useCorrMatrix';

const ASSETS_A = ['BTC', 'ETH', 'SOL'];
const ASSETS_B = ['DXY', 'SPX', 'GOLD', 'VIX', 'MSTR', 'NVDA', 'COIN'];

function corrColor(r: number): { bg: string; text: string } {
  if (!Number.isFinite(r)) return { bg: 'transparent', text: 'var(--dim)' };
  if (r > 0.5) return { bg: 'rgba(74,222,128,0.28)', text: 'var(--bull)' };
  if (r > 0.25) return { bg: 'rgba(74,222,128,0.14)', text: 'var(--bull)' };
  if (r < -0.5) return { bg: 'rgba(255,51,85,0.28)', text: 'var(--bear)' };
  if (r < -0.25) return { bg: 'rgba(255,51,85,0.14)', text: 'var(--bear)' };
  return { bg: 'rgba(140,140,160,0.08)', text: 'var(--muted)' };
}

function interpret(cells: { a: string; b: string; r: number }[]): string | null {
  const strong = cells.filter((c) => Math.abs(c.r) >= 0.5);
  if (strong.length === 0) return null;
  const top = strong.reduce((acc, c) => (Math.abs(c.r) > Math.abs(acc.r) ? c : acc));
  const dir = top.r > 0 ? 'corrélé' : 'anti-corrélé';
  const sense = top.r > 0
    ? 'mouvements conjoints'
    : 'rotation défensive';
  return `BTC ${dir} à ${(Math.abs(top.r) * 100).toFixed(0)}% avec ${top.b} (7j) → ${sense}.`;
}

export default function CorrelationTable() {
  const { cells, isLoading, error } = useCorrMatrix(['7d']);

  const matrix = useMemo(() => {
    const map = new Map<string, number>();
    for (const c of cells) {
      const a = c.a.toUpperCase();
      const b = c.b.toUpperCase();
      if (ASSETS_A.includes(a) && ASSETS_B.includes(b)) {
        map.set(`${a}|${b}`, c.r);
      } else if (ASSETS_A.includes(b) && ASSETS_B.includes(a)) {
        map.set(`${b}|${a}`, c.r);
      }
    }
    return map;
  }, [cells]);

  const insight = useMemo(() => {
    const btcCells = Array.from(matrix.entries())
      .filter(([k]) => k.startsWith('BTC|'))
      .map(([k, r]) => ({ a: 'BTC', b: k.split('|')[1], r }));
    return interpret(btcCells);
  }, [matrix]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Corrélation 7j · BTC/ETH/SOL vs macro
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {error ? 'err' : isLoading ? 'load' : 'live'}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.6rem] border-collapse">
          <thead>
            <tr>
              <th className="text-left text-[var(--muted)] uppercase tracking-[1px] font-normal py-1 px-2">
                asset
              </th>
              {ASSETS_B.map((b) => (
                <th
                  key={b}
                  className="text-center text-[var(--muted)] uppercase tracking-[1px] font-normal py-1 px-1.5"
                >
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ASSETS_A.map((a) => (
              <tr key={a} className="border-t border-[var(--border)]">
                <td className="py-1 px-2 text-[var(--text)] uppercase tracking-[1px] font-semibold">
                  {a}
                </td>
                {ASSETS_B.map((b) => {
                  const r = matrix.get(`${a}|${b}`);
                  const display = r != null && Number.isFinite(r) ? r.toFixed(2) : '—';
                  const c = corrColor(r ?? NaN);
                  return (
                    <td key={b} className="py-1 px-1 text-center">
                      <span
                        className="inline-block tabular-nums px-1.5 py-0.5 rounded-[2px] min-w-[2.5em]"
                        style={{ background: c.bg, color: c.text }}
                        title={r != null ? `r = ${r.toFixed(3)}` : 'no data'}
                      >
                        {display}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="font-mono text-[0.55rem] text-[var(--muted)] leading-tight pt-2">
        {insight ?? 'Pas de corrélation forte (>50%) détectée sur 7j.'}
      </div>
      <div className="font-mono text-[0.5rem] text-[var(--dim)] pt-0.5">
        Cells vides = données indisponibles. Refresh 5min via /api/macro/corr-matrix.
      </div>
    </div>
  );
}
