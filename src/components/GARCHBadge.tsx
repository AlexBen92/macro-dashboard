/**
 * GARCH VOLATILITY REGIME BADGE
 * Affiche le régime de volatilité avec code couleur
 */

'use client';

import React from 'react';

const REGIME_CONFIG = {
  COMPRESSED: {
    color: '#3b82f6',
    bgColor: '#1e3a8a22',
    label: 'VOL:COMPRESSED',
    emoji: '🔵',
    description: 'Vol faible - breakout possible'
  },
  NORMAL: {
    color: '#22c55e',
    bgColor: '#16653422',
    label: 'VOL:NORMAL',
    emoji: '🟢',
    description: 'Vol normale - trading standard'
  },
  ELEVATED: {
    color: '#f97316',
    bgColor: '#7c2d1222',
    label: 'VOL:ELEVATED',
    emoji: '🟠',
    description: 'Vol élevée - réduire taille'
  },
  EXPLOSIVE: {
    color: '#ef4444',
    bgColor: '#7f1d1d22',
    label: 'VOL:EXPLOSIVE',
    emoji: '🔴',
    description: 'Vol explosive - no-trade'
  },
} as const;

const PERSISTENCE_CONFIG = {
  LOW: { color: '#60a5fa', label: 'P:LOW' },
  MODERATE: { color: '#a78bfa', label: 'P:MED' },
  HIGH: { color: '#f87171', label: 'P:HIGH' },
  EXTREME: { color: '#ef4444', label: 'P:EXT' },
} as const;

interface GARCHBadgeProps {
  regime: 'COMPRESSED' | 'NORMAL' | 'ELEVATED' | 'EXPLOSIVE';
  vol_ratio?: number;
  persistence?: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  phi?: number;
  compact?: boolean;
}

export function GARCHBadge({
  regime,
  vol_ratio = 1,
  persistence = 'MODERATE',
  phi = 0.95,
  compact = false
}: GARCHBadgeProps) {
  const cfg = REGIME_CONFIG[regime];
  const pCfg = PERSISTENCE_CONFIG[persistence];

  if (compact) {
    return (
      <span style={{
        padding: '1px 4px',
        borderRadius: 3,
        background: cfg.bgColor,
        border: `1px solid ${cfg.color}44`,
        color: cfg.color,
        fontSize: 9,
        fontFamily: 'monospace',
        fontWeight: 600,
      }}>
        {cfg.label.split(':')[1]}
      </span>
    );
  }

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      borderRadius: 4,
      background: cfg.bgColor,
      border: `1px solid ${cfg.color}44`,
      fontSize: 10,
      fontFamily: 'monospace',
    }}>
      <span style={{ color: cfg.color, fontWeight: 700 }}>{cfg.emoji}</span>
      <span style={{ color: cfg.color }}>{cfg.label.split(':')[1]}</span>
      {vol_ratio && (
        <span style={{ color: '#64748b' }}>×{vol_ratio.toFixed(1)}</span>
      )}
      {phi && (
        <span style={{ color: pCfg.color, fontSize: 9 }}>φ{phi.toFixed(2)}</span>
      )}
    </div>
  );
}
