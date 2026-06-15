/**
 * ACF MINI CHART — Sparkline visualization of autocorrelation lags
 * Shows rho_1 through rho_10 as colored bars
 */

'use client';

import React from 'react';

interface ACFMiniChartProps {
  lags: number[];  // rho_1..rho_10
  width?: number;
  height?: number;
}

export function ACFMiniChart({ lags, width = 80, height = 24 }: ACFMiniChartProps) {
  if (!lags || lags.length === 0) {
    return (
      <span style={{
        color: '#444',
        fontSize: '10px',
        fontFamily: 'monospace'
      }}>
        —
      </span>
    );
  }

  const barWidth = Math.max(1, Math.floor((width - 2) / lags.length) - 1);
  const mid = height / 2;
  const maxBarHeight = mid * 0.9;

  return (
    <svg
      width={width}
      height={height}
      style={{ display: 'block', overflow: 'visible' }}
    >
      {/* Zero line */}
      <line
        x1={0}
        y1={mid}
        x2={width}
        y2={mid}
        stroke="#333"
        strokeWidth={0.5}
      />
      {lags.map((rho, i) => {
        const barH = Math.min(maxBarHeight, Math.abs(rho) * maxBarHeight * 3);
        const x = i * (barWidth + 1) + 1;
        const y = rho > 0 ? mid - barH : mid;
        const color = rho > 0 ? '#00cc66' : '#ff4444';
        const opacity = Math.min(1, Math.abs(rho) * 2 + 0.3);

        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={barH}
            fill={color}
            opacity={opacity}
            rx={0.5}
          />
        );
      })}
    </svg>
  );
}
