'use client';

import { useMemo } from 'react';
import { useEdgeM15Status, type CandleM15 } from '@/hooks/api/useEdgeM15Status';

const W = 800;
const H = 240;
const PAD = { top: 8, right: 60, bottom: 18, left: 8 };

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}

export default function PriceLevelsM15Chart() {
  const { data, isLoading } = useEdgeM15Status();

  const candles: CandleM15[] = data?.candles_m15_last ?? [];

  const view = useMemo(() => {
    if (candles.length < 5) return null;
    const prices = candles.flatMap((c) => [c.h, c.l]);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = range * 0.08;
    const yMin = min - pad;
    const yMax = max + pad;

    const plotW = W - PAD.left - PAD.right;
    const plotH = H - PAD.top - PAD.bottom;
    const xStep = plotW / candles.length;
    const yScale = (p: number) => PAD.top + (1 - (p - yMin) / (yMax - yMin)) * plotH;

    const bodyW = Math.max(1, Math.min(6, xStep * 0.6));
    const bbUpper = data?.verdict_btc?.bb_upper;
    const bbLower = data?.verdict_btc?.bb_lower;

    return {
      candles: candles.map((c, i) => {
        const x = PAD.left + i * xStep + xStep / 2;
        const up = c.c >= c.o;
        return {
          x,
          up,
          wickTop: yScale(c.h),
          wickBot: yScale(c.l),
          bodyTop: yScale(Math.max(c.o, c.c)),
          bodyBot: yScale(Math.min(c.o, c.c)),
          bodyW,
          close: c.c,
          t: c.t,
        };
      }),
      bbUpperY: bbUpper != null ? yScale(bbUpper) : null,
      bbLowerY: bbLower != null ? yScale(bbLower) : null,
      bbUpper,
      bbLower,
      yMin,
      yMax,
      yScale,
      plotH,
      lastClose: candles[candles.length - 1].c,
    };
  }, [candles, data]);

  if (isLoading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] h-[260px] animate-pulse" />
    );
  }
  if (!view) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 font-mono text-[0.6rem] text-[var(--muted)] h-[260px] flex items-center justify-center">
        Bougies M15 indisponibles — export cron 15min en attente
      </div>
    );
  }

  const last = view.candles[view.candles.length - 1];
  const ticks = [view.yMin, (view.yMin + view.yMax) / 2, view.yMax];

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          BTC M15 · 24h
        </span>
        <span className="font-mono text-[0.55rem] text-[var(--text)]">
          ${view.lastClose.toFixed(1)}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[240px]" preserveAspectRatio="none">
        <line
          x1={PAD.left} y1={view.bbUpperY ?? -1}
          x2={W - PAD.right} y2={view.bbUpperY ?? -1}
          stroke="var(--caution)" strokeOpacity="0.4" strokeDasharray="2 4"
        />
        <line
          x1={PAD.left} y1={view.bbLowerY ?? -1}
          x2={W - PAD.right} y2={view.bbLowerY ?? -1}
          stroke="var(--caution)" strokeOpacity="0.4" strokeDasharray="2 4"
        />
        {view.bbUpperY != null && (
          <text x={W - PAD.right + 4} y={(view.bbUpperY ?? 0) + 3}
                fill="var(--caution)" fontSize="9" fontFamily="monospace">
            BB↑
          </text>
        )}
        {view.bbLowerY != null && (
          <text x={W - PAD.right + 4} y={(view.bbLowerY ?? 0) + 3}
                fill="var(--caution)" fontSize="9" fontFamily="monospace">
            BB↓
          </text>
        )}

        {view.candles.map((c, i) => {
          const color = c.up ? 'var(--bull)' : 'var(--bear)';
          return (
            <g key={i}>
              <line
                x1={c.x} x2={c.x}
                y1={c.wickTop} y2={c.wickBot}
                stroke={color} strokeWidth="1"
              />
              <rect
                x={c.x - c.bodyW / 2}
                y={c.bodyTop}
                width={c.bodyW}
                height={Math.max(1, c.bodyBot - c.bodyTop)}
                fill={color}
                opacity={0.85}
              />
            </g>
          );
        })}

        <line
          x1={last.x} y1={PAD.top}
          x2={last.x} y2={H - PAD.bottom}
          stroke="var(--label)" strokeOpacity="0.25" strokeDasharray="2 2"
        />

        {ticks.map((t, i) => (
          <text
            key={i}
            x={W - PAD.right + 4}
            y={view.yScale(t) + 3}
            fill="var(--muted)"
            fontSize="9"
            fontFamily="monospace"
          >
            {t.toFixed(0)}
          </text>
        ))}

        <text x={PAD.left} y={H - 4} fill="var(--dim)" fontSize="9" fontFamily="monospace">
          {fmtTime(view.candles[0].t)} UTC
        </text>
        <text x={W - PAD.right - 60} y={H - 4}
              fill="var(--dim)" fontSize="9" fontFamily="monospace" textAnchor="end">
          {fmtTime(last.t)} UTC
        </text>
      </svg>

      <div className="font-mono text-[0.5rem] text-[var(--muted)] px-1 pt-1 flex gap-3">
        <span><span style={{ color: 'var(--caution)' }}>— —</span> BB[20,2]</span>
        <span><span style={{ color: 'var(--bull)' }}>█</span> up · <span style={{ color: 'var(--bear)' }}>█</span> down</span>
        <span className="ml-auto">source: Hyperliquid M15 · 96 bougies</span>
      </div>
    </div>
  );
}
