import { NextResponse } from 'next/server';
import { getHyperliquidMetaAndAssetCtxs, formatMarketTableRows, computeMonitorStats } from '@/lib/market-data';
import { getPrevDataMap, updatePrevDataMap } from '@/lib/market-data/cache';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get previous data for trend comparison
    const prevDataMap = getPrevDataMap();

    const hlData = await getHyperliquidMetaAndAssetCtxs();

    if (hlData.universe.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch Hyperliquid data', rows: [], stats: null },
        { status: 200 }
      );
    }

    const rows = formatMarketTableRows(hlData, {
      includeStablecoins: false,
      minVolume: 500000,
      minOpenInterest: 100000,
    }, prevDataMap);

    // Update cache with current data for next comparison
    updatePrevDataMap(rows);

    const stats = computeMonitorStats(rows);

    return NextResponse.json({
      rows,
      stats,
      lastUpdate: Date.now(),
    });
  } catch (error) {
    console.error('Hyperliquid monitor API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        rows: [],
        stats: null,
      },
      { status: 200 }
    );
  }
}
