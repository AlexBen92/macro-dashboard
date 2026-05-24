import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidMetaAndAssetCtxs, formatMarketTableRows, computeMonitorStats } from '@/lib/market-data';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

interface PrevDataRequest {
  symbol: string;
  oi: number;
  vol: number;
}

export async function GET(request: NextRequest) {
  try {
    // Get previous data from query param (sent by client)
    const prevDataParam = request.nextUrl.searchParams.get('prevData');
    let prevDataMap: Map<string, { oi: number; vol: number }> = new Map();

    if (prevDataParam) {
      try {
        const parsed: PrevDataRequest[] = JSON.parse(prevDataParam);
        prevDataMap = new Map(parsed.map(p => [p.symbol, { oi: p.oi, vol: p.vol }]));
      } catch {
        // Invalid param, ignore
      }
    }

    const hlData = await getHyperliquidMetaAndAssetCtxs();

    if (hlData.universe.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch Hyperliquid data', rows: [], stats: null },
        { status: 200 }
      );
    }

    const rows = formatMarketTableRows(hlData, {
      includeStablecoins: false,
      minVolume: 100000,   // Réduit de 500K à 100K
      minOpenInterest: 50000,  // Réduit de 100K à 50K
    }, prevDataMap);

    const stats = computeMonitorStats(rows);

    // Return current data for client to store and send back next time
    const currentDataForCache = rows
      .filter(r => r.openInterest !== null && r.volume24h !== null)
      .map(r => ({ symbol: r.symbol, oi: r.openInterest!, vol: r.volume24h! }));

    return NextResponse.json({
      rows,
      stats,
      lastUpdate: Date.now(),
      cacheData: currentDataForCache,
    });
  } catch (error) {
    console.error('Hyperliquid monitor API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        rows: [],
        stats: null,
        cacheData: [],
      },
      { status: 200 }
    );
  }
}
