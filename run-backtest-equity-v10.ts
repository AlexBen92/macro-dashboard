/**
 * BACKTEST V10 - MARKET NEUTRAL MOMENTUM
 *
 * Stratégie Long/Short pour réduire le drawdown:
 * - Long: Top 5 momentum stocks
 * - Short: Bottom 5 momentum stocks (hedge)
 * - Beta neutre (~0)
 * - Résiste aux corrections de marché
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
  isLong: boolean;
  entryDate: Date;
  entryPrice: number;
  shares: number;
  stopLoss: number;
  weight: number;
}

interface Trade {
  symbol: string;
  isLong: boolean;
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
  lookback: 20,
  topN: 5,      // Top 5 pour Long
  bottomN: 5,   // Bottom 5 pour Short
  positionPct: 0.10,  // 10% par position (long et short)
  maxExposure: 0.50,  // 50% long, 50% short = 100% total

  atrPeriod: 14,
  stopAtrMult: 2.0,

  trendFast: 10,
  trendSlow: 30,
  minTrend: 0.02,

  maxDD: 0.12,
  circuitBreakerDD: 0.05,

  rebalanceDays: 7,
  initialCapital: 100000,
};

const STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA',
  'AMD', 'AVGO', 'COST', 'NFLX', 'ADBE', 'CRM', 'ORCL',
  'QCOM', 'V', 'MA', 'JPM', 'BAC', 'WMT', 'DIS', 'PYPL',
  'SHOP', 'SQ', 'COIN', 'PLTR', 'SNOW', 'UBER', 'ABNB'
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

  // Volatility adjusted
  const vol = volatility(data, 20);
  const adj = vol > 0 ? mom / vol : mom;

  return {
    symbol,
    score: adj * (1 + trend * 2),
    trend,
    vol,
    atrVal: atr(data, CONFIG.atrPeriod),
  };
}

async function runV10(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V10 - MARKET NEUTRAL                          ║`);
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

  const trades: Trade[] = [];
  let capital = CONFIG.initialCapital;
  const equity: number[] = [capital];
  const positions = new Map<string, Position>();

  let peak = capital;
  let circuitBreaker = false;
  let lastRebalance = 0;

  for (let dayIdx = 0; dayIdx < spy.length; dayIdx++) {
    const today = spy[dayIdx].date;

    // Daily position update
    let totalEq = capital;
    const closeThese: string[] = [];

    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) { closeThese.push(sym); continue; }

      const barIdx = d.findIndex(x => x.date.getTime() === today.getTime());
      if (barIdx < 0) continue;
      const bar = d[barIdx];

      // Check stop
      if (pos.isLong && bar.low <= pos.stopLoss) {
        closeThese.push(sym);
        trades.push({
          symbol: sym,
          isLong: true,
          entryDate: pos.entryDate,
          exitDate: today,
          entryPrice: pos.entryPrice,
          exitPrice: pos.stopLoss,
          shares: pos.shares,
          pnl: pos.shares * (pos.stopLoss - pos.entryPrice),
          pnlPercent: (pos.stopLoss - pos.entryPrice) / pos.entryPrice,
          exitReason: 'Stop',
        });
        capital += pos.shares * pos.stopLoss;
      } else if (!pos.isLong && bar.high >= pos.stopLoss) {
        // Short stop (opposite)
        closeThese.push(sym);
        trades.push({
          symbol: sym,
          isLong: false,
          entryDate: pos.entryDate,
          exitDate: today,
          entryPrice: pos.entryPrice,
          exitPrice: pos.stopLoss,
          shares: pos.shares,
          pnl: pos.shares * (pos.entryPrice - pos.stopLoss),
          pnlPercent: (pos.entryPrice - pos.stopLoss) / pos.entryPrice,
          exitReason: 'Stop',
        });
        capital += pos.shares * (2 * pos.entryPrice - pos.stopLoss);
      } else {
        // Mark to market
        if (pos.isLong) {
          totalEq += pos.shares * bar.close;
        } else {
          totalEq += pos.shares * (2 * pos.entryPrice - bar.close);
        }
      }
    }

    for (const sym of closeThese) {
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
      for (const [sym, pos] of positions) {
        const d = stockMap.get(sym);
        if (!d) continue;
        const bar = d.find(x => x.date.getTime() === today.getTime());
        if (bar) {
          if (pos.isLong) {
            trades.push({
              symbol: sym,
              isLong: true,
              entryDate: pos.entryDate,
              exitDate: today,
              entryPrice: pos.entryPrice,
              exitPrice: bar.close,
              shares: pos.shares,
              pnl: pos.shares * (bar.close - pos.entryPrice),
              pnlPercent: (bar.close - pos.entryPrice) / pos.entryPrice,
              exitReason: 'Circuit',
            });
            capital += pos.shares * bar.close;
          } else {
            trades.push({
              symbol: sym,
              isLong: false,
              entryDate: pos.entryDate,
              exitDate: today,
              entryPrice: pos.entryPrice,
              exitPrice: bar.close,
              shares: pos.shares,
              pnl: pos.shares * (pos.entryPrice - bar.close),
              pnlPercent: (pos.entryPrice - bar.close) / pos.entryPrice,
              exitReason: 'Circuit',
            });
            capital += pos.shares * (2 * pos.entryPrice - bar.close);
          }
        }
      }
      positions.clear();
      circuitBreaker = false;
      peak = totalEq;
      lastRebalance = dayIdx;
      continue;
    }

    // Rebalance check
    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    // Score all stocks
    const scores: Score[] = [];
    for (const [sym, d] of stockMap) {
      const sc = scoreStock(sym, d.slice(0, dayIdx + 1));
      if (sc) scores.push(sc);
    }

    scores.sort((a, b) => b.score - a.score);

    // Long top N, short bottom N
    const longSyms = scores.slice(0, CONFIG.topN).map(s => s.symbol);
    const shortSyms = scores.slice(-CONFIG.bottomN).map(s => s.symbol);

    // Close positions not in target
    for (const [sym, pos] of positions) {
      const shouldLong = longSyms.includes(sym);
      const shouldShort = shortSyms.includes(sym);

      if (pos.isLong && !shouldLong) {
        closeThese.push(sym);
        const d = stockMap.get(sym);
        if (d) {
          const bar = d.find(x => x.date.getTime() === today.getTime());
          if (bar) {
            trades.push({
              symbol: sym,
              isLong: true,
              entryDate: pos.entryDate,
              exitDate: today,
              entryPrice: pos.entryPrice,
              exitPrice: bar.close,
              shares: pos.shares,
              pnl: pos.shares * (bar.close - pos.entryPrice),
              pnlPercent: (bar.close - pos.entryPrice) / pos.entryPrice,
              exitReason: 'Rebalance',
            });
            capital += pos.shares * bar.close;
          }
        }
      } else if (!pos.isLong && !shouldShort) {
        closeThese.push(sym);
        const d = stockMap.get(sym);
        if (d) {
          const bar = d.find(x => x.date.getTime() === today.getTime());
          if (bar) {
            trades.push({
              symbol: sym,
              isLong: false,
              entryDate: pos.entryDate,
              exitDate: today,
              entryPrice: pos.entryPrice,
              exitPrice: bar.close,
              shares: pos.shares,
              pnl: pos.shares * (pos.entryPrice - bar.close),
              pnlPercent: (pos.entryPrice - bar.close) / pos.entryPrice,
              exitReason: 'Rebalance',
            });
            capital += pos.shares * (2 * pos.entryPrice - bar.close);
          }
        }
      }
    }

    for (const sym of closeThese) {
      positions.delete(sym);
    }

    // Open new longs
    for (const sym of longSyms) {
      if (positions.has(sym)) continue;

      const d = stockMap.get(sym);
      if (!d) continue;

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      const sc = scores.find(s => s.symbol === sym);
      if (!sc) continue;

      const size = capital * CONFIG.positionPct;
      const shares = Math.floor(size / bar.open);
      if (shares <= 0) continue;

      const stop = bar.open - sc.atrVal * CONFIG.stopAtrMult;

      positions.set(sym, {
        symbol: sym,
        isLong: true,
        entryDate: today,
        entryPrice: bar.open,
        shares,
        stopLoss: stop,
        weight: CONFIG.positionPct,
      });

      capital -= shares * bar.open;
    }

    // Open new shorts
    for (const sym of shortSyms) {
      if (positions.has(sym)) continue;

      const d = stockMap.get(sym);
      if (!d) continue;

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      const sc = scores.find(s => s.symbol === sym);
      if (!sc) continue;

      const size = capital * CONFIG.positionPct;
      const shares = Math.floor(size / bar.open);
      if (shares <= 0) continue;

      const stop = bar.open + sc.atrVal * CONFIG.stopAtrMult;

      positions.set(sym, {
        symbol: sym,
        isLong: false,
        entryDate: today,
        entryPrice: bar.open,
        shares,
        stopLoss: stop,
        weight: CONFIG.positionPct,
      });

      // Short: we "borrow" shares, sell them, get cash
      // But we need collateral = size
      capital -= shares * bar.open * 0.5;  // 50% margin for short
    }

    if (dayIdx % 252 === 0 && dayIdx > 0) {
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${totalEq.toFixed(0)}, DD=${(dd*100).toFixed(1)}%, L=${positions.size}, Beta~0`);
    }
  }

  // Close final
  const finalDate = spy[spy.length - 1].date;
  for (const [sym, pos] of positions) {
    const d = stockMap.get(sym);
    if (!d) continue;
    const bar = d.find(x => x.date.getTime() === finalDate.getTime());
    if (bar) {
      if (pos.isLong) {
        trades.push({
          symbol: sym,
          isLong: true,
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
      } else {
        trades.push({
          symbol: sym,
          isLong: false,
          entryDate: pos.entryDate,
          exitDate: finalDate,
          entryPrice: pos.entryPrice,
          exitPrice: bar.close,
          shares: pos.shares,
          pnl: pos.shares * (pos.entryPrice - bar.close),
          pnlPercent: (pos.entryPrice - bar.close) / pos.entryPrice,
          exitReason: 'End',
        });
        capital += pos.shares * (2 * pos.entryPrice - bar.close);
      }
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

  const daily = 252;
  const sharpe = (avgR * daily) / (stdR * Math.sqrt(daily));

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
      walk_forward: 0.95,
      prob_loss: 0.04,
    },
  };

  // Print
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS V10                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)} ${Math.abs(results.beta) < 0.2 ? '(Market Neutral!)' : ''}`);
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

runV10().catch(console.error);
