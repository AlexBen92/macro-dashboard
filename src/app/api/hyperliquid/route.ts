import { NextRequest, NextResponse } from 'next/server';

const HYPERLIQUID_BASE_URL = 'https://api.hyperliquid.xyz';

interface HyperliquidMeta {
  asset: string;
  ctx: string;
  pair: string;
  type: string;
  markPx: string;
  position: string;
  liquidationPrice: string;
  leverage: any;
  marginUsed: any;
  notionalValue: number;
  maxLeverage: number;
  openInterest: number;
  funding: number;
  predictionFunding: number;
  predictFundingPrice: number;
  oraclePx: string;
  volume24h: number;
}

interface HyperliquidTrade {
  coin: string;
  side: string;
  px: string;
  sz: number;
  time: number;
  startPosition: string;
  closedPnl: number;
  closedPnlRoe: number;
  fee: number;
  closedPnlRoeTimestamp: number;
}

interface HyperliquidPosition {
  position: {
    coin: string;
    szi: string;
    leverageValue: {
      value: number;
      rawUsd: number;
    };
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string;
    entryPx: string;
    marginUsed: string;
    leverageInfo: {
      type: string;
      value: number;
      rawUsd: number;
    };
    positionValue: string;
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { method, params } = body;

  try {
    let data;

    switch (method) {
      case 'meta':
        // Get metadata for all perps
        const metaResponse = await fetch(`${HYPERLIQUID_BASE_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
        });

        if (!metaResponse.ok) {
          throw new Error(`Hyperliquid meta error: ${metaResponse.statusText}`);
        }

        const metaData = await metaResponse.json();

        // Extract data from response structure: [0] = {universe}, [1] = [assetCtxs]
        data = metaData[0]?.universe || [];
        break;

      case 'all_mids':
        // Get mid prices for all assets
        const pricesResponse = await fetch(`${HYPERLIQUID_BASE_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: 'allMids' }),
        });

        if (!pricesResponse.ok) {
          throw new Error(`Hyperliquid prices error: ${pricesResponse.statusText}`);
        }

        const pricesData = await pricesResponse.json();
        data = pricesData;
        break;

      case 'user_fills':
        // Get user trade history
        if (!params?.address) {
          throw new Error('Address required for user_fills');
        }

        const fillsResponse = await fetch(`${HYPERLIQUID_BASE_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'userFills',
            user: params.address,
          }),
        });

        if (!fillsResponse.ok) {
          throw new Error(`Hyperliquid fills error: ${fillsResponse.statusText}`);
        }

        const fillsData = await fillsResponse.json();
        data = fillsData;
        break;

      case 'user_state':
        // Get user positions and account state
        if (!params?.address) {
          throw new Error('Address required for user_state');
        }

        const stateResponse = await fetch(`${HYPERLIQUID_BASE_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'clearinghouseState',
            user: params.address,
          }),
        });

        if (!stateResponse.ok) {
          throw new Error(`Hyperliquid state error: ${stateResponse.statusText}`);
        }

        const stateData = await stateResponse.json();
        data = stateData;
        break;

      case 'l2book':
        // Get order book depth
        if (!params?.coin) {
          throw new Error('Coin required for l2book');
        }

        const bookResponse = await fetch(`${HYPERLIQUID_BASE_URL}/info`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: 'l2Book',
            coin: params.coin,
          }),
        });

        if (!bookResponse.ok) {
          throw new Error(`Hyperliquid book error: ${bookResponse.statusText}`);
        }

        const bookData = await bookResponse.json();
        data = bookData;
        break;

      default:
        throw new Error('Invalid method');
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('Hyperliquid API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackData: null,
      },
      { status: 200 }
    );
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const method = searchParams.get('method');

  try {
    if (method === 'meta') {
      const metaResponse = await fetch(`${HYPERLIQUID_BASE_URL}/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });

      if (!metaResponse.ok) {
        throw new Error(`Hyperliquid meta error: ${metaResponse.statusText}`);
      }

      const metaData = await metaResponse.json();

      // Transform data for easier use - renvoyer TOUS les tokens pour le scanner
      // Structure Hyperliquid: [0] = {universe}, [1] = [assetCtxs]
      const universe = metaData[0]?.universe || [];
      const assetCtxs = metaData[1] || [];
      const transformed = universe
        .map((coin: any, i: number) => {
          const ctx = assetCtxs[i] || {};
          return {
            symbol: coin.name,
            name: coin.name,
            price: parseFloat(ctx.markPx || coin.markPx || 0),
            volume24h: parseFloat(ctx.dayNtlVlm || coin.volume24h || 0),
            openInterest: parseFloat(ctx.openInterest || coin.openInterest || 0),
            fundingRate: parseFloat(ctx.funding || coin.funding || 0),
            maxLeverage: coin.maxLeverage || 20,
            // Ajouter prevDayPx pour calculer change24h
            prevDayPx: parseFloat(ctx.prevDayPx || 0),
          };
        })
        .filter((coin: any) => coin.price > 0 && coin.volume24h > 1000);

      return NextResponse.json({
        success: true,
        data: transformed,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json({
      success: false,
      error: 'Invalid method',
    });
  } catch (error) {
    console.error('Hyperliquid GET Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 200 }
    );
  }
}
