'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OptionLevel, Timeframe } from '@/lib/options/types';
import { useCryptoCandles } from '@/hooks/api/useCryptoCandles';
import { fmtStrike } from '@/lib/options/format';

interface PriceLevelsChartProps {
  symbol: 'BTC' | 'ETH';
  timeframe: Timeframe;
  levels: {
    callWall: OptionLevel | null;
    putWall: OptionLevel | null;
    zeroGamma: OptionLevel | null;
    hvl: OptionLevel | null;
  };
}

const TF_LABEL: Record<Timeframe, string> = {
  M15: 'M15',
  H1: 'H1',
  H4: 'H4',
};

export default function PriceLevelsChart({ symbol, timeframe, levels }: PriceLevelsChartProps) {
  const { bars, source, error, isLoading } = useCryptoCandles(symbol, timeframe);

  const data = useMemo(
    () =>
      bars.map((b) => ({
        time: b.time * 1000,
        close: b.close,
        label: new Date(b.time * 1000).toLocaleTimeString('en-GB', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      })),
    [bars],
  );

  const anyLevel =
    levels.callWall || levels.putWall || levels.zeroGamma || levels.hvl;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Price · {symbol} · {TF_LABEL[timeframe]}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {source ?? '—'}
        </div>
      </div>
      <div className="p-2 h-[260px]">
        {isLoading && (
          <div className="h-full w-full animate-pulse bg-[var(--bg3)] rounded-[3px]" />
        )}
        {!isLoading && error && (
          <div className="h-full flex items-center justify-center font-mono text-[0.6rem] text-[var(--bear)]">
            Candles unavailable — {error}
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <div className="h-full flex items-center justify-center font-mono text-[0.6rem] text-[var(--muted)]">
            No candles
          </div>
        )}
        {!isLoading && !error && data.length > 0 && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 2" />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--muted)', fontSize: 9, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                minTickGap={40}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: 'var(--muted)', fontSize: 9, fontFamily: 'monospace' }}
                tickLine={false}
                axisLine={{ stroke: 'var(--border)' }}
                width={56}
                tickFormatter={(v: number) => fmtStrike(v, 0)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  fontFamily: 'monospace',
                  fontSize: 10,
                }}
                labelStyle={{ color: 'var(--label)' }}
                formatter={(v: unknown) => [fmtStrike(Number(v), 2), 'Close']}
              />
              {levels.callWall && (
                <ReferenceLine
                  y={levels.callWall.strike}
                  stroke="var(--accent)"
                  strokeDasharray="4 2"
                  label={{ value: 'CW', fill: 'var(--accent)', fontSize: 9, position: 'right' }}
                />
              )}
              {levels.putWall && (
                <ReferenceLine
                  y={levels.putWall.strike}
                  stroke="var(--bear)"
                  strokeDasharray="4 2"
                  label={{ value: 'PW', fill: 'var(--bear)', fontSize: 9, position: 'right' }}
                />
              )}
              {levels.zeroGamma && (
                <ReferenceLine
                  y={levels.zeroGamma.strike}
                  stroke="var(--purple)"
                  strokeDasharray="2 2"
                  label={{ value: 'ZG', fill: 'var(--purple)', fontSize: 9, position: 'left' }}
                />
              )}
              {levels.hvl && (
                <ReferenceLine
                  y={levels.hvl.strike}
                  stroke="var(--caution)"
                  strokeDasharray="1 1"
                  label={{ value: 'HVL', fill: 'var(--caution)', fontSize: 9, position: 'left' }}
                />
              )}
              <Line
                type="monotone"
                dataKey="close"
                stroke="var(--text)"
                strokeWidth={1.25}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {!anyLevel && !isLoading && (
        <div className="px-3 py-1 font-mono text-[0.55rem] text-[var(--muted)] italic border-t border-[var(--border)]">
          No option levels — overlays hidden
        </div>
      )}
    </div>
  );
}
