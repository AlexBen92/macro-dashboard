'use client';
/**
 * Wrapper client pour FundingAggregator.
 * Wiring données V25 §2.4 (realizedVol24h) + C2 V21 (ADA rollingHigh20d) + fundingHistory30d (percentiles).
 *
 * Stratégie anti-N+1 (270 symbols × fetch = fragilité) :
 * - realizedVol24h calculé pour TOP_OI_SYMBOLS (top liquidity majors) + ADA
 * - fundingHistory30d calculé pour TOP_OI_SYMBOLS + ADA (percentiles 70/90 par symbol)
 * - rollingHigh20d calculé pour ADA seulement (override C2 V21 prioritaire)
 *
 * Pour les autres symbols, FundingAggregator garde fallback constantes (0.0002/0.0005).
 * Pas de block render : état lazy, fetch parallèle Promise.all.
 */
import { useEffect, useRef, useState } from 'react';
import FundingAggregator, { FundingAggregatorProps } from '@/components/FundingAggregator';

// Subset restreint — top OI majors + ADA pour override C2 V21.
// Au-delà : N+1 trop cher, fallback constants suffit pour les alts long-tail.
const TOP_OI_SYMBOLS = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA'] as const;

const HL_INFO = 'https://api.hyperliquid.xyz/info';

async function hlInfo<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchCandles(
  coin: string,
  interval: string,
  limit: number,
): Promise<Array<{ t: number; o: string; h: string; l: string; c: string; v: string }>> {
  const end = Date.now();
  const unitMs: Record<string, number> = { h: 3_600_000, m: 60_000, d: 86_400_000 };
  const unit = interval.slice(-1);
  const n = parseInt(interval.slice(0, -1) || '1', 10);
  const ms = unitMs[unit] ?? 3_600_000;
  const start = end - ms * n * limit;
  const res = await hlInfo<{ candleSnapshot: Array<{ t: number; o: string; h: string; l: string; c: string; v: string }> }>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime: Math.floor(start / 1000), endTime: Math.floor(end / 1000) },
  });
  return res?.candleSnapshot ?? [];
}

async function fetchFunding(coin: string, lastN: number): Promise<number[]> {
  const end = Date.now();
  const start = end - lastN * 8 * 3_600_000;
  const res = await hlInfo<Array<{ funding: string }>>({
    type: 'fundingHistory',
    coin,
    startTime: Math.floor(start / 1000),
    endTime: Math.floor(end / 1000),
  });
  if (!Array.isArray(res)) return [];
  return res.map(p => parseFloat(p.funding ?? '0')).filter(v => Number.isFinite(v));
}

function computeRealizedVol(candles: Array<{ c: string }>): number | null {
  // V25 §2.4 — decimal daily std returns (pas annualisé)
  // candles = 24h × interval 1h → std des returns 1h × sqrt(24)
  if (candles.length < 5) return null;
  const prices = candles.map(c => parseFloat(c.c)).filter(p => Number.isFinite(p) && p > 0);
  if (prices.length < 5) return null;
  const rets: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] > 0) rets.push(prices[i] / prices[i - 1] - 1);
  }
  if (rets.length < 4) return null;
  const mean = rets.reduce((s, r) => s + r, 0) / rets.length;
  const variance = rets.reduce((s, r) => s + (r - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(24); // scale 1h → daily
}

function computeRollingHigh(candles: Array<{ h: string }>): number | null {
  if (candles.length === 0) return null;
  let max = -Infinity;
  for (const c of candles) {
    const h = parseFloat(c.h);
    if (Number.isFinite(h) && h > max) max = h;
  }
  return max > 0 ? max : null;
}

export default function FundingAggregatorWired() {
  const [props, setProps] = useState<FundingAggregatorProps>({});
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const realizedVol24h: Record<string, number> = {};
        const fundingHistory30d: Record<string, number[]> = {};
        const rollingHigh20d: Record<string, number> = {};

        await Promise.all(
          TOP_OI_SYMBOLS.map(async sym => {
            const [c24, fund] = await Promise.all([
              fetchCandles(sym, '1h', 24),
              fetchFunding(sym, 90),
            ]);
            if (cancelled) return;
            const vol = computeRealizedVol(c24);
            if (vol != null) realizedVol24h[sym] = vol;
            if (fund.length > 0) fundingHistory30d[sym] = fund;
            if (sym === 'ADA') {
              const c20d = await fetchCandles(sym, '1d', 20);
              if (cancelled) return;
              const rh = computeRollingHigh(c20d);
              if (rh != null) rollingHigh20d[sym] = rh;
            }
          }),
        );

        if (cancelled) return;
        setProps({ realizedVol24h, fundingHistory30d, rollingHigh20d });
      } catch {
        // silent — FundingAggregator gère le fallback
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return <FundingAggregator {...props} />;
}
