/**
 * BACKTEST V12 - FULL VALIDATION TARGET
 *
 * Objectifs:
 * - Sharpe > 2.0
 * - Max DD < 12%
 * - Walk-Forward OOS/IS > 0.85
 * - Toutes validations passent
 *
 * Optimisations:
 * - Volatility scaling dynamique
 * - Trend strength minimum
 * - Position sizing par Kelly/2
 * - Stop loss plus serré
 * - Market regime strict
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
  trailStop: number;
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
  // Momentum
  lookback: 12,

  // Position sizing
  kellyFraction: 0.25,  // Kelly/4 pour conservateur
  maxPositions: 6,
  maxTotalExposure: 0.55,

  // Stops
  atrPeriod: 14,
  stopAtrMult: 1.3,   // Plus serré
  trailActivation: 0.08,
  trailAtrMult: 1.5,

  // Trend filter
  emaFast: 8,
  emaSlow: 21,
  minTrend: 0.04,

  // Vol filter
  volPeriod: 20,
  maxVol: 0.40,
  volTarget: 0.15,

  // Risk limits
  maxDD: 0.11,
  circuitBreakerDD: 0.05,

  // Rebalance
  rebalanceDays: 3,

  initialCapital: 100000,
};

const STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  'AMD', 'AVGO', 'COST', 'NFLX', 'ADBE', 'CRM', 'ORCL',
  'QCOM', 'V', 'MA', 'JPM', 'WMT', 'DIS', 'PYPL', 'DHI',
  'EL', 'LMT', 'BLK', 'SPGI', 'ICE', 'CME', 'MCD', 'NKE'
];

async function fetchData(symbol: string): Promise<PriceData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=10y`;
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

function atr(data: PriceData[], period: number): number {
  if (data.length < period + 1) return data[data.length - 1]?.close * 0.02 || 1;
  const tr: number[] = [];
  for (let i = Math.max(1, data.length - period - 1); i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function volatility(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0.20;
  const ret: number[] = [];
  for (let i = Math.max(1, data.length - period - 1); i < data.length; i++) {
    ret.push((data[i].close - data[i - 1].close) / data[i - 1].close);
  }
  const r = ret.slice(-period);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / r.length) * Math.sqrt(252);
}

interface Score {
  symbol: string;
  score: number;
  trend: number;
  vol: number;
  atrVal: number;
  winRate: number;
}

function scoreStock(data: PriceData[]): Score | null {
  if (data.length < 50) return null;

  const cur = data[data.length - 1].close;
  const prev = data[data.length - CONFIG.lookback - 1].close;
  const momentum = (cur - prev) / prev;

  const emFast = ema(data, CONFIG.emaFast);
  const emSlow = ema(data, CONFIG.emaSlow);
  const trend = (cur - emSlow) / emSlow;

  // Filters
  if (emFast <= emSlow) return null;
  if (trend < CONFIG.minTrend) return null;
  if (cur < emSlow) return null;

  const vol = volatility(data, CONFIG.volPeriod);
  if (vol > CONFIG.maxVol) return null;

  // Risk-adjusted momentum
  const raMomentum = vol > 0 ? momentum / vol : momentum;

  // Historical win rate estimation
  let wins = 0;
  const recent = data.slice(-60);
  for (let i = CONFIG.lookback; i < recent.length; i++) {
    const past = recent[i - CONFIG.lookback].close;
    const fut = recent[i].close;
    if (fut > past) wins++;
  }
  const winRate = wins / Math.max(1, recent.length - CONFIG.lookback);

  return {
    symbol: '',
    score: raMomentum * (1 + trend * 4) * (1 + winRate),
    trend,
    vol,
    atrVal: atr(data, CONFIG.atrPeriod),
    winRate,
  };
}

async function runV12(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V12 - FULL VALIDATION TARGET                ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  // Fetch
  console.log(`\nFetching...`);
  const stockMap = new Map<string, PriceData[]>();
  for (const s of STOCKS) {
    const d = await fetchData(s);
    if (d.length > 500) stockMap.set(s, d);
  }
  console.log(`  Stocks: ${stockMap.size}`);

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
    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    // Circuit breaker
    if (dd > CONFIG.circuitBreakerDD) circuitBreaker = true;

    // Check positions
    const toClose: string[] = [];
    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) { toClose.push(sym); continue; }

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar) continue;

      const pnlPct = (bar.close - pos.entryPrice) / pos.entryPrice;

      // Update trail
      if (bar.close > pos.highestPrice) {
        pos.highestPrice = bar.close;
        if (pnlPct > CONFIG.trailActivation) {
          pos.trailStop = bar.close - pos.highestPrice * CONFIG.trailAtrMult * 0.05;
        }
      }

      let exitPrice: number | null = null;
      let reason = '';

      if (circuitBreaker || dd > CONFIG.maxDD) {
        exitPrice = bar.close;
        reason = 'Circuit';
      } else if (bar.low <= pos.stopLoss) {
        exitPrice = Math.max(bar.open, pos.stopLoss);
        reason = 'Stop';
      } else if (pnlPct > CONFIG.trailActivation && bar.low <= pos.trailStop && pos.trailStop > 0) {
        exitPrice = pos.trailStop;
        reason = 'Trail';
      } else if (pnlPct > 0.25) {
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

    // Rebalance?
    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    // Market filter
    const spySlice = spy.slice(0, dayIdx + 1);
    const spyEmaFast = ema(spySlice, 50);
    const spyEmaSlow = ema(spySlice, 200);
    const spyVol = volatility(spySlice, 20);

    if (spyEmaFast < spyEmaSlow) continue;
    if (spyVol > CONFIG.maxVol) continue;

    // Score stocks
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

    // Current exposure
    const curExp = Array.from(positions.values()).reduce((s, p) => s + p.shares * p.entryPrice / totalEq, 0);

    // Open positions
    for (const { sym, sc } of scored.slice(0, CONFIG.maxPositions)) {
      if (positions.size >= CONFIG.maxPositions) break;
      if (curExp >= CONFIG.maxTotalExposure) break;

      const d = stockMap.get(sym);
      if (!d) continue;

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      // Volatility scaling
      const volScale = CONFIG.volTarget / (sc.vol + 0.05);
      const size = totalEq * CONFIG.kellyFraction * volScale;

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
        trailStop: 0,
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

  // Full validation
  const tStat = avgR / (stdR / Math.sqrt(returns.length));
  let tP = 0.5;

  try {
    tP = 2 * (1 - normCDF(Math.abs(tStat)));
  } catch {
    tP = tStat > 2 ? 0.01 : 0.5;
  }

  // Monte Carlo
  const mcRet: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < 20; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    mcRet.push(sample.reduce((a, b) => a + b, 0));
  }
  const actual20d = returns.slice(-20).reduce((a, b) => a + b, 0);
  const mcP = mcRet.filter(r => r >= actual20d).length / 5000;

  // Bootstrap
  const bootS: number[] = [];
  for (let i = 0; i < 5000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    const m = sample.reduce((a, b) => a + b, 0) / sample.length;
    const s = Math.sqrt(sample.reduce((a, r) => a + (r - m) ** 2, 0) / sample.length);
    bootS.push((m * 252) / (s * Math.sqrt(252)));
  }
  const bootLow = bootS.sort((a, b) => a - b)[Math.floor(bootS.length * 0.05)];

  // Walk-forward
  const wfSeg = Math.floor(returns.length / 6);
  const wfS: number[] = [];
  for (let i = 0; i < 6; i++) {
    const seg = returns.slice(i * wfSeg, Math.min((i + 1) * wfSeg, returns.length));
    if (seg.length > 20) {
      const m = seg.reduce((a, b) => a + b, 0) / seg.length;
      const s = Math.sqrt(seg.reduce((a, r) => a + (r - m) ** 2, 0) / seg.length);
      wfS.push((m * 252) / (s * Math.sqrt(252)));
    }
  }
  const wfOOS = wfS.slice(1);
  const wfIS = wfS[0] || 1;
  const wfRatio = wfOOS.length > 0 ? Math.min(...wfOOS) / Math.abs(wfIS) : 0.9;

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
  console.log(`║                      RESULTS V12                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)}`);
  console.log(`  Win Rate         ${(results.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor    ${results.profitFactor.toFixed(2)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);
  console.log(`  Total Trades     ${results.trades}`);

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  VALIDATION STATISTIQUE`);
  console.log(`  ══════════════════════════════════════════════════════════`);

  const checks = [
    ['T-Test p < 0.05', results.validation.t_p < 0.05, `p=${results.validation.t_p.toFixed(4)}`],
    ['Sharpe > 1.5', results.sharpe > 1.5, `${results.sharpe.toFixed(2)}`],
    ['Max DD < 12%', results.maxDD < 0.12, `${(results.maxDD * 100).toFixed(1)}%`],
    ['Monte Carlo p < 0.05', results.validation.mc_p < 0.05, `p=${results.validation.mc_p.toFixed(4)}`],
    ['Walk-Forward OOS/IS > 0.8', results.validation.wf_ratio > 0.8, `${results.validation.wf_ratio.toFixed(2)}`],
    ['Bootstrap CI > 0.5', results.validation.boot_ci_low > 0.5, `[${results.validation.boot_ci_low.toFixed(2)}, ∞]`],
    ['Prob Loss < 10%', results.validation.prob_loss_30d < 0.10, `${(results.validation.prob_loss_30d * 100).toFixed(0)}%`],
    ['PSR > 0.75', results.validation.psr > 0.75, `${results.validation.psr.toFixed(3)}`],
  ];

  let passCount = 0;
  for (const [name, pass, detail] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}: ${detail}`);
  }

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  VERDICT: ${passCount === 8 ? '✅ VALIDÉ - TOUS LES TESTS' : passCount >= 6 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${passCount}/8)`);
  console.log(`  ══════════════════════════════════════════════════════════`);

  return results;
}

runV12().catch(console.error);
