'use client';

import { useMemo } from 'react';
import { computeContextBadge } from '@/lib/options/context-badge';
import type { CorrCellLike, ContextBadge } from '@/lib/options/types';
import MacroCorrelationMatrix from '@/components/crypto/MacroCorrelationMatrix';
import { useCorrMatrix } from '@/hooks/api/useCorrMatrix';

interface ContextCorrelationPanelProps {
  ctxWindow?: '24h' | '7d' | '30d';
}

const BADGE_COLOR: Record<ContextBadge, string> = {
  'risk-on': 'var(--bull)',
  'risk-off': 'var(--bear)',
  mixed: 'var(--caution)',
  insufficient: 'var(--muted)',
  not_configured: 'var(--muted)',
};

const BADGE_LABEL: Record<ContextBadge, string> = {
  'risk-on': 'Risk-on',
  'risk-off': 'Risk-off',
  mixed: 'Mixed',
  insufficient: 'Insufficient',
  not_configured: 'Not configured',
};

export default function ContextCorrelationPanel({ ctxWindow = '7d' }: ContextCorrelationPanelProps) {
  const { cells } = useCorrMatrix([ctxWindow]);
  const cellsLike: CorrCellLike[] = useMemo(
    () => cells.map((c) => ({ a: c.a, b: c.b, r: c.r, window: c.window, n: c.n })),
    [cells],
  );
  const ctx = useMemo(() => computeContextBadge(cellsLike), [cellsLike]);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Context · Corr
        </div>
        <span className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px]">
          ctx · {ctxWindow}
        </span>
      </div>
      <div className="px-3 py-2 flex items-center gap-2 border-b border-[var(--border)]">
        <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1.5px]">
          Context
        </div>
        <span
          className="px-2 py-0.5 rounded-[3px] border font-mono text-[0.6rem] uppercase tracking-[1.5px]"
          style={{
            color: BADGE_COLOR[ctx.badge],
            borderColor: `${BADGE_COLOR[ctx.badge]}55`,
            background: `${BADGE_COLOR[ctx.badge]}11`,
          }}
          title={ctx.evidence.join('\n')}
        >
          {BADGE_LABEL[ctx.badge]}
        </span>
        <span className="ml-auto font-mono text-[0.5rem] text-[var(--dim)]">
          rule {ctx.ruleVersion}
        </span>
      </div>
      <div className="p-2">
        <MacroCorrelationMatrix />
      </div>
    </div>
  );
}
