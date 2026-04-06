import { NextResponse } from 'next/server';

const FRED_KEY = process.env.FRED_API_KEY || '';
const EIA_KEY = process.env.EIA_API_KEY || '';
const METALS_KEY = process.env.METALS_API_KEY || '';

const COT_CODES: Record<string, string> = {
  EUR: '099741', GBP: '096742', JPY: '097741',
  CAD: '090741', AUD: '232741', GOLD: '088691', OIL: '067651',
};

export async function GET() {
  const [cot, forex, forexHistory, macro, gold, oil] = await Promise.allSettled([
    fetchAllCOT(),
    fetchForexRates(),
    fetchForexHistory(20),
    fetchFREDMacro(),
    fetchGoldPrice(),
    fetchOilPrice(),
  ]);

  const cotData = cot.status === 'fulfilled' ? cot.value : {};
  const fxRates = forex.status === 'fulfilled' ? forex.value : {};
  const fxHistory = forexHistory.status === 'fulfilled' ? forexHistory.value : {};
  const macroData = macro.status === 'fulfilled' ? macro.value : {};
  const goldPrice = gold.status === 'fulfilled' ? gold.value : null;
  const oilPrice = oil.status === 'fulfilled' ? oil.value : null;

  const strength = computeCurrencyStrength(fxRates as Record<string, number>);
  const trendScores = computeTrendScores(fxHistory as Record<string, number[]>);
  const cotScores = computeCOTScores(cotData as Record<string, COTEntry>);
  const macroScores = computeMacroScores(macroData as Record<string, number>);
  const seasonalScores = computeSeasonalScores();

  const instruments = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'GOLD', 'OIL'];
  const scores: Record<string, InstrumentScore> = {};

  for (const inst of instruments) {
    const breakdown = {
      cot: cotScores[inst] || 0,
      trend: trendScores[inst] || 0,
      macro: macroScores[inst] || 0,
      sentiment: 0,
      seasonal: seasonalScores[inst] || 0,
    };
    const total = Math.max(-10, Math.min(10,
      breakdown.cot + breakdown.trend + breakdown.macro + breakdown.sentiment + breakdown.seasonal
    ));

    let signal = 'NEUTRAL';
    if (total >= 7) signal = 'STRONG BULL';
    else if (total >= 4) signal = 'BULLISH';
    else if (total >= 1) signal = 'MILD BULL';
    else if (total >= -1) signal = 'NEUTRAL';
    else if (total >= -3) signal = 'MILD BEAR';
    else if (total >= -6) signal = 'BEARISH';
    else signal = 'STRONG BEAR';

    scores[inst] = { total, signal, breakdown };
  }

  return NextResponse.json({
    scores,
    cot: cotData,
    macro: macroData,
    strength,
    fxRates,
    goldPrice,
    oilPrice,
    timestamp: new Date().toISOString(),
    apiStatus: {
      cot: cot.status === 'fulfilled' ? 'ok' : 'error',
      forex: forex.status === 'fulfilled' ? 'ok' : 'error',
      fred: macro.status === 'fulfilled' ? 'ok' : 'error',
      gold: gold.status === 'fulfilled' ? 'ok' : 'error',
      oil: oil.status === 'fulfilled' ? 'ok' : 'error',
    },
  }, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' },
  });
}

// ═══════════════ TYPES ═══════════════

interface COTEntry {
  netPosition: number;
  prevNetPosition: number;
  weeklyChange: number;
  cotIndex: number;
  reportDate: string;
  weeks52: number[];
}

interface InstrumentScore {
  total: number;
  signal: string;
  breakdown: { cot: number; trend: number; macro: number; sentiment: number; seasonal: number };
}

// ═══════════════ FETCH FUNCTIONS ═══════════════

async function fetchAllCOT(): Promise<Record<string, COTEntry>> {
  const results: Record<string, COTEntry> = {};
  const fetches = Object.entries(COT_CODES).map(async ([symbol, code]) => {
    try {
      const url = `https://publicreporting.cftc.gov/resource/6dca-aqww.json?cftc_contract_market_code=${code}&$limit=52&$order=report_date_as_yyyy_mm_dd DESC`;
      const r = await fetch(url, { next: { revalidate: 86400 } });
      const data = await r.json();
      if (data && data.length >= 2) {
        const weeks = data.map((w: Record<string, string>) => ({
          date: w.report_date_as_yyyy_mm_dd,
          longAll: parseInt(w.noncomm_positions_long_all || '0'),
          shortAll: parseInt(w.noncomm_positions_short_all || '0'),
          netPosition: parseInt(w.noncomm_positions_long_all || '0') - parseInt(w.noncomm_positions_short_all || '0'),
        }));
        const netPositions: number[] = weeks.map((w: { netPosition: number }) => w.netPosition);
        const min52 = Math.min(...netPositions);
        const max52 = Math.max(...netPositions);
        const cotIndex = max52 !== min52
          ? Math.round(((netPositions[0] - min52) / (max52 - min52)) * 100)
          : 50;

        results[symbol] = {
          netPosition: netPositions[0],
          prevNetPosition: netPositions[1],
          weeklyChange: netPositions[0] - netPositions[1],
          cotIndex,
          reportDate: weeks[0].date,
          weeks52: netPositions,
        };
      }
    } catch { /* skip failed symbol */ }
  });
  await Promise.allSettled(fetches);
  return results;
}

