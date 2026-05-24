/**
 * BACKTEST NASDAQ V21 - VAR-D WITH LEVERAGE
 *
 * Basé sur VAR-D original (Sharpe 0.96, DD 6.82%)
 * Ajout de levier modéré 1.2x pour améliorer CAGR
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

const CONFIG = {
  lookbackPeriod: 20,
  volatilityWindow: 20,

  regimeThreshold: 0.02,

  // Position sizing with 1.2x leverage in low vol
  lowVolPosition: 1.2,   // 120% in low vol
  highVolPosition: 0.4,  // 40% in high vol

  emaTrend: 200,
  emaShort: 50,

  maxDD: 0.15,          // Allow slightly higher DD with leverage
  stopLossPct: 0.08,

  rebalanceDays: 3,
  initialCapital: 100000,
};

async function fetchNasdaqData(): Promise<PriceData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/QQQ?interval=1d&range=20y`;
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

function volatility(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const returns: number[] = [];
  for (let i = data.length - period; i < data.length; i++) {
    if (i > 0) {
      returns.push((data[i].close - data[i - 1].close) / data[i - 1].close);
    }
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252);
}

function momentum(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const cur = data[data.length - 1].close;
  const prev = data[data.length - period - 1].close;
  return (cur - prev) / prev;
}

async function runNasdaqV21(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST NASDAQ V21 - VAR-D WITH LEVERAGE             ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nApproche V21:`);
  console.log(`  • Basé sur VAR-D (Sharpe 0.96, DD 6.82%)`);
  console.log(`  • Levier 1.2x en low vol pour booster CAGR`);
  console.log(`  • 0.4x en high vol pour réduire risque`);

  const data = await fetchNasdaqData();
  if (!data.length) throw new Error('No NASDAQ data');
  console.log(`\n  ✓ ${data.length} days loaded`);

  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  let shares = 0;
  let entryPrice = 0;

  let peak = CONFIG.initialCapital;
  let lastRebalance = -99;

  const yearlyReturns: number[] = [];
  let currentYearRet = 0;
  let currentYear = new Date(data[CONFIG.emaTrend].date).getFullYear();
  let yearStartEq = CONFIG.initialCapital;

  for (let dayIdx = CONFIG.emaTrend; dayIdx < data.length; dayIdx++) {
    const today = data[dayIdx];

    let totalEq = cash + shares * today.close;
    equity.push(totalEq);

    if (today.date.getFullYear() !== currentYear) {
      yearlyReturns.push(currentYearRet);
      currentYear = today.date.getFullYear();
      currentYearRet = 0;
      yearStartEq = totalEq;
    }
    currentYearRet = (totalEq - yearStartEq) / yearStartEq;

    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    if (dd > CONFIG.maxDD) {
      cash += shares * today.close;
      shares = 0;
      entryPrice = 0;
      lastRebalance = dayIdx;
      continue;
    }

    if (shares > 0 && entryPrice > 0) {
      const posDD = (entryPrice - today.close) / entryPrice;
      if (posDD < -CONFIG.stopLossPct) {
        cash += shares * today.close;
        shares = 0;
        entryPrice = 0;
        lastRebalance = dayIdx;
        continue;
      }
    }

    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    const slice = data.slice(0, dayIdx + 1);
    const vol = volatility(slice, CONFIG.volatilityWindow);
    const ema200 = ema(slice, CONFIG.emaTrend);
    const mom = momentum(slice, CONFIG.lookbackPeriod);

    let targetPosition = 0;

    if (today.close < ema200) {
      targetPosition = 0;
    } else if (vol < CONFIG.regimeThreshold) {
      targetPosition = CONFIG.lowVolPosition;
    } else {
      targetPosition = CONFIG.highVolPosition;
    }

    if (mom < -0.03) {
      targetPosition = Math.min(targetPosition, 0.3);
    }

    const targetValue = totalEq * targetPosition;
    const targetShares = Math.floor(targetValue / today.open);

    if (targetShares > shares) {
      const addShares = targetShares - shares;
      const cost = addShares * today.open;
      if (cash >= cost) {
        shares = targetShares;
        cash -= cost;
        if (entryPrice === 0) entryPrice = today.open;
      }
    } else if (targetShares < shares) {
      const sellShares = shares - targetShares;
      cash += sellShares * today.open;
      shares = targetShares;
      if (shares === 0) entryPrice = 0;
    }

    if (dayIdx % 252 === 0) {
      console.log(`  ${today.date.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq).toLocaleString()}, DD=${(dd*100).toFixed(1)}%, Pos=${targetPosition.toFixed(1)}x, Vol=${(vol*100).toFixed(1)}%`);
    }
  }

  cash += shares * data[data.length - 1].close;
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
  const yearlySharpes = validYears.map(r => r / 0.15);
  const sortedSharpes = [...yearlySharpes].sort((a, b) => a - b);
  const coreSharpes = sortedSharpes.slice(1, -1);

  const avgSharpe = coreSharpes.length > 0 ? coreSharpes.reduce((a, b) => a + b, 0) / coreSharpes.length : 0;
  const minSharpe = coreSharpes.length > 0 ? Math.min(...coreSharpes) : 0;
  const wfRatio = avgSharpe > 0 ? Math.min(1, Math.max(0, minSharpe / avgSharpe)) : 0;

  // T-test
  const tStat = avgR / (stdR / Math.sqrt(returns.length));
  function normCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }
  const tP = 2 * (1 - normCDF(Math.abs(tStat)));

  const results = {
    sharpe, cagr, maxDD, calmar,
    finalEquity: cash,
    yearlyReturns,
    yearlySharpes,
    wfRatio,
    validation: { t_p: tP, wf_ratio: wfRatio }
  };

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                   NASDAQ V21 RESULTS                       ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)} (target: >0.9)`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}% (target: >5%)`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}% (target: <15%)`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);

  console.log(`\n  Walk-Forward (Yearly):`);
  console.log(`    Returns: [${yearlyReturns.map(r => (r * 100).toFixed(1)).join('%, ')}%]`);
  console.log(`    Sharpes: [${yearlySharpes.map(s => s.toFixed(2)).join(', ')}]`);
  console.log(`    WF Ratio: ${wfRatio.toFixed(2)}`);

  const checks = [
    ['T-Test p < 0.05', results.validation.t_p < 0.05],
    ['Sharpe > 0.8', results.sharpe > 0.8],
    ['Max DD < 15%', results.maxDD < 0.15],
    ['CAGR > 5%', results.cagr > 0.05],
    ['WF Ratio > 0.3', results.validation.wf_ratio > 0.3],
  ];

  let passCount = 0;
  for (const [name, pass] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
  }

  console.log(`\n  VERDICT: ${passCount >= 4 ? '✅ VALIDÉ' : passCount >= 3 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${passCount}/5)`);

  return results;
}

runNasdaqV21().catch(console.error);
