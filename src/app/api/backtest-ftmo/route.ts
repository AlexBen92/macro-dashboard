import { NextResponse } from 'next/server';
import { runBacktest, type BtCandle } from '@/lib/backtest';

// Yahoo Finance symbols for FTMO instruments
const FTMO_INSTRUMENTS = [
  { symbol: 'GC=F',    label: 'XAU/USD' },  // Gold futures
  { symbol: 'NQ=F',    label: 'NAS100' },    // Nasdaq futures
  { symbol: 'EURUSD=X', label: 'EUR/USD' },
  { symbol: 'GBPUSD=X', label: 'GBP/USD' },
];

async function fetchYahooCandles(symbol: string): Promise<BtCandle[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1h&range=730d`; // max ~1 an
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    next: { revalidate: 86400 }, // cache 24h server-side
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const data = await res.json() as {
    chart: {
      result: Array<{
        timestamp: number[];
        indicators: { quote: Array<{ open: number[]; high: number[]; low: number[]; close: number[]; volume: number[] }> };
      }>;
      error?: string;
    };
  };
  const result = data.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${symbol}`);

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0] ?? {};
  const opens = quote.open ?? [];
  const highs = quote.high ?? [];
  const lows = quote.low ?? [];
  const closes = quote.close ?? [];
  const volumes = quote.volume ?? [];

  return timestamps
    .map((t, i) => ({
      t: t * 1000,
      o: opens[i] ?? 0,
      h: highs[i] ?? 0,
      l: lows[i] ?? 0,
      c: closes[i] ?? 0,
      v: volumes[i] ?? 0,
    }))
    .filter(c => c.c > 0 && c.h > 0 && c.l > 0)
    .slice(-1500); // cap at 1500 candles
}

export async function GET() {
  try {
    const results = await Promise.all(
      FTMO_INSTRUMENTS.map(async ({ symbol, label }) => {
        try {
          const candles = await fetchYahooCandles(symbol);
          if (candles.length < 60) return null;
          return runBacktest(candles, label);
        } catch {
          return null;
        }
      })
    );
    const valid = results.filter(Boolean);
    return NextResponse.json({ results: valid, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
