import { NextResponse } from 'next/server';

const BTC_CORRELATED_ASSETS = [
  { ticker: 'NDQ', label: 'US 100 Index', category: 'macro', baseCorr: 0.62, yahooSymbol: '^NDX' },
  { ticker: 'SPX', label: "S&P 500", category: 'macro', baseCorr: 0.55, yahooSymbol: '^GSPC' },
  { ticker: 'M2SL', label: 'M2 Money Stock', category: 'macro', baseCorr: 0.71, yahooSymbol: null },
  { ticker: 'NVDA', label: 'NVIDIA Corporation', category: 'tech', baseCorr: 0.68, yahooSymbol: 'NVDA' },
  { ticker: 'MSTR', label: 'Strategy Inc. Class A', category: 'btc_proxy', baseCorr: 0.91, yahooSymbol: 'MSTR' },
  { ticker: 'MARA', label: 'MARA Holdings', category: 'miner', baseCorr: 0.87, yahooSymbol: 'MARA' },
  { ticker: 'CLSK', label: 'CleanSpark', category: 'miner', baseCorr: 0.84, yahooSymbol: 'CLSK' },
  { ticker: 'COIN', label: 'Coinbase Global', category: 'exchange', baseCorr: 0.82, yahooSymbol: 'COIN' },
  { ticker: 'RIOT', label: 'Riot Platforms', category: 'miner', baseCorr: 0.85, yahooSymbol: 'RIOT' },
];

const BTC_BETAS: Record<string, number> = {
  NDQ: 0.8,
  SPX: 0.6,
  M2SL: 0.3,
  NVDA: 1.1,
  MSTR: 2.4,
  MARA: 2.1,
  CLSK: 1.9,
  COIN: 1.6,
  RIOT: 2.0,
};

const STATIC_FALLBACK = {
  btc: { price: 69420, change24h: 1.2 },
  assets: [
    { ticker: 'MSTR', price: 159.89, change24h: -3.01 },
    { ticker: 'MARA', price: 13.81, change24h: 1.92 },
    { ticker: 'RIOT', price: 24.49, change24h: 0.08 },
    { ticker: 'CLSK', price: 15.97, change24h: 1.33 },
    { ticker: 'COIN', price: 184.99, change24h: -4.43 },
    { ticker: 'NVDA', price: 215.33, change24h: -1.90 },
    { ticker: 'NDQ', price: 19481, change24h: 0.42 },
    { ticker: 'SPX', price: 5473, change24h: 0.37 },
    { ticker: 'M2SL', price: 20890, change24h: 0.26 },
  ],
};

