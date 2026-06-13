/**
 * BINANCE HISTORY API - Initial CVD data
 * Fetches recent trades to bootstrap CVD calculation before WebSocket kicks in
 */

const BINANCE_REST = 'https://api.binance.com';

export interface TradeHistory {
  id: number;
  price: string;
  qty: string;
  time: number;
  isBuyerMaker: boolean;
}

export interface CVDInitData {
  cvd5m: number;
  cvd15m: number;
  buyVol5m: number;
  sellVol5m: number;
  buyVol15m: number;
  sellVol15m: number;
}

/**
 * Fetch recent trades for a symbol (last 1000 trades = ~15-30min depending on volume)
 */
export async function fetchRecentTrades(symbol: string): Promise<TradeHistory[]> {
  try {
    const res = await fetch(`${BINANCE_REST}/api/v3/trades?symbol=${symbol}USDT&limit=1000`);
    if (!res.ok) throw new Error(`Binance API: ${res.status}`);
    const data = await res.json();
    return data.map((t: any) => ({
      id: t.id,
      price: t.price,
      qty: t.qty,
      time: t.time,
      isBuyerMaker: t.isBuyerMaker,
    }));
  } catch (err) {
    console.error(`[BinanceHistory] Failed for ${symbol}:`, err);
    return [];
  }
}

/**
 * Calculate initial CVD from trade history
 */
export function calculateInitialCVD(trades: TradeHistory[], now: number = Date.now()): CVDInitData {
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fifteenMinAgo = now - 15 * 60 * 1000;

  const trades5m = trades.filter(t => t.time >= fiveMinAgo);
  const trades15m = trades.filter(t => t.time >= fifteenMinAgo);

  const buyVol5m = trades5m.filter(t => !t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty), 0);
  const sellVol5m = trades5m.filter(t => t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty), 0);
  const buyVol15m = trades15m.filter(t => !t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty), 0);
  const sellVol15m = trades15m.filter(t => t.isBuyerMaker).reduce((sum, t) => sum + parseFloat(t.qty), 0);

  const total5m = buyVol5m + sellVol5m;
  const total15m = buyVol15m + sellVol15m;

  return {
    cvd5m: total5m > 0 ? (buyVol5m / total5m) * 100 : 50,
    cvd15m: total15m > 0 ? (buyVol15m / total15m) * 100 : 50,
    buyVol5m,
    sellVol5m,
    buyVol15m,
    sellVol15m,
  };
}

/**
 * Fetch initial CVD for a symbol (bootstrapping)
 */
export async function fetchInitialCVD(symbol: string): Promise<CVDInitData> {
  const trades = await fetchRecentTrades(symbol);
  return calculateInitialCVD(trades);
}

/**
 * Batch fetch for multiple symbols
 */
export async function fetchBatchInitialCVD(symbols: string[]): Promise<Map<string, CVDInitData>> {
  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      const cvd = await fetchInitialCVD(symbol);
      return { symbol, cvd };
    })
  );

  const map = new Map<string, CVDInitData>();
  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      map.set(result.value.symbol, result.value.cvd);
    } else {
      // Fallback to neutral on error
      map.set(symbols[idx], { cvd5m: 50, cvd15m: 50, buyVol5m: 0, sellVol5m: 0, buyVol15m: 0, sellVol15m: 0 });
    }
  });

  return map;
}
