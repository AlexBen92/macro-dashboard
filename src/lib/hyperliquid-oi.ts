/**
 * HYPERLIQUID OI HISTORY
 * Fetches Open Interest history to calculate OI momentum (L2 setup component)
 */

const HL_API = 'https://api.hyperliquid.xyz/info';

export interface OIHistoryPoint {
  timestamp: number;
  oi: number;
}

export interface OIMetrics {
  current: number;
  change5m: number; // % change over 5m
  change15m: number; // % change over 15m
  change1h: number; // % change over 1h
  trend: 'up' | 'down' | 'stable';
}

/**
 * Fetch OI history from Hyperliquid
 * Note: Hyperliquid doesn't directly provide OI history, we'll infer from funding snapshots
 */
export async function fetchOIHistory(symbol: string): Promise<OIHistoryPoint[]> {
  try {
    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'fundingHistory',
        asset: symbol,
        startTime: Date.now() - 24 * 60 * 60 * 1000, // 24h back
      }),
    });

    if (!res.ok) throw new Error(`HL API: ${res.status}`);
    const data = await res.json();

    // Funding history gives us OI snapshots
    return data.map((point: any) => ({
      timestamp: point.time,
      oi: parseFloat(point.openInterest || '0'),
    })).filter((p: OIHistoryPoint) => p.oi > 0);
  } catch (err) {
    console.error(`[HL OI] Failed for ${symbol}:`, err);
    return [];
  }
}

/**
 * Calculate OI metrics from history
 */
export function calculateOIMetrics(history: OIHistoryPoint[], currentPrice: number): OIMetrics {
  if (history.length < 2) {
    return {
      current: 0,
      change5m: 0,
      change15m: 0,
      change1h: 0,
      trend: 'stable',
    };
  }

  const now = Date.now();
  const fiveMinAgo = now - 5 * 60 * 1000;
  const fifteenMinAgo = now - 15 * 60 * 1000;
  const oneHourAgo = now - 60 * 60 * 1000;

  const current = history[history.length - 1].oi * currentPrice; // Convert to USD

  // Find closest points
  const point5m = history.find(p => Math.abs(p.timestamp - fiveMinAgo) < 60000);
  const point15m = history.find(p => Math.abs(p.timestamp - fifteenMinAgo) < 60000);
  const point1h = history.find(p => Math.abs(p.timestamp - oneHourAgo) < 60000);

  const change5m = point5m ? ((current - point5m.oi * currentPrice) / (point5m.oi * currentPrice)) * 100 : 0;
  const change15m = point15m ? ((current - point15m.oi * currentPrice) / (point15m.oi * currentPrice)) * 100 : 0;
  const change1h = point1h ? ((current - point1h.oi * currentPrice) / (point1h.oi * currentPrice)) * 100 : 0;

  // Determine trend
  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (change15m > 2) trend = 'up';
  else if (change15m < -2) trend = 'down';

  return {
    current,
    change5m,
    change15m,
    change1h,
    trend,
  };
}

/**
 * Fetch OI metrics for a symbol
 */
export async function fetchOIMetrics(symbol: string, currentPrice: number): Promise<OIMetrics> {
  const history = await fetchOIHistory(symbol);
  return calculateOIMetrics(history, currentPrice);
}

/**
 * Batch fetch OI metrics
 */
export async function fetchBatchOIMetrics(symbols: string[], prices: Map<string, number>): Promise<Map<string, OIMetrics>> {
  const results = await Promise.allSettled(
    symbols.map(async (symbol, idx) => {
      const price = prices.get(symbol) || 0;
      const metrics = await fetchOIMetrics(symbol, price);
      return { symbol, metrics };
    })
  );

  const map = new Map<string, OIMetrics>();
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      map.set(result.value.symbol, result.value.metrics);
    }
  });

  return map;
}
