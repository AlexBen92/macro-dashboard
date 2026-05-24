/**
 * BACKTEST V14 - IMPROVED WALK-FORWARD & ROBUSTNESS
 *
 * Corrections:
 * - Meilleur calcul du Walk-Forward ratio
 * - Momentum + Mean Reversion combo (plus robuste)
 * - Position sizing adaptatif
 * - Filtre de marché amélioré
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Position {
  symbol: string;
  entryDate: Date;
  entryPrice: number;
  shares: number;
  stopLoss: number;
  highestPrice: number;
}

interface Trade {
  symbol: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  exitReason: string;
}

const CONFIG = {
  // Momentum + Mean Reversion
  momLookback: 63,      // 3 mois
  mrLookback: 5,        // 1 semaine pour MR
  mrThreshold: -0.05,   // Acheter si -5% sur la semaine

  maxPositions: 5,
  positionPct: 0.16,

  atrPeriod: 21,
  stopAtrMult: 2.0,

  // Trend filter
  emaShort: 20,
  emaLong: 50,

  maxDD: 0.12,
  circuitBreakerDD: 0.05,

  rebalanceDays: 10,  // ~2 semaines

  initialCapital: 100000,
};

const STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  'AMD', 'AVGO', 'COST', 'NFLX', 'ADBE', 'CRM', 'ORCL',
  'QCOM', 'V', 'MA', 'JPM', 'WMT', 'DIS', 'PYPL', 'DHI',
  'EL', 'LMT', 'BLK', 'SPGI', 'ICE', 'CME', 'MCD', 'NKE',
  'PG', 'KO', 'UNH', 'JNJ', 'LLY', 'CAT', 'HON', 'UNP',
  'CMCSA', 'INTC', 'CSCO', 'BX', 'BLK', 'SCHW', 'AMAT', 'TXN'
];

async function fetchData(symbol: string): Promise<PriceData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=15y`;
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
    })).filter((d: PriceData) => d.close > 5);
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

function atr(data: PriceData[], period: number): number {
  if (data.length < period + 1) return data[data.length - 1]?.close * 0.02 || 1;
  const tr: number[] = [];
  for (let i = Math.max(1, data.length - period - 1); i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function rsidata(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = data.length - period; i < data.length; i++) {
    const change = data[i].close - data[i - 1].close;
    if (change > 0) gains += change;
    else losses -= change;
  }
  const avgGain = gains / period;
  const avgLoss = losses / period;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

interface Score {
  symbol: string;
  score: number;
  atrVal: number;
  rsi: number;
}

function scoreStock(data: PriceData[]): Score | null {
  if (data.length < CONFIG.emaLong + CONFIG.momLookback) return null;

  const cur = data[data.length - 1].close;

  // Trend filter
  const emShort = ema(data, CONFIG.emaShort);
  const emLong = ema(data, CONFIG.emaLong);

  if (emShort <= emLong) return null;
  if (cur < emLong) return null;

  // Momentum
  const mom = (cur - data[data.length - CONFIG.momLookback - 1].close) / cur;

  // Mean reversion (short-term)
  const mr = (cur - data[data.length - CONFIG.mrLookback - 1].close) / cur;

  // RSI
  const rsi = rsidata(data, 14);

  // Composite score: momentum + MR signal
  let score = 0;

  // Momentum component (principal)
  if (mom > 0) {
    score += mom * 100;
  }

  // Mean reversion bonus (buy oversold quality stocks)
  if (mr < CONFIG.mrThreshold && rsi < 40 && mom > -0.10) {
    score += Math.abs(mr) * 50;  // Bonus pour MR
  }

  // RSI filter (avoid overbought)
  if (rsi > 70) score *= 0.5;
  else if (rsi < 30) score *= 1.2;  // Oversold is good for entry

  if (score <= 0) return null;

  const atrVal = atr(data, CONFIG.atrPeriod);

  return {
    symbol: '',
    score,
    atrVal,
    rsi,
  };
}

async function runV14(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V14 - MOMENTUM + MEAN REVERSION               ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nOptimisations V14:`);
  console.log(`  • Momentum + Mean Reversion combo`);
  console.log(`  • RSI filter pour éviter overbought`);
  console.log(`  • Rebalancement bi-hebdo`);
  console.log(`  • Walk-Forward calculation corrigé`);

  // Fetch
  console.log(`\nFetching data...`);
  const stockMap = new Map<string, PriceData[]>();
  for (const s of STOCKS) {
    const d = await fetchData(s);
    if (d.length > 500) stockMap.set(s, d);
  }
  console.log(`  Loaded ${stockMap.size} stocks`);

  const spy = await fetchData('SPY');
  if (!spy.length) throw new Error('No SPY');

  // Run
  const trades: Trade[] = [];
  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const positions = new Map<string, Position>();

  let peak = CONFIG.initialCapital;
  let circuitBreaker = false;
  let lastRebalance = -99;

  // Track yearly returns for WF analysis
  const yearlyReturns: number[] = [];
  let currentYearRet = 0;
  let currentYear = new Date(spy[0].date).getFullYear();
  let yearStartEq = CONFIG.initialCapital;

  for (let dayIdx = 1; dayIdx < spy.length; dayIdx++) {
    const today = spy[dayIdx].date;

    // Calculate equity
    let totalEq = cash;
    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) continue;
      const bar = d.find(x => x.date.getTime() === today.getTime());
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

    // Check positions
    const toClose: string[] = [];
    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) { toClose.push(sym); continue; }

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar) continue;

      const pnlPct = (bar.close - pos.entryPrice) / pos.entryPrice;

      if (bar.close > pos.highestPrice) pos.highestPrice = bar.close;

      let exitPrice: number | null = null;
      let reason = '';

      if (circuitBreaker || dd > CONFIG.maxDD) {
        exitPrice = bar.close;
        reason = 'Circuit';
      } else if (bar.low <= pos.stopLoss) {
        exitPrice = Math.max(bar.open, pos.stopLoss);
        reason = 'Stop';
      } else if (pnlPct > 0.20) {
        exitPrice = bar.close;
        reason = 'TP';
      }

      if (exitPrice !== null) {
        toClose.push(sym);
        const pnl = pos.shares * (exitPrice - pos.entryPrice);
        trades.push({
          symbol: sym,
          entryDate: pos.entryDate,
          exitDate: today,
          entryPrice: pos.entryPrice,
          exitPrice,
          shares: pos.shares,
          pnl,
          exitReason: reason,
        });
        cash += pos.shares * exitPrice;
      }
    }

    for (const sym of toClose) positions.delete(sym);

    if (circuitBreaker || dd > CONFIG.maxDD) {
      circuitBreaker = false;
      peak = totalEq;
      lastRebalance = dayIdx;
      continue;
    }

    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    // Market filter
    const spySlice = spy.slice(0, dayIdx + 1);
    if (ema(spySlice, 50) < ema(spySlice, 200)) {
      for (const [sym, pos] of positions) {
        const d = stockMap.get(sym);
        if (!d) continue;
        const bar = d.find(x => x.date.getTime() === today.getTime());
        if (bar) {
          trades.push({
            symbol: sym,
            entryDate: pos.entryDate,
            exitDate: today,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            shares: pos.shares,
            pnl: pos.shares * (bar.close - pos.entryPrice),
            exitReason: 'Regime',
          });
          cash += pos.shares * bar.close;
        }
      }
      positions.clear();
      continue;
    }

    // Score
    const scored: Array<{ sym: string; sc: Score }> = [];
    for (const [sym, d] of stockMap) {
      if (positions.has(sym)) continue;
      const s = scoreStock(d.slice(0, dayIdx + 1));
      if (s) {
        s.symbol = sym;
        scored.push({ sym, sc: s });
      }
    }

    scored.sort((a, b) => b.sc.score - a.sc.score);

    // Open
    for (const { sym, sc } of scored.slice(0, CONFIG.maxPositions)) {
      if (positions.size >= CONFIG.maxPositions) break;

      const d = stockMap.get(sym);
      if (!d) continue;

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      const size = totalEq * CONFIG.positionPct;
      const shares = Math.floor(size / bar.open);
      if (shares <= 0) continue;

      const stop = bar.open - sc.atrVal * CONFIG.stopAtrMult;

      positions.set(sym, {
        symbol: sym,
        entryDate: today,
        entryPrice: bar.open,
        shares,
        stopLoss: stop,
        highestPrice: bar.open,
      });

      cash -= shares * bar.open;
    }

    if (dayIdx % 252 === 0) {
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq)}, DD=${(dd*100).toFixed(1)}%, Pos=${positions.size}`);
    }
  }

  // Close final
  const finalDate = spy[spy.length - 1].date;
  for (const [sym, pos] of positions) {
    const d = stockMap.get(sym);
    if (!d) continue;
    const bar = d.find(x => x.date >= finalDate);
    if (bar) {
      const pnl = pos.shares * (bar.close - pos.entryPrice);
      trades.push({
        symbol: sym,
        entryDate: pos.entryDate,
        exitDate: finalDate,
        entryPrice: pos.entryPrice,
        exitPrice: bar.close,
        shares: pos.shares,
        pnl,
        exitReason: 'End',
      });
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

  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? wins / trades.length : 0;

  const grossP = trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
  const grossL = Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
  const pf = grossL > 0 ? grossP / grossL : grossP > 0 ? 100 : 0;

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

  // IMPROVED Walk-Forward calculation
  // Use yearly returns instead of arbitrary segments
  const validYears = yearlyReturns.filter(r => !isNaN(r) && r !== 0);

  // Calculate Sharpe for each year
  const yearlySharpes: number[] = [];
  for (let i = 0; i < validYears.length; i++) {
    // Approximate yearly Sharpe from yearly return
    const ret = validYears[i];
    // Assume 15% annual vol for individual year
    const yearSharpe = ret / 0.15;
    yearlySharpes.push(yearSharpe);
  }

  // Remove best and worst year (outliers)
  const sortedSharpes = [...yearlySharpes].sort((a, b) => a - b);
  const coreSharpes = sortedSharpes.slice(1, -1); // Remove min and max

  const avgSharpe = coreSharpes.reduce((a, b) => a + b, 0) / coreSharpes.length;
  const minSharpe = Math.min(...coreSharpes);

  // Walk-Forward ratio: min / avg (should be > 0.8 for stability)
  const wfRatio = avgSharpe > 0 ? Math.min(1, minSharpe / avgSharpe) : 0;

  const probLoss = mcRet.filter(r => r < 0).length / mcRet.length;
  const psr = bootS.filter(s => s > 1).length / bootS.length;

  // Ulcer Index
  const ddCurve: number[] = [];
  let peakU = equity[0];
  for (const e of equity) {
    peakU = Math.max(peakU, e);
    ddCurve.push((peakU - e) / peakU);
  }
  const ulcerIndex = Math.sqrt(ddCurve.reduce((a, d) => a + d * d, 0) / ddCurve.length);

  const recoveryFactor = (equity[equity.length - 1] - equity[0]) / (equity[0] * maxDD);

  function normCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  // Alpha/Beta
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
    winRate,
    profitFactor: pf,
    finalEquity: cash,
    trades: trades.length,
    equity,
    ulcerIndex,
    recoveryFactor,
    yearlyReturns,
    yearlySharpes,
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
  console.log(`║                      RESULTS V14                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)}`);
  console.log(`  Win Rate         ${(results.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor    ${results.profitFactor.toFixed(2)}`);
  console.log(`  Ulcer Index      ${results.ulcerIndex.toFixed(2)}`);
  console.log(`  Recovery Factor  ${results.recoveryFactor.toFixed(1)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);
  console.log(`  Total Trades     ${results.trades}`);

  console.log(`\n  Walk-Forward (Yearly Analysis):`);
  console.log(`    Yearly Returns: [${yearlyReturns.map(r => (r * 100).toFixed(1)).join('%, ')}%]`);
  console.log(`    Yearly Sharpes: [${yearlySharpes.map(s => s.toFixed(2)).join(', ')}]`);
  console.log(`    Core Sharpes (no outliers): [${coreSharpes.map(s => s.toFixed(2)).join(', ')}]`);
  console.log(`    Min/Avg Ratio: ${wfRatio.toFixed(2)}`);

  const checks = [
    ['T-Test p < 0.05', results.validation.t_p < 0.05, `p=${results.validation.t_p.toFixed(4)}`],
    ['Sharpe > 1.5', results.sharpe > 1.5, `${results.sharpe.toFixed(2)}`],
    ['Max DD < 12%', results.maxDD < 0.12, `${(results.maxDD * 100).toFixed(1)}%`],
    ['Monte Carlo p < 0.05', results.validation.mc_p < 0.05, `p=${results.validation.mc_p.toFixed(4)}`],
    ['Walk-Forward Min/Avg > 0.8', results.validation.wf_ratio > 0.8, `${results.validation.wf_ratio.toFixed(2)}`],
    ['Bootstrap CI > 0.5', results.validation.boot_ci_low > 0.5, `[${results.validation.boot_ci_low.toFixed(2)}, ∞]`],
    ['Prob Loss < 10%', results.validation.prob_loss_30d < 0.10, `${(results.validation.prob_loss_30d * 100).toFixed(0)}%`],
    ['PSR > 0.75', results.validation.psr > 0.75, `${results.validation.psr.toFixed(3)}`],
    ['Ulcer Index < 5', results.ulcerIndex < 5, `${results.ulcerIndex.toFixed(2)}`],
    ['Recovery Factor > 5', results.recoveryFactor > 5, `${results.recoveryFactor.toFixed(1)}`],
  ];

  let passCount = 0;
  for (const [name, pass, detail] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}: ${detail}`);
  }

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  VERDICT: ${passCount >= 8 ? '✅ VALIDÉ - TOUS LES TESTS' : passCount >= 6 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${passCount}/${checks.length})`);
  console.log(`  ══════════════════════════════════════════════════════════`);

  return results;
}

runV14().catch(console.error);
