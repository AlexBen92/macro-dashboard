// components/GARCHRegimeBadge.tsx
import React from 'react';
import type { GARCHOutput } from '@/lib/garch-engine';

const REGIME_MAP = {
  NORMAL:     { color: '#00cc66', icon: '🟢', short: 'NRM' },
  COMPRESSED: { color: '#4488ff', icon: '🔵', short: 'CMP' },
  ELEVATED:   { color: '#ff8800', icon: '🟠', short: 'ELV' },
  EXPLOSIVE:  { color: '#ff2222', icon: '🔴', short: 'EXP' },
};

interface Props {
  output?: GARCHOutput;
  compact?: boolean;
}

export function GARCHRegimeBadge({ output, compact = false }: Props) {
  if (!output) return <span style={{ color: '#444' }}>—</span>;
  const cfg = REGIME_MAP[output.regime];

  if (compact) {
    return (
      <span title={`vol_ratio=${output.vol_ratio.toFixed(2)} φ=${output.phi.toFixed(3)}`}
        style={{
          padding: '2px 6px', borderRadius: 3,
          border: `1px solid ${cfg.color}44`,
          color: cfg.color, fontSize: 10,
          fontFamily: 'monospace', fontWeight: 700,
          cursor: 'help',
        }}>
        {cfg.short}
      </span>
    );
  }

  return (
    <span title={`vol_ratio=${output.vol_ratio.toFixed(2)} φ=${output.phi.toFixed(3)}`}
      style={{
        padding: '2px 6px', borderRadius: 3,
        border: `1px solid ${cfg.color}44`,
        color: cfg.color, fontSize: 10,
        fontFamily: 'monospace', fontWeight: 700,
        cursor: 'help',
      }}>
      {cfg.icon} {cfg.short} {output.vol_ratio.toFixed(2)}
    </span>
  );
}
