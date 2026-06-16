// components/StyleBadge.tsx
import React from 'react';
import type { ScalpStyle } from '@/lib/garch-engine';

const STYLE_MAP: Record<ScalpStyle, { color: string; label: string; icon: string }> = {
  TREND:     { color: '#00cc66', label: 'TREND',   icon: '📈' },
  MEAN_REV:  { color: '#4488ff', label: 'MR',      icon: '↔️' },
  BREAKOUT:  { color: '#ffaa00', label: 'BREAK',   icon: '💥' },
  NO_TRADE:  { color: '#666',    label: 'SKIP',    icon: '🚫' },
};

interface Props {
  style: ScalpStyle;
  compact?: boolean;
}

export function StyleBadge({ style, compact = false }: Props) {
  const cfg = STYLE_MAP[style];
  return (
    <span style={{
      padding: '2px 5px', borderRadius: 3,
      border: `1px solid ${cfg.color}44`,
      color: cfg.color, fontSize: 10, fontFamily: 'monospace',
    }}>
      {compact ? cfg.label : `${cfg.icon} ${cfg.label}`}
    </span>
  );
}
