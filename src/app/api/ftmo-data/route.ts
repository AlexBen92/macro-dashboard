import { NextResponse } from 'next/server';

interface YahooResult {
  symbol: string;
  candles: { t: number; o: number; h: number; l: number; c: number; v: number }[];
  price: number;
  change24h: number;
}

async function fetchYahoo(symbol: string, interval: string, range: string): Promise<YahooResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result) return { symbol, candles: [], price: 0, change24h: 0 };

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];
  const volumes = quote.volume || [];

  const candles = timestamps
    .map((t: number, i: number) => ({
      t: t * 1000,
      o: opens[i] ?? 0,
      h: highs[i] ?? 0,
      l: lows[i] ?? 0,
      c: closes[i] ?? 0,
      v: volumes[i] ?? 0,
    }))
    .filter((c: { c: number }) => c.c > 0);

  const price = candles.length > 0 ? candles[candles.length - 1].c : 0;
  const prevClose = candles.length > 1 ? candles[candles.length - 2].c : price;
  const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

  return { symbol, candles, price, change24h };
}

export async function GET() {
  try {
    const fetches = [
      // Gold
      { key: 'XAUUSD_1h', symbol: 'GC=F', interval: '1h', range: '5d' },
      { key: 'XAUUSD_15m', symbol: 'GC=F', interval: '15m', range: '2d' },
      { key: 'XAUUSD_daily', symbol: 'GC=F', interval: '1d', range: '6mo' },
      // Oil
      { key: 'OIL_1h', symbol: 'CL=F', interval: '1h', range: '5d' },
      { key: 'BRENT_1h', symbol: 'BZ=F', interval: '1h', range: '5d' },
      // Forex 1h
      { key: 'EURUSD_1h', symbol: 'EURUSD=X', interval: '1h', range: '5d' },
      { key: 'GBPUSD_1h', symbol: 'GBPUSD=X', interval: '1h', range: '5d' },
      { key: 'USDJPY_1h', symbol: 'USDJPY=X', interval: '1h', range: '5d' },
      { key: 'USDCHF_1h', symbol: 'USDCHF=X', interval: '1h', range: '5d' },
      { key: 'AUDUSD_1h', symbol: 'AUDUSD=X', interval: '1h', range: '5d' },
      { key: 'USDCAD_1h', symbol: 'USDCAD=X', interval: '1h', range: '5d' },
      // Forex H4 (for mean reversion)
      { key: 'EURUSD_4h', symbol: 'EURUSD=X', interval: '1h', range: '3mo' }, // Yahoo doesn't have 4h, use 1h and resample
      { key: 'EURGBP_4h', symbol: 'EURGBP=X', interval: '1h', range: '3mo' },
      // Indices M5 (for ORB)
      { key: 'NAS100_5m', symbol: 'NQ=F', interval: '5m', range: '2d' },
      { key: 'US30_5m', symbol: 'YM=F', interval: '5m', range: '2d' },
      { key: 'NAS100_1h', symbol: 'NQ=F', interval: '1h', range: '5d' },
      // Macro
      { key: 'VIX', symbol: '%5EVIX', interval: '1d', range: '1mo' },
      { key: 'DXY_1h', symbol: 'DX-Y.NYB', interval: '1h', range: '5d' },
      { key: '10Y', symbol: '%5ETNX', interval: '1d', range: '5d' },
    ];

    const results = await Promise.allSettled(
      fetches.map(f => fetchYahoo(f.symbol, f.interval, f.range).then(r => ({ ...r, key: f.key })))
    );

    const data: Record<string, { candles: typeof results extends PromiseSettledResult<infer T>[] ? T extends { candles: infer C } ? C : never : never; price: number; change24h: number }> = {};
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const v = r.value as { key: string; candles: { t: number; o: number; h: number; l: number; c: number; v: number }[]; price: number; change24h: number };
        data[v.key] = { candles: v.candles, price: v.price, change24h: v.change24h };
      }
    }

    // Resample 1h to 4h for mean reversion
    for (const key of ['EURUSD_4h', 'EURGBP_4h']) {
      if (data[key]?.candles) {
        const h1 = data[key].candles;
        const h4: typeof h1 = [];
        for (let i = 0; i < h1.length; i += 4) {
          const chunk = h1.slice(i, i + 4);
          if (chunk.length === 0) continue;
          h4.push({
            t: chunk[0].t,
            o: chunk[0].o,
            h: Math.max(...chunk.map(c => c.h)),
            l: Math.min(...chunk.map(c => c.l)),
            c: chunk[chunk.length - 1].c,
            v: chunk.reduce((a, c) => a + c.v, 0),
          });
        }
        data[key] = { ...data[key], candles: h4 };
      }
    }

    return NextResponse.json(
      { data, timestamp: Date.now() },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=15' } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