async function fetchYahooPrice(symbol: string): Promise<{ price: number; change24h: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d&includePrePost=false`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const d = await res.json();
    const result = d.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    if (!meta || !quotes) return null;

    const close = quotes.close?.filter((x: number | null) => x != null);
    if (!close || close.length < 2) return null;

    const price = close[close.length - 1];
    const prevClose = close[close.length - 2];
    const change24h = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

    return { price, change24h };
  } catch {
    return null;
  }
}

async function fetchCoinGeckoBTC(): Promise<{ price: number; change24h: number } | null> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true',
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const btc = d.bitcoin;
    if (!btc) return null;
    return { price: btc.usd, change24h: btc.usd_24h_change ?? 0 };
  } catch {
    return null;
  }
}

async function fetchM2SL(): Promise<{ price: number; change24h: number } | null> {
  try {
    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) return null;

    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=M2SL&api_key=${fredKey}&file_type=json&sort_order=desc&limit=2`,
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const d = await res.json();
    const obs = d.observations?.filter((x: { value: string }) => x.value !== '.') || [];
    if (obs.length < 2) return null;

    const current = parseFloat(obs[0].value);
    const prev = parseFloat(obs[1].value);
    const change24h = prev > 0 ? ((current - prev) / prev) * 100 : 0;

    return { price: Math.round(current), change24h };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [btcData, ...assetPrices] = await Promise.all([
      fetchCoinGeckoBTC(),
      ...BTC_CORRELATED_ASSETS.map(async (asset) => {
        if (asset.ticker === 'M2SL') {
          return { ticker: asset.ticker, data: await fetchM2SL() };
        }
        if (asset.yahooSymbol) {
          return { ticker: asset.ticker, data: await fetchYahooPrice(asset.yahooSymbol) };
        }
        return { ticker: asset.ticker, data: null };
      }),
    ]);

    const btc = btcData ?? STATIC_FALLBACK.btc;

    const assets = BTC_CORRELATED_ASSETS.map((asset) => {
      const priceData = assetPrices.find((p) => p.ticker === asset.ticker)?.data;
      const fallback = STATIC_FALLBACK.assets.find((f) => f.ticker === asset.ticker);

      return {
        ticker: asset.ticker,
        label: asset.label,
        category: asset.category,
        baseCorr: asset.baseCorr,
        beta: BTC_BETAS[asset.ticker] ?? 1.0,
        price: priceData?.price ?? fallback?.price ?? 0,
        change24h: priceData?.change24h ?? fallback?.change24h ?? 0,
      };
    }).sort((a, b) => b.baseCorr - a.baseCorr);

    const stale = !btcData;

    // Compute ecosystem score
  const avgChange = assets.reduce((sum, a) => sum + a.change24h, 0) / assets.length;
  const btcChange = btc.change24h;

  // Strength = (avg ecosystem change - BTC change) weighted by avg correlation
  const avgCorr = assets.reduce((sum, a) => sum + a.baseCorr, 0) / assets.length;
  const strength = (avgChange - btcChange) * avgCorr;

  // Momentum: avg change of high-beta assets (MSTR, MARA, RIOT, CLSK, COIN)
  const highBetaAssets = assets.filter(a => a.beta >= 1.5);
  const highBetaMomentum = highBetaAssets.length > 0
    ? highBetaAssets.reduce((sum, a) => sum + a.change24h, 0) / highBetaAssets.length
    : 0;

  // Macro risk: SPX + NDQ average change
  const macroAssets = assets.filter(a => a.category === 'macro' && a.ticker !== 'M2SL');
  const macroRisk = macroAssets.length > 0
    ? macroAssets.reduce((sum, a) => sum + a.change24h, 0) / macroAssets.length
    : 0;

  // Final score (0-100)
  let score = 50;
  score += strength * 10; // Ecosystem strength vs BTC
  score += highBetaMomentum * 2; // High-beta momentum
  score += btcChange * 3; // BTC momentum
  score += macroRisk * 2; // Macro risk-on/risk-off
  score = Math.max(0, Math.min(100, score));

  // Determine signal
  let signal: 'bullish' | 'neutral' | 'bearish' = 'neutral';
  let signalLabel = 'NEUTRE';
  if (score >= 60) {
    signal = 'bullish';
    signalLabel = 'BULLISH';
  } else if (score <= 40) {
    signal = 'bearish';
    signalLabel = 'BEARISH';
  }

  return NextResponse.json(
      {
        btc,
        assets,
        score: {
          value: Math.round(score),
          signal,
          label: signalLabel,
          components: {
            strength: Math.round(strength * 100) / 100,
            highBetaMomentum: Math.round(highBetaMomentum * 100) / 100,
            macroRisk: Math.round(macroRisk * 100) / 100,
            avgCorr: Math.round(avgCorr * 100) / 100,
          },
        },
        updatedAt: new Date().toISOString(),
        stale,
      },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        btc: STATIC_FALLBACK.btc,
        assets: STATIC_FALLBACK.assets.map((a) => ({
          ...a,
          ...BTC_CORRELATED_ASSETS.find((b) => b.ticker === a.ticker),
          beta: BTC_BETAS[a.ticker] ?? 1.0,
        })),
        updatedAt: new Date().toISOString(),
        stale: true,
        error: String(e),
      },
      { status: 200 }
    );
  }
}