async function fetchForexRates(): Promise<Record<string, number>> {
  const r = await fetch('https://api.frankfurter.dev/v1/latest?from=USD', { next: { revalidate: 3600 } });
  const data = await r.json();
  return data.rates || {};
}

async function fetchForexHistory(days: number): Promise<Record<string, number[]>> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const url = `https://api.frankfurter.dev/v1/${start.toISOString().slice(0, 10)}..${end.toISOString().slice(0, 10)}?from=USD&to=EUR,GBP,JPY,CAD,AUD`;
  const r = await fetch(url, { next: { revalidate: 3600 } });
  const data = await r.json();
  const history: Record<string, number[]> = { EUR: [], GBP: [], JPY: [], CAD: [], AUD: [] };
  if (data.rates) {
    const dates = Object.keys(data.rates).sort();
    for (const date of dates) {
      for (const ccy of Object.keys(history)) {
        if (data.rates[date][ccy]) history[ccy].push(data.rates[date][ccy]);
      }
    }
  }
  return history;
}

async function fetchFREDMacro(): Promise<Record<string, number>> {
  if (!FRED_KEY) return {};
  const series = [
    { id: 'PAYEMS', key: 'nfp', limit: 3 },
    { id: 'CPIAUCSL', key: 'cpi', limit: 3 },
    { id: 'DFF', key: 'fedFunds', limit: 2 },
    { id: 'DGS10', key: 'treasury10y', limit: 2 },
    { id: 'DFII10', key: 'tipsReal', limit: 2 },
    { id: 'T10YIE', key: 'breakeven', limit: 2 },
  ];
  const results: Record<string, number> = {};
  await Promise.allSettled(series.map(async (s) => {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${s.limit}`;
      const r = await fetch(url, { next: { revalidate: 86400 } });
      const data = await r.json();
      const obs = (data.observations || []).filter((o: { value: string }) => o.value !== '.');
      if (obs.length >= 2) {
        results[s.key] = parseFloat(obs[0].value);
        results[`${s.key}Prev`] = parseFloat(obs[1].value);
      }
    } catch { /* skip */ }
  }));
  if (results.cpi && results.cpiPrev) {
    results.cpiYoY = ((results.cpi - results.cpiPrev) / results.cpiPrev) * 100;
  }
  return results;
}

async function fetchGoldPrice(): Promise<{ price: number | null; source: string } | null> {
  if (METALS_KEY) {
    try {
      const r = await fetch(`https://api.metals.dev/v1/metal/spot?api_key=${METALS_KEY}&metal=gold&currency=USD`);
      const data = await r.json();
      if (data.rate) return { price: data.rate, source: 'metals.dev' };
    } catch { /* fallback */ }
  }
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/XAU');
    const data = await r.json();
    return { price: data.rates?.USD ? 1 / data.rates.USD : null, source: 'open.er-api' };
  } catch { /* skip */ }
  return null;
}

async function fetchOilPrice(): Promise<{ price: number | null; prevPrice: number | null; source: string } | null> {
  if (!EIA_KEY) return null;
  try {
    const url = `https://api.eia.gov/v2/petroleum/pri/spt/data/?api_key=${EIA_KEY}&facets[series][]=RWTC&data[0]=value&sort[0][column]=period&sort[0][direction]=desc&length=2`;
    const r = await fetch(url, { next: { revalidate: 3600 } });
    const data = await r.json();
    const values = data.response?.data || [];
    return {
      price: values[0]?.value ? parseFloat(values[0].value) : null,
      prevPrice: values[1]?.value ? parseFloat(values[1].value) : null,
      source: 'EIA',
    };
  } catch { /* skip */ }
  return null;
}

// ═══════════════ COMPUTE FUNCTIONS ═══════════════

function computeCurrencyStrength(rates: Record<string, number>): Record<string, number> {
  const currencies = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
  const strength: Record<string, number> = {};

  for (const ccy of currencies) {
    let totalStrength = 0;
    let count = 0;
    for (const other of currencies) {
      if (ccy === other) continue;
      const ccyRate = ccy === 'USD' ? 1 : rates[ccy] || 1;
      const otherRate = other === 'USD' ? 1 : rates[other] || 1;
      totalStrength += (1 / ccyRate) - (1 / otherRate);
      count++;
    }
    strength[ccy] = count > 0 ? Math.round((totalStrength / count) * 10000) / 100 : 0;
  }
  return strength;
}

