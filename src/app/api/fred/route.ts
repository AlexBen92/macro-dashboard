import { NextRequest, NextResponse } from 'next/server';

// FRED API - Federal Reserve Economic Data
// Documentation: https://fred.stlouisfed.org/docs/api/fred/
// Sign up for free API key: https://fred.stlouisfed.org/docs/api/api_key.html

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

interface FredSeries {
  id: string;
  units: string;
  name: string;
  description: string;
}

// Important FRED series for macro analysis
const FRED_SERIES: Record<string, FredSeries> = {
  // GDP
  GDP: {
    id: 'GDP',
    units: 'Billions of Dollars',
    name: 'Gross Domestic Product',
    description: 'Gross Domestic Product',
  },
  GDPC1: {
    id: 'GDPC1',
    units: 'Billions of Chained 2012 Dollars',
    name: 'Real Gross Domestic Product',
    description: 'Real Gross Domestic Product',
  },

  // Inflation
  CPIAUCSL: {
    id: 'CPIAUCSL',
    units: 'Index 1982-1984=100',
    name: 'Consumer Price Index for All Urban Consumers',
    description: 'CPI All Urban Consumers (CPI-U)',
  },
  CPILFESL: {
    id: 'CPILFESL',
    units: 'Index 1982-1984=100',
    name: 'Consumer Price Index for All Urban Consumers Less Food & Energy',
    description: 'CPI Less Food and Energy',
  },

  // Employment
  UNRATE: {
    id: 'UNRATE',
    units: 'Percent',
    name: 'Unemployment Rate',
    description: 'Unemployment Rate',
  },
  PAYEMS: {
    id: 'PAYEMS',
    units: 'Thousands of Persons',
    name: 'All Employees, Nonfarm',
    description: 'Total Nonfarm Payroll',
  },

  // Interest Rates
  FEDFUNDS: {
    id: 'FEDFUNDS',
    units: 'Percent',
    name: 'Effective Federal Funds Rate',
    description: 'Federal Funds Effective Rate',
  },
  DGS2: {
    id: 'DGS2',
    units: 'Percent',
    name: 'Market Yield on U.S. Treasury Securities at 2-Year Constant Maturity',
    description: '2-Year Treasury Constant Maturity Rate',
  },
  DGS10: {
    id: 'DGS10',
    units: 'Percent',
    name: 'Market Yield on U.S. Treasury Securities at 10-Year Constant Maturity',
    description: '10-Year Treasury Constant Maturity Rate',
  },

  // Volatility
  VIXCLS: {
    id: 'VIXCLS',
    units: 'Index',
    name: 'CBOE Volatility Index: VIX',
    description: 'VIX - CBOE Volatility Index',
  },
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const seriesId = searchParams.get('series_id');
  const apiKey = process.env.FRED_API_KEY;

  if (!apiKey) {
    return NextResponse.json({
      success: false,
      error: 'FRED_API_KEY not configured. Get one free at https://fred.stlouisfed.org/docs/api/api_key.html',
      fallbackData: generateFallbackData(seriesId),
    });
  }

  try {
    if (!seriesId) {
      // Return all available series info
      return NextResponse.json({
        success: true,
        data: FRED_SERIES,
        timestamp: Date.now(),
      });
    }

    // Fetch specific series data
    const url = new URL(FRED_BASE_URL);
    url.searchParams.append('series_id', seriesId);
    url.searchParams.append('api_key', apiKey);
    url.searchParams.append('file_type', 'json');
    url.searchParams.append('observation_start', '2020-01-01'); // Last 5+ years

    const response = await fetch(url.toString(), {
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`FRED API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Transform data
    const observations = data.observations
      ?.filter((obs: any) => obs.value !== '.')
      .map((obs: any) => ({
        date: obs.date,
        value: parseFloat(obs.value),
        realtime_start: obs.realtime_start,
        realtime_end: obs.realtime_end,
      }))
      .reverse() || []; // Most recent first

    const seriesInfo = FRED_SERIES[seriesId];

    return NextResponse.json({
      success: true,
      data: {
        series: seriesInfo,
        observations: observations.slice(0, 100), // Last 100 observations
        latest: observations[0],
        change: observations.length >= 2
          ? ((observations[0].value - observations[1].value) / Math.abs(observations[1].value) * 100)
          : 0,
      },
      timestamp: Date.now(),
    });

  } catch (error) {
    console.error('FRED API Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fallbackData: generateFallbackData(seriesId),
      },
      { status: 200 } // Return 200 with fallback data
    );
  }
}

// Generate fallback data when API fails
function generateFallbackData(seriesId: string | null) {
  const seriesInfo = seriesId && FRED_SERIES[seriesId];

  if (!seriesInfo) {
    return {
      available_series: FRED_SERIES,
    };
  }

  // Generate mock data based on series type
  const mockObservations = [];
  const now = new Date();

  for (let i = 0; i < 100; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    let value = 0;

    switch (seriesId) {
      case 'VIXCLS':
        value = 15 + Math.random() * 20; // 15-35 range
        break;
      case 'FEDFUNDS':
        value = 4.5 + Math.random() * 2; // 4.5-6.5 range (current levels)
        break;
      case 'DGS10':
        value = 3.5 + Math.random() * 2; // 3.5-5.5 range
        break;
      case 'UNRATE':
        value = 3.5 + Math.random() * 2; // 3.5-5.5 range
        break;
      case 'CPIAUCSL':
        value = 300 + Math.random() * 10; // 300-310 range
        break;
      default:
        value = 100 + Math.random() * 50;
    }

    mockObservations.push({
      date: date.toISOString().split('T')[0],
      value,
      realtime_start: date.toISOString().split('T')[0],
      realtime_end: '9999-12-31',
    });
  }

  return {
    series: seriesInfo,
    observations: mockObservations.reverse(),
    latest: mockObservations[0],
    change: (Math.random() - 0.5) * 5, // Random change
    fallback: true,
  };
}

// Export series list for use in components
export { FRED_SERIES };
