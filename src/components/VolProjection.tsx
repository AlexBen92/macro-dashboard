/**
 * GARCH VOLATILITY PROJECTION DISPLAY
 * Affiche les projections de volatilité multi-horizons
 */

'use client';

import React from 'react';

interface VolProjectionProps {
  sigma2_1m: number;
  sigma2_5m: number;
  sigma2_15m: number;
  sigma2_1h: number;
  current_vol: number;
}

export function VolProjection({
  sigma2_1m,
  sigma2_5m,
  sigma2_15m,
  sigma2_1h,
  current_vol
}: VolProjectionProps) {
  const vol1m = Math.sqrt(sigma2_1m) * 100;
  const vol5m = Math.sqrt(sigma2_5m) * 100;
  const vol15m = Math.sqrt(sigma2_15m) * 100;
  const vol1h = Math.sqrt(sigma2_1h) * 100;
  const currVol = current_vol * 100;

  const getColor = (vol: number, base: number) => {
    const ratio = vol / Math.max(base, 0.01);
    if (ratio > 1.5) return '#ef4444';
    if (ratio > 1.2) return '#f97316';
    if (ratio > 0.8) return '#22c55e';
    return '#60a5fa';
  };

  const bars = [
    { label: 'Now', vol: currVol, width: 30 },
    { label: '1m', vol: vol1m, sigma2: sigma2_1m },
    { label: '5m', vol: vol5m, sigma2: sigma2_5m },
    { label: '15m', vol: vol15m, sigma2: sigma2_15m },
    { label: '1h', vol: vol1h, sigma2: sigma2_1h },
  ];

  const maxVol = Math.max(...bars.map(b => b.vol));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 3,
      padding: '4px 6px',
      background: '#0a0a14',
      borderRadius: 4,
      border: '1px solid #1e1e32',
    }}>
      {bars.map((bar) => {
        const height = Math.max(4, (bar.vol / maxVol) * 30);
        const color = getColor(bar.vol, currVol);
        return (
          <div key={bar.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
            <div
              style={{
                width: 8,
                height: `${height}px`,
                background: color,
                borderRadius: '2px 2px 0 0',
                minHeight: 4,
              }}
            />
            <span style={{ fontSize: 8, color: '#64748b', fontFamily: 'monospace' }}>
              {bar.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
