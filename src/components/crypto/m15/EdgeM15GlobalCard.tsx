'use client';

import { useEdgeM15Status, type EdgeGlobal } from '@/hooks/api/useEdgeM15Status';

const EDGE_STYLE: Record<EdgeGlobal, {
  bg: string; border: string; text: string; emoji: string; blurb: string;
}> = {
  RANGE_MR: {
    bg: 'rgba(74,222,128,0.08)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    emoji: '🎯',
    blurb: 'CALM + ADX<20 + vol<avg — bandes touchées → MR',
  },
  BREAKOUT: {
    bg: 'rgba(74,222,128,0.08)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    emoji: '🚀',
    blurb: 'BUILDING + ADX>25 + BW expanding — breakout scalp',
  },
  TRANSITION: {
    bg: 'rgba(255,170,0,0.08)',
    border: 'var(--caution)',
    text: 'var(--caution)',
    emoji: '⚠',
    blurb: 'Régime changé <24h — attendre',
  },
  NO_EDGE: {
    bg: 'rgba(140,140,160,0.05)',
    border: 'var(--muted)',
    text: 'var(--muted)',
    emoji: '⏸',
    blurb: 'Conditions M15 insuffisantes — attendre',
  },
  NO_DATA: {
    bg: 'rgba(140,140,160,0.05)',
    border: 'var(--muted)',
    text: 'var(--muted)',
    emoji: '✗',
    blurb: 'Export cron indisponible',
  },
};

export default function EdgeM15GlobalCard() {
  const { data, isLoading } = useEdgeM15Status();

  if (isLoading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[110px] animate-pulse" />
    );
  }

  const edge = data?.edge_global ?? 'NO_DATA';
  const style = EDGE_STYLE[edge];

  return (
    <div
      className="bg-[var(--bg2)] border rounded-[4px] p-3 flex flex-col gap-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Edge M15 Global
        </span>
        <span className="font-mono text-[0.55rem]" style={{ color: style.text }}>
          {style.emoji}
        </span>
      </div>

      <div className="font-mono text-[1.4rem] font-bold leading-none" style={{ color: style.text }}>
        {edge.replace('_', ' ')}
      </div>

      <div className="font-mono text-[0.6rem] text-[var(--muted)] leading-tight">
        {style.blurb}
      </div>

      {data?.verdict_btc && (
        <div className="border-t border-[var(--border)] pt-1.5 mt-0.5">
          <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[1px]">
            Verdict BTC
          </div>
          <div
            className="font-mono text-[0.7rem] font-semibold"
            style={{ color: style.text }}
          >
            {data.verdict_btc.label}
          </div>
        </div>
      )}
    </div>
  );
}
