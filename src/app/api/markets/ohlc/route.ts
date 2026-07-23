import { NextResponse } from 'next/server';

export interface OhlcBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

const INTERVAL_RE = /^(1d|1h|1wk)$/;
const RANGE_RE = /^(1mo|3mo|6mo|1y|2y|5y)$/;

const cache = new Map<string, { at: number; data: OhlcBar[] }>();
const TTL = 5 * 60 * 1000;

async function fetchYahooOhlc(
  ticker: string,
  interval: string,
  range: string,
): Promise<OhlcBar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker,
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    console.warn(`[markets/ohlc] yahoo ${ticker} HTTP ${res.status}`);
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

  const out: OhlcBar[] = [];
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const interval = searchParams.get('interval') || '1d';
  const range = searchParams.get('range') || '1y';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }
  if (!INTERVAL_RE.test(interval) || !RANGE_RE.test(range)) {
    return NextResponse.json(
      { error: 'invalid interval or range' },
      { status: 400 },
    );
  }

  const key = `${ticker}|${interval}|${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ bars: hit.data, cached: true });
  }

  try {
    const bars = await fetchYahooOhlc(ticker, interval, range);
    cache.set(key, { at: Date.now(), data: bars });
    return NextResponse.json(
      { bars, cached: false },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 502 },
    );
  }
}
