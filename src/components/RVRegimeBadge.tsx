/**
 * RV REGIME BADGE — Realized volatility regime indicator
 */

'use client';

import React from 'react';

const REGIME_CONFIG: Record<string, { color: string; label: string; emoji: string }> = {
  LOW:       { color: '#4488ff', label: 'VOL:LOW',  emoji: '🔵' },
  NORMAL:    { color: '#00cc66', label: 'VOL:OK',   emoji: '🟢' },
  HIGH:      { color: '#ff8800', label: 'VOL:HIGH', emoji: '🟠' },
  EXPLOSIVE: { color: '#ff2222', label: 'VOL:💥',   emoji: '🔴' },
};

interface RVRegimeBadgeProps {
  regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXPLOSIVE';
  compact?: boolean;
}

export function RVRegimeBadge({ regime, compact = false }: RVRegimeBadgeProps) {
  const cfg = REGIME_CONFIG[regime] ?? REGIME_CONFIG.NORMAL;

  if (compact) {
    return (
      <span style={{
        padding: '1px 5px',
        borderRadius: '3px',
        background: `${cfg.color}22`,
        border: `1px solid ${cfg.color}44`,
        color: cfg.color,
        fontSize: '9px',
        fontFamily: 'ui-monospace, SFMono-Regular, Monaco, monospace',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}>
        {cfg.emoji}
      </span>
    );
  }

  return (
    <span style={{
      padding: '2px 6px',
      borderRadius: '4px',
      background: `${cfg.color}22`,
      border: `1px solid ${cfg.color}44`,
      color: cfg.color,
      fontSize: '10px',
      fontFamily: 'ui-monospace, SFMono-Regular, Monaco, monospace',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}
