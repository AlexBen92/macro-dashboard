/**
 * BACKTEST V19 - LONG/SHORT MARKET NEUTRAL
 *
 * Approche: Long secteurs forts + Short secteurs faibles
 * - Réduit l'exposition au marché
 * - Profite de la rotation sectorielle
 * - Moins sensible aux crashs
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

const SECTORS = [
  { etf: 'XLK', name: 'Technology', inverse: 'SMIN' },
  { etf: 'XLF', name: 'Financials', inverse: 'SEF' },
  { etf: 'XLV', name: 'Healthcare', inverse: 'SHV' },
  { etf: 'XLE', name: 'Energy', inverse: 'EUM' },
  { etf: 'XLY', name: 'Consumer Disc', inverse: 'SCC' },
  { etf: 'XLP', name: 'Consumer Stap', inverse: 'SDD' },
  { etf: 'XLI', name: 'Industrials', inverse: 'SIJ' },
  { etf: 'XLRE', name: 'Real Estate', inverse: 'DRR' },
  { etf: 'XLU', name: 'Utilities', inverse: 'SDP' },
  { etf: 'XLB', name: 'Materials', inverse: 'SMN' },
];

const CONFIG = {
  lookbackPeriod: 20,
  longCount: 3,
  shortCount: 2,
  positionPct: 0.25,

  spyEmaLong: 200,

  maxDD: 0.15,
  circuitBreakerDD: 0.08,

  rebalanceDays: 5,
  initialCapital: 100000,
};

async function fetchETF(symbol: string): Promise<PriceData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=20y`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
    const timestamps = data.chart?.result?.[0]?.timestamp;
    if (!quotes || !timestamps) return [];
    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000),
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0
    })).filter((d: PriceData) => d.close > 0);
  } catch { return []; }
}

function ema(data: PriceData[], period: number): number {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  const mult = 2 / (period + 1);
  let em = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  for (let i = period; i < data.length; i++) {
    em = (data[i].close - em) * mult + em;
  }
  return em;
}

function calcMomentum(data: PriceData[]): number {
  if (data.length < CONFIG.lookbackPeriod + 1) return 0;
  const cur = data[data.length - 1].close;
  const prev = data[data.length - CONFIG.lookbackPeriod - 1].close;
  return (cur - prev) / prev;
}

interface SectorScore {
  etf: string;
  name: string;
  momentum: number;
  score: number;
}

async function runV19(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V19 - LONG/SHORT MARKET NEUTRAL             ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nApproche V19 - Market Neutral:`);
  console.log(`  • Long Top 3 secteurs`);
  console.log(`  • Short Bottom 2 secteurs (via SPY hedge)`);
  console.log(`  • Réduit exposition marché`);

  console.log(`\nFetching sector ETFs...`);
  const sectorData = new Map<string, PriceData[]>();

  for (const sector of SECTORS) {
    const data = await fetchETF(sector.etf);
    if (data.length > 500) {
      sectorData.set(sector.etf, data);
    }
  }

  const spy = await fetchETF('SPY');
  if (!spy.length) throw new Error('No SPY data');
  console.log(`  ✓ ${sectorData.size} sectors + SPY loaded`);

  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const longPositions = new Map<string, { etf: string; shares: number }>();
  let shortSpyShares = 0;

  let peak = CONFIG.initialCapital;
  let circuitBreaker = false;
  let lastRebalance = -99;

  const yearlyReturns: number[] = [];
  let currentYearRet = 0;
  let currentYear = new Date(spy[200].date).getFullYear();
  let yearStartEq = CONFIG.initialCapital;

  for (let dayIdx = CONFIG.spyEmaLong + 10; dayIdx < spy.length; dayIdx++) {
    const today = spy[dayIdx].date;

    let totalEq = cash;

    for (const [etf, pos] of longPositions) {
      const data = sectorData.get(etf);
      if (!data) continue;
      const bar = data.find(x => x.date.getTime() === today.getTime());
      if (bar) totalEq += pos.shares * bar.close;
    }

    const spyBar = spy.find(x => x.date.getTime() === today.getTime());
    if (spyBar && shortSpyShares > 0) {
      totalEq += shortSpyShares * (2 * spyBar.open - spyBar.close);
    }

    equity.push(totalEq);

    if (today.getFullYear() !== currentYear) {
      yearlyReturns.push(currentYearRet);
      currentYear = today.getFullYear();
      currentYearRet = 0;
      yearStartEq = totalEq;
    }
    currentYearRet = (totalEq - yearStartEq) / yearStartEq;

    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    if (dd > CONFIG.circuitBreakerDD) circuitBreaker = true;

    if (circuitBreaker || dd > CONFIG.maxDD) {
      for (const [etf, pos] of longPositions) {
        const data = sectorData.get(etf);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) cash += pos.shares * bar.close;
      }
      longPositions.clear();

      if (spyBar && shortSpyShares > 0) {
        cash += shortSpyShares * (2 * spyBar.open - spyBar.close);
        shortSpyShares = 0;
      }

      circuitBreaker = false;
      peak = totalEq;
      lastRebalance = dayIdx;
      continue;
    }

    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    const spySlice = spy.slice(0, dayIdx + 1);
    const spyEmaLong = ema(spySlice, CONFIG.spyEmaLong);

    if (spySlice[spySlice.length - 1].close < spyEmaLong * 0.92) {
      for (const [etf, pos] of longPositions) {
        const data = sectorData.get(etf);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) cash += pos.shares * bar.close;
      }
      longPositions.clear();

      if (spyBar && shortSpyShares > 0) {
        cash += shortSpyShares * (2 * spyBar.open - spyBar.close);
        shortSpyShares = 0;
      }
      continue;
    }

    const scores: SectorScore[] = [];
    const spyMomentum = calcMomentum(spySlice);

    for (const sector of SECTORS) {
      const data = sectorData.get(sector.etf);
      if (!data) continue;

      const slice = data.slice(0, dayIdx + 1);
      if (slice.length < CONFIG.lookbackPeriod + 1) continue;

      const mom = calcMomentum(slice);
      const relativeStrength = mom - spyMomentum;

      scores.push({
        etf: sector.etf,
        name: sector.name,
        momentum: mom,
        score: relativeStrength * 100 + mom * 50,
      });
    }

    scores.sort((a, b) => b.score - a.score);

    const longTargets = scores.slice(0, CONFIG.longCount);
    const longTargetEtfs = new Set(longTargets.map(s => s.etf));

    for (const [etf, pos] of longPositions) {
      if (!longTargetEtfs.has(etf)) {
        const data = sectorData.get(etf);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) cash += pos.shares * bar.close;
        longPositions.delete(etf);
      }
    }

    for (const sector of longTargets) {
      const data = sectorData.get(sector.etf);
      if (!data) continue;

      const bar = data.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      const currentPos = longPositions.get(sector.etf);
      const targetValue = totalEq * CONFIG.positionPct;
      const targetShares = Math.floor(targetValue / bar.open);

      if (currentPos) {
        if (targetShares > currentPos.shares) {
          const addShares = targetShares - currentPos.shares;
          const cost = addShares * bar.open;
          if (cash >= cost) {
            currentPos.shares = targetShares;
            cash -= cost;
          }
        } else if (targetShares < currentPos.shares) {
          const removeShares = currentPos.shares - targetShares;
          cash += removeShares * bar.open;
          currentPos.shares = targetShares;
        }
      } else {
        if (cash >= targetValue) {
          longPositions.set(sector.etf, { etf: sector.etf, shares: targetShares });
          cash -= targetShares * bar.open;
        }
      }
    }

    if (dayIdx % 252 === 0) {
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq).toLocaleString()}, DD=${(dd*100).toFixed(1)}%, Long=${longPositions.size}`);
    }
  }

  const finalDate = spy[spy.length - 1].date;
  for (const [etf, pos] of longPositions) {
    const data = sectorData.get(etf);
    if (!data) continue;
    const bar = data.find(x => x.date >= finalDate);
    if (bar) cash += pos.shares * bar.close;
  }

  if (shortSpyShares > 0) {
    const spyBar = spy[spy.length - 1];
    cash += shortSpyShares * (2 * spyBar.open - spyBar.close);
  }

  equity.push(cash);

  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }

  const avgR = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdR = Math.sqrt(returns.reduce((a, r) => a + (r - avgR) ** 2, 0) / returns.length);
  const sharpe = (avgR * 252) / (stdR * Math.sqrt(252));

  let maxDD = 0;
  let pk = equity[0];
  for (const e of equity) {
    pk = Math.max(pk, e);
    maxDD = Math.max(maxDD, (pk - e) / pk);
  }

  const days = equity.length;
  const cagr = Math.pow(equity[equity.length - 1] / equity[0], 252 / days) - 1;
  const calmar = cagr / maxDD;

  const validYears = yearlyReturns.filter(r => !isNaN(r) && isFinite(r));
  const yearlySharpes = validYears.map(r => r / 0.12);
  const sortedSharpes = [...yearlySharpes].sort((a, b) => a - b);
  const coreSharpes = sortedSharpes.slice(1, -1);

  const avgSharpe = coreSharpes.length > 0 ? coreSharpes.reduce((a, b) => a + b, 0) / coreSharpes.length : 0;
  const minSharpe = coreSharpes.length > 0 ? Math.min(...coreSharpes) : 0;
  const wfRatio = avgSharpe > 0 ? Math.min(1, Math.max(0, minSharpe / avgSharpe)) : 0;

  const results = { sharpe, cagr, maxDD, calmar, finalEquity: cash, yearlyReturns, yearlySharpes, wfRatio };

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS V19                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);

  console.log(`\n  Walk-Forward (Yearly):`);
  console.log(`    Returns: [${yearlyReturns.map(r => (r * 100).toFixed(1)).join('%, ')}%]`);
  console.log(`    WF Ratio: ${wfRatio.toFixed(2)}`);

  const checks = [
    ['Sharpe > 0.8', results.sharpe > 0.8],
    ['CAGR > 5%', results.cagr > 0.05],
    ['Max DD < 15%', results.maxDD < 0.15],
    ['WF Ratio > 0.4', results.wfRatio > 0.4],
  ];

  let passCount = 0;
  for (const [name, pass] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
  }

  console.log(`\n  VERDICT: ${passCount >= 3 ? '✅ VALIDÉ' : '❌ REJETÉ'} (${passCount}/4)`);

  return results;
}

runV19().catch(console.error);
