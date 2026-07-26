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
import type { GammaRegime, OptionLevel, Timeframe } from '@/lib/options/types';
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
  gammaRegime?: GammaRegime;
  spot?: number | null;
}

const TF_LABEL: Record<Timeframe, string> = {
  M15: 'M15',
  H1: 'H1',
  H4: 'H4',
};

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

export default function PriceLevelsChart({
  symbol,
  timeframe,
  levels,
  gammaRegime = 'unknown',
  spot,
}: PriceLevelsChartProps) {
  const { bars, source, error, isLoading } = useCryptoCandles(symbol, timeframe);
  const g = REGIME_STYLE[gammaRegime];

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
    <div
      className="border border-[var(--border)] border-l-[3px] rounded-[4px]"
      style={{ background: 'var(--bg2)', borderLeftColor: g.border }}
    >
      <div
        className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between"
        style={{ background: g.bg }}
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
            Price · {symbol} · {TF_LABEL[timeframe]}
          </span>
          {gammaRegime !== 'unknown' && (
            <span
              className="font-mono text-[0.5rem] uppercase tracking-[1.5px] px-1.5 py-0.5 rounded-[2px]"
              style={{
                color: g.text,
                background: `${g.text}11`,
                border: `1px solid ${g.text}44`,
              }}
            >
              γ {gammaRegime}
            </span>
          )}
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {source ?? '—'}
          {spot != null && ` · spot ${fmtStrike(spot, 0)}`}
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
