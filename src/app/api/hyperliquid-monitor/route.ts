import { NextResponse } from 'next/server';
import { getHyperliquidMetaAndAssetCtxs, formatMarketTableRows, computeMonitorStats } from '@/lib/market-data';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
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
    });

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
