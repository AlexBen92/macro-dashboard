import { NextRequest, NextResponse } from 'next/server';

const COINGLASS_BASE_URL = 'https://open-api.coinglass.com/public/v2';
const COINGLASS_API_KEY = process.env.COINGLASS_API_KEY;

interface CoinGlassFundingData {
  symbol: string;
  price: number;
  price_change_24h: number;
  volume_24h: number;
  open_interest: number;
  open_interest_change_24h: number;
  funding_rate: number;
  next_funding_time: number;
}

interface CoinGlassLiquidationData {
  symbol: string;
  long_liq: number;
  short_liq: number;
  total_liq: number;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const endpoint = searchParams.get('endpoint') || 'funding_rate';

  try {
    let data;

    switch (endpoint) {
      case 'funding_rate':
        // Fetch funding rates for top cryptocurrencies
        const fundingHeaders: Record<string, string> = {
          'accept': 'application/json',
        };

        if (COINGLASS_API_KEY) {
          fundingHeaders['cg-api-key'] = COINGLASS_API_KEY;
        }

        const fundingResponse = await fetch(
          `${COINGLASS_BASE_URL}/funding_rate`,
          {
            headers: fundingHeaders,
            next: { revalidate: 30 } // Cache for 30 seconds
          }
        );

        if (!fundingResponse.ok) {
          throw new Error(`CoinGlass API error: ${fundingResponse.statusText}`);
        }

        const fundingData = await fundingResponse.json();
        data = fundingData.data?.slice(0, 20).map((item: any) => ({
          symbol: item.symbol,
          price: parseFloat(item.price),
          price_change_24h: parseFloat(item.price_change_24h),
          volume_24h: parseFloat(item.volume_24h),
          open_interest: parseFloat(item.open_interest),
          open_interest_change_24h: parseFloat(item.open_interest_change_24h),
          funding_rate: parseFloat(item.funding_rate),
          next_funding_time: item.next_funding_time,
        })) || [];
        break;

      case 'liquidation':
        // Fetch liquidation data
        const liqHeaders: Record<string, string> = {
          'accept': 'application/json',
        };

        if (COINGLASS_API_KEY) {
          liqHeaders['cg-api-key'] = COINGLASS_API_KEY;
        }

        const liqResponse = await fetch(
          `${COINGLASS_BASE_URL}/liquidation_chart`,
          {
            headers: liqHeaders,
            next: { revalidate: 60 } // Cache for 1 minute
          }
        );

        if (!liqResponse.ok) {
          throw new Error(`CoinGlass API error: ${liqResponse.statusText}`);
        }

        const liqData = await liqResponse.json();
        data = liqData.data || [];
        break;

      case 'open_interest':
        // Fetch open interest history
        const symbol = searchParams.get('symbol') || 'BTC';
        const interval = searchParams.get('interval') || '1h';

        const oiHeaders: Record<string, string> = {
          'accept': 'application/json',
        };

        if (COINGLASS_API_KEY) {
          oiHeaders['cg-api-key'] = COINGLASS_API_KEY;
        }

        const oiResponse = await fetch(
          `${COINGLASS_BASE_URL}/open_interest_chart?symbol=${symbol}&interval=${interval}`,
          {
            headers: oiHeaders,
            next: { revalidate: 300 } // Cache for 5 minutes
          }
        );

        if (!oiResponse.ok) {
          throw new Error(`CoinGlass API error: ${oiResponse.statusText}`);
        }

        const oiData = await oiResponse.json();
        data = oiData.data || [];
        break;

      default:
        throw new Error('Invalid endpoint');
    }

    return NextResponse.json({
      success: true,
      data,
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('CoinGlass API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackData: generateFallbackData(endpoint),
      },
      { status: 200 } // Return 200 with fallback data to prevent UI breakage
    );
  }
}

// Generate fallback data when API fails
function generateFallbackData(endpoint: string) {
  const coins = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'AVAX', 'MATIC', 'LINK'];

  if (endpoint === 'funding_rate') {
    return coins.map(coin => {
      const fundingRate = (Math.random() - 0.5) * 0.1;
      const oiChange = (Math.random() - 0.5) * 20;
      const price = coin === 'BTC' ? 65000 : coin === 'ETH' ? 3500 : 50 + Math.random() * 200;

      return {
        symbol: coin,
        price,
        price_change_24h: (Math.random() - 0.5) * 10,
        volume_24h: Math.random() * 5000000000 + 500000000,
        open_interest: Math.random() * 10000000000 + 1000000000,
        open_interest_change_24h: oiChange,
        funding_rate: fundingRate,
        next_funding_time: Date.now() + 3600000,
      };
    });
  }

  if (endpoint === 'liquidation') {
    return coins.map(coin => ({
      symbol: coin,
      long_liq: Math.random() * 50000000,
      short_liq: Math.random() * 50000000,
      total_liq: Math.random() * 100000000,
    }));
  }

  return [];
}
