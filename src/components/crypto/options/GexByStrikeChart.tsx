'use client';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { GammaRegime, StrikeExposure } from '@/lib/options/types';
import { compactUSD, fmtStrike } from '@/lib/options/format';

interface GexByStrikeChartProps {
  strikes: StrikeExposure[];
  spot: number | null;
  sourceTs: string | null;
  gammaRegime?: GammaRegime;
}

interface Point {
  strike: number;
  netGex: number;
  callGex: number;
  putGex: number;
  callOi: number;
  putOi: number;
  expiries: string;
}

const REGIME_STYLE: Record<GammaRegime, { bg: string; border: string; text: string }> = {
  positive: {
    bg: 'rgba(74,222,128,0.05)',
    border: 'var(--bull)',
    text: 'var(--bull)',
  },
  negative: {
    bg: 'rgba(255,51,85,0.05)',
    border: 'var(--bear)',
    text: 'var(--bear)',
  },
  neutral: {
    bg: 'rgba(140,140,160,0.03)',
    border: 'var(--muted)',
    text: 'var(--muted)',
  },
  unknown: {
    bg: 'transparent',
    border: 'var(--border)',
    text: 'var(--muted)',
  },
};

function decimateLabels(strikes: number[], maxLabels = 8): Set<number> {
  if (strikes.length <= maxLabels) return new Set(strikes);
  const step = Math.ceil(strikes.length / maxLabels);
  const out = new Set<number>();
  for (let i = 0; i < strikes.length; i += step) out.add(strikes[i]);
  out.add(strikes[strikes.length - 1]);
  return out;
}

export default function GexByStrikeChart({ strikes, spot, sourceTs, gammaRegime = 'unknown' }: GexByStrikeChartProps) {
  const data: Point[] = useMemo(
    () =>
      strikes.map((s) => ({
        strike: s.strike,
        netGex: s.netGex,
        callGex: s.callGex,
        putGex: s.putGex,
        callOi: s.callOi,
        putOi: s.putOi,
        expiries: s.expiries.join(','),
      })),
    [strikes],
  );

  const labelSet = useMemo(() => decimateLabels(strikes.map((s) => s.strike)), [strikes]);
  const g = REGIME_STYLE[gammaRegime];

  return (
    <div
      className="border border-[var(--border)] border-l-[3px] rounded-[4px]"
      style={{ background: `var(--bg2)`, borderLeftColor: g.border }}
    >
      <div
        className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between"
        style={{ background: g.bg }}
      >
        <div
          className="font-mono text-[0.6rem] uppercase tracking-[2px] font-semibold"
          style={{ color: g.text }}
        >
          GEX · {gammaRegime}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          USD / 1% spot · provider net
        </div>
      </div>
      <div className="p-2 h-[200px]">
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center font-mono text-[0.6rem] text-[var(--muted)]">
            No strikes
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} syncId="options-strikes" margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" vertical={false} />
              <XAxis
                dataKey="strike"
                tick={{ fill: 'var(--muted)', fontSize: 9, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                tickFormatter={(v: number) => (labelSet.has(v) ? fmtStrike(v, 0) : '')}
                minTickGap={0}
              />
              <YAxis
                tick={{ fill: 'var(--muted)', fontSize: 9, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                width={48}
                tickFormatter={(v: number) => compactUSD(v)}
              />
              <Tooltip
                cursor={{ fill: 'rgba(232,236,242,0.04)' }}
                contentStyle={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  fontFamily: 'monospace',
                  fontSize: 10,
                }}
                labelFormatter={(label: unknown) =>
                  `Strike ${fmtStrike(Number(label), 0)}`
                }
                formatter={(value: unknown, name: unknown) => {
                  if (name === 'netGex') return [compactUSD(Number(value)), 'Net GEX'];
                  return [compactUSD(Number(value)), String(name)];
                }}
              />
              <ReferenceLine y={0} stroke="var(--border)" />
              {spot != null && (
                <ReferenceLine
                  x={spot}
                  stroke="var(--text)"
                  strokeDasharray="3 3"
                  label={{ value: 'Spot', fill: 'var(--text)', fontSize: 9, position: 'top' }}
                />
              )}
              <Bar dataKey="netGex" isAnimationActive={false}>
                {data.map((p, i) => (
                  <Cell key={i} fill={p.netGex >= 0 ? 'var(--bull)' : 'var(--bear)'} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {sourceTs && (
        <div className="px-3 py-0.5 font-mono text-[0.5rem] text-[var(--dim)] border-t border-[var(--border)]">
          source ts: {sourceTs}
        </div>
      )}
    </div>
  );
}
