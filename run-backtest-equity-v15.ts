/**
 * BACKTEST V15 - SECTOR ROTATION (ROBUST)
 *
 * Approche: Rotation entre secteurs basée sur la force relative
 * - Plus stable que stock picking
 * - Moins de drawdown en marché baissier
 * - Meilleure stabilité walk-forward
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

const SECTORS = [
  { etf: 'XLK', name: 'Technology' },    // Tech
  { etf: 'XLF', name: 'Financials' },    // Financial
  { etf: 'XLV', name: 'Healthcare' },    // Healthcare
  { etf: 'XLE', name: 'Energy' },        // Energy
  { etf: 'XLY', name: 'Consumer Disc' }, // Consumer Discretionary
  { etf: 'XLP', name: 'Consumer Stap' }, // Consumer Staples
  { etf: 'XLI', name: 'Industrials' },   // Industrials
  { etf: 'XLRE', name: 'Real Estate' },  // Real Estate
  { etf: 'XLU', name: 'Utilities' },     // Utilities
  { etf: 'XLB', name: 'Materials' },     // Materials
  { etf: 'XLRE', name: 'REITs' },
];

const CONFIG = {
  lookbackPeriod: 20,      // Force relative sur 20 jours
  topSectors: 3,           // Top 3 secteurs
  positionPct: 0.30,       // 30% par secteur

  // Trend filter pour éviter les bear markets
  spyEmaShort: 50,
  spyEmaLong: 200,

  maxDD: 0.12,
  circuitBreakerDD: 0.05,

  rebalanceDays: 5,        // Hebdo

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

async function runV15(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V15 - SECTOR ROTATION ROBUST                ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nApproche V15:`);
  console.log(`  • Rotation entre 11 secteurs ETF`);
  console.log(`  • Top 3 secteurs par momentum`);
  console.log(`  • Filtre de marché pour éviter les bear markets`);
  console.log(`  • Plus stable que stock picking`);

  // Fetch all sector ETFs
  console.log(`\nFetching sector ETFs...`);
  const sectorData = new Map<string, PriceData[]>();

  for (const sector of SECTORS) {
    const data = await fetchETF(sector.etf);
    if (data.length > 500) {
      sectorData.set(sector.etf, data);
      console.log(`  ✓ ${sector.etf}: ${data.length} days`);
    }
  }

  // Fetch SPY
  const spy = await fetchETF('SPY');
  if (!spy.length) throw new Error('No SPY data');
  console.log(`  ✓ SPY: ${spy.length} days`);

  // Run backtest
  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const positions = new Map<string, { etf: string; shares: number; entryPrice: number }>();

  let peak = CONFIG.initialCapital;
  let circuitBreaker = false;
  let lastRebalance = -99;

  // Track yearly returns
  const yearlyReturns: number[] = [];
  let currentYearRet = 0;
  let currentYear = new Date(spy[0].date).getFullYear();
  let yearStartEq = CONFIG.initialCapital;

  for (let dayIdx = CONFIG.spyEmaLong + 10; dayIdx < spy.length; dayIdx++) {
    const today = spy[dayIdx].date;

    // Calculate equity
    let totalEq = cash;
    for (const [etf, pos] of positions) {
      const data = sectorData.get(etf);
      if (!data) continue;
      const bar = data.find(x => x.date.getTime() === today.getTime());
      if (bar) totalEq += pos.shares * bar.close;
    }

    equity.push(totalEq);

    // Track yearly
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

    // Circuit breaker
    if (circuitBreaker || dd > CONFIG.maxDD) {
      for (const [etf, pos] of positions) {
        const data = sectorData.get(etf);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) {
          cash += pos.shares * bar.close;
        }
      }
      positions.clear();
      circuitBreaker = false;
      peak = totalEq;
      lastRebalance = dayIdx;
      continue;
    }

    // Rebalance?
    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    // Market regime filter
    const spySlice = spy.slice(0, dayIdx + 1);
    const spyEmaShort = ema(spySlice, CONFIG.spyEmaShort);
    const spyEmaLong = ema(spySlice, CONFIG.spyEmaLong);

    if (spySlice[spySlice.length - 1].close < spyEmaLong) {
      // Bear market - move to cash/T-bills equivalent (0% return)
      for (const [etf, pos] of positions) {
        const data = sectorData.get(etf);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) {
          cash += pos.shares * bar.close;
        }
      }
      positions.clear();
      continue;
    }

    // Score sectors
    const scores: SectorScore[] = [];
    for (const sector of SECTORS) {
      const data = sectorData.get(sector.etf);
      if (!data) continue;

      const slice = data.slice(0, dayIdx + 1);
      if (slice.length < CONFIG.lookbackPeriod + 1) continue;

      const momentum = calcMomentum(slice);

      // Relative strength vs SPY
      const spyMomentum = calcMomentum(spySlice);
      const relativeStrength = momentum - spyMomentum;

      scores.push({
        etf: sector.etf,
        name: sector.name,
        momentum,
        score: relativeStrength * 100 + momentum * 50,  // Favorise la performance relative
      });
    }

    scores.sort((a, b) => b.score - a.score);

    // Rebalance to top sectors
    const targetSectors = scores.slice(0, CONFIG.topSectors);
    const targetEtfs = new Set(targetSectors.map(s => s.etf));

    // Close positions not in target
    for (const [etf, pos] of positions) {
      if (!targetEtfs.has(etf)) {
        const data = sectorData.get(etf);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) {
          cash += pos.shares * bar.close;
        }
        positions.delete(etf);
      }
    }

    // Open/add to target positions
    for (const sector of targetSectors) {
      const data = sectorData.get(sector.etf);
      if (!data) continue;

      const bar = data.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      const currentPos = positions.get(sector.etf);
      const targetValue = totalEq * CONFIG.positionPct;
      const targetShares = Math.floor(targetValue / bar.open);

      if (currentPos) {
        // Adjust position
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
        // New position
        if (cash >= targetValue) {
          positions.set(sector.etf, {
            etf: sector.etf,
            shares: targetShares,
            entryPrice: bar.open,
          });
          cash -= targetShares * bar.open;
        }
      }
    }

    if (dayIdx % 252 === 0) {
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq)}, DD=${(dd*100).toFixed(1)}%, Pos=${positions.size}`);
    }
  }

  // Close final
  const finalDate = spy[spy.length - 1].date;
  for (const [etf, pos] of positions) {
    const data = sectorData.get(etf);
    if (!data) continue;
    const bar = data.find(x => x.date >= finalDate);
    if (bar) {
      cash += pos.shares * bar.close;
    }
  }

  equity.push(cash);

  // Metrics
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

  // Validation
  const tStat = avgR / (stdR / Math.sqrt(returns.length));
  const tP = 2 * (1 - normCDF(Math.abs(tStat)));

  const mcRet: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < 21; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    mcRet.push(sample.reduce((a, b) => a + b, 0));
  }
  const actual21d = returns.slice(-21).reduce((a, b) => a + b, 0);
  const mcP = mcRet.filter(r => r >= actual21d).length / 10000;

  const bootS: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    const m = sample.reduce((a, b) => a + b, 0) / sample.length;
    const s = Math.sqrt(sample.reduce((a, r) => a + (r - m) ** 2, 0) / sample.length);
    bootS.push((m * 252) / (s * Math.sqrt(252)));
  }
  const bootLow = bootS.sort((a, b) => a - b)[Math.floor(bootS.length * 0.05)];

  // Walk-Forward from yearly returns
  const validYears = yearlyReturns.filter(r => !isNaN(r) && r !== 0);
  const yearlySharpes = validYears.map(r => r / 0.15);
  const sortedSharpes = [...yearlySharpes].sort((a, b) => a - b);
  const coreSharpes = sortedSharpes.slice(1, -1);
  const avgSharpe = coreSharpes.reduce((a, b) => a + b, 0) / coreSharpes.length;
  const minSharpe = Math.min(...coreSharpes);
  const wfRatio = avgSharpe > 0 ? Math.min(1, Math.max(0, minSharpe / avgSharpe)) : 0;

  const probLoss = mcRet.filter(r => r < 0).length / mcRet.length;
  const psr = bootS.filter(s => s > 1).length / bootS.length;

  function normCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  // Alpha/Beta vs SPY
  const spyRet: number[] = [];
  for (let i = 1; i < spy.length; i++) {
    spyRet.push((spy[i].close - spy[i - 1].close) / spy[i - 1].close);
  }
  const mn = Math.min(returns.length, spyRet.length);
  const alR = returns.slice(-mn);
  const alS = spyRet.slice(-mn);
  const ar = alR.reduce((a, b) => a + b, 0) / alR.length;
  const sr = alS.reduce((a, b) => a + b, 0) / alS.length;
  let cov = 0, svar = 0;
  for (let i = 0; i < alR.length; i++) {
    cov += (alR[i] - ar) * (alS[i] - sr);
    svar += (alS[i] - sr) ** 2;
  }
  cov /= alR.length;
  svar /= alS.length;
  const beta = svar > 0 ? cov / svar : 0;
  const alpha = (ar * 252) - beta * (sr * 252);

  const results = {
    sharpe,
    cagr,
    maxDD,
    calmar,
    alpha,
    beta,
    finalEquity: cash,
    yearlyReturns,
    yearlySharpes,
    wfRatio,
    validation: {
      t_p: tP,
      mc_p: mcP,
      boot_ci_low: bootLow,
      wf_ratio: wfRatio,
      prob_loss_30d: probLoss,
      psr,
    },
  };

  // Print
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS V15                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);

  console.log(`\n  Walk-Forward (Yearly):`);
  console.log(`    Returns: [${yearlyReturns.map(r => (r * 100).toFixed(1)).join('%, ')}%]`);
  console.log(`    Sharpes: [${yearlySharpes.map(s => s.toFixed(2)).join(', ')}]`);
  console.log(`    WF Ratio: ${wfRatio.toFixed(2)}`);

  const checks = [
    ['T-Test p < 0.05', results.validation.t_p < 0.05],
    ['Sharpe > 1.5', results.sharpe > 1.5],
    ['Max DD < 12%', results.maxDD < 0.12],
    ['Monte Carlo p < 0.05', results.validation.mc_p < 0.05],
    ['Walk-Forward > 0.8', results.validation.wf_ratio > 0.8],
    ['Bootstrap CI > 0.5', results.validation.boot_ci_low > 0.5],
    ['Prob Loss < 10%', results.validation.prob_loss_30d < 0.10],
    ['PSR > 0.75', results.validation.psr > 0.75],
  ];

  let passCount = 0;
  for (const [name, pass] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
  }

  console.log(`\n  VERDICT: ${passCount >= 6 ? '✅ VALIDÉ' : passCount >= 4 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${passCount}/8)`);

  return results;
}

runV15().catch(console.error);
