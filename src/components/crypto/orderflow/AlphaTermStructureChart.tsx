'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot,
} from 'recharts';

import { useOrderflowStatus } from '@/hooks/api/useOrderflowStatus';

const HORIZONS = ['1m', '5m', '15m', '1h'];
const MODELS = ['ARX', 'MLP', 'LSTM', 'CNN-LSTM'] as const;

const MODEL_COLOR: Record<string, string> = {
  ARX: 'rgb(140,180,255)',
  MLP: 'rgb(180,140,255)',
  LSTM: 'rgb(74,222,128)',
  'CNN-LSTM': 'rgb(255,170,80)',
};

export default function AlphaTermStructureChart() {
  const { data, isLoading, isStale } = useOrderflowStatus();

  const symbol = data?.symbols?.[0] ?? 'BTCUSDT';
  const snapshot = data?.alpha_term_structure_snapshot?.[symbol] ?? {};

  const chartData = useMemo(() => {
    return HORIZONS.map((h) => {
      const row: Record<string, number | string> = { horizon: h };
      for (const m of MODELS) {
        row[m] = snapshot?.[h]?.[m] ?? 0;
      }
      return row;
    });
  }, [snapshot]);

  const peak = useMemo(() => {
    let best: { horizon: string; model: string; sh: number } | null = null;
    for (const h of HORIZONS) {
      for (const m of MODELS) {
        const sh = snapshot?.[h]?.[m] ?? 0;
        if (!best || sh > best.sh) best = { horizon: h, model: m, sh };
      }
    }
    return best;
  }, [snapshot]);

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[260px] animate-pulse" />
    );
  }

  const peakX = peak?.horizon ?? '1m';
  const peakY = peak?.sh ?? 0;
  const bestModel = data.best_model_per_asset?.[symbol];

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Alpha Term Structure · {symbol}
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {isStale ? '⚠ STALE · ' : ''}
          {bestModel ? `peak ${bestModel.model} @ ${bestModel.horizon} (Sh ${bestModel.sh_oos.toFixed(2)})` : 'no model'}
        </span>
      </div>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <LineChart data={chartData} margin={{ top: 8, right: 10, bottom: 4, left: -16 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" vertical={false} />
            <XAxis dataKey="horizon" tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'monospace' }} stroke="var(--border)" />
            <YAxis tick={{ fill: 'var(--muted)', fontSize: 10, fontFamily: 'monospace' }} stroke="var(--border)" />
            <Tooltip
              contentStyle={{
                background: 'var(--bg2)', border: '1px solid var(--border)',
                fontSize: 10, fontFamily: 'monospace', color: 'var(--label)',
              }}
              labelStyle={{ color: 'var(--label)' }}
            />
            {MODELS.map((m) => (
              <Line
                key={m}
                type="monotone"
                dataKey={m}
                stroke={MODEL_COLOR[m]}
                strokeWidth={1.5}
                dot={{ r: 2, fill: MODEL_COLOR[m] }}
                isAnimationActive={false}
              />
            ))}
            {peak && peak.sh > 0.1 && (
              <ReferenceDot
                x={peakX}
                y={peakY}
                r={4}
                fill="var(--bull)"
                stroke="var(--bg2)"
                strokeWidth={1}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="font-mono text-[0.45rem] text-[var(--muted)] mt-1 flex gap-3 flex-wrap">
        {MODELS.map((m) => (
          <span key={m} style={{ color: MODEL_COLOR[m] }}>■ {m}</span>
        ))}
        <span className="text-[var(--dim)]">· Sh annualisé par horizon × model</span>
      </div>
    </div>
  );
}
