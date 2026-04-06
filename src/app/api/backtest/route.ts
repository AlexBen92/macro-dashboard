import { NextResponse } from 'next/server';
import { runBacktest, type BtCandle } from '@/lib/backtest';

const COINS = [
  { symbol: 'BTCUSDT', label: 'BTC/USD' },
  { symbol: 'ETHUSDT', label: 'ETH/USD' },
];

async function fetchCandles(symbol: string): Promise<BtCandle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=1500`; // max 1500 H1 ≈ 62 jours
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h server-side
  if (!res.ok) throw new Error(`Binance ${symbol}: ${res.status}`);
  const raw = await res.json() as [number, string, string, string, string, string, ...unknown[]][];
  return raw.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
  }));
}

export async function GET() {
  try {
    const results = await Promise.all(
      COINS.map(async ({ symbol, label }) => {
        const candles = await fetchCandles(symbol);
        return runBacktest(candles, label);
      })
    );
    return NextResponse.json({ results, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
