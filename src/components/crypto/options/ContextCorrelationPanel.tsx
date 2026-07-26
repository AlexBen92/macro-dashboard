'use client';

import { useMemo } from 'react';
import { computeContextBadge } from '@/lib/options/context-badge';
import type { CorrCellLike, ContextBadge } from '@/lib/options/types';
import MacroCorrelationMatrix from '@/components/crypto/MacroCorrelationMatrix';
import { useCorrMatrix } from '@/hooks/api/useCorrMatrix';

interface ContextCorrelationPanelProps {
  ctxWindow?: '24h' | '7d' | '30d';
}

interface BadgeStyle {
  bg: string;
  border: string;
  text: string;
  label: string;
  emoji: string;
}

const BADGE_STYLE: Record<ContextBadge, BadgeStyle> = {
  'risk-on': {
    bg: 'rgba(74,222,128,0.08)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    label: 'Risk-on',
    emoji: '🟢',
  },
  'risk-off': {
    bg: 'rgba(255,51,85,0.08)',
    border: 'var(--bear)',
    text: 'var(--bear)',
    label: 'Risk-off',
    emoji: '🔴',
  },
  mixed: {
    bg: 'rgba(255,170,0,0.07)',
    border: 'var(--caution)',
    text: 'var(--caution)',
    label: 'Mixed',
    emoji: '🟡',
  },
  insufficient: {
    bg: 'rgba(140,140,160,0.05)',
    border: 'var(--muted)',
    text: 'var(--muted)',
    label: 'Insufficient data',
    emoji: '⚪',
  },
  not_configured: {
    bg: 'rgba(140,140,160,0.04)',
    border: 'var(--border)',
    text: 'var(--muted)',
    label: 'Not configured',
    emoji: '—',
  },
};

export default function ContextCorrelationPanel({ ctxWindow = '7d' }: ContextCorrelationPanelProps) {
  const { cells } = useCorrMatrix([ctxWindow]);
  const cellsLike: CorrCellLike[] = useMemo(
    () => cells.map((c) => ({ a: c.a, b: c.b, r: c.r, window: c.window, n: c.n })),
    [cells],
  );
  const ctx = useMemo(() => computeContextBadge(cellsLike), [cellsLike]);
  const s = BADGE_STYLE[ctx.badge];

  return (
    <div
      className="border border-[var(--border)] border-l-[3px] rounded-[4px]"
      style={{ background: 'var(--bg2)', borderLeftColor: s.border }}
    >
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Context · Corr
        </div>
        <span className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px]">
          ctx · {ctxWindow}
        </span>
      </div>
      <div
        className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border)]"
        style={{ background: s.bg }}
        title={ctx.evidence.join('\n')}
      >
        <span className="text-sm">{s.emoji}</span>
        <div>
          <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
            Context
          </div>
          <div
            className="font-mono text-[0.65rem] uppercase tracking-[1.5px] font-semibold"
            style={{ color: s.text }}
          >
            {s.label}
          </div>
        </div>
        <span className="ml-auto font-mono text-[0.5rem] text-[var(--dim)]">
          rule {ctx.ruleVersion}
        </span>
      </div>
      <div className="p-2">
        <MacroCorrelationMatrix extraRefs={['VIX', 'MSTR', 'NVDA', 'COIN']} compact />
      </div>
    </div>
  );
}
