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
import { useMarketOHLC } from '@/hooks/api/useMarketOHLC';
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

function tfToYahoo(tf: Timeframe): {
  interval: '1h' | '1d';
  range: '1mo' | '3mo';
  label: string;
} {
  switch (tf) {
    case 'H4':
      return { interval: '1h', range: '3mo', label: 'H1 × 3mo (H4 proxy)' };
    case 'H1':
      return { interval: '1h', range: '1mo', label: 'H1 × 1mo' };
    case 'M15':
    default:
      return { interval: '1h', range: '1mo', label: 'M15 not exposed by Yahoo — showing H1' };
  }
}

function yahooTicker(symbol: 'BTC' | 'ETH'): string {
  return symbol === 'BTC' ? 'BTC=F' : 'ETH=F';
}

export default function PriceLevelsChart({ symbol, timeframe, levels }: PriceLevelsChartProps) {
  const cfg = tfToYahoo(timeframe);
  const { bars, isLoading, error } = useMarketOHLC(
    yahooTicker(symbol),
    cfg.interval,
    cfg.range,
  );

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
          Price · {symbol} · {cfg.label}
        </div>
        {timeframe === 'M15' && (
          <div className="font-mono text-[0.5rem] text-[var(--caution)] uppercase tracking-[1px]">
            M15 fallback
          </div>
        )}
      </div>
      <div className="p-2 h-[260px]">
        {isLoading && (
          <div className="h-full w-full animate-pulse bg-[var(--bg3)] rounded-[3px]" />
        )}
        {!isLoading && error && (
          <div className="h-full flex items-center justify-center font-mono text-[0.6rem] text-[var(--bear)]">
            OHLC unavailable — {error}
          </div>
        )}
        {!isLoading && !error && data.length === 0 && (
          <div className="h-full flex items-center justify-center font-mono text-[0.6rem] text-[var(--muted)]">
            No OHLC bars
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
