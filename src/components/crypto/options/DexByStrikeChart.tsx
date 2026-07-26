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
import type { StrikeExposure } from '@/lib/options/types';
import { compactUSD, fmtStrike } from '@/lib/options/format';

interface DexByStrikeChartProps {
  strikes: StrikeExposure[];
  spot: number | null;
}

interface Point {
  strike: number;
  netDex: number;
  callDex: number;
  putDex: number;
}

function decimateLabels(strikes: number[], maxLabels = 8): Set<number> {
  if (strikes.length <= maxLabels) return new Set(strikes);
  const step = Math.ceil(strikes.length / maxLabels);
  const out = new Set<number>();
  for (let i = 0; i < strikes.length; i += step) out.add(strikes[i]);
  out.add(strikes[strikes.length - 1]);
  return out;
}

export default function DexByStrikeChart({ strikes, spot }: DexByStrikeChartProps) {
  const data: Point[] = useMemo(
    () =>
      strikes.map((s) => ({
        strike: s.strike,
        netDex: s.netDex,
        callDex: s.callDex,
        putDex: s.putDex,
      })),
    [strikes],
  );

  const labelSet = useMemo(() => decimateLabels(strikes.map((s) => s.strike)), [strikes]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          DEX by strike
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          USD notional × delta · provider net
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
                  if (name === 'netDex') return [compactUSD(Number(value)), 'Net DEX'];
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
              <Bar dataKey="netDex" isAnimationActive={false}>
                {data.map((p, i) => (
                  <Cell
                    key={i}
                    fill={p.netDex >= 0 ? 'var(--accent)' : 'var(--caution)'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
