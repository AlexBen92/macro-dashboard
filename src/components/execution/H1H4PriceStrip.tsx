'use client';

/**
 * Bandeau prix ETH/SOL pour l'exécution H1/H4 — niveau 1.
 * Bougies 1h/4h via Hyperliquid REST (candleSnapshot interval "1h"/"4h",
 * jamais "d" — 422).
 */
import { useEffect, useState } from 'react';

const COINS = ['ETH', 'SOL'] as const;

interface Candle { t: number; o: string; c: string; h: string; l: string; v: string; }
interface CoinState { last: number; chg24h: number | null; chg7d: number | null; dirH1: number; dirH4: number; }

async function fetchCandles(coin: string, interval: string): Promise<Candle[]> {
  const res = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'candleSnapshot', req: { coin, interval } }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as Candle[];
}

function pct(a: Candle[], bars: number): number | null {
  if (a.length <= bars) return null;
  const ref = parseFloat(a[a.length - 1 - bars].c);
  const last = parseFloat(a[a.length - 1].c);
  if (!ref) return null;
  return ((last - ref) / ref) * 100;
}

function dir(a: Candle[]): number {
  if (a.length < 3) return 0;
  const c1 = parseFloat(a[a.length - 3].c);
  const c2 = parseFloat(a[a.length - 2].c);
  const c3 = parseFloat(a[a.length - 1].c);
  if (c3 > c2 && c2 > c1) return 1;
  if (c3 < c2 && c2 < c1) return -1;
  return 0;
}

export default function H1H4PriceStrip() {
  const [state, setState] = useState<Record<string, CoinState | null>>({});
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const next: Record<string, CoinState | null> = {};
        for (const coin of COINS) {
          const [h1, h4] = await Promise.all([
            fetchCandles(coin, '1h'),
            fetchCandles(coin, '4h'),
          ]);
          next[coin] = {
            last: parseFloat(h1[h1.length - 1].c),
            chg24h: pct(h1, 24),
            chg7d: pct(h4, 42),
            dirH1: dir(h1),
            dirH4: dir(h4),
          };
        }
        if (alive) { setState(next); setErr(null); }
      } catch (e) {
        if (alive) setErr(String(e));
      }
    };
    load();
    const id = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const fmt = (v: number | null, digits = 2) =>
    v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
  const arrow = (d: number) => (d > 0 ? '↑' : d < 0 ? '↓' : '→');
  const arrowColor = (d: number) => (d > 0 ? 'var(--bull)' : d < 0 ? 'var(--bear)' : 'var(--dim)');

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {COINS.map((coin) => {
        const s = state[coin];
        return (
          <div
            key={coin}
            className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] px-3 py-2 flex items-center justify-between font-mono"
          >
            <span className="text-[0.8rem] font-bold text-[var(--text)] tracking-[2px]">{coin}</span>
            {s ? (
              <>
                <span className="text-[0.85rem] tabular-nums text-[var(--text)]">
                  {s.last.toLocaleString('en-US', { maximumFractionDigits: s.last < 10 ? 4 : 2 })}
                </span>
                <span
                  className="text-[0.65rem] tabular-nums"
                  style={{ color: (s.chg24h ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)' }}
                >
                  {fmt(s.chg24h)} 24h
                </span>
                <span className="text-[0.6rem] tabular-nums text-[var(--muted)]">{fmt(s.chg7d, 1)} 7j</span>
                <span className="flex gap-2 text-[0.7rem]">
                  <span style={{ color: arrowColor(s.dirH1) }}>H1 {arrow(s.dirH1)}</span>
                  <span style={{ color: arrowColor(s.dirH4) }}>H4 {arrow(s.dirH4)}</span>
                </span>
              </>
            ) : (
              <span className="text-[0.6rem] text-[var(--muted)]">
                {err ? `indisponible (${err})` : 'chargement…'}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
