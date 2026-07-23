import { NextResponse } from 'next/server';
import universe from '@/config/markets-universe.json';
import type { Candle, TrendResult } from '@/lib/engines/trend';
import { classifyTrend } from '@/lib/engines/trend';

interface UniverseEntry {
  ticker: string;
  name: string;
  sector: string;
}

const allTickers: string[] = [
  ...(universe.liquid_basket as UniverseEntry[]).map((x) => x.ticker),
  ...(universe.edge_watchlist as UniverseEntry[]).map((x) => x.ticker),
];

type TrendMap = Record<string, { daily: TrendResult | null; h4: TrendResult | null }>;

interface CacheEntry {
  at: number;
  data: { asOf: string; trends: TrendMap };
}

const cache: { entry: CacheEntry | null } = { entry: null };
const TTL = 10 * 60 * 1000;

async function fetchYahoo(
  ticker: string,
  interval: string,
  range: string,
): Promise<Candle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    console.warn(`[markets/sectors] yahoo ${ticker} HTTP ${res.status}`);
    return [];
  }
  const d = await res.json();
  const result = d.chart?.result?.[0];
  if (!result) return [];
  const ts: number[] = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const opens: (number | null)[] = q.open || [];
  const highs: (number | null)[] = q.high || [];
  const lows: (number | null)[] = q.low || [];
  const closes: (number | null)[] = q.close || [];
  const volumes: (number | null)[] = q.volume || [];

  const out: Candle[] = [];
  for (let i = 0; i < ts.length; i++) {
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (o == null || h == null || l == null || c == null) continue;
    out.push({
      time: ts[i],
      open: o,
      high: h,
      low: l,
      close: c,
      volume: volumes[i] ?? 0,
    });
  }
  return out;
}

function resample4h(candles: Candle[]): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < candles.length; i += 4) {
    const slice = candles.slice(i, i + 4);
    if (slice.length === 0) continue;
    const open = slice[0].open;
    const close = slice[slice.length - 1].close;
    const high = Math.max(...slice.map((s) => s.high));
    const low = Math.min(...slice.map((s) => s.low));
    const volume = slice.reduce((s, c) => s + c.volume, 0);
    out.push({ time: slice[0].time, open, high, low, close, volume });
  }
  return out;
}

async function fetchOne(ticker: string): Promise<[string, { daily: TrendResult | null; h4: TrendResult | null }]> {
  try {
    const [dailyCandles, h1Candles] = await Promise.all([
      fetchYahoo(ticker, '1d', '1y'),
      fetchYahoo(ticker, '1h', '3mo'),
    ]);
    const daily: TrendResult | null =
      dailyCandles.length > 30 ? classifyTrend(dailyCandles.slice(-200), 'D') : null;
    const h4Candles = resample4h(h1Candles);
    const h4: TrendResult | null =
      h4Candles.length > 30 ? classifyTrend(h4Candles.slice(-300), '4H') : null;
    return [ticker, { daily, h4 }];
  } catch (e) {
    console.warn(`[markets/sectors] ${ticker} fail:`, String(e));
    return [ticker, { daily: null, h4: null }];
  }
}

export async function GET() {
  const hit = cache.entry;
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json(hit.data);
  }

  const entries = await Promise.all(allTickers.map(fetchOne));
  const trends: TrendMap = Object.fromEntries(entries);

  const data = { asOf: new Date().toISOString(), trends };
  cache.entry = { at: Date.now(), data };
  return NextResponse.json(data, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' },
  });
}
