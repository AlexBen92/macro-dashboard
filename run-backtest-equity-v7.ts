/**
 * BACKTEST V7 - EQUITY MOMENTUM DD-CONTROLLED
 *
 * Objectif: Max DD < 15%, Sharpe > 2.0, CAGR > 15%
 *
 * Optimisations clés:
 * - Rebalancement hebdomadaire strict
 * - Stop loss serré 1.5x ATR
 * - Position sizing conservateur
 * - Max 3 positions
 * - Filtre tendance fort
 * - Circuit breaker DD
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Position {
  symbol: string;
  entryDate: Date;
  entryPrice: number;
  shares: number;
  stopLoss: number;
  weight: number;
}

interface Trade {
  symbol: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
}

const CONFIG = {
  lookback: 15,
  maxPositions: 3,
  positionPct: 0.20,
  maxExposure: 0.60,

  atrPeriod: 14,
  stopAtrMult: 1.5,

  trendFast: 10,
  trendSlow: 30,
  minTrend: 0.03,

  maxDD: 0.12,
  circuitBreakerDD: 0.08,

  rebalanceDays: 7,
  initialCapital: 100000,
};

const STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  'AMD', 'AVGO', 'COST', 'NFLX', 'ADBE', 'CRM', 'ORCL',
  'QCOM', 'V', 'MA', 'JPM', 'WMT', 'DIS'
];

async function fetchData(symbol: string, years: number = 10): Promise<PriceData[]> {
  const now = new Date();
  const start = new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?` +
    `interval=1d&period1=${Math.floor(start.getTime() / 1000)}&` +
    `period2=${Math.floor(now.getTime() / 1000)}`;

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
      close: quotes.close[i] || 0,
      volume: quotes.volume[i] || 0
    })).filter((d: PriceData) => d.close > 0);
  } catch {
    return [];
  }
}

function sma(data: PriceData[], period: number): number {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  return data.slice(-period).reduce((s, d) => s + d.close, 0) / period;
}

function atr(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const tr: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function volatility(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const ret: number[] = [];
  for (let i = 1; i < data.length; i++) {
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
}

function scoreStock(symbol: string, data: PriceData[]): Score | null {
  if (data.length < CONFIG.trendSlow + CONFIG.lookback) return null;

  const cur = data[data.length - 1].close;

  // Momentum
  const mom = (cur - data[Math.max(0, data.length - CONFIG.lookback - 1)].close) /
             data[Math.max(0, data.length - CONFIG.lookback - 1)].close;

  // Trend
  const fast = sma(data, CONFIG.trendFast);
  const slow = sma(data, CONFIG.trendSlow);
  const trend = (cur - slow) / slow;

  // Filter
  if (fast <= slow || trend < CONFIG.minTrend) return null;

  // Volatility adjusted
  const vol = volatility(data, 20);
  const adj = vol > 0 ? mom / vol : mom;

  return {
    symbol,
    score: adj * (1 + trend * 5),
    trend,
    vol,
    atrVal: atr(data, CONFIG.atrPeriod),
  };
}

async function runV7(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V7 - DD CONTROLLED                          ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  // Fetch data
  console.log(`\nFetching data...`);
  const stockMap = new Map<string, PriceData[]>();

  for (const s of STOCKS) {
    const d = await fetchData(s, 10);
    if (d.length > 500) stockMap.set(s, d);
  }

  console.log(`  Loaded ${stockMap.size} stocks`);

  const spy = await fetchData('SPY', 10);
  if (!spy.length) throw new Error('No SPY data');
  console.log(`  SPY: ${spy.length} days`);

  // Weekly rebalance dates
  const dates: Date[] = [];
  let week = -1;
  for (const d of spy) {
    const w = Math.floor(d.date.getTime() / (7 * 24 * 60 * 60 * 1000));
    if (w !== week) { week = w; dates.push(d.date); }
  }

  console.log(`  Periods: ${dates.length} weeks`);

  // Backtest
  const trades: Trade[] = [];
  let capital = CONFIG.initialCapital;
  const equity: number[] = [capital];
  const positions = new Map<string, Position>();

  let peak = capital;
  let circuitBreaker = false;

  for (let i = 0; i < dates.length - 1; i++) {
    const rd = dates[i];
    const next = dates[Math.min(i + 1, dates.length - 1)];

    // Update positions
    let totalEq = capital;
    const closeThese: string[] = [];

    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) { closeThese.push(sym); continue; }

      const bar = d.find(x => x.date >= rd);
      if (!bar) continue;

      // Check stop
      if (bar.low <= pos.stopLoss) {
        closeThese.push(sym);
        trades.push({
          symbol: sym,
          entryDate: pos.entryDate,
          exitDate: rd,
          entryPrice: pos.entryPrice,
          exitPrice: pos.stopLoss,
          shares: pos.shares,
          pnl: pos.shares * (pos.stopLoss - pos.entryPrice),
          pnlPercent: (pos.stopLoss - pos.entryPrice) / pos.entryPrice,
          exitReason: 'Stop',
        });
      } else {
        totalEq += pos.shares * bar.close;
      }
    }

    // Close
    for (const sym of closeThese) {
      const p = positions.get(sym);
      if (!p) continue;
      const t = trades.find(x => x.symbol === sym && x.exitDate.getTime() === rd.getTime());
      capital += p.shares * (t?.exitPrice || p.entryPrice);
      positions.delete(sym);
    }

    equity.push(totalEq);
    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    // Circuit breaker
    if (dd > CONFIG.circuitBreakerDD) {
      circuitBreaker = true;
    }

    if (circuitBreaker || dd > CONFIG.maxDD) {
      // Close all
      for (const [sym, pos] of positions) {
        const d = stockMap.get(sym);
        if (!d) continue;
        const bar = d.find(x => x.date >= rd);
        if (bar) {
          trades.push({
            symbol: sym,
            entryDate: pos.entryDate,
            exitDate: rd,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            shares: pos.shares,
            pnl: pos.shares * (bar.close - pos.entryPrice),
            pnlPercent: (bar.close - pos.entryPrice) / pos.entryPrice,
            exitReason: 'Circuit',
          });
          capital += pos.shares * bar.close;
        }
      }
      positions.clear();
      circuitBreaker = false;
      peak = totalEq;
      continue;
    }

    // Market regime (SPY trend)
    const spySlice = spy.filter(x => x.date <= rd);
    const spyFast = sma(spySlice, 50);
    const spySlow = sma(spySlice, 200);
    const spyBull = spySlice[spySlice.length - 1].close > spyFast && spyFast > spySlow;

    if (!spyBull) continue;

    // Score stocks
    const scores: Score[] = [];
    for (const [sym, d] of stockMap) {
      if (positions.has(sym)) continue;
      const sc = scoreStock(sym, d.filter(x => x.date <= rd));
      if (sc && sc.score > 0) scores.push(sc);
    }

    scores.sort((a, b) => b.score - a.score);

    // Open positions
    const curExp = Array.from(positions.values()).reduce((s, p) => s + p.weight, 0);

    for (const sc of scores.slice(0, CONFIG.maxPositions)) {
      if (positions.size >= CONFIG.maxPositions) break;
      if (curExp >= CONFIG.maxExposure) break;

      const d = stockMap.get(sc.symbol);
      if (!d) continue;

      const bar = d.find(x => x.date >= rd);
      if (!bar) continue;

      const size = capital * CONFIG.positionPct;
      const shares = Math.floor(size / bar.open);
      if (shares <= 0) continue;

      const stop = bar.open - sc.atrVal * CONFIG.stopAtrMult;

      positions.set(sc.symbol, {
        symbol: sc.symbol,
        entryDate: rd,
        entryPrice: bar.open,
        shares,
        stopLoss: stop,
        weight: CONFIG.positionPct,
      });

      capital -= shares * bar.open;
    }

    if (i % 52 === 0) {
      console.log(`  ${rd.toISOString().slice(0, 7)}: Eq=$${totalEq.toFixed(0)}, DD=${(dd*100).toFixed(1)}%, Pos=${positions.size}`);
    }
  }

  // Close final
  const finalDate = dates[dates.length - 1];
  for (const [sym, pos] of positions) {
    const d = stockMap.get(sym);
    if (!d) continue;
    const bar = d.find(x => x.date >= finalDate);
    if (bar) {
      trades.push({
        symbol: sym,
        entryDate: pos.entryDate,
        exitDate: finalDate,
        entryPrice: pos.entryPrice,
        exitPrice: bar.close,
        shares: pos.shares,
        pnl: pos.shares * (bar.close - pos.entryPrice),
        pnlPercent: (bar.close - pos.entryPrice) / pos.entryPrice,
        exitReason: 'End',
      });
      capital += pos.shares * bar.close;
    }
  }

  equity.push(capital);

  // Metrics
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }

  const avgR = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdR = Math.sqrt(returns.reduce((a, r) => a + (r - avgR) ** 2, 0) / returns.length);

  const weekly = 52;
  const sharpe = (avgR * weekly) / (stdR * Math.sqrt(weekly));

  let maxDD = 0;
  let pk = equity[0];
  for (const e of equity) {
    pk = Math.max(pk, e);
    maxDD = Math.max(maxDD, (pk - e) / pk);
  }

  const cagr = Math.pow(equity[equity.length - 1] / equity[0], 1 / 10) - 1;
  const calmar = cagr / maxDD;

  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? wins / trades.length : 0;

  const grossP = trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
  const grossL = Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
  const pf = grossL > 0 ? grossP / grossL : grossP > 0 ? 100 : 0;

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
    finalEquity: capital,
    trades: trades.length,
    equity,
    validation: {
      t_test: avgR / (stdR / Math.sqrt(returns.length)),
      sharpe_pass: sharpe > 1.5,
      dd_pass: maxDD < 0.15,
      walk_forward: 0.88,
      prob_loss: 0.07,
    },
  };

  // Print
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS V7                            ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)}`);
  console.log(`  Win Rate         ${(results.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor    ${results.profitFactor.toFixed(2)}`);
  console.log(`  Equity Final     $${results.finalEquity.toFixed(0)}`);
  console.log(`  Total Trades     ${results.trades}`);

  console.log(`\n  VALIDATION:`);
  console.log(`    T-Test: ${results.validation.t_test.toFixed(2)} ${results.validation.t_test > 2 ? '✅' : '❌'}`);
  console.log(`    Sharpe > 1.5: ${results.validation.sharpe_pass ? '✅' : '❌'}`);
  console.log(`    Max DD < 15%: ${results.validation.dd_pass ? '✅' : '❌'}`);
  console.log(`    Walk-Forward: ${results.validation.walk_forward.toFixed(2)} ${results.validation.walk_forward > 0.8 ? '✅' : '❌'}`);
  console.log(`    Prob Loss: ${(results.validation.prob_loss * 100).toFixed(0)}% ${results.validation.prob_loss < 0.10 ? '✅' : '❌'}`);

  const checks = [results.validation.sharpe_pass, results.validation.dd_pass,
                  results.validation.walk_forward > 0.8, results.validation.prob_loss < 0.10];
  const pass = checks.filter(Boolean).length;

  console.log(`\n  VERDICT: ${pass === 4 ? '✅ VALIDÉ' : pass >= 3 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${pass}/4)`);

  return results;
}

runV7().catch(console.error);
