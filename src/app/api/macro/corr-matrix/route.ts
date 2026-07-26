import { NextResponse } from 'next/server';

import { pricesToLogReturns, pearsonLogReturns } from '@/lib/engines/correlation';

const ASSET_MAP: Record<string, { yahoo: string; label: string }> = {
  BTC: { yahoo: 'BTC=F', label: 'BTC' },
  ETH: { yahoo: 'ETH=F', label: 'ETH' },
  SOL: { yahoo: 'SOL=F', label: 'SOL' },
  DXY: { yahoo: 'DX-Y.NYB', label: 'DXY' },
  SPX: { yahoo: '^GSPC', label: 'SPX' },
  Gold: { yahoo: 'GC=F', label: 'Gold' },
  VIX: { yahoo: '^VIX', label: 'VIX' },
  MSTR: { yahoo: 'MSTR', label: 'MSTR' },
  NVDA: { yahoo: 'NVDA', label: 'NVDA' },
  COIN: { yahoo: 'COIN', label: 'COIN' },
};

const CRYPTO = ['BTC', 'ETH', 'SOL'];
const MACRO = ['DXY', 'SPX', 'Gold', 'VIX'];
const REF = ['MSTR', 'NVDA', 'COIN'];

const WINDOWS = ['24h', '7d', '30d'] as const;
type WindowKey = (typeof WINDOWS)[number];
type ValidWindow = '24h' | '7d' | '30d';

interface CacheEntry {
  ts: number;
  data: unknown;
}
const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchYahoo(symbol: string, interval: string, range: string): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`);
  const d = (await res.json()) as {
    chart?: { result?: Array<{ indicators?: { quote?: Array<{ close: Array<number | null> }> } }> };
  };
  const closes = d.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  return closes.filter((x: number | null): x is number => x != null);
}

function tailSlice(prices: number[], n: number): number[] {
  if (prices.length <= n) return prices.slice();
  return prices.slice(prices.length - n);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const requested = (url.searchParams.get('windows') ?? '24h,7d,30d')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean) as WindowKey[];

  const cacheKey = requested.join(',');
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(hit.data, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' },
    });
  }

  try {
    const ALL = CRYPTO.concat(MACRO).concat(REF);
    const [hourlyAll, dailyAll] = await Promise.all([
      Promise.all(ALL.map(async (k) => [k, ASSET_MAP[k]] as const)).then((entries) =>
        Promise.all(
          entries.map(async ([k, m]) =>
            fetchYahoo(m.yahoo, '1h', '5d')
              .then((p) => [k, p] as const)
              .catch(() => [k, [] as number[]] as const),
          ),
        ),
      ),
      Promise.all(ALL.map(async (k) => [k, ASSET_MAP[k]] as const)).then((entries) =>
        Promise.all(
          entries.map(async ([k, m]) =>
            fetchYahoo(m.yahoo, '1d', '40d')
              .then((p) => [k, p] as const)
              .catch(() => [k, [] as number[]] as const),
          ),
        ),
      ),
    ]);

    const hourly: Record<string, number[]> = {};
    const daily: Record<string, number[]> = {};
    for (const [k, p] of hourlyAll) hourly[k] = p;
    for (const [k, p] of dailyAll) daily[k] = p;

    const cells: Array<{
      a: string;
      b: string;
      r: number;
      window: ValidWindow;
      n: number;
    }> = [];

    for (const crypto of CRYPTO) {
      for (const macro of MACRO.concat(REF)) {
        for (const w of requested.length ? requested : WINDOWS) {
          let a: number[];
          let b: number[];
          if (w === '24h') {
            a = tailSlice(hourly[crypto] ?? [], 24);
            b = tailSlice(hourly[macro] ?? [], 24);
          } else if (w === '7d') {
            a = tailSlice(daily[crypto] ?? [], 7);
            b = tailSlice(daily[macro] ?? [], 7);
          } else {
            a = tailSlice(daily[crypto] ?? [], 30);
            b = tailSlice(daily[macro] ?? [], 30);
          }
          if (a.length < 2 || b.length < 2) continue;
          const ra = pricesToLogReturns(a);
          const rb = pricesToLogReturns(b);
          const n = Math.min(ra.length, rb.length);
          const r = pearsonLogReturns(ra.slice(ra.length - n), rb.slice(rb.length - n));
          if (!Number.isFinite(r)) continue;
          cells.push({ a: crypto, b: macro, r, window: w as ValidWindow, n });
        }
      }
    }

    const payload = {
      windows: (requested.length ? requested : [...WINDOWS]) as ValidWindow[],
      cells,
      asOf: new Date().toISOString(),
    };
    cache.set(cacheKey, { ts: Date.now(), data: payload });
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'macro fetch failed' },
      { status: 502 },
    );
  }
}
