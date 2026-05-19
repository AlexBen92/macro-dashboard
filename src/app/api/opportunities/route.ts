import { NextRequest, NextResponse } from 'next/server';
import { getHyperliquidMetaAndAssetCtxs, formatMarketTableRows } from '@/lib/market-data';
import { rankOpportunities, filterByDirection, filterByStrategy } from '@/lib/opportunities';

export const revalidate = 30;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const maxCount = parseInt(searchParams.get('count') ?? '10');
    const filter = searchParams.get('filter'); // 'long', 'short', 'watch', or strategy name

    // Get previous data from query param (sent by client)
    const prevDataParam = request.nextUrl.searchParams.get('prevData');
    let prevDataMap: Map<string, { oi: number; vol: number }> = new Map();

    if (prevDataParam) {
      try {
        const parsed = JSON.parse(prevDataParam);
        prevDataMap = new Map(parsed.map((p: any) => [p.symbol, { oi: p.oi, vol: p.vol }]));
      } catch {
        // Invalid param, ignore
      }
    }

    // Fetch market data
    const hlData = await getHyperliquidMetaAndAssetCtxs();

    if (hlData.universe.length === 0) {
      return NextResponse.json(
        { error: 'Failed to fetch market data', opportunities: [], stats: null },
        { status: 200 }
      );
    }

    // Format market rows
    const rows = formatMarketTableRows(hlData, {
      includeStablecoins: false,
      minVolume: 500_000,
      minOpenInterest: 100_000,
    }, prevDataMap);

    // Rank opportunities
    let opportunities = rankOpportunities(rows, prevDataMap, maxCount);

    // Apply filter if specified
    if (filter && filter !== 'all') {
      if (filter === 'long' || filter === 'short' || filter === 'watch') {
        opportunities = filterByDirection(opportunities, filter as any);
      } else {
        opportunities = filterByStrategy(opportunities, filter);
      }
    }

    // Prepare cache data for next request
    const currentDataForCache = rows
      .filter(r => r.openInterest !== null && r.volume24h !== null)
      .map(r => ({ symbol: r.symbol, oi: r.openInterest!, vol: r.volume24h! }));

    // Calculate stats
    const stats = {
      total: opportunities.length,
      byDirection: {
        long: opportunities.filter(o => o.direction === 'long').length,
        short: opportunities.filter(o => o.direction === 'short').length,
        watch: opportunities.filter(o => o.direction === 'watch').length,
      },
      avgScore: opportunities.length > 0
        ? opportunities.reduce((sum, o) => sum + o.opportunityScore, 0) / opportunities.length
        : 0,
    };

    return NextResponse.json({
      opportunities,
      stats,
      lastUpdate: Date.now(),
      cacheData: currentDataForCache,
    });
  } catch (error) {
    console.error('Opportunities API error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        opportunities: [],
        stats: null,
      },
      { status: 200 }
    );
  }
}
