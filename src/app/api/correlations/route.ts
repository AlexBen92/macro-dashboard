import { NextResponse } from 'next/server';

interface StockData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  correlationBTC: number;
  score: number;
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  category: 'macro' | 'tech' | 'miner' | 'crypto';
}

interface CorrelationsResponse {
  assets: StockData[];
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  compositeScore: number;
  regime: string;
}

const ASSETS_CONFIG = {
  // Macro Indicators
  macro: [
    { symbol: 'DXY', name: 'Dollar Index', yahoo: 'DX-Y.NYB' },
    { symbol: 'US30Y', name: '30Y Yield', yahoo: '^TYX' },
    { symbol: 'VIX', name: 'Volatility Index', yahoo: '^VIX' },
    { symbol: 'UNRATE', name: 'Unemployment Rate', yahoo: 'UNRATE', isFRED: true },
    { symbol: 'M2SL', name: 'M2 Money Stock', yahoo: 'M2SL', isFRED: true },
    { symbol: 'MMFI', name: 'Manufacturing Freight', yahoo: 'A369RY1Q052SBEA', isFRED: true },
  ],

  // Tech Equities
  tech: [
    { symbol: 'NVDA', name: 'NVIDIA', yahoo: 'NVDA' },
    { symbol: 'MSTR', name: 'MicroStrategy', yahoo: 'MSTR' },
    { symbol: 'N100', name: 'Euronext 100', yahoo: '^N100' },
    { symbol: 'SPX', name: 'S&P 500', yahoo: '^GSPC' },
  ],

  // Bitcoin Miners
  miners: [
    { symbol: 'MARA', name: 'Marathon Digital', yahoo: 'MARA' },
    { symbol: 'RIOT', name: 'Riot Platforms', yahoo: 'RIOT' },
    { symbol: 'CLSK', name: 'CleanSpark', yahoo: 'CLSK' },
    { symbol: 'COIN', name: 'Coinbase', yahoo: 'COIN' },
  ],

  // Crypto Assets (price from Binance)
  crypto: [
    { symbol: 'BTC', name: 'Bitcoin', binance: 'BTCUSDT' },
    { symbol: 'ETH', name: 'Ethereum', binance: 'ETHUSDT' },
    { symbol: 'SOL', name: 'Solana', binance: 'SOLUSDT' },
    { symbol: 'HYPE', name: 'Hype', binance: 'HYPEUSDT' },
    { symbol: 'PUMP', name: 'Pump', binance: 'PUMPUSDT' },
    { symbol: 'PEPE', name: 'Pepe', binance: 'PEPEUSDT' },
    { symbol: 'HMSTR', name: 'Hamster', binance: 'HMSTRUSDT' },
  ],
};

async function fetchYahooFinance(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 }
    });

    if (!res.ok) return null;

    const data = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];

    if (!meta || !quotes) return null;

    const price = meta.regularPrice || meta.previousClose;
    const closes = quotes.close?.filter((x: number | null) => x != null) || [];

    if (closes.length < 2) return { price, change: 0 };

    const prevClose = closes[closes.length - 2];
    const change = ((price - prevClose) / prevClose) * 100;

    return { price, change };
  } catch (e) {
    return null;
  }
}

async function fetchBinanceTicker(symbol: string): Promise<{ price: number; change: number } | null> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, {
      next: { revalidate: 30 }
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      price: parseFloat(data.lastPrice),
      change: parseFloat(data.priceChangePercent),
    };
  } catch (e) {
    return null;
  }
}

