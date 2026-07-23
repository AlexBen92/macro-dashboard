'use client';

import universe from '@/config/markets-universe.json';
import type { TrendResult } from '@/lib/engines/trend';

interface UniverseEntry {
  ticker: string;
  name: string;
  sector: string;
  liquidity: 'low' | 'medium';
  catalyst: string;
}

interface TrendsMap {
  [ticker: string]: { daily: TrendResult | null; h4: TrendResult | null };
}

interface Props {
  trends: TrendsMap;
}

const edge = universe.edge_watchlist as UniverseEntry[];

function trendColor(t: TrendResult | null): string {
  if (!t) return 'var(--dim)';
  if (t.direction === 'bull') return 'var(--bull)';
  if (t.direction === 'bear') return 'var(--bear)';
  return 'var(--muted)';
}

function liquidityBadge(liq: string): React.CSSProperties {
  if (liq === 'low') {
    return { background: 'color-mix(in srgb, var(--bear) 18%, transparent)', color: 'var(--bear)', borderColor: 'var(--bear)' };
  }
  return { background: 'color-mix(in srgb, var(--caution) 18%, transparent)', color: 'var(--caution)', borderColor: 'var(--caution)' };
}

export default function EdgeWatchlist({ trends }: Props) {
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase mb-3">
        EDGE WATCHLIST <span className="text-[0.58rem] text-[var(--muted)] ml-2">14 niche markets · potential alpha</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.62rem] min-w-[800px]">
          <thead>
            <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
              <th className="text-left py-2 pr-3">Ticker</th>
              <th className="text-left py-2 px-2">Sector</th>
              <th className="text-left py-2 px-2">Trend D</th>
              <th className="text-left py-2 px-2">Trend 4H</th>
              <th className="text-left py-2 px-2">Liquidity</th>
              <th className="text-left py-2 pl-2">Catalyst</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {edge.map((it) => {
              const t = trends[it.ticker];
              return (
                <tr key={it.ticker} className="hover:bg-[var(--bg3)]">
                  <td className="py-1.5 pr-3">
                    <div className="text-[var(--label)]">{it.name}</div>
                    <div className="text-[var(--muted)] text-[0.52rem] uppercase tracking-[1px]">{it.ticker}</div>
                  </td>
                  <td className="py-1.5 px-2 text-[var(--dim)] uppercase tracking-[1px] text-[0.55rem]">
                    {it.sector}
                  </td>
                  <td className="py-1.5 px-2 uppercase tracking-[1px] font-semibold" style={{ color: trendColor(t?.daily ?? null) }}>
                    {t?.daily ? t.daily.direction : '—'}
                  </td>
                  <td className="py-1.5 px-2 uppercase tracking-[1px] font-semibold" style={{ color: trendColor(t?.h4 ?? null) }}>
                    {t?.h4 ? t.h4.direction : '—'}
                  </td>
                  <td className="py-1.5 px-2">
                    <span
                      className="px-1.5 py-0.5 rounded-[2px] text-[0.5rem] uppercase tracking-[1px] border"
                      style={liquidityBadge(it.liquidity)}
                    >
                      {it.liquidity}
                    </span>
                  </td>
                  <td className="py-1.5 pl-2 text-[var(--dim)] text-[0.55rem] normal-case">
                    {it.catalyst}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
