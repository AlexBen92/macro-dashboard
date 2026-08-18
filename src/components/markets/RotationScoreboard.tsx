'use client';

import { useMemo } from 'react';
import universe from '@/config/markets-universe.json';
import type { TrendResult } from '@/lib/engines/trend';
import { computeGlobalRotation } from '@/lib/marketRotation';

interface UniverseEntry {
  ticker: string;
  name: string;
  sector: string;
}

interface TrendsMap {
  [ticker: string]: { daily: TrendResult | null; h4: TrendResult | null };
}

interface Props {
  trends: TrendsMap;
}

const SECTOR_ORDER = [
  'equity',
  'rates',
  'fx_g10',
  'fx_em',
  'metals_precious',
  'metals_industrial',
  'energy',
  'grains',
  'softs',
  'livestock',
  'dairy',
  'materials',
  'crypto',
] as const;

const SECTOR_LABELS: Record<string, string> = {
  equity: 'Equity',
  rates: 'Rates',
  fx_g10: 'FX G10',
  fx_em: 'FX EM',
  metals_precious: 'Metals · Precious',
  metals_industrial: 'Metals · Industrial',
  energy: 'Energy',
  grains: 'Grains',
  softs: 'Softs',
  livestock: 'Livestock',
  dairy: 'Dairy',
  materials: 'Materials',
  crypto: 'Crypto',
};

function computeScore(
  tickers: string[],
  trends: TrendsMap,
  tf: 'daily' | 'h4',
): number | null {
  let bull = 0;
  let bear = 0;
  let n = 0;
  for (const t of tickers) {
    const cell = trends[t]?.[tf];
    if (!cell) continue;
    n++;
    if (cell.direction === 'bull') bull++;
    else if (cell.direction === 'bear') bear++;
  }
  if (n === 0) return null;
  return Math.round((100 * (bull - bear)) / n);
}

function colorFor(score: number | null): string {
  if (score == null) return 'var(--dim)';
  if (score > 20) return 'var(--bull)';
  if (score < -20) return 'var(--bear)';
  return 'var(--muted)';
}

export default function RotationScoreboard({ trends }: Props) {
  const liquid = universe.liquid_basket as UniverseEntry[];
  const edge = universe.edge_watchlist as UniverseEntry[];
  const all = useMemo(() => [...liquid, ...edge], [liquid, edge]);

  const rows = useMemo(() => {
    return SECTOR_ORDER.map((sector) => {
      const tickers = all.filter((x) => x.sector === sector).map((x) => x.ticker);
      const daily = computeScore(tickers, trends, 'daily');
      const h4 = computeScore(tickers, trends, 'h4');
      return { sector, n: tickers.length, daily, h4 };
    }).filter((r) => r.n > 0);
  }, [all, trends]);

  const global = useMemo(() => computeGlobalRotation(rows), [rows]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase mb-2">
        ROTATION SCOREBOARD <span className="text-[0.58rem] text-[var(--muted)] ml-2">% bull - % bear</span>
      </div>
      {global && (
        <div className="mb-3 border border-[var(--border)] rounded-[3px] px-2.5 py-1.5 bg-[var(--bg)]">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-mono">
            <span className="text-[0.5rem] uppercase tracking-[2px] text-[var(--muted)]">Régime global</span>
            <span className="text-[0.7rem] font-semibold tracking-[2px]" style={{ color: global.color }}>
              {global.label}
            </span>
            <span className="text-[0.55rem] text-[var(--muted)]" title="Moyenne des scores daily des secteurs avec données">
              moy {global.avg > 0 ? '+' : ''}
              {global.avg.toFixed(1)} · {global.nPos}▲ / {global.nNeg}▼ / {global.nNeutral}—
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[0.55rem]">
            {global.scored.map((r) => {
              const arrow = r.daily > 20 ? '▲' : r.daily < -20 ? '▼' : '—';
              return (
                <span key={r.sector} title={`${SECTOR_LABELS[r.sector] ?? r.sector} : ${r.daily > 0 ? '+' : ''}${r.daily}`}>
                  <span className="text-[var(--dim)]">{SECTOR_LABELS[r.sector] ?? r.sector}</span>{' '}
                  <span style={{ color: colorFor(r.daily) }}>{arrow}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-[1fr_120px_120px] gap-x-3 font-mono text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase pb-2 border-b border-[var(--border)]">
        <div>Sector</div>
        <div className="text-right">Daily</div>
        <div className="text-right">4H</div>
      </div>
      <div className="divide-y divide-[var(--border)]">
        {rows.map((r) => (
          <div
            key={r.sector}
            className="grid grid-cols-[1fr_120px_120px] gap-x-3 items-center py-1.5 font-mono text-[0.7rem]"
          >
            <div className="flex items-center gap-2">
              <span className="text-[var(--dim)] text-[0.55rem] w-4">{r.n}</span>
              <span className="text-[var(--label)]">{SECTOR_LABELS[r.sector] ?? r.sector}</span>
            </div>
            <div className="text-right font-semibold" style={{ color: colorFor(r.daily) }}>
              {r.daily == null ? '—' : `${r.daily > 0 ? '+' : ''}${r.daily}`}
            </div>
            <div className="text-right font-semibold" style={{ color: colorFor(r.h4) }}>
              {r.h4 == null ? '—' : `${r.h4 > 0 ? '+' : ''}${r.h4}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