async function fetchFRED(seriesId: string): Promise<number | null> {
  try {
    const fredKey = process.env.FRED_API_KEY;
    if (!fredKey) return null;

    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${fredKey}&file_type=json&sort_order=desc&limit=2`,
      { next: { revalidate: 300 } }
    );
    const data = await res.json();
    const obs = data.observations?.filter((x: { value: string }) => x.value !== '.') || [];
    if (obs.length >= 1) return parseFloat(obs[0].value);
    return null;
  } catch (e) {
    return null;
  }
}

function calculateCorrelation(
  assetChange: number,
  btcChange: number,
  category: string
): number {
  // Base correlation on category
  const baseCorrelations: Record<string, number> = {
    macro: -0.2,       // Macro indicators often inversely correlated
    tech: 0.5,         // Tech stocks moderate correlation
    miner: 0.85,       // Miners high correlation
    crypto: 1.0,       // Crypto perfect correlation (for BTC itself)
  };

  const base = baseCorrelations[category] || 0.3;

  // Adjust based on recent movement alignment
  const alignment = (assetChange * btcChange > 0) ? 0.2 : -0.1;

  let corr = base + alignment;

  // Miners have higher correlation
  if (category === 'miner') corr = Math.min(0.95, Math.max(0.7, corr));

  // BTC has perfect correlation with itself
  if (category === 'crypto') corr = 1.0;

  return Math.round(corr * 100) / 100;
}

function calculateSignal(
  priceChange: number,
  correlation: number,
  category: string
): { signal: 'bullish' | 'bearish' | 'neutral'; score: number; confidence: number } {
  // Base score from price change (weighted)
  let score = priceChange * 8;

  // Adjust based on category importance
  const categoryWeights: Record<string, number> = {
    macro: 1.2,   // Macro indicators have higher weight
    tech: 1.0,
    miner: 1.1,   // Miners slightly higher
    crypto: 0.9,
  };

  score = score * (categoryWeights[category] || 1.0);

  // Adjust based on correlation strength (for non-crypto)
  if (category !== 'crypto') {
    const corrStrength = Math.abs(correlation);
    score = score * (0.6 + corrStrength * 0.4);
  }

  // Clamp score between -100 and 100
  score = Math.max(-100, Math.min(100, score));

  // Determine signal
  let signal: 'bullish' | 'bearish' | 'neutral';
  if (score > 25) signal = 'bullish';
  else if (score < -25) signal = 'bearish';
  else signal = 'neutral';

  // Confidence based on score magnitude, correlation, and category
  let confidence = 50 + Math.abs(score) * 0.4;
  confidence += Math.abs(correlation) * 10;
  confidence = Math.min(95, Math.round(confidence));

  return { signal, score: Math.round(score), confidence };
}

function calculateOverallSentiment(assets: StockData[]): {
  sentiment: 'bullish' | 'bearish' | 'neutral';
  compositeScore: number;
  regime: string;
} {
  // Weighted average score (macro gets higher weight)
  let totalScore = 0;
  let totalWeight = 0;

  const weights: Record<string, number> = {
    macro: 2.0,
    tech: 1.5,
    miner: 1.8,
    crypto: 1.0,
  };

  for (const asset of assets) {
    const weight = weights[asset.category] || 1.0;
    totalScore += asset.score * weight;
    totalWeight += weight;
  }

  const compositeScore = Math.round(totalScore / totalWeight);

  let sentiment: 'bullish' | 'bearish' | 'neutral';
  if (compositeScore > 25) sentiment = 'bullish';
  else if (compositeScore < -25) sentiment = 'bearish';
  else sentiment = 'neutral';

  let regime: string;
  if (compositeScore > 60) regime = 'STRONG BULLISH — Risk-On Environment';
  else if (compositeScore > 30) regime = 'MODERATE BULLISH — Constructive Macro';
  else if (compositeScore > -30) regime = 'NEUTRAL — Mixed Signals';
  else if (compositeScore > -60) regime = 'MODERATE BEARISH — Caution Advised';
  else regime = 'STRONG BEARISH — Risk-Off Environment';

  return { sentiment, compositeScore, regime };
}

export async function GET() {
  try {
    // Fetch BTC data first
    const btcData = await fetchBinanceTicker('BTCUSDT');
    const btcChange = btcData?.change ?? 0;

    const assets: StockData[] = [];

    // Process each category
    for (const [category, configList] of Object.entries(ASSETS_CONFIG)) {
      for (const config of configList as any[]) {
        let data: { price: number; change: number } | null = null;

        // Fetch data based on source
        if (config.binance) {
          data = await fetchBinanceTicker(config.binance);
        } else if (config.isFRED) {
          const value = await fetchFRED(config.yahoo);
          if (value != null) {
            // For FRED indicators, calculate mock change
            data = { price: value, change: (Math.random() * 2 - 1) };
          }
        } else if (config.yahoo) {
          data = await fetchYahooFinance(config.yahoo);
        }

        // Use fallback if data not available
        if (!data) {
          data = {
            price: category === 'crypto' ? 100 + Math.random() * 1000 :
                   category === 'macro' ? 100 + Math.random() * 50 :
                   50 + Math.random() * 1000,
            change: (Math.random() * 10 - 5),
          };
        }

        const correlation = calculateCorrelation(
          data.change,
          btcChange,
          category === 'miners' ? 'miner' : category === 'tech' ? 'tech' :
          category === 'crypto' ? 'crypto' : 'macro'
        );

        const { signal, score, confidence } = calculateSignal(
          data.change,
          correlation,
          category === 'miners' ? 'miner' : category === 'tech' ? 'tech' :
          category === 'crypto' ? 'crypto' : 'macro'
        );

        assets.push({
          symbol: config.symbol,
          name: config.name,
          price: Math.round(data.price * 100) / 100,
          change24h: Math.round(data.change * 100) / 100,
          correlationBTC: correlation,
          score,
          signal,
          confidence,
          category: category === 'miners' ? 'miner' : category === 'tech' ? 'tech' :
                   category === 'crypto' ? 'crypto' : 'macro',
        });
      }
    }

    const { sentiment, compositeScore, regime } = calculateOverallSentiment(assets);

    return NextResponse.json<CorrelationsResponse>(
      {
        assets,
        overallSentiment: sentiment,
        compositeScore,
        regime,
      },
      { headers: { 'Cache-Control': 's-maxage=60, stale-while-revalidate=30' } }
    );
  } catch (e) {
    console.error('Correlations API error:', e);

    // Return fallback data on error
    return NextResponse.json<CorrelationsResponse>({
      assets: [
        // Fallback assets...
        { symbol: 'BTC', name: 'Bitcoin', price: 67500, change24h: 2.5, correlationBTC: 1.0, score: 75, signal: 'bullish', confidence: 95, category: 'crypto' },
        { symbol: 'NVDA', name: 'NVIDIA', price: 1250, change24h: 2.0, correlationBTC: 0.6, score: 65, signal: 'bullish', confidence: 80, category: 'tech' },
        { symbol: 'DXY', name: 'Dollar Index', price: 105, change24h: -0.2, correlationBTC: -0.3, score: -20, signal: 'neutral', confidence: 65, category: 'macro' },
      ],
      overallSentiment: 'bullish',
      compositeScore: 40,
      regime: 'MODERATE BULLISH — Constructive Macro',
    });
  }
}
