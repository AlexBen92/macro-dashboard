import { NextResponse } from 'next/server';

async function fetchYahoo(symbol: string): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const d = await res.json();
  const closes: number[] = (d.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
    .filter((x: number | null) => x != null);
  return closes;
}

export async function GET() {
  try {
    // VIX
    let vix: { v: number | null; chg: number | null; src: string } = { v: null, chg: null, src: 'N/A' };
    try {
      // Try FRED first if key is available
      const fredKey = process.env.FRED_API_KEY;
      if (fredKey) {
        const fredRes = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`
        );
        const fredData = await fredRes.json();
        const obs = fredData.observations?.filter((x: { value: string }) => x.value !== '.') || [];
        if (obs.length >= 2) {
          vix = { v: parseFloat(obs[0].value), chg: parseFloat(obs[0].value) - parseFloat(obs[1].value), src: 'FRED' };
        }
      }
      if (vix.v == null) {
        const closes = await fetchYahoo('^VIX');
        if (closes.length >= 2) {
          vix = { v: closes[closes.length - 1], chg: closes[closes.length - 1] - closes[closes.length - 2], src: 'Yahoo' };
        }
      }
    } catch {
      // BTC realized vol fallback
      try {
        const cgRes = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily');
        const cgData = await cgRes.json();
        const prices = cgData.prices.map((x: number[]) => x[1]);
        const ret: number[] = [];
        for (let i = 1; i < prices.length; i++) ret.push(Math.log(prices[i] / prices[i - 1]));
        const m = ret.reduce((a: number, b: number) => a + b, 0) / ret.length;
        const std = Math.sqrt(ret.reduce((a: number, b: number) => a + (b - m) * (b - m), 0) / (ret.length - 1));
        vix = { v: std * Math.sqrt(365) * 100, chg: null, src: 'BTC Vol' };
      } catch { /* skip */ }
    }

    // DXY
    let dxy: { v: number | null; prev: number | null; src: string } = { v: null, prev: null, src: 'N/A' };
    try {
      const closes = await fetchYahoo('DX-Y.NYB');
      if (closes.length >= 2) {
        dxy = { v: closes[closes.length - 1], prev: closes[closes.length - 2], src: 'Yahoo' };
      }
    } catch { /* skip */ }

    // 10Y
    let yield10y: { v: number | null; src: string } = { v: null, src: 'N/A' };
    try {
      const closes = await fetchYahoo('^TNX');
      if (closes.length >= 1) {
        yield10y = { v: closes[closes.length - 1], src: 'Yahoo' };
      }
    } catch { /* skip */ }

    return NextResponse.json(
      { vix, dxy, yield10y, timestamp: Date.now() },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
