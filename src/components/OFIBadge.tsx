/**
 * OFI BADGE — Displays OFI direction, strength, and continuation probability
 */

'use client';

import React from 'react';

interface OFIBadgeProps {
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  pContinuation: number;
  ofiScore: number;
}

const DIRECTION_COLORS = {
  BUY: {
    bg: '#0d2b1d',
    border: '#00ff88',
    text: '#00ff88',
    arrow: '▲'
  },
  SELL: {
    bg: '#2b0d0d',
    border: '#ff4444',
    text: '#ff4444',
    arrow: '▼'
  },
  NEUTRAL: {
    bg: '#1a1a2e',
    border: '#666',
    text: '#999',
    arrow: '◆'
  }
};

export function OFIBadge({ direction, strength, pContinuation, ofiScore }: OFIBadgeProps) {
  const colors = DIRECTION_COLORS[direction];
  const arrow = colors.arrow;
  const strengthChar = strength === 'STRONG' ? 'S' : strength === 'MODERATE' ? 'M' : 'W';
  const pct = Math.round(pContinuation * 100);

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '3px 8px',
      borderRadius: '6px',
      background: colors.bg,
      border: `1px solid ${colors.border}33`,
      fontSize: '11px',
      fontFamily: 'ui-monospace, SFMono-Regular, Monaco, monospace',
      cursor: 'default',
    }}>
      <span style={{ color: colors.text, fontWeight: 700, fontSize: '12px' }}>
        {arrow} {direction}
      </span>
      <span style={{ color: '#555' }}>·</span>
      <span style={{ color: '#ccc', fontWeight: 600 }}>{strengthChar}</span>
      <span style={{ color: '#555' }}>·</span>
      <span style={{ color: colors.text, fontWeight: 600 }}>{pct}%</span>
    </div>
  );
}
