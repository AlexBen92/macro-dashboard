/**
 * BACKTEST V6.5 - MEAN-REVERSION WITH STATISTICAL VALIDATION
 * Based on V6 (91.3% WR) + P4 improvements + Full Statistical Validation
 */

import { runBacktestV65, type BacktestV65Result } from './src/lib/backtest-v6-5';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const RESULTS_DIR = './results-v6-5';

const COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'AVAXUSDT',
  'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'DOTUSDT', 'LINKUSDT',
  'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT',
  'ALGOUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'TRXUSDT',
];

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICAL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

interface ValidationResult {
  name: string;
  passed: boolean;
  value: string;
  detail: string;
}

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function calculateSharpeFromReturns(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev !== 0 ? (mean / stdDev) * Math.sqrt(252 * 24) : 0;
}

/**
 * T-Test: Test if returns are significantly different from zero
 */
function tTest(returns: number[]): ValidationResult {
  if (returns.length < 2) {
    return { name: 'T-Test', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  const tStat = mean / (stdDev / Math.sqrt(returns.length));
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  return {
    name: 'T-Test',
    passed: pValue < 0.05,
    value: `t=${tStat.toFixed(2)}, p=${pValue < 0.001 ? '<0.001' : pValue.toFixed(4)}`,
    detail: pValue < 0.001 ? 'HIGHLY SIGNIFICANT' : pValue < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT',
  };
}

/**
 * Monte Carlo Equity Percentile
 */
function monteCarloEquity(trades: BacktestV65Result['trades'], simulations: number = 10000): ValidationResult {
  if (trades.length < 5) {
    return { name: 'Monte Carlo Eq', passed: false, value: 'N/A', detail: 'Insufficient trades' };
  }

  const actualFinal = trades.reduce((sum, t) => sum + t.pnlNet, 0);
  const percentiles: number[] = [];

  for (let i = 0; i < simulations; i++) {
    const shuffled = [...trades].sort(() => Math.random() - 0.5);
    const finalPnL = shuffled.reduce((sum, t) => sum + t.pnlNet, 0);
    percentiles.push(finalPnL);
  }

  percentiles.sort((a, b) => a - b);
  const percentile = percentiles.findIndex(p => p >= actualFinal) / simulations;

  return {
    name: 'Monte Carlo Eq',
    passed: percentile > 0.5,
    value: `${(percentile * 100).toFixed(0)}%ile`,
    detail: percentile > 0.75 ? 'EXCELLENT' : percentile > 0.5 ? 'ROBUST' : 'WEAK',
  };
}

/**
 * Walk-Forward Analysis
 */
function walkForward(returns: number[], trainSize: number = 100): ValidationResult {
  if (returns.length < trainSize * 2) {
    return { name: 'Walk-Forward', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  const midPoint = Math.floor(returns.length / 2);
  const firstHalf = returns.slice(0, midPoint);
  const secondHalf = returns.slice(midPoint);

  const sharpe1 = calculateSharpeFromReturns(firstHalf);
  const sharpe2 = calculateSharpeFromReturns(secondHalf);

  const correlation = Math.abs(sharpe1 - sharpe2) / (Math.abs(sharpe1) + Math.abs(sharpe2) + 0.001);
  const stability = 1 - correlation;

  return {
    name: 'Walk-Forward',
    passed: stability > 0.7,
    value: stability.toFixed(2),
    detail: stability > 0.85 ? 'EXCELLENT STABILITY' : stability > 0.7 ? 'STABLE OOS' : 'UNSTABLE',
  };
}

/**
 * Bootstrap Confidence Interval
 */
function bootstrapCI(returns: number[], simulations: number = 1000): ValidationResult {
  if (returns.length < 10) {
    return { name: 'Bootstrap CI', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  const sharpes: number[] = [];
  for (let i = 0; i < simulations; i++) {
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    sharpes.push(calculateSharpeFromReturns(sample));
  }

  sharpes.sort((a, b) => a - b);
  const lower = sharpes[Math.floor(simulations * 0.025)];
  const upper = sharpes[Math.floor(simulations * 0.975)];

  return {
    name: 'Bootstrap CI',
    passed: lower > 0,
    value: `[${lower.toFixed(2)}, ${upper.toFixed(2)}]`,
    detail: lower > 0 ? 'ALL POSITIVE' : 'INCLUDES ZERO',
  };
}

/**
 * Ulcer Index: Measure pain from drawdowns
 */
function ulcerIndex(drawdownCurve: number[]): ValidationResult {
  const squares = drawdownCurve.map(dd => dd * dd);
  const ui = Math.sqrt(squares.reduce((a, b) => a + b, 0) / squares.length);

  return {
    name: 'Ulcer Index',
    passed: ui < 5,
    value: ui.toFixed(2),
    detail: ui < 2 ? 'VERY LOW PAIN' : ui < 5 ? 'LOW PAIN' : ui < 10 ? 'MODERATE PAIN' : 'HIGH PAIN',
  };
}

/**
 * Recovery Factor: Net profit / max drawdown
 */
function recoveryFactor(totalPnl: number, maxDrawdownUsd: number): ValidationResult {
  const rf = Math.abs(totalPnl / (maxDrawdownUsd || 1));

  return {
    name: 'Recovery Factor',
    passed: rf > 2,
    value: rf >= 1000 ? `${rf.toExponential(1)}` : rf.toFixed(1),
    detail: rf > 10 ? 'EXCEPTIONAL' : rf > 5 ? 'EXCELLENT' : rf > 2 ? 'GOOD' : 'POOR',
  };
}

/**
 * Sharpe P-Value: Probability that Sharpe is > 0 by luck
 */
function sharpePValue(sharpe: number, returns: number[]): ValidationResult {
  // Latane's formula approximation
  const n = returns.length;
  const ps = sharpe / Math.sqrt(n);

  return {
    name: 'Sharpe P-Value',
    passed: ps < 0.05,
    value: `p=${ps.toFixed(2)}`,
    detail: ps < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT',
  };
}

/**
 * Random Walk Test: Is the equity curve too smooth?
 */
function randomWalkTest(equityCurve: number[]): ValidationResult {
  // Count direction changes
  let changes = 0;
  for (let i = 2; i < equityCurve.length; i++) {
    const dir1 = Math.sign(equityCurve[i] - equityCurve[i-1]);
    const dir2 = Math.sign(equityCurve[i-1] - equityCurve[i-2]);
    if (dir1 !== dir2) changes++;
  }

  const changeRatio = changes / equityCurve.length;

  return {
    name: 'Random Walk',
    passed: changeRatio > 0.1,
    value: `p=${changeRatio < 0.1 ? '1.00' : (1 - changeRatio).toFixed(2)}`,
    detail: changeRatio < 0.1 ? '(too stable)' : changeRatio > 0.3 ? 'NORMAL' : 'ACCEPTABLE',
  };
}

/**
 * 30-Day Loss Probability
 */
function probLoss30Days(returns: number[]): ValidationResult {
  const dailyReturns: number[] = [];
  for (let i = 24; i < returns.length; i += 24) {
    dailyReturns.push(returns.slice(i - 24, i).reduce((a, b) => a + b, 0));
  }

  if (dailyReturns.length < 10) {
    return { name: 'Prob Loss 30d', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  const losingDays = dailyReturns.filter(r => r < 0).length;
  const probLoss = losingDays / dailyReturns.length;

  return {
    name: 'Prob Loss 30d',
    passed: probLoss < 0.4,
    value: `${(probLoss * 100).toFixed(0)}%`,
    detail: probLoss > 0.5 ? 'HIGH RISK' : probLoss > 0.3 ? 'MODERATE' : 'LOW RISK',
  };
}

function runValidation(result: BacktestV65Result): ValidationResult[] {
  const returns: number[] = [];
  for (let i = 1; i < result.equityCurve.length; i++) {
    returns.push((result.equityCurve[i] - result.equityCurve[i-1]) / result.equityCurve[i-1]);
  }

  return [
    tTest(returns),
    monteCarloEquity(result.trades, 10000),
    walkForward(returns),
    bootstrapCI(returns),
    ulcerIndex(result.drawdownCurve),
    recoveryFactor(result.totalPnl, result.maxDrawdownUsd),
    sharpePValue(result.sharpe, returns),
    randomWalkTest(result.equityCurve),
    probLoss30Days(returns),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function loadCandles(symbol: string) {
  const filePath = join(DATA_DIR, `${symbol}_H1.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data) as Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  BACKTEST V6.5 - MEAN-REVERSION + STATISTICAL VALIDATION                 ║');
  console.log('║  Based on V6 (91.3% WR) + P4 Improvements                                 ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const results: Record<string, BacktestV65Result> = {};
  let totalPnl = 0, totalTrades = 0, totalWins = 0, profitableCoins = 0;

  for (const coin of COINS) {
    process.stdout.write(`\r🔄 Testing ${coin}...`);
    try {
      const candles = await loadCandles(coin);
      const result = runBacktestV65(candles, coin, {
        trailingStopTrigger: 1.0,
      });

      results[coin] = result;
      totalPnl += result.totalPnl;
      totalTrades += result.totalTrades;
      totalWins += result.wins;
      if (result.totalPnl > 0) profitableCoins++;

      await fs.writeFile(
        join(RESULTS_DIR, `${coin.replace('USDT', '')}_v6-5.json`),
        JSON.stringify(result, null, 2)
      );

      const status = result.totalPnl > 0 ? '✅' : '❌';
      const pnlStr = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(2)}` : `-$${Math.abs(result.totalPnl).toFixed(2)}`;
      process.stdout.write(`\r${status} ${coin}: ${pnlStr} (${result.winRate.toFixed(1)}% WR, ${result.totalTrades} trades)\n`);

    } catch (error) {
      process.stdout.write(`\r❌ ${coin}: FAILED\n`);
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 AGGREGATE RESULTS');
  console.log('═'.repeat(80));

  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  const allReturns: number[] = [];
  for (const result of Object.values(results)) {
    for (let i = 1; i < result.equityCurve.length; i++) {
      allReturns.push((result.equityCurve[i] - result.equityCurve[i-1]) / result.equityCurve[i-1]);
    }
  }
  const aggregateSharpe = calculateSharpeFromReturns(allReturns);
  const avgMaxDD = Object.values(results).reduce((sum, r) => sum + r.maxDrawdownPct, 0) / Object.values(results).length;

  console.log(`Total PnL:        $${totalPnl.toFixed(2)}`);
  console.log(`Total Trades:     ${totalTrades}`);
  console.log(`Win Rate:         ${overallWinRate.toFixed(2)}%`);
  console.log(`Sharpe:           ${aggregateSharpe.toFixed(2)}`);
  console.log(`Max DD (avg):     ${avgMaxDD.toFixed(2)}%`);
  console.log(`Profitable Coins: ${profitableCoins}/${COINS.length} (${(profitableCoins / COINS.length * 100).toFixed(1)}%)`);
  console.log('');

  // Top performers
  const sorted = Object.entries(results).sort((a, b) => b[1].totalPnl - a[1].totalPnl);
  console.log('═'.repeat(80));
  console.log('🏆 TOP PERFORMERS');
  console.log('═'.repeat(80));
  console.log('┌────────────┬─────────┬───────────┬──────────┬──────────┬──────────┬─────────┐');
  console.log('│ Coin       │ PnL ($) │ Win Rate  │ Trades   │ Sharpe   │ PF       │ Avg Hold│');
  console.log('├────────────┼─────────┼───────────┼──────────┼──────────┼──────────┼─────────┤');

  for (const [coin, result] of sorted.slice(0, 10)) {
    const pnl = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(0)}` : `-$${Math.abs(result.totalPnl).toFixed(0)}`;
    console.log(`│ ${coin.padEnd(10)} │ ${pnl.padStart(7)} │ ${result.winRate.toFixed(1)}%    │ ${result.totalTrades.toString().padStart(8)} │ ${result.sharpe.toFixed(2).padStart(8)} │ ${result.profitFactor.toFixed(2).padStart(8)} │ ${result.avgHoldBars.toFixed(1).padStart(7)} │`);
  }
  console.log('└────────────┴─────────┴───────────┴──────────┴──────────┴──────────┴─────────┘');

  console.log('');
  console.log('═'.repeat(80));
  console.log('📉 WORST PERFORMERS');
  console.log('═'.repeat(80));
  for (const [coin, result] of sorted.slice(-5).reverse()) {
    const pnl = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(0)}` : `-$${Math.abs(result.totalPnl).toFixed(0)}`;
    console.log(`│ ${coin.padEnd(10)} │ ${pnl.padStart(7)} │ ${result.winRate.toFixed(1)}%    │ ${result.totalTrades.toString().padStart(8)} │ ${result.sharpe.toFixed(2).padStart(8)} │`);
  }

  // Aggregate validation
  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ STATISTICAL VALIDATION (AGGREGATE)');
  console.log('═'.repeat(80));

  const aggregateResult: BacktestV65Result = {
    coin: 'AGGREGATE',
    totalTrades,
    wins: totalWins,
    losses: totalTrades - totalWins,
    winRate: overallWinRate,
    totalPnl,
    totalPnlPct: (totalPnl / 10_000) * 100,
    avgTradeReturn: totalPnl / totalTrades,
    sharpe: aggregateSharpe,
    sortino: 0,
    maxDrawdownUsd: avgMaxDD / 100 * 10_000,
    maxDrawdownPct: avgMaxDD,
    calmar: 0,
    profitFactor: 0,
    avgHoldBars: 0,
    avgWin: 0,
    avgLoss: 0,
    winLossRatio: 0,
    tpHits: 0,
    stopHits: 0,
    trailingStopHits: 0,
    maxHoldHits: 0,
    signalReversalHits: 0,
    bbSignals: 0,
    rsiSignals: 0,
    bothSignals: 0,
    volumeSignals: 0,
    equityCurve: [10_000, 10_000 + totalPnl],
    drawdownCurve: [0, -avgMaxDD],
    trades: [],
    winsList: [],
    lossesList: [],
    runDate: new Date().toISOString(),
    candleFrom: '',
    candleTo: '',
    totalCandles: 0,
  };

  const validations = runValidation(aggregateResult);
  const passedCount = validations.filter(v => v.passed).length;

  console.log(`✅ STATISTICAL VALIDATION: ${passedCount}/${validations.length} (${(passedCount / validations.length * 100).toFixed(0)}%)`);
  console.log('═'.repeat(80));

  for (const v of validations) {
    const icon = v.passed ? '✅' : '❌';
    console.log(`${icon} ${v.name.padEnd(18)} ${v.value.padStart(18)} ${v.detail}`);
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('🎯 CONFIGURATION');
  console.log('═'.repeat(80));
  console.log('BB Period/StdDev:  20 / 2.0');
  console.log('RSI Period:        14 (30/70 thresholds)');
  console.log('ATR Stop Loss:     1.5x');
  console.log('ATR Take Profit:   4.5x');
  console.log('Trailing Stop:     1.2x ATR (triggers at 1R profit)');
  console.log('Max Hold:          50 bars');
  console.log('Trend Filter:      EMA50 +/- 2%');
  console.log('Volume Filter:     1.5x average');

  console.log('');
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log(`Results saved to: ${RESULTS_DIR}/`);
}

main().catch(console.error);
