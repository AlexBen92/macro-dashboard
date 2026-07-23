'use client';

import { useMemo, useState } from 'react';
import universe from '@/config/markets-universe.json';
import type { TrendResult, TrendDirection } from '@/lib/engines/trend';

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

function cellStyle(dir: TrendDirection, strength: number): React.CSSProperties {
  if (dir === 'range') {
    return {
      background: 'var(--border)',
      color: 'var(--dim)',
      opacity: 0.6 + Math.min(0.4, strength / 200),
    };
  }
  const base = dir === 'bull' ? 'var(--bull)' : 'var(--bear)';
  const opacity = 0.18 + Math.min(0.7, strength / 100 * 0.7);
  return {
    background: `color-mix(in srgb, ${base} ${Math.round(opacity * 100)}%, transparent)`,
    color: base,
    borderColor: base,
  };
}

function Cell({ name, dir, strength }: { name: string; dir: TrendDirection; strength: number }) {
  return (
    <div
      className="px-2 py-1 rounded-[3px] border font-mono text-[0.58rem] uppercase tracking-[1px]"
      style={cellStyle(dir, strength)}
      title={`${name} · ${dir} · strength ${strength}`}
    >
      {name}
    </div>
  );
}

export default function SectorHeatmap({ trends }: Props) {
  const [tf, setTf] = useState<'daily' | 'h4'>('daily');
  const liquid = universe.liquid_basket as UniverseEntry[];
  const edge = universe.edge_watchlist as UniverseEntry[];
  const all = useMemo(() => [...liquid, ...edge], [liquid, edge]);

  const groups = useMemo(() => {
    return SECTOR_ORDER.map((sector) => {
      const items = all
        .filter((x) => x.sector === sector)
        .map((x) => ({ ...x, cell: trends[x.ticker]?.[tf] ?? null }));
      return { sector, items };
    }).filter((g) => g.items.length > 0);
  }, [all, trends, tf]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
          SECTOR HEATMAP
        </div>
        <div className="flex gap-1 font-mono text-[0.6rem]">
          {(['daily', 'h4'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setTf(k)}
              className="px-2 py-0.5 rounded-[3px] tracking-[1px] uppercase transition-colors"
              style={
                tf === k
                  ? { background: 'var(--info)', color: 'var(--bg)' }
                  : { background: 'var(--border)', color: 'var(--muted)' }
              }
            >
              {k === 'daily' ? 'Daily' : '4H'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {groups.map((g) => (
          <div key={g.sector} className="grid grid-cols-[140px_1fr] gap-3 items-start">
            <div className="font-mono text-[0.6rem] text-[var(--dim)] uppercase tracking-[2px] pt-1">
              {SECTOR_LABELS[g.sector] ?? g.sector}
            </div>
            <div className="flex flex-wrap gap-1">
              {g.items.map((it) => {
                const cell = it.cell;
                if (!cell) {
                  return (
                    <div
                      key={it.ticker}
                      className="px-2 py-1 rounded-[3px] border border-[var(--border)] font-mono text-[0.58rem] uppercase tracking-[1px] text-[var(--muted)] opacity-50"
                    >
                      {it.name}
                    </div>
                  );
                }
                return (
                  <Cell
                    key={it.ticker}
                    name={it.name}
                    dir={cell.direction}
                    strength={cell.strength}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center gap-4 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-[2px]" style={{ background: 'var(--bull)', opacity: 0.7 }} />
          Bull
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-[2px]" style={{ background: 'var(--bear)', opacity: 0.7 }} />
          Bear
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-[2px]" style={{ background: 'var(--border)' }} />
          Range
        </div>
        <div className="ml-auto">opacity = strength</div>
      </div>
    </div>
  );
}
