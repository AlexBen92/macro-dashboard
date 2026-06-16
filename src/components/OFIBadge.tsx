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
  rho1?: number;  // Premier lag ACF pour décision immédiate
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

export function OFIBadge({ direction, strength, pContinuation, ofiScore, rho1 }: OFIBadgeProps) {
  const colors = DIRECTION_COLORS[direction];
  const arrow = colors.arrow;
  const pct = Math.round(pContinuation * 100);
  const rhoDisplay = rho1 !== undefined ? Math.abs(rho1).toFixed(2) : null;

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '3px',
      padding: '2px 6px',
      borderRadius: '4px',
      background: colors.bg,
      border: `1px solid ${colors.border}33`,
      fontSize: '10px',
      fontFamily: 'ui-monospace, SFMono-Regular, Monaco, monospace',
      cursor: 'default',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: colors.text, fontWeight: 700, fontSize: '11px' }}>
        {arrow}{pct}%
      </span>
      {rhoDisplay !== null && (
        <>
          <span style={{ color: '#444' }}>ρ</span>
          <span style={{ color: rho1 !== undefined && rho1 > 0.3 ? colors.text : '#666', fontWeight: 600 }}>
            {rhoDisplay}
          </span>
        </>
      )}
    </div>
  );
}