function computeTrendScores(history: Record<string, number[]>): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [ccy, closes] of Object.entries(history)) {
    if (closes.length < 14) { scores[ccy] = 0; continue; }
    const sma3 = closes.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const sma14 = closes.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const older = closes.slice(-19, -5);
    const sma14_5dAgo = older.length > 0 ? older.reduce((a, b) => a + b, 0) / older.length : sma14;
    const slope = sma14 - sma14_5dAgo;
    const sma14Score = slope > 0 ? 1 : -1;

    // USD/X rates: down = X stronger → invert
    let smaCrossRaw = sma3 > sma14 ? -2 : 2;
    if (smaCrossRaw === -2 && sma14Score === 1) smaCrossRaw = -1;
    else if (smaCrossRaw === 2 && sma14Score === -1) smaCrossRaw = 1;

    scores[ccy] = sma14Score + smaCrossRaw;
  }
  // USD = inverse of average
  const vals = Object.values(scores);
  scores['USD'] = vals.length > 0 ? -Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  return scores;
}

function computeCOTScores(cot: Record<string, COTEntry>): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const [symbol, data] of Object.entries(cot)) {
    if (!data) { scores[symbol] = 0; continue; }
    const momentum = data.weeklyChange > 0 ? 1 : -1;
    const direction = data.netPosition > 0 ? 1 : -1;
    scores[symbol] = momentum + direction;
  }
  scores['USD'] = -Math.round(
    (scores['EUR'] || 0) * 0.5 + (scores['GBP'] || 0) * 0.3 + (scores['JPY'] || 0) * 0.2
  );
  return scores;
}

function computeMacroScores(macro: Record<string, number>): Record<string, number> {
  const scores: Record<string, number> = {};

  const cpiScore = macro.cpi > macro.cpiPrev ? 1 : macro.cpi < macro.cpiPrev ? -1 : 0;
  const nfpScore = macro.nfp > macro.nfpPrev ? 1 : macro.nfp < macro.nfpPrev ? -1 : 0;
  const stanceScore = macro.fedFunds > macro.breakeven ? 1 : macro.fedFunds < macro.breakeven ? -1 : 0;
  scores['USD'] = cpiScore + nfpScore + stanceScore;

  const CB_SCORES: Record<string, number> = { EUR: 0, GBP: 0, JPY: -1, CAD: -1, AUD: -1 };
  for (const [ccy, score] of Object.entries(CB_SCORES)) {
    scores[ccy] = score;
  }

  // Gold
  const realRate = macro.tipsReal || 2;
  const goldRateScore = realRate < 1.5 ? 1 : realRate > 2.5 ? -1 : 0;
  const goldDxyScore = scores['USD'] > 0 ? -1 : scores['USD'] < 0 ? 1 : 0;
  scores['GOLD'] = goldRateScore + goldDxyScore;

  scores['OIL'] = 0;
  return scores;
}

function computeSeasonalScores(): Record<string, number> {
  const SEASONALITY: Record<string, number[]> = {
    EUR:  [+0.3, -0.1, -0.2, +0.1, +0.2, -0.3, -0.1, +0.1, +0.4, +0.1, -0.2, +0.5],
    GBP:  [-0.2, +0.1, -0.1, +0.2, -0.1, -0.2, +0.1, +0.2, +0.3, -0.1, -0.3, +0.2],
    JPY:  [+0.4, +0.2, +0.3, -0.1, -0.2, -0.1, +0.2, +0.4, -0.3, -0.1, +0.2, +0.3],
    CAD:  [+0.2, +0.1, -0.2, +0.1, +0.3, +0.2, +0.1, -0.1, -0.2, +0.1, -0.1, +0.2],
    AUD:  [-0.1, +0.2, +0.1, -0.2, +0.1, -0.3, +0.2, +0.1, -0.1, +0.2, -0.1, +0.1],
    USD:  [-0.2, +0.1, +0.1, +0.2, -0.1, +0.3, +0.1, -0.2, +0.1, +0.2, +0.1, -0.3],
    GOLD: [+1.8, +0.3, -0.5, +0.2, -0.8, -0.3, +0.5, +1.2, -0.8, +0.4, +0.6, +0.3],
    OIL:  [+0.5, +0.8, +1.2, +0.3, -0.5, -0.8, +0.2, +0.6, +0.4, -0.3, -0.8, -0.5],
  };
  const month = new Date().getMonth();
  const scores: Record<string, number> = {};
  for (const [symbol, returns] of Object.entries(SEASONALITY)) {
    const r = returns[month];
    scores[symbol] = r > 0.1 ? 1 : r < -0.1 ? -1 : 0;
  }
  return scores;
}
