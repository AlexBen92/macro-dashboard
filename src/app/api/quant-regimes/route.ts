import { NextRequest, NextResponse } from 'next/server';
import {
  calculateMultiWindowHurst,
  testStationarity,
  calculateVarianceRatio,
  calculateEfficiency,
  calculateCompositeRegime,
  calculateNormalizedVolatility,
} from '@/lib/quant-regimes';

async function fetchPriceHistory(symbol: string, limit: number = 500): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=15m&limit=${limit}`
    );
    const data = await res.json();
    return data.map((k: any[]) => parseFloat(k[4])); // Close prices
  } catch {
    return [];
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol') || 'BTC';

    // Fetch price history
    const prices = await fetchPriceHistory(symbol, 500);

    if (prices.length < 128) {
      return NextResponse.json(
        { error: 'Not enough data' },
        { status: 400 }
      );
    }

    // Calculate all regime indicators
    const hurst = calculateMultiWindowHurst(prices);
    const stationarity = testStationarity(prices);
    const varianceRatio = calculateVarianceRatio(prices);
    const efficiency = calculateEfficiency(prices);
    const composite = calculateCompositeRegime(prices);
    const volatility = calculateNormalizedVolatility(prices);

    return NextResponse.json(
      {
        symbol,
        hurst: {
          hurst_64: hurst.hurst_64.hurst,
          hurst_96: hurst.hurst_96.hurst,
          hurst_128: hurst.hurst_128.hurst,
          consensus: hurst.consensus,
          regime_score: hurst.regime_score,
        },
        stationarity: {
          classification: stationarity.classification,
          confidence: stationarity.confidence,
        },
        variance_ratio: {
          variance_ratio: varianceRatio.variance_ratio,
          regime: varianceRatio.regime,
        },
        efficiency: {
          efficiency_ratio: efficiency.efficiency_ratio,
          choppiness_index: efficiency.choppiness_index,
          trend_strength: efficiency.trend_strength,
        },
        composite: {
          overall_regime: composite.overall_regime,
          trend_score: composite.trend_score,
          confidence: composite.confidence,
          recommended_strategies: composite.recommended_strategies,
          risk_multiplier: composite.risk_multiplier,
        },
        volatility: {
          realized_vol: volatility.realized_vol,
          vol_percentile: volatility.vol_percentile,
          vol_regime: volatility.vol_regime,
          range_position: volatility.range_position,
        },
        timestamp: Date.now(),
      },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=10' } }
    );
  } catch (e) {
    console.error('Quant regimes error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
