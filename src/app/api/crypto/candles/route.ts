import { NextResponse } from 'next/server';

import type { Timeframe } from '@/lib/options/types';

export const revalidate = 60;
export const dynamic = 'force-dynamic';

const HL_BASE = 'https://api.hyperliquid.xyz/info';
const TTL_BY_TF: Record<Timeframe, number> = {
  M15: 86_400_000,
  H1: 7 * 86_400_000,
  H4: 30 * 86_400_000,
};
const INTERVAL_BY_TF: Record<Timeframe, string> = {
  M15: '15m',
  H1: '1h',
  H4: '4h',
};

interface HLCandle {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get('symbol') ?? 'BTC').toUpperCase();
  const tfRaw = (url.searchParams.get('tf') ?? 'M15').toUpperCase() as Timeframe;

  if (symbol !== 'BTC' && symbol !== 'ETH') {
    return NextResponse.json(
      { success: false, error: `unsupported symbol: ${symbol}` },
      { status: 400 },
    );
  }
  if (!(tfRaw in INTERVAL_BY_TF)) {
    return NextResponse.json(
      { success: false, error: `unsupported tf: ${tfRaw}` },
      { status: 400 },
    );
  }
  const tf = tfRaw as Timeframe;
  const interval = INTERVAL_BY_TF[tf];
  const ttl = TTL_BY_TF[tf];

  const now = Date.now();
  const startTime = now - ttl;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(HL_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'candleSnapshot',
        req: { coin: symbol, interval, startTime, endTime: now },
      }),
      signal: ctrl.signal,
      next: { revalidate: 60 },
    });
    clearTimeout(timer);
    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `hyperliquid HTTP ${res.status}` },
        { status: 502 },
      );
    }
    const raw = (await res.json()) as HLCandle[];
    const bars = raw.map((c) => ({
      time: Math.floor(c.t / 1000),
      open: Number(c.o),
      high: Number(c.h),
      low: Number(c.l),
      close: Number(c.c),
      volume: Number(c.v),
    }));
    return NextResponse.json(
      {
        success: true,
        source: 'hyperliquid_perp',
        symbol,
        tf,
        interval,
        bars,
        asOf: new Date().toISOString(),
      },
      {
        headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' },
      },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json(
      { success: false, error: `hyperliquid upstream: ${msg}` },
      { status: 502 },
    );
  }
}
