'use client';

import { ResponsiveContainer, LineChart, Line, YAxis, Tooltip } from 'recharts';

/**
 * Mini-série temporelle microstructure (κ×ε, spread, slippage). Données:
 * collector VPS, jamais fabriquées. Ligne horizontale optionnelle = seuil
 * configuré (non universel).
 */
export default function ToxicitySparkline({
  series,
  threshold,
  color,
  label = 'κ × ε',
  decimals = 3,
}: {
  series: [number, number][];
  threshold?: number;
  color: string;
  label?: string;
  decimals?: number;
}) {
  if (!series || series.length < 2) {
    return (
      <div className="h-[40px] flex items-center justify-center font-mono text-[0.5rem] text-[var(--muted)]">
        SÉRIE INSUFFISANTE
      </div>
    );
  }
  const data = series.map(([t, v]) => ({ t, v }));
  return (
    <div className="h-[40px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Tooltip
            contentStyle={{
              background: 'var(--bg2)',
              border: '1px solid var(--border)',
              fontSize: '0.55rem',
              fontFamily: 'monospace',
            }}
            labelFormatter={(t) => new Date(Number(t)).toLocaleTimeString()}
            formatter={(value) => [Number(value).toFixed(decimals), label]}
          />
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.2} dot={false} isAnimationActive={false} />
          {threshold != null && (
            <Line
              type="monotone"
              dataKey={() => threshold}
              stroke="var(--muted)"
              strokeDasharray="3 3"
              strokeWidth={0.8}
              dot={false}
              isAnimationActive={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
