'use client';

import { useEffect, useMemo, useState } from 'react';
import universe from '@/config/markets-universe.json';
import type { TrendResult } from '@/lib/engines/trend';
import {
  correlationMatrix,
  pricesToLogReturns,
  type CorrCell,
} from '@/lib/engines/correlation';
import { flatClusters } from '@/lib/engines/clustering';

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

const liquid = universe.liquid_basket as UniverseEntry[];

interface Close5y {
  ticker: string;
  closes: number[];
}

function corrOf(corr: CorrCell[], a: string, b: string): number | null {
  for (const c of corr) {
    if ((c.a === a && c.b === b) || (c.a === b && c.b === a)) return c.r;
  }
  return null;
}

function trendColor(t: TrendResult | null): string {
  if (!t) return 'var(--dim)';
  if (t.direction === 'bull') return 'var(--bull)';
  if (t.direction === 'bear') return 'var(--bear)';
  return 'var(--muted)';
}

function corrColor(r: number | null): string {
  if (r == null) return 'var(--dim)';
  if (r > 0.6) return 'var(--bear)';
  if (r > 0.3) return 'var(--caution)';
  if (r < -0.3) return 'var(--info)';
  return 'var(--muted)';
}

export default function LiquidBasketTable({ trends }: Props) {
  const [series, setSeries] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const results = await Promise.all(
        liquid.map(async (it) => {
          try {
            const res = await fetch(
              `/api/markets/ohlc?ticker=${encodeURIComponent(it.ticker)}&interval=1d&range=5y`,
            );
            if (!res.ok) return { ticker: it.ticker, closes: [] as number[] };
            const json = await res.json();
            const bars: Array<{ close: number }> = json.bars ?? [];
            const closes = bars
              .map((b) => b.close)
              .filter((x) => typeof x === 'number' && isFinite(x));
            return { ticker: it.ticker, closes };
          } catch {
            return { ticker: it.ticker, closes: [] as number[] };
          }
        }),
      );
      if (cancelled) return;
      const map: Record<string, number[]> = {};
      for (const r of results) map[r.ticker] = r.closes;
      setSeries(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const returns = useMemo(() => {
    const out: Record<string, number[]> = {};
    for (const k of Object.keys(series)) {
      out[k] = pricesToLogReturns(series[k]);
    }
    return out;
  }, [series]);

  const corr60 = useMemo(() => correlationMatrix(returns, 60), [returns]);
  const corr120 = useMemo(() => correlationMatrix(returns, 120), [returns]);
  const corr252 = useMemo(() => correlationMatrix(returns, 252), [returns]);

  const clusters = useMemo(() => {
    const tickers = liquid.map((x) => x.ticker);
    return flatClusters(corr252, tickers, 0.4);
  }, [corr252]);

  const esCluster = (clusters as Record<string, number>)['ES=F'] ?? null;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase mb-3">
        LIQUID BASKET <span className="text-[0.58rem] text-[var(--muted)] ml-2">9 majors · corr vs ES=F · cluster flag |r|&gt;0.4</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.62rem] min-w-[900px]">
          <thead>
            <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
              <th className="text-left py-2 pr-3">Asset</th>
              <th className="text-left py-2 px-2">Trend D</th>
              <th className="text-left py-2 px-2">Trend 4H</th>
              <th className="text-right py-2 px-2">ADX D</th>
              <th className="text-right py-2 px-2">Corr 60d</th>
              <th className="text-right py-2 px-2">Corr 120d</th>
              <th className="text-right py-2 px-2">Corr 252d</th>
              <th className="text-left py-2 pl-2">Cluster</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {liquid.map((it) => {
              const t = trends[it.ticker];
              const r60 = corrOf(corr60, 'ES=F', it.ticker);
              const r120 = corrOf(corr120, 'ES=F', it.ticker);
              const r252 = corrOf(corr252, 'ES=F', it.ticker);
              const sameCluster =
                esCluster != null &&
                (clusters as Record<string, number>)[it.ticker] === esCluster &&
                it.ticker !== 'ES=F' &&
                (r252 != null && Math.abs(r252) > 0.4);
              return (
                <tr key={it.ticker} className="hover:bg-[var(--bg3)]">
                  <td className="py-1.5 pr-3">
                    <div className="text-[var(--label)]">{it.name}</div>
                    <div className="text-[var(--muted)] text-[0.52rem] uppercase tracking-[1px]">{it.ticker}</div>
                  </td>
                  <td className="py-1.5 px-2 uppercase tracking-[1px] font-semibold" style={{ color: trendColor(t?.daily ?? null) }}>
                    {t?.daily ? t.daily.direction : '—'}
                  </td>
                  <td className="py-1.5 px-2 uppercase tracking-[1px] font-semibold" style={{ color: trendColor(t?.h4 ?? null) }}>
                    {t?.h4 ? t.h4.direction : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right text-[var(--dim)]">
                    {t?.daily ? t.daily.adx.toFixed(0) : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right" style={{ color: corrColor(r60) }}>
                    {r60 == null ? '—' : r60.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-right" style={{ color: corrColor(r120) }}>
                    {r120 == null ? '—' : r120.toFixed(2)}
                  </td>
                  <td className="py-1.5 px-2 text-right" style={{ color: corrColor(r252) }}>
                    {r252 == null ? '—' : r252.toFixed(2)}
                  </td>
                  <td className="py-1.5 pl-2">
                    {sameCluster ? (
                      <span className="px-1.5 py-0.5 rounded-[2px] text-[0.5rem] uppercase tracking-[1px] bg-[var(--caution)]/15 text-[var(--caution)] border border-[var(--caution)]/30">
                        cluster ES
                      </span>
                    ) : (
                      <span className="text-[var(--dim)] text-[0.5rem]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loading && (
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
          loading 5y closes for correlation...
        </div>
      )}
    </div>
  );
}
