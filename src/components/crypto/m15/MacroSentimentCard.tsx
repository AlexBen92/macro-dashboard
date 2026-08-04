'use client';

import { useEffect, useState } from 'react';

interface AssetCorr {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  correlationBTC: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  category: 'macro' | 'tech' | 'miner' | 'crypto';
}

interface CorrPayload {
  assets: AssetCorr[];
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  compositeScore: number | null;
  regime: string;
}

const MACRO_TICKERS = ['DXY', 'VIX', 'SPX'] as const;

function verdictColor(s: string): {
  bg: string; border: string; text: string; emoji: string;
} {
  const r = (s || '').toLowerCase();
  if (r.includes('bull') || r.includes('risk-on')) {
    return {
      bg: 'rgba(74,222,128,0.08)',
      border: 'var(--bull)',
      text: 'var(--bull)',
      emoji: '🟢',
    };
  }
  if (r.includes('bear') || r.includes('risk-off')) {
    return {
      bg: 'rgba(255,51,85,0.08)',
      border: 'var(--bear)',
      text: 'var(--bear)',
      emoji: '🔴',
    };
  }
  return {
    bg: 'rgba(140,140,160,0.05)',
    border: 'var(--muted)',
    text: 'var(--muted)',
    emoji: '⚪',
  };
}

function arrow(chg: number): string {
  if (!Number.isFinite(chg)) return '·';
  if (chg > 0.05) return '↑';
  if (chg < -0.05) return '↓';
  return '·';
}

export default function MacroSentimentCard() {
  const [data, setData] = useState<CorrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const run = async () => {
      try {
        const res = await fetch('/api/correlations', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setData((await res.json()) as CorrPayload);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'fetch failed');
      }
    };
    run();
    const id = setInterval(run, 300_000);
    return () => {
      clearTimeout(timer);
      clearInterval(id);
      ctrl.abort();
    };
  }, []);

  if (error || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 font-mono text-[0.6rem] text-[var(--muted)] h-[110px] flex items-center justify-center">
        Macro sentiment indisponible
      </div>
    );
  }

  const v = verdictColor(data.regime ?? data.overallSentiment ?? '');
  const macroTicks = MACRO_TICKERS.map((t) => {
    const found = data.assets.find((a) => a.symbol.toUpperCase() === t);
    return found ?? null;
  }).filter(Boolean) as AssetCorr[];

  return (
    <div
      className="bg-[var(--bg2)] border rounded-[4px] p-3 flex flex-col gap-2"
      style={{ background: v.bg, borderColor: v.border }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Macro Sentiment
        </span>
        <span className="font-mono text-[0.55rem]" style={{ color: v.text }}>
          {v.emoji} {data.regime ?? data.overallSentiment ?? 'n/a'}
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span
          className="font-mono text-[1.4rem] font-bold leading-none uppercase"
          style={{ color: v.text }}
        >
          {(data.regime ?? data.overallSentiment ?? 'neutral').toUpperCase()}
        </span>
        <span className="font-mono text-[0.6rem] text-[var(--muted)]">
          {data.compositeScore != null ? `${data.compositeScore > 0 ? '+' : ''}${data.compositeScore.toFixed(0)}` : ''}
        </span>
      </div>

      <div className="flex gap-2 font-mono text-[0.6rem]">
        {macroTicks.length === 0 ? (
          <span className="text-[var(--muted)]">DXY/VIX/SPX indisponibles</span>
        ) : (
          macroTicks.map((a) => {
            const c = a.change24h ?? 0;
            const tone = c > 0.05 ? 'var(--bull)' : c < -0.05 ? 'var(--bear)' : 'var(--muted)';
            return (
              <div key={a.symbol} className="flex flex-col">
                <span className="text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
                  {a.symbol}
                </span>
                <span style={{ color: tone }}>
                  {arrow(c)} {a.price?.toFixed(a.symbol === 'VIX' ? 1 : 2)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
