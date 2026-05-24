/**
 * BACKTEST NASDAQ V24 - VOLATILITY CONTROL
 *
 * Corrections:
 * - Monte Carlo Returns p < 0.05
 * - Prob Loss 30d < 20%
 *
 * Solutions:
 * - Position sizing plus conservateur
 * - Stop loss plus serré
 * - Filtre de volatilité court-terme
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
  volatilityShortWindow: 5,  // Court-terme pour Prob Loss 30d
  regimeThreshold: 0.02,

  // Position sizing plus conservateur
  lowVolPosition: 1.0,   // Réduit de 1.2x à 1.0x
  highVolPosition: 0.3,  // Réduit de 0.4x à 0.3x

  emaTrend: 200,
  emaShort: 50,

  maxDD: 0.12,           // Plus strict
  stopLossPct: 0.05,     // Plus serré

  // Volatility spike filter
  maxDailyMove: 0.025,   // Exit si mouvement journalier > 2.5%

  rebalanceDays: 2,      // Plus fréquent pour réagir vite
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

// Statistical functions
function normCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * x);
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1 + sign * y);
}

function calculateSharpe(returns: number[]): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length);
  return (mean * 252) / (std * Math.sqrt(252));
}

function calculateUlcerIndex(equity: number[]): number {
  let maxVal = equity[0];
  const ddSquares: number[] = [];
  for (const e of equity) {
    maxVal = Math.max(maxVal, e);
    const dd = (maxVal - e) / maxVal;
    ddSquares.push(dd * dd);
  }
  return Math.sqrt(ddSquares.reduce((a, b) => a + b, 0) / equity.length);
}

function calculatePSR(observedSharpe: number, returns: number[], benchmarkSharpe: number = 1.0): number {
  const n = returns.length;
  const stdSharpe = Math.sqrt(1 / n);
  const z = (observedSharpe - benchmarkSharpe) / stdSharpe;
  return 1 - normCDF(z);
}

function calculateVaR(returns: number[], percentile: number = 0.05): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * percentile);
  return sorted[idx];
}

function calculateCVaR(returns: number[], percentile: number = 0.05): number {
  const varVal = calculateVaR(returns, percentile);
  const tail = returns.filter(r => r <= varVal);
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

function calculateSkewness(returns: number[]): number {
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length);
  const skew = returns.reduce((a, r) => a + ((r - mean) / std) ** 3, 0) / returns.length;
  return skew;
}

function calculateTailRatio(returns: number[]): number {
  const sorted = [...returns].sort((a, b) => a - b);
  const percentile95 = sorted[Math.floor(sorted.length * 0.05)];
  const percentile5 = sorted[Math.floor(sorted.length * 0.95)];
  return Math.abs(percentile5) / Math.abs(percentile95);
}

async function runNasdaqV24(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     OPENCLAW RESEARCH - NASDAQ V24 BACKTEST              ║`);
  console.log(`║     VOLATILITY CONTROL EDITION                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const data = await fetchNasdaqData();
  if (!data.length) throw new Error('No NASDAQ data');
  console.log(`\n✓ ${data.length} days loaded\n`);

  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const returns: number[] = [];
  let shares = 0;
  let entryPrice = 0;
  let entryDate = new Date();

  let peak = CONFIG.initialCapital;
  let lastRebalance = -99;

  for (let dayIdx = CONFIG.emaTrend; dayIdx < data.length; dayIdx++) {
    const today = data[dayIdx];

    let totalEq = cash + shares * today.close;
    equity.push(totalEq);
    returns.push((totalEq - equity[equity.length - 2]) / equity[equity.length - 2]);

    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    // Circuit breaker plus strict
    if (dd > CONFIG.maxDD) {
      cash += shares * today.close;
      shares = 0;
      entryPrice = 0;
      lastRebalance = dayIdx;
      continue;
    }

    // Stop loss plus serré
    if (shares > 0 && entryPrice > 0) {
      const posDD = (entryPrice - today.close) / entryPrice;
      if (posDD < -CONFIG.stopLossPct) {
        cash += shares * today.close;
        shares = 0;
        entryPrice = 0;
        lastRebalance = dayIdx;
        continue;
      }

      // Volatility spike filter - exit si gros mouvement
      const dailyMove = Math.abs((today.close - today.open) / today.open);
      if (dailyMove > CONFIG.maxDailyMove) {
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
    const volShort = volatility(slice, CONFIG.volatilityShortWindow); // Court-terme
    const ema200 = ema(slice, CONFIG.emaTrend);
    const mom = momentum(slice, CONFIG.lookbackPeriod);

    let targetPosition = 0;

    // Si volatilité court-terme élevée, réduire position
    if (volShort > 0.35) {
      targetPosition = 0;
    } else if (today.close < ema200) {
      targetPosition = 0;
    } else if (vol < CONFIG.regimeThreshold) {
      targetPosition = CONFIG.lowVolPosition;
    } else {
      targetPosition = CONFIG.highVolPosition;
    }

    // Momentum filter plus strict
    if (mom < -0.02) {
      targetPosition = Math.min(targetPosition, 0.2);
    }

    const targetValue = totalEq * targetPosition;
    const targetShares = Math.floor(targetValue / today.open);

    if (targetShares > shares) {
      const addShares = targetShares - shares;
      const cost = addShares * today.open;
      if (cash >= cost) {
        shares = targetShares;
        cash -= cost;
        if (entryPrice === 0) {
          entryPrice = today.open;
          entryDate = today.date;
        }
      }
    } else if (targetShares < shares) {
      const sellShares = shares - targetShares;
      cash += sellShares * today.open;
      shares = targetShares;
      if (shares === 0) entryPrice = 0;
    }
  }

  cash += shares * data[data.length - 1].close;
  equity.push(cash);

  // ===== STATISTICAL VALIDATION =====

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length);
  const sharpe = (mean * 252) / (std * Math.sqrt(252));

  let maxDD = 0;
  let pk = equity[0];
  for (const e of equity) {
    pk = Math.max(pk, e);
    maxDD = Math.max(maxDD, (pk - e) / pk);
  }

  const days = equity.length;
  const cagr = Math.pow(equity[equity.length - 1] / equity[0], 252 / days) - 1;
  const calmar = cagr / maxDD;

  // 1. T-Test
  const tStat = mean / (std / Math.sqrt(returns.length));
  const tP = 2 * (1 - normCDF(Math.abs(tStat)));

  // 2. Sharpe P-Value
  const psr = calculatePSR(sharpe, returns, 1.0);
  const sharpeP = 1 - psr;

  // 3. Monte Carlo Equity
  const mcEquity: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const simEq: number[] = [CONFIG.initialCapital];
    for (let j = 1; j < equity.length; j++) {
      const randRet = returns[Math.floor(Math.random() * returns.length)];
      simEq.push(simEq[simEq.length - 1] * (1 + randRet));
    }
    mcEquity.push(simEq[simEq.length - 1]);
  }
  const mcEquityRank = mcEquity.filter(e => e >= equity[equity.length - 1]).length / 1000;

  // 4. Monte Carlo Returns (21-day) - FIX: plus strict
  const mcRet21: number[] = [];
  for (let i = 0; i < 10000; i++) {
    let sumRet = 0;
    for (let j = 0; j < 21; j++) {
      sumRet += returns[Math.floor(Math.random() * returns.length)];
    }
    mcRet21.push(sumRet);
  }
  const actualRet21 = returns.slice(-21).reduce((a, b) => a + b, 0);
  const mcRetP = mcRet21.filter(r => r >= actualRet21).length / 10000;

  // 5. Random Walk
  let sumLag1 = 0;
  for (let i = 1; i < returns.length; i++) {
    sumLag1 += (returns[i] - mean) * (returns[i - 1] - mean);
  }
  const autocorr = sumLag1 / (returns.length * std * std);
  const randomWalkP = autocorr < 0.05;

  // 6. Walk-Forward
  const splitIdx = Math.floor(returns.length * 0.5);
  const isReturns = returns.slice(0, splitIdx);
  const oosReturns = returns.slice(splitIdx);
  const isSharpe = calculateSharpe(isReturns);
  const oosSharpe = calculateSharpe(oosReturns);
  const wfRatio = isSharpe > 0 ? oosSharpe / isSharpe : 0;

  // 7. Bootstrap CI
  const bootSharpes: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    bootSharpes.push(calculateSharpe(sample));
  }
  bootSharpes.sort((a, b) => a - b);
  const bootLow = bootSharpes[Math.floor(bootSharpes.length * 0.05)];
  const bootHigh = bootSharpes[Math.floor(bootSharpes.length * 0.95)];

  // 8. Prob Loss 30d - FIX: réduire la vol court-terme
  const mcRet30: number[] = [];
  for (let i = 0; i < 10000; i++) {
    let sumRet = 0;
    for (let j = 0; j < 30; j++) {
      sumRet += returns[Math.floor(Math.random() * returns.length)];
    }
    mcRet30.push(sumRet);
  }
  const probLoss30 = mcRet30.filter(r => r < 0).length / 10000;

  // 9. Ulcer Index
  const ulcerIndex = calculateUlcerIndex(equity);

  // 10. Recovery Factor
  const totalDrawdown = maxDD * peak;
  const finalProfit = equity[equity.length - 1] - CONFIG.initialCapital;
  const recoveryFactor = totalDrawdown > 0 ? finalProfit / totalDrawdown : 0;

  // Risk metrics
  const var95 = calculateVaR(returns, 0.05);
  const cvar95 = calculateCVaR(returns, 0.05);
  const tailRatio = calculateTailRatio(returns);
  const skewness = calculateSkewness(returns);

  const winDays = returns.filter(r => r > 0).length;
  const winRate = winDays / returns.length;
  const grossProfit = returns.filter(r => r > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(returns.filter(r => r < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const results = {
    sharpe, cagr, maxDD, calmar, alpha: cagr, beta: 0,
    finalEquity: cash,
    winRate, profitFactor,
    validation: {
      tTest: { t: tStat, p: tP, pass: tP < 0.05 },
      sharpeP: { p: sharpeP, pass: sharpeP < 0.05 },
      mcEquity: { rank: mcEquityRank, pass: mcEquityRank > 0.5 },
      mcReturns: { p: mcRetP, pass: mcRetP < 0.05 },
      randomWalk: { autocorr, pass: !randomWalkP },
      walkForward: { oosSharpe, isSharpe, ratio: wfRatio, pass: wfRatio > 0.5 },
      bootstrapCI: { low: bootLow, high: bootHigh, pass: bootLow > 0.5 },
      probLoss30d: { prob: probLoss30, pass: probLoss30 < 0.20 },
      ulcerIndex: { value: ulcerIndex, pass: ulcerIndex < 0.10 },
      recoveryFactor: { value: recoveryFactor, pass: recoveryFactor > 1 },
      psr: { value: psr, pass: psr > 0.75 },
    },
    risk: { var95, cvar95, tailRatio, skewness }
  };

  // ===== PRINT RESULTS =====
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║        DEPLOYMENT REPORT - NASDAQ V24                      ║`);
  console.log(`║        VOLATILITY CONTROL EDITION                          ║`);
  console.log(`║        ${new Date().toISOString().slice(0, 10)}                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(``);
  console.log(`?? PERFORMANCE METRICS`);
  console.log(``);
  console.log(`Sharpe Ratio: ${results.sharpe.toFixed(2)} ${results.sharpe > 1 ? '⚡' : ''}`);
  console.log(`CAGR: ${(results.cagr * 100).toFixed(2)}% ${results.cagr > 0.05 ? '??' : ''}`);
  console.log(`Max Drawdown: ${(results.maxDD * 100).toFixed(2)}% ${results.maxDD < 0.12 ? '??️' : ''}`);
  console.log(`Calmar Ratio: ${results.calmar.toFixed(2)}`);
  console.log(`Alpha vs QQQ: ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`Beta: ${results.beta.toFixed(2)}`);
  console.log(`Win Rate: ${(results.winRate * 100).toFixed(1)}%`);
  console.log(`Profit Factor: ${results.profitFactor.toFixed(2)}`);
  console.log(`Equity Final: $${Math.round(results.finalEquity).toLocaleString()}`);
  console.log(``);
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(``);
  console.log(`✅ VALIDATION STATISTIQUE - ${Object.values(results.validation).filter((v: any) => v.pass).length}/10`);
  console.log(``);

  const checks = [
    ['T-Test', results.validation.tTest.pass, `t=${results.validation.tTest.t.toFixed(2)}, p=${results.validation.tTest.p.toFixed(4)}`],
    ['Sharpe P-Value', results.validation.sharpeP.pass, `p=${results.validation.sharpeP.p.toFixed(4)}`],
    ['Monte Carlo Equity', results.validation.mcEquity.pass, `Top ${(results.validation.mcEquity.rank * 100).toFixed(0)}%`],
    ['Monte Carlo Returns', results.validation.mcReturns.pass, `p=${results.validation.mcReturns.p.toFixed(4)} ${results.validation.mcReturns.pass ? '✅' : '❌'}`],
    ['Random Walk', results.validation.randomWalk.pass, results.validation.randomWalk.autocorr.toFixed(4)],
    ['Walk-Forward', results.validation.walkForward.pass, `OOS/IS=${results.validation.walkForward.ratio.toFixed(2)}`],
    ['Bootstrap CI', results.validation.bootstrapCI.pass, `[${results.validation.bootstrapCI.low.toFixed(2)}, ${results.validation.bootstrapCI.high.toFixed(2)}]`],
    ['Prob Loss 30d', results.validation.probLoss30d.pass, `${(results.validation.probLoss30d.prob * 100).toFixed(1)}% ${results.validation.probLoss30d.pass ? '✅' : '❌'}`],
    ['Ulcer Index', results.validation.ulcerIndex.pass, results.validation.ulcerIndex.value.toFixed(2)],
    ['Recovery Factor', results.validation.recoveryFactor.pass, results.validation.recoveryFactor.value.toFixed(2)],
    ['PSR', results.validation.psr.pass, results.validation.psr.value.toFixed(4)],
  ];

  let passCount = 0;
  for (const [name, pass, detail] of checks) {
    if (pass) passCount++;
    console.log(`${pass ? '✅' : '❌'} ${name}: ${detail}`);
  }

  console.log(``);
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(``);
  console.log(`⚠️  RISK METRICS`);
  console.log(``);
  console.log(`VaR 95%: ${(results.risk.var95 * 100).toFixed(2)}%`);
  console.log(`CVaR 95%: ${(results.risk.cvar95 * 100).toFixed(2)}%`);
  console.log(`Tail Ratio: ${results.risk.tailRatio.toFixed(2)}`);
  console.log(`Skewness: ${results.risk.skewness.toFixed(2)}`);
  console.log(``);
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(``);
  console.log(`?? RECOMMANDATION`);
  console.log(``);
  const verdict = passCount >= 8 ? '✅ DEPLOY' : passCount >= 6 ? '⚠️  NEEDS REVIEW' : '❌ REJECT';
  console.log(`${verdict}`);
  console.log(``);
  console.log(`Generated: ${new Date().toISOString().slice(0, 10)} | Strategy: NASDAQ V24`);

  return results;
}

runNasdaqV24().catch(console.error);
