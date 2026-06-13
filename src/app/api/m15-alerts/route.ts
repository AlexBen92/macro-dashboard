/**
 * M15 ALERTS API - Send scores to Telegram
 * POST /api/m15-alerts
 */

import { NextRequest, NextResponse } from 'next/server';
import { computeM15Score } from '@/lib/m15-scoring';
import { sendBatchAlerts, sendSummaryAlert, type TelegramAlert } from '@/lib/telegram-alerts';
import {
  fetchHLMeta,
  fetchHLTrades,
  fetchBinanceKlines,
  fetchBinanceOrderBook,
  computeMetricsFromKlines,
  computeOrderBookImbalance,
  mapHLToBinance,
} from '@/lib/multi-source-data';
import { fetchBatchInitialCVD } from '@/lib/binance-history';
import { fetchBatchOIMetrics } from '@/lib/hyperliquid-oi';

const HL_API = 'https://api.hyperliquid.xyz/info';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type = 'summary', symbols } = body;

    // Fetch Hyperliquid metadata
    const hlRes = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
    });
    const hlData = await hlRes.json();
    const meta = hlData[0]?.universe || [];
    const ctxs = hlData[1] || [];

    // Session score (fixed for API calls)
    const sessionScore = 100; // Assume active session for alerts

    // Default symbols if not provided
    const topSymbols = symbols || ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX', 'SUI', 'ARB', 'OP', 'LINK'];

    // Fetch real L2 data in parallel
    const [cvdData, oiData] = await Promise.all([
      fetchBatchInitialCVD(topSymbols),
      fetchBatchOIMetrics(topSymbols, new Map()),
    ]);

    // Process tokens
    const alerts: TelegramAlert[] = [];

    for (const symbol of topSymbols) {
      const idx = meta.findIndex((m: { name: string }) => m.name === symbol);
      if (idx === -1) continue;

      const ctx = ctxs[idx] || {};
      const price = parseFloat(ctx.markPx || 0);
      const funding = parseFloat(ctx.funding || 0) * 100;
      const vol24h = parseFloat(ctx.dayNtlVlm || 0);
      const oi = parseFloat(ctx.openInterest || 0) * price;
      const prevPx = parseFloat(ctx.prevDayPx || price);
      const change24h = prevPx > 0 ? ((price - prevPx) / prevPx) * 100 : 0;

      if (price === 0 || vol24h < 100_000) continue;

      const binanceSymbol = mapHLToBinance(symbol);

      // Fetch Binance data
      const [klines5m, klines15m, orderBook] = await Promise.all([
        fetchBinanceKlines(binanceSymbol, '5m', 20).catch(() => []),
        fetchBinanceKlines(binanceSymbol, '15m', 50).catch(() => []),
        fetchBinanceOrderBook(binanceSymbol, 20).catch(() => null),
      ]);

      const metrics5m = computeMetricsFromKlines(klines5m);
      const metrics15m = computeMetricsFromKlines(klines15m);
      const obMetrics = orderBook ? computeOrderBookImbalance(orderBook) : {
        imbalance5: 50, imbalance10: 50, depth5: 0, depth10: 0, spread: 0
      };

      // Get L2 data
      const cvd = cvdData.get(symbol) || { cvd5m: 50, cvd15m: 50, buyVol5m: 0, sellVol5m: 0, buyVol15m: 0, sellVol15m: 0 };
      const oiMetrics = oiData.get(symbol);
      const oiChange = oiMetrics?.change15m || 0;

      const tokenData = {
        symbol,
        price,
        funding,
        fundingRate: funding / 100,
        oi,
        oiChange,
        vol24h,
        change24h,
        markPx: price,
        spread: obMetrics.spread,
        bidAskImbalance: obMetrics.imbalance5,
        obDepth5: obMetrics.depth5,
        obDepth10: obMetrics.depth10,
        slippageEst: obMetrics.spread * 2,
        cvd5m: cvd.cvd5m,
        cvd15m: cvd.cvd15m,
        cvdBuyVol5m: cvd.buyVol5m,
        cvdSellVol5m: cvd.sellVol5m,
        cvdBuyVol15m: cvd.buyVol15m,
        cvdSellVol15m: cvd.sellVol15m,
        deltaVolume: metrics5m.volume,
        vwapDist: metrics15m.vwap > 0 ? ((price - metrics15m.vwap) / price) : 0,
        atr5m: metrics5m.atr,
        atr15m: metrics15m.atr,
        atr1h: 0,
        realizedVol: metrics15m.atr / price,
        squeezeProb: metrics15m.atr > 0 ? Math.min(1, metrics15m.atr / price * 50) : 0,
      };

      const score = computeM15Score(tokenData, sessionScore);

      alerts.push({
        symbol,
        finalScore: score.finalScore,
        action: score.action,
        direction: score.direction,
        confidence: score.confidenceScores,
        layer1: { score: score.layer1.score, reasons: score.layer1.reasons },
        layer2: { total: score.layer2.total, reasons: score.layer2.reasons },
        layer3: { total: score.layer3.total, reasons: score.layer3.reasons },
        price,
        funding,
        cvd15m: cvd.cvd15m,
        oiChange,
      });
    }

    // Sort by final score
    alerts.sort((a, b) => b.finalScore - a.finalScore);

    // Send alerts based on type
    if (type === 'summary') {
      await sendSummaryAlert(alerts);
      return NextResponse.json({ success: true, type: 'summary', sent: true });
    } else {
      const sent = await sendBatchAlerts(alerts);
      return NextResponse.json({ success: true, type: 'batch', sent });
    }
  } catch (err) {
    console.error('[M15 Alerts API] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}

// Also support GET for simple summary
export async function GET() {
  try {
    // Quick summary without full data fetch
    const message = `📊 *M15 Scanner Ready*\n\nSend POST request with:\n- type: "summary" or "batch"\n- symbols: ["BTC", "ETH", ...]`;

    // Just return info, don't send alert
    return NextResponse.json({
      success: true,
      message: 'M15 Alerts API ready',
      usage: {
        method: 'POST',
        body: { type: 'summary or batch', symbols: 'array of symbols' },
      },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
