import { NextResponse } from 'next/server';
import { runBacktest, type BtCandle, BACKTEST_FEE } from '@/lib/backtest';

const FEE_THRESHOLD = 0.001; // 0.1% threshold
const MIN_SCORE = 70;

// Top scoring crypto markets from Hyperliquid (high OI + volume)
const HIGH_SCORE_COINS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT',
  'ADAUSDT', 'AVAXUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT',
  'UNIUSDT', 'LTCUSDT', 'BCHUSDT', 'ATOMUSDT', 'NEARUSDT',
  'APTUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT', 'SEIUSDT',
  'TIAUSDT', 'INJUSDT', 'FETUSDT', 'RNDRUSDT', 'GRTUSDT'
];

async function fetchCandles(symbol: string): Promise<BtCandle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=1500`;
  const res = await fetch(url, { next: { revalidate: 60 } });
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

async function fetchHyperliquidMarkets(): Promise<Set<string>> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return new Set();
    const data = await res.json() as { symbols: Array<{ name: string }> };
    return new Set(data.symbols.map(s => s.name.toUpperCase()));
  } catch {
    return new Set();
  }
}

async function scoreMarket(symbol: string, candles: BtCandle[]): Promise<number> {
  if (candles.length < 50) return 0;

  const closes = candles.map(c => c.c);
  const volumes = candles.map(c => c.v);

  // Price momentum (24h change)
  const priceChange = ((closes[closes.length - 1] - closes[closes.length - 24]) / closes[closes.length - 24]) * 100;

  // Volume trend
  const recentVol = volumes.slice(-24).reduce((a, b) => a + b, 0) / 24;
  const prevVol = volumes.slice(-48, -24).reduce((a, b) => a + b, 0) / 24;
  const volChange = prevVol > 0 ? ((recentVol - prevVol) / prevVol) * 100 : 0;

  // Volatility (ATR-based)
  const atr = calculateATR(candles.slice(-14));
  const avgPrice = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const volatility = (atr / avgPrice) * 100;

  // Scoring
  let score = 50;

  // Momentum score (0-20)
  if (Math.abs(priceChange) > 5) score += 20;
  else if (Math.abs(priceChange) > 3) score += 15;
  else if (Math.abs(priceChange) > 1) score += 10;

  // Volume confirmation (0-15)
  if (volChange > 20) score += 15;
  else if (volChange > 10) score += 10;
  else if (volChange > 0) score += 5;

  // Volatility suitability (0-15) - sweet spot 2-5%
  if (volatility >= 2 && volatility <= 5) score += 15;
  else if (volatility >= 1 && volatility <= 7) score += 10;
  else if (volatility > 8) score -= 5; // Too volatile

  return Math.max(0, Math.min(99, score));
}

function calculateATR(candles: BtCandle[]): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c),
    ));
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  try {
    const url = new URL(request.url);
    const minScore = parseInt(url.searchParams.get('minScore') ?? String(MIN_SCORE), 10);
    const maxCoins = parseInt(url.searchParams.get('maxCoins') ?? '10', 10);

    // Fetch Hyperliquid markets for reference
    const hlMarkets = await fetchHyperliquidMarkets();

    // Score all markets
    const scored: Array<{ symbol: string; score: number; candles: BtCandle[] }> = [];

    for (const symbol of HIGH_SCORE_COINS) {
      try {
        const candles = await fetchCandles(symbol);
        const score = await scoreMarket(symbol, candles);
        const isOnHL = hlMarkets.has(symbol.replace('USDT', ''));

        if (score >= minScore) {
          scored.push({ symbol, score, candles });
        }

        // Limit concurrent requests
        await new Promise(r => setTimeout(r, 50));
      } catch (err) {
        console.error(`Error scoring ${symbol}:`, err);
      }
    }

    // Sort by score descending and take top N
    const topMarkets = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, maxCoins);

    // Run backtests on top-scoring markets
    const results = await Promise.all(
      topMarkets.map(async ({ symbol, score, candles }) => {
        const result = runBacktest(candles, symbol.replace('USDT', ''));
        return {
          ...result,
          opportunityScore: score,
          feeRate: FEE_THRESHOLD,
        };
      })
    );

    // Aggregate stats
    const totalTrades = results.reduce((a, r) => a + r.totalTrades, 0);
    const totalWins = results.reduce((a, r) => a + r.wins, 0);
    const totalLosses = results.reduce((a, r) => a + r.losses, 0);
    const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
    const totalFees = results.reduce((a, r) => a + r.totalFees, 0);
    const winRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

    return NextResponse.json({
      results,
      summary: {
        totalMarkets: results.length,
        totalTrades,
        totalWins,
        totalLosses,
        winRate: Math.round(winRate * 10) / 10,
        totalPnl: Math.round(totalPnl * 100) / 100,
        totalPnlPct: Math.round((totalPnl / (10_000 * results.length)) * 10000) / 100,
        totalFees: Math.round(totalFees * 100) / 100,
        avgScore: results.length > 0
          ? Math.round(results.reduce((a, r) => a + r.opportunityScore, 0) / results.length)
          : 0,
      },
      config: {
        minScore,
        feeThreshold: FEE_THRESHOLD,
        maxCoins,
      },
      fetchedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    });
  } catch (err) {
    return NextResponse.json({
      error: String(err),
      fetchedAt: new Date().toISOString(),
    }, { status: 500 });
  }
}
