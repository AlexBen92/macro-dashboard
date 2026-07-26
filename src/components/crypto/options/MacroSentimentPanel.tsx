'use client';

import { useEffect, useState } from 'react';

interface AssetCorr {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  correlationBTC: number;
  score: number | null;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  category: 'macro' | 'tech' | 'miner' | 'crypto';
}

interface CorrPayload {
  assets: AssetCorr[];
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  compositeScore: number | null;
  regime: string;
}

const CATEGORIES: { key: AssetCorr['category']; label: string }[] = [
  { key: 'macro', label: 'Macro' },
  { key: 'tech', label: 'Tech / Equity' },
  { key: 'miner', label: 'Miners' },
  { key: 'crypto', label: 'Crypto' },
];

function verdictStyle(regime: string): {
  bg: string;
  border: string;
  text: string;
  emoji: string;
  verdict: 'bullish' | 'bearish' | 'neutral';
} {
  const r = regime.toLowerCase();
  if (r.includes('bull') || r.includes('risk-on')) {
    return {
      bg: 'rgba(74,222,128,0.08)',
      border: 'var(--bull)',
      text: 'var(--bull)',
      emoji: '🟢',
      verdict: 'bullish',
    };
  }
  if (r.includes('bear') || r.includes('risk-off')) {
    return {
      bg: 'rgba(255,51,85,0.08)',
      border: 'var(--bear)',
      text: 'var(--bear)',
      emoji: '🔴',
      verdict: 'bearish',
    };
  }
  return {
    bg: 'rgba(140,140,160,0.05)',
    border: 'var(--muted)',
    text: 'var(--muted)',
    emoji: '⚪',
    verdict: 'neutral',
  };
}

function corrColor(r: number): { bg: string; text: string } {
  if (!Number.isFinite(r)) return { bg: 'transparent', text: 'var(--muted)' };
  if (r > 0.6) return { bg: 'rgba(74,222,128,0.22)', text: 'var(--bull)' };
  if (r > 0.3) return { bg: 'rgba(74,222,128,0.12)', text: 'var(--bull)' };
  if (r < -0.3) return { bg: 'rgba(255,51,85,0.18)', text: 'var(--bear)' };
  if (r < -0.1) return { bg: 'rgba(255,51,85,0.10)', text: 'var(--bear)' };
  return { bg: 'rgba(140,140,160,0.10)', text: 'var(--muted)' };
}

function signalColor(s: AssetCorr['signal']): string {
  if (s === 'bullish') return 'var(--bull)';
  if (s === 'bearish') return 'var(--bear)';
  return 'var(--muted)';
}

function categoryScore(assets: AssetCorr[]): {
  score: number;
  bullish: number;
  bearish: number;
  neutral: number;
} {
  let bullish = 0;
  let bearish = 0;
  let neutral = 0;
  let sum = 0;
  let n = 0;
  for (const a of assets) {
    if (a.signal === 'bullish') bullish++;
    else if (a.signal === 'bearish') bearish++;
    else neutral++;
    if (a.score != null) {
      sum += a.score;
      n++;
    }
  }
  return {
    score: n > 0 ? sum / n : 0,
    bullish,
    bearish,
    neutral,
  };
}

export default function MacroSentimentPanel() {
  const [data, setData] = useState<CorrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 10_000);
    const run = async () => {
      try {
        const res = await fetch('/api/correlations', { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as CorrPayload;
        setData(json);
        setAsOf(new Date().toISOString());
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'fetch failed');
      } finally {
        setLoading(false);
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

  if (loading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
        <div className="h-32 w-full animate-pulse bg-[var(--bg3)] rounded-[3px]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--bear)]/40 rounded-[4px] p-3 font-mono text-[0.65rem] text-[var(--bear)]">
        Macro sentiment unavailable — {error ?? 'no data'}
      </div>
    );
  }

  const v = verdictStyle(data.regime ?? '');
  const composite =
    data.compositeScore ??
    (v.verdict === 'bullish' ? 60 : v.verdict === 'bearish' ? -60 : 0);

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          Macro Sentiment · Heatmap
        </div>
        <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {asOf ? `as of ${asOf.slice(11, 16)}` : ''}
        </div>
      </div>

      <div
        className="border-l-[3px] px-3 py-2 flex items-center gap-3 flex-wrap"
        style={{ background: v.bg, borderColor: v.border }}
      >
        <span className="text-base">{v.emoji}</span>
        <div>
          <div
            className="font-mono text-[0.7rem] uppercase tracking-[2px] font-semibold"
            style={{ color: v.text }}
          >
            {data.regime ?? 'n/a'}
          </div>
          <div className="font-mono text-[0.55rem] text-[var(--dim)]">
            overall sentiment: {data.overallSentiment ?? '—'}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 font-mono text-[0.6rem]">
          <div className="text-right">
            <div className="text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
              composite
            </div>
            <div className="tabular-nums" style={{ color: v.text }}>
              {composite > 0 ? '+' : ''}
              {composite.toFixed(0)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2 p-2">
        {CATEGORIES.map(({ key, label }) => {
          const list = data.assets.filter((a) => a.category === key);
          if (list.length === 0) return null;
          const cs = categoryScore(list);
          const tone =
            cs.bullish > cs.bearish && cs.bullish > cs.neutral
              ? 'var(--bull)'
              : cs.bearish > cs.bullish && cs.bearish > cs.neutral
                ? 'var(--bear)'
                : 'var(--muted)';
          return (
            <div
              key={key}
              className="border border-[var(--border)] rounded-[3px] overflow-hidden"
            >
              <div className="px-2 py-1 border-b border-[var(--border)] flex items-center justify-between">
                <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px]">
                  {label}
                </span>
                <span
                  className="font-mono text-[0.5rem] tabular-nums"
                  style={{ color: tone }}
                >
                  {cs.bullish}↑ / {cs.neutral}· / {cs.bearish}↓
                </span>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {list.map((a) => {
                  const c = corrColor(a.correlationBTC);
                  return (
                    <div
                      key={a.symbol}
                      className="px-2 py-1 flex items-center gap-2 font-mono text-[0.6rem]"
                    >
                      <span
                        className="w-[3px] h-3 rounded-full flex-shrink-0"
                        style={{ background: signalColor(a.signal) }}
                      />
                      <span className="text-[var(--text)] uppercase tracking-[1px] w-12 flex-shrink-0">
                        {a.symbol}
                      </span>
                      <span
                        className="ml-auto tabular-nums px-1.5 py-0.5 rounded-[2px]"
                        style={{ background: c.bg, color: c.text }}
                        title={`corr BTC: ${a.correlationBTC?.toFixed(2) ?? 'n/a'}`}
                      >
                        {a.correlationBTC?.toFixed(2) ?? '—'}
                      </span>
                      <span
                        className="tabular-nums text-[0.55rem] w-8 text-right"
                        style={{
                          color:
                            a.change24h >= 0 ? 'var(--bull)' : 'var(--bear)',
                        }}
                      >
                        {a.change24h >= 0 ? '+' : ''}
                        {a.change24h?.toFixed(1) ?? '—'}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-1 border-t border-[var(--border)] font-mono text-[0.5rem] text-[var(--dim)] flex items-center gap-3 flex-wrap">
        <span>
          Sources: Yahoo (macro/tech/miners) + Binance (crypto). Rule v1.
        </span>
        <span className="ml-auto">
          Heatmap: green r&gt;+0.3 · red r&lt;-0.3 · grey neutral
        </span>
      </div>
    </div>
  );
}
