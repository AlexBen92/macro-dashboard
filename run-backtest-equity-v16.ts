/**
 * BACKTEST V16 - MARKET REGIME ADAPTIVE
 *
 * Approche: 3 régimes avec comportements différents
 * 1. BULL MARKET: Rotation sectorielle agressive
 * 2. BEAR MARKET: Cash/T-Bills (capital preservation)
 * 3. SIDEWAYS: Mean-reversion sur secteurs
 *
 * Détection régime: Trend + Volatilité + Momentum
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

const SECTORS = [
  { etf: 'XLK', name: 'Technology' },
  { etf: 'XLF', name: 'Financials' },
  { etf: 'XLV', name: 'Healthcare' },
  { etf: 'XLE', name: 'Energy' },
  { etf: 'XLY', name: 'Consumer Disc' },
  { etf: 'XLP', name: 'Consumer Stap' },
  { etf: 'XLI', name: 'Industrials' },
  { etf: 'XLRE', name: 'Real Estate' },
  { etf: 'XLU', name: 'Utilities' },
  { etf: 'XLB', name: 'Materials' },
];

type Regime = 'BULL' | 'BEAR' | 'SIDEWAYS';

interface RegimeState {
  regime: Regime;
  spyAboveSma200: boolean;
  momentum: number;
  volatility: number;
  confidence: number;
}

const CONFIG = {
  // Regime detection
  spyFastEma: 20,
  spySlowEma: 200,
  volatilityPeriod: 20,
  momentumPeriod: 60,

  // Bull market: agressive sector rotation
  bullTopSectors: 3,
  bullPositionPct: 0.32,

  // Sideways: mean reversion, smaller positions
  sidewaysTopSectors: 2,
  sidewaysPositionPct: 0.20,

  // Bear market: defensive - maybe very selective
  bearTopSectors: 1,
  bearPositionPct: 0.10,

  // Risk management
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

function momentum(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const cur = data[data.length - 1].close;
  const prev = data[data.length - period - 1].close;
  return (cur - prev) / prev;
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
  return Math.sqrt(variance) * Math.sqrt(252); // Annualized
}

interface SectorScore {
  etf: string;
  name: string;
  momentum: number;
  score: number;
}

async function runV16(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V16 - MARKET REGIME ADAPTIVE                ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nApproche V16:`);
  console.log(`  • 3 régimes: BULL / BEAR / SIDEWAYS`);
  console.log(`  • Comportement adaptatif par régime`);
  console.log(`  • Détection par trend + volatilité + momentum`);
  console.log(`  • Capital preservation prioritaire en bear`);

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

  // Track regimes
  const regimeHistory: RegimeState[] = [];

  // Run backtest
  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const positions = new Map<string, { etf: string; shares: number; entryPrice: number }>();

  let peak = CONFIG.initialCapital;
  let circuitBreaker = false;
  let lastRebalance = -99;

  // Track yearly returns
  const yearlyReturns: number[] = [];
  const yearlyRegimes: Record<Regime, number>[] = [];
  let currentYearRet = 0;
  let currentYear = new Date(spy[0].date).getFullYear();
  let yearStartEq = CONFIG.initialCapital;
  let yearRegimeCount: Record<Regime, number> = { BULL: 0, BEAR: 0, SIDEWAYS: 0 };

  function detectRegime(dayIdx: number): RegimeState {
    const spySlice = spy.slice(0, dayIdx + 1);

    // Trend indicators
    const spyEmaFast = ema(spySlice, CONFIG.spyFastEma);
    const spyEmaSlow = ema(spySlice, CONFIG.spySlowEma);
    const spyAboveSma200 = spySlice[spySlice.length - 1].close > spyEmaSlow;

    // Momentum
    const mom = momentum(spySlice, CONFIG.momentumPeriod);

    // Volatility (annualized)
    const vol = volatility(spySlice, CONFIG.volatilityPeriod);

    // Regime logic
    let regime: Regime;
    let confidence = 0.5;

    if (spyAboveSma200 && mom > 0 && vol < 0.25) {
      // Clear uptrend, positive momentum, low volatility -> BULL
      regime = 'BULL';
      confidence = 0.7 + Math.min(0.3, mom * 5);
    } else if (!spyAboveSma200 && mom < 0) {
      // Below 200DMA and negative momentum -> BEAR
      regime = 'BEAR';
      confidence = 0.6 + Math.min(0.4, Math.abs(mom) * 3);
    } else {
      // Mixed signals -> SIDEWAYS
      regime = 'SIDEWAYS';
      confidence = 0.5;
    }

    return { regime, spyAboveSma200, momentum: mom, volatility: vol, confidence };
  }

  for (let dayIdx = CONFIG.spySlowEma + 10; dayIdx < spy.length; dayIdx++) {
    const today = spy[dayIdx].date;

    // Detect regime
    const regimeState = detectRegime(dayIdx);
    regimeHistory.push(regimeState);

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
      yearlyRegimes.push({ ...yearRegimeCount });
      currentYear = today.getFullYear();
      currentYearRet = 0;
      yearStartEq = totalEq;
      yearRegimeCount = { BULL: 0, BEAR: 0, SIDEWAYS: 0 };
    }
    currentYearRet = (totalEq - yearStartEq) / yearStartEq;
    yearRegimeCount[regimeState.regime]++;

    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    if (dd > CONFIG.circuitBreakerDD) circuitBreaker = true;

    // Circuit breaker - liquidate everything
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

    // Strategy per regime
    const configByRegime = {
      BULL: { topSectors: CONFIG.bullTopSectors, positionPct: CONFIG.bullPositionPct },
      BEAR: { topSectors: CONFIG.bearTopSectors, positionPct: CONFIG.bearPositionPct },
      SIDEWAYS: { topSectors: CONFIG.sidewaysTopSectors, positionPct: CONFIG.sidewaysPositionPct },
    };

    const { topSectors, positionPct } = configByRegime[regimeState.regime];

    // In BEAR, mostly stay in cash - only very selective
    if (regimeState.regime === 'BEAR') {
      // Liquidate most positions, maybe keep 1 defensive
      const defensiveSectors = ['XLP', 'XLV', 'XLU']; // Staples, Healthcare, Utilities

      for (const [etf, pos] of positions) {
        if (!defensiveSectors.includes(etf)) {
          const data = sectorData.get(etf);
          if (!data) continue;
          const bar = data.find(x => x.date.getTime() === today.getTime());
          if (bar) {
            cash += pos.shares * bar.close;
          }
          positions.delete(etf);
        }
      }

      // Small exposure to defensive if trend is improving
      if (regimeState.momentum > -0.05 && positions.size < topSectors) {
        const scores: SectorScore[] = [];
        for (const sector of SECTORS.filter(s => defensiveSectors.includes(s.etf))) {
          const data = sectorData.get(sector.etf);
          if (!data) continue;

          const slice = data.slice(0, dayIdx + 1);
          if (slice.length < CONFIG.momentumPeriod + 1) continue;

          const mom = calcMomentum(slice, CONFIG.momentumPeriod);
          scores.push({ etf: sector.etf, name: sector.name, momentum: mom, score: mom });
        }

        scores.sort((a, b) => b.score - a.score);

        for (const sector of scores.slice(0, topSectors)) {
          const data = sectorData.get(sector.etf);
          if (!data) continue;

          const bar = data.find(x => x.date.getTime() === today.getTime());
          if (!bar || bar.open <= 0) continue;

          const currentPos = positions.get(sector.etf);
          const targetValue = totalEq * positionPct;
          const targetShares = Math.floor(targetValue / bar.open);

          if (!currentPos && cash >= targetValue) {
            positions.set(sector.etf, {
              etf: sector.etf,
              shares: targetShares,
              entryPrice: bar.open,
            });
            cash -= targetShares * bar.open;
          }
        }
      }

      continue;
    }

    // BULL and SIDEWAYS: Score sectors
    const scores: SectorScore[] = [];
    const spySlice = spy.slice(0, dayIdx + 1);
    const spyMomentum = calcMomentum(spySlice, CONFIG.momentumPeriod);

    for (const sector of SECTORS) {
      const data = sectorData.get(sector.etf);
      if (!data) continue;

      const slice = data.slice(0, dayIdx + 1);
      if (slice.length < CONFIG.momentumPeriod + 1) continue;

      const mom = calcMomentum(slice, CONFIG.momentumPeriod);
      const relativeStrength = mom - spyMomentum;

      // Different scoring by regime
      let score: number;
      if (regimeState.regime === 'BULL') {
        // In bull: favor momentum and relative strength
        score = relativeStrength * 100 + mom * 50;
      } else {
        // In sideways: favor stability (lower volatility) and mean reversion
        const secVol = volatility(slice, CONFIG.volatilityPeriod);
        score = mom * 30 - secVol * 200; // Penalize high volatility
      }

      scores.push({ etf: sector.etf, name: sector.name, momentum: mom, score });
    }

    scores.sort((a, b) => b.score - a.score);

    // Rebalance to top sectors
    const targetSectors = scores.slice(0, topSectors);
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
      const targetValue = totalEq * positionPct;
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
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq).toLocaleString()}, DD=${(dd*100).toFixed(1)}%, Regime=${regimeState.regime}, Pos=${positions.size}`);
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
  const validYears = yearlyReturns.filter(r => !isNaN(r) && isFinite(r));
  const yearlySharpes = validYears.map(r => r / 0.15);
  const sortedSharpes = [...yearlySharpes].sort((a, b) => a - b);
  const coreSharpes = sortedSharpes.slice(1, -1);

  if (coreSharpes.length === 0) {
    console.log(`\n⚠️  Pas assez d'années pour Walk-Forward`);
    return { sharpe: 0, cagr: 0, maxDD: 1, calmar: 0, validation: {}, regimeHistory };
  }

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

  function calcMomentum(data: PriceData[], period: number): number {
    if (data.length < period + 1) return 0;
    const cur = data[data.length - 1].close;
    const prev = data[data.length - period - 1].close;
    return (cur - prev) / prev;
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

  // Regime distribution
  const regimeCounts: Record<Regime, number> = { BULL: 0, BEAR: 0, SIDEWAYS: 0 };
  for (const r of regimeHistory) {
    regimeCounts[r.regime]++;
  }
  const totalDays = regimeHistory.length;

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
    regimeDistribution: {
      BULL: regimeCounts.BULL / totalDays,
      BEAR: regimeCounts.BEAR / totalDays,
      SIDEWAYS: regimeCounts.SIDEWAYS / totalDays,
    },
    validation: {
      t_p: tP,
      mc_p: mcP,
      boot_ci_low: bootLow,
      wf_ratio: wfRatio,
      prob_loss_30d: probLoss,
      psr,
    },
    regimeHistory,
  };

  // Print
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS V16                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);

  console.log(`\n  Regime Distribution:`);
  console.log(`    BULL:     ${(results.regimeDistribution.BULL * 100).toFixed(1)}%`);
  console.log(`    SIDEWAYS: ${(results.regimeDistribution.SIDEWAYS * 100).toFixed(1)}%`);
  console.log(`    BEAR:     ${(results.regimeDistribution.BEAR * 100).toFixed(1)}%`);

  console.log(`\n  Walk-Forward (Yearly):`);
  console.log(`    Returns: [${yearlyReturns.slice(-5).map(r => (r * 100).toFixed(1)).join('%, ')}%]`);
  console.log(`    Sharpes: [${yearlySharpes.slice(-5).map(s => s.toFixed(2)).join(', ')}]`);
  console.log(`    WF Ratio: ${wfRatio.toFixed(2)}`);

  const checks = [
    ['T-Test p < 0.05', results.validation.t_p < 0.05],
    ['Sharpe > 1.0', results.sharpe > 1.0],
    ['Max DD < 15%', results.maxDD < 0.15],
    ['Monte Carlo p < 0.10', results.validation.mc_p < 0.10],
    ['Walk-Forward > 0.6', results.validation.wf_ratio > 0.6],
    ['Bootstrap CI > 0.4', results.validation.boot_ci_low > 0.4],
    ['Prob Loss < 15%', results.validation.prob_loss_30d < 0.15],
    ['PSR > 0.6', results.validation.psr > 0.6],
  ];

  let passCount = 0;
  for (const [name, pass] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
  }

  console.log(`\n  VERDICT: ${passCount >= 6 ? '✅ VALIDÉ' : passCount >= 4 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${passCount}/8)`);

  return results;
}

runV16().catch(console.error);
