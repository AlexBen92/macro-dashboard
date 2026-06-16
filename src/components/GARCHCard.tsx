// components/GARCHCard.tsx
import React from 'react';
import type { GARCHOutput } from '@/lib/garch-engine';

interface Props {
  output: GARCHOutput;
  asset: string;
}

export function GARCHCard({ output, asset }: Props) {
  const annualVol = (Math.sqrt(output.sigma2_next * 365 * 24 * 3600) * 100).toFixed(1);
  const vr = output.vol_ratio.toFixed(2);
  const phi = (output.phi * 100).toFixed(1);

  const regimeColors: Record<string, string> = {
    NORMAL:     '#00cc66',
    COMPRESSED: '#4488ff',
    ELEVATED:   '#ff8800',
    EXPLOSIVE:  '#ff2222',
  };
  const color = regimeColors[output.regime];

  return (
    <div style={{
      background: '#0d0d14', border: `1px solid ${color}33`,
      borderRadius: 8, padding: 12, flex: 1,
    }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
        📊 GARCH — {asset}
      </div>

      {/* Regime badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: `${color}15`, border: `1px solid ${color}`,
        borderRadius: 4, padding: '3px 8px', marginBottom: 12,
      }}>
        <span style={{ color, fontSize: 12, fontWeight: 700 }}>{output.regimeLabel}</span>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { label: 'vol_ratio',  value: vr,            color: parseFloat(vr) > 1.5 ? '#ff8800' : '#ccc' },
          { label: 'φ (α+β)',   value: `${phi}%`,      color: parseFloat(phi) > 97 ? '#ff8800' : '#ccc' },
          { label: 'σ²_next',   value: output.sigma2_next.toExponential(2), color: '#ccc' },
          { label: 'Ann. Vol',  value: `${annualVol}%`, color: '#ccc' },
        ].map(({ label, value, color: c }) => (
          <div key={label} style={{ background: '#0a0a10', borderRadius: 6, padding: '6px 8px' }}>
            <div style={{ fontSize: 9, color: '#666' }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: c, fontFamily: 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Multi-horizon projection mini-bar */}
      <div style={{ marginTop: 10 }}>
        <div style={{ fontSize: 9, color: '#666', marginBottom: 4 }}>σ² projection →</div>
        <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 24 }}>
          {[
            { label: '1s',  val: output.sigma2_h.s1 },
            { label: '2.5s',val: output.sigma2_h.s5 },
            { label: '5s',  val: output.sigma2_h.s10 },
            { label: '10s', val: output.sigma2_h.s20 },
          ].map(({ label, val }) => {
            const pct = Math.min(1, val / Math.max(output.sigma2_h.s20, 1e-9));
            const barColor = val > output.sigma2_next ? '#ff8800' : '#00cc66';
            return (
              <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{
                  width: '100%', height: Math.max(4, pct * 20),
                  background: barColor, borderRadius: 2, opacity: 0.8
                }} />
                <span style={{ fontSize: 8, color: '#555' }}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
