import { NextResponse } from 'next/server';
import {
  computeVWTSMOM,
  detectFundingDivergence,
  detectMarketRegime,
  computeMultiTFMACD,
  computeCompositeCryptoSignal,
} from '@/lib/crypto-advanced';

// Cache pour les données historiques
const fundingHistory: Record<string, number[]> = {};

async function fetchBinanceFunding(symbol: string): Promise<number> {
  try {
    const res = await fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}USDT`);
    const data = await res.json();
    return parseFloat(data.lastFundingRate || '0');
  } catch {
    return 0;
  }
}

async function fetchHyperliquidFunding(symbol: string): Promise<number> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'meta' }),
    });
    const data = await res.json();
    const meta = data.find((m: any) => m.name === symbol);
    return meta?.funding ?? 0;
  } catch {
    return 0;
  }
}

async function fetchPriceHistory(symbol: string, interval: string = '1h', limit: number = 200): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}USDT&interval=${interval}&limit=${limit}`
    );
    const data = await res.json();
    return data.map((k: any[]) => parseFloat(k[4]));
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    const symbols = ['BTC', 'ETH'];
    const signals: any[] = [];

    for (const symbol of symbols) {
      // Fetch prices pour différentes timeframes
      const [h1Prices, h4Prices, d1Prices] = await Promise.all([
        fetchPriceHistory(symbol, '1h', 200),
        fetchPriceHistory(symbol, '4h', 200),
        fetchPriceHistory(symbol, '1d', 200),
      ]);

      // VW-TSMOM
      const vwtsmom = computeVWTSMOM(d1Prices, {
        lookback: 126,
        volWindow: 20,
        volTarget: 0.15,
        minVol: 0.01,
      });

      // Funding Divergence
      const [hlFunding, binanceFunding] = await Promise.all([
        fetchHyperliquidFunding(symbol),
        fetchBinanceFunding(symbol),
      ]);

      // Store funding history
      if (!fundingHistory[symbol]) fundingHistory[symbol] = [];
      fundingHistory[symbol].push(binanceFunding);
      if (fundingHistory[symbol].length > 20) fundingHistory[symbol].shift();

      const funding = detectFundingDivergence(
        hlFunding,
        binanceFunding,
        fundingHistory[symbol]
      );

      // Market Regime
      const regime = detectMarketRegime(d1Prices, 30);

      // Multi-TF MACD
      const macd = computeMultiTFMACD(d1Prices, h4Prices, h1Prices);

      // Composite Signal
      const composite = computeCompositeCryptoSignal({
        vwtsmom,
        funding,
        regime,
        macd,
      });

      signals.push({
        symbol,
        vwtsmom: {
          direction: vwtsmom.direction,
          confidence: vwtsmom.confidence,
          positionSize: vwtsmom.positionSize,
          reasons: vwtsmom.reasons,
          meta: vwtsmom.meta,
        },
        funding: {
          signal: funding.signal,
          strength: funding.strength,
          confidence: funding.confidence,
          reasons: funding.reasons,
          meta: funding.meta,
        },
        regime: {
          regime: regime.regime,
          confidence: regime.confidence,
          expectedReturn: regime.expectedReturn,
          description: regime.description,
        },
        macd: {
          consensus: macd.consensus,
          confidence: macd.confidence,
          d1: macd.d1,
          h4: macd.h4,
          h1: macd.h1,
        },
        composite: {
          overall: composite.overall,
          confidence: composite.confidence,
          breakdown: composite.breakdown,
          reasons: composite.reasons,
        },
      });
    }

    return NextResponse.json(
      { signals, timestamp: Date.now() },
      { headers: { 'Cache-Control': 's-maxage=30, stale-while-revalidate=10' } }
    );
  } catch (e) {
    console.error('Crypto signals error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
