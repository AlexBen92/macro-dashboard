import { NextResponse } from 'next/server';

async function fetchYahoo(symbol: string): Promise<number[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  });
  const d = await res.json();
  const closes: number[] = (d.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [])
    .filter((x: number | null) => x != null);
  return closes;
}

// US High Impact Economic Events 2026
const US_ECONOMIC_EVENTS = [
  { name: 'FOMC Rate Decision', impact: 'high', months: [1, 3, 5, 6, 8, 10, 12] },
  { name: 'CPI m/m', impact: 'high', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Non-Farm Payrolls', impact: 'high', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'PCE Price Index m/m', impact: 'high', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'Retail Sales m/m', impact: 'high', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'ISM Manufacturing PMI', impact: 'medium', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'ADP Non-Farm Employment', impact: 'medium', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { name: 'GDP q/q', impact: 'high', months: [1, 4, 7, 10] },
  { name: 'Unemployment Rate', impact: 'high', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

function getNextEventDate(eventName: string, currentMonth: number): Date {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  // Standard release days (approximate)
  const releaseDays: Record<string, number> = {
    'FOMC Rate Decision': 15, // Around mid-month
    'CPI m/m': 12,
    'Non-Farm Payrolls': 5,    // First Friday
    'PCE Price Index m/m': 28,
    'Retail Sales m/m': 14,
    'ISM Manufacturing PMI': 3,
    'ADP Non-Farm Employment': 2,
    'GDP q/q': 28,
    'Unemployment Rate': 5,
  };

  const day = releaseDays[eventName] || 15;

  // If event day has passed this month, schedule for next month
  let eventDate = new Date(Date.UTC(year, month - 1, day, 8, 30, 0)); // 8:30 AM ET = ~12:30 UTC
  if (eventDate < now) {
    const nextMonth = month % 12 + 1;
    const nextYear = month === 12 ? year + 1 : year;
    eventDate = new Date(Date.UTC(nextYear, nextMonth - 1, day, 8, 30, 0));
  }

  return eventDate;
}

export async function GET() {
  try {
    // VIX
    let vix: { v: number | null; chg: number | null; src: string } = { v: null, chg: null, src: 'N/A' };
    try {
      const fredKey = process.env.FRED_API_KEY;
      if (fredKey) {
        const fredRes = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=VIXCLS&api_key=${fredKey}&file_type=json&sort_order=desc&limit=5`
        );
        const fredData = await fredRes.json();
        const obs = fredData.observations?.filter((x: { value: string }) => x.value !== '.') || [];
        if (obs.length >= 2) {
          vix = { v: parseFloat(obs[0].value), chg: parseFloat(obs[0].value) - parseFloat(obs[1].value), src: 'FRED' };
        }
      }
      if (vix.v == null) {
        const closes = await fetchYahoo('^VIX');
        if (closes.length >= 2) {
          vix = { v: closes[closes.length - 1], chg: closes[closes.length - 1] - closes[closes.length - 2], src: 'Yahoo' };
        }
      }
    } catch {
      try {
        const cgRes = await fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=30&interval=daily');
        const cgData = await cgRes.json();
        const prices = cgData.prices.map((x: number[]) => x[1]);
        const ret: number[] = [];
        for (let i = 1; i < prices.length; i++) ret.push(Math.log(prices[i] / prices[i - 1]));
        const m = ret.reduce((a: number, b: number) => a + b, 0) / ret.length;
        const std = Math.sqrt(ret.reduce((a: number, b: number) => a + (b - m) * (b - m), 0) / (ret.length - 1));
        vix = { v: std * Math.sqrt(365) * 100, chg: null, src: 'BTC Vol' };
      } catch { /* skip */ }
    }

    // DXY
    let dxy: { v: number | null; prev: number | null; src: string } = { v: null, prev: null, src: 'N/A' };
    try {
      const closes = await fetchYahoo('DX-Y.NYB');
      if (closes.length >= 2) {
        dxy = { v: closes[closes.length - 1], prev: closes[closes.length - 2], src: 'Yahoo' };
      }
    } catch { /* skip */ }

    // 10Y Yield
    let yield10y: { v: number | null; src: string } = { v: null, src: 'N/A' };
    try {
      const closes = await fetchYahoo('^TNX');
      if (closes.length >= 1) {
        yield10y = { v: closes[closes.length - 1], src: 'Yahoo' };
      }
    } catch { /* skip */ }

    // CPI Inflation Rate (CORRIGÉ: utilise CPALAES01CTM189N - déjà en pourcentage)
    let cpiInflation: { v: number | null; src: string } = { v: null, src: 'N/A' };
    try {
      const fredKey = process.env.FRED_API_KEY;
      if (fredKey) {
        // CPALAES01CTM189N = All Urban Consumers CPI: All Items Less Food & Energy (Core CPI m/m)
        // OU utiliser CPIAUCSL pour le niveau et calculer le % YoY
        const fredRes = await fetch(
          `https://api.stlouisfed.org/fred/series/observations?series_id=CPALAES01CTM189N&api_key=${fredKey}&file_type=json&sort_order=desc&limit=3`
        );
        const fredData = await fredRes.json();
        const obs = fredData.observations?.filter((x: { value: string }) => x.value !== '.') || [];
        if (obs.length >= 1) {
          // Convertir en pourcentage annuel approximatif (monthly * 12)
          const monthlyRate = parseFloat(obs[0].value);
          cpiInflation = { v: Math.abs(monthlyRate * 12), src: 'FRED (Core CPI annualized)' };
        }
      }
    } catch { /* skip */ }

    // Pas de fallback fabriqué: FRED indisponible → null, l'UI affiche l'absence
    if (cpiInflation.v == null) {
      cpiInflation = { v: null, src: 'N/A' };
    }

    // Calculate upcoming US high impact events
    const now = new Date();
    const upcomingEvents: Array<{ name: string; impact: string; hoursLeft: number; date: string }> = [];

    for (const event of US_ECONOMIC_EVENTS) {
      const eventDate = getNextEventDate(event.name, now.getMonth() + 1);
      const hoursLeft = Math.max(0, (eventDate.getTime() - now.getTime()) / (1000 * 60 * 60));

      // Only include events within next 30 days
      if (hoursLeft < 30 * 24) {
        upcomingEvents.push({
          name: event.name,
          impact: event.impact,
          hoursLeft: Math.round(hoursLeft),
          date: eventDate.toISOString(),
        });
      }
    }

    // Sort by hoursLeft
    upcomingEvents.sort((a, b) => a.hoursLeft - b.hoursLeft);

    const nextEvent = upcomingEvents[0] || null;

    return NextResponse.json(
      {
        vix,
        dxy,
        yield10y,
        cpi: cpiInflation,
        upcomingEvents: upcomingEvents.slice(0, 5), // Top 5 upcoming events
        nextEvent,
        timestamp: Date.now(),
      },
      { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
