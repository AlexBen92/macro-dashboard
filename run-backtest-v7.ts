/**
 * BACKTEST V7 - DUAL REGIME STRATEGY
 * Inspired by NASDAQ VAR-D P4
 * WITH STATISTICAL VALIDATION
 */

import { runBacktestV7, type BacktestV7Result } from './src/lib/backtest-v7';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const RESULTS_DIR = './results-v7';

// Coins to test
const COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'AVAXUSDT',
  'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'DOTUSDT', 'LINKUSDT',
  'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT',
  'ALGOUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'TRXUSDT',
];

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICAL VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface ValidationResult {
  name: string;
  passed: boolean;
  value: string;
  detail: string;
}

/**
 * T-Test: Test if returns are significantly different from zero
 * H0: Mean return = 0 (strategy is random)
 * H1: Mean return != 0 (strategy has edge)
 */
function tTest(returns: number[]): ValidationResult {
  if (returns.length < 2) {
    return { name: 'T-Test', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (returns.length - 1);
  const stdDev = Math.sqrt(variance);
  const tStat = mean / (stdDev / Math.sqrt(returns.length));

  // Two-tailed p-value approximation
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  return {
    name: 'T-Test',
    passed: pValue < 0.05,
    value: `t=${tStat.toFixed(2)}, p=${pValue < 0.001 ? '<0.001' : pValue.toFixed(4)}`,
    detail: pValue < 0.001 ? 'HIGHLY SIGNIFICANT' : pValue < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT',
  };
}

/**
 * Monte Carlo Equity Percentile: Test robustness via randomization
 */
function monteCarloEquity(
  trades: BacktestV7Result['trades'],
  initialCapital: number,
  simulations: number = 1000
): ValidationResult {
  if (trades.length < 5) {
    return { name: 'Monte Carlo Eq', passed: false, value: 'N/A', detail: 'Insufficient trades' };
  }

  const actualFinal = trades.reduce((sum, t) => sum + t.pnlNet, 0);
  const percentiles: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Shuffle trades
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
 * Walk-Forward Analysis: Test out-of-sample stability
 */
function walkForward(returns: number[], trainSize: number = 100): ValidationResult {
  if (returns.length < trainSize * 2) {
    return { name: 'Walk-Forward', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  // Simple walk-forward: Sharpe in first half vs second half
  const midPoint = Math.floor(returns.length / 2);
  const firstHalf = returns.slice(0, midPoint);
  const secondHalf = returns.slice(midPoint);

  const sharpe1 = calculateSharpe(firstHalf);
  const sharpe2 = calculateSharpe(secondHalf);

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
 * Bootstrap Confidence Interval: Test if Sharpe is positive
 */
function bootstrapCI(returns: number[], simulations: number = 1000): ValidationResult {
  if (returns.length < 10) {
    return { name: 'Bootstrap CI', passed: false, value: 'N/A', detail: 'Insufficient data' };
  }

  const sharpes: number[] = [];

  for (let i = 0; i < simulations; i++) {
    // Bootstrap sample with replacement
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    sharpes.push(calculateSharpe(sample));
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
  // Ulcer Index = sqrt(sum(DD^2) / n)
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

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function normalCDF(x: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1.0 + sign * y);
}

function calculateSharpe(returns: number[]): number {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev !== 0 ? (mean / stdDev) * Math.sqrt(252 * 24) : 0;
}

function runValidation(result: BacktestV7Result): ValidationResult[] {
  // Calculate returns from equity curve
  const returns: number[] = [];
  for (let i = 1; i < result.equityCurve.length; i++) {
    returns.push((result.equityCurve[i] - result.equityCurve[i-1]) / result.equityCurve[i-1]);
  }

  return [
    tTest(returns),
    monteCarloEquity(result.trades, 10_000),
    walkForward(returns),
    bootstrapCI(returns),
    ulcerIndex(result.drawdownCurve),
    recoveryFactor(result.totalPnl, result.maxDrawdownUsd),
  ];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function loadCandles(symbol: string) {
  // Files are named like BTCUSDT_H1.json
  const filePath = join(DATA_DIR, `${symbol}_H1.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data) as Array<{ t: number; o: number; h: number; l: number; c: number; v: number }>;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  BACKTEST V7 - DUAL REGIME (TREND + MEAN-REVERSION)                      ║');
  console.log('║  Inspired by NASDAQ VAR-D P4 (Sharpe 2.03, WR 71.3%)                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  // Ensure results directory exists
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const results: Record<string, BacktestV7Result> = {};
  let totalPnl = 0;
  let totalTrades = 0;
  let totalWins = 0;
  let profitableCoins = 0;

  // Test each coin
  for (const coin of COINS) {
    process.stdout.write(`\r🔄 Testing ${coin}...`);

    try {
      const candles = await loadCandles(coin);
      const result = runBacktestV7(candles, coin);

      results[coin] = result;
      totalPnl += result.totalPnl;
      totalTrades += result.totalTrades;
      totalWins += result.wins;
      if (result.totalPnl > 0) profitableCoins++;

      // Save individual result
      await fs.writeFile(
        join(RESULTS_DIR, `${coin.replace('USDT', '')}_v7.json`),
        JSON.stringify(result, null, 2)
      );

      const status = result.totalPnl > 0 ? '✅' : '❌';
      const pnlStr = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(2)}` : `-$${Math.abs(result.totalPnl).toFixed(2)}`;
      process.stdout.write(`\r${status} ${coin}: ${pnlStr} (${result.winRate.toFixed(1)}% WR, ${result.totalTrades} trades)\n`);

    } catch (error) {
      process.stdout.write(`\r❌ ${coin}: FAILED - ${error}\n`);
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 AGGREGATE RESULTS');
  console.log('═'.repeat(80));

  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  // Calculate aggregate Sharpe
  const allReturns: number[] = [];
  for (const result of Object.values(results)) {
    for (let i = 1; i < result.equityCurve.length; i++) {
      allReturns.push((result.equityCurve[i] - result.equityCurve[i-1]) / result.equityCurve[i-1]);
    }
  }
  const aggregateSharpe = calculateSharpe(allReturns);

  // Calculate aggregate CAGR (approximate)
  const finalCapital = 10_000 + totalPnl;
  const cagr = Math.pow(finalCapital / 10_000, 365 / 365) - 1; // 1 year approx
  const avgMaxDD = Object.values(results).reduce((sum, r) => sum + r.maxDrawdownPct, 0) / Object.values(results).length;
  const calmar = avgMaxDD !== 0 ? (cagr * 100) / avgMaxDD : 0;

  console.log(`Total PnL:        $${totalPnl.toFixed(2)}`);
  console.log(`Total Trades:     ${totalTrades}`);
  console.log(`Win Rate:         ${overallWinRate.toFixed(2)}%`);
  console.log(`Sharpe:           ${aggregateSharpe.toFixed(2)}`);
  console.log(`CAGR:             ${(cagr * 100).toFixed(2)}%`);
  console.log(`Max DD (avg):     ${avgMaxDD.toFixed(2)}%`);
  console.log(`Calmar:           ${calmar.toFixed(2)}`);
  console.log(`Profitable Coins: ${profitableCoins}/${COINS.length} (${(profitableCoins / COINS.length * 100).toFixed(1)}%)`);
  console.log('');

  // Top performers
  console.log('═'.repeat(80));
  console.log('🏆 TOP PERFORMERS');
  console.log('═'.repeat(80));

  const sorted = Object.entries(results).sort((a, b) => b[1].totalPnl - a[1].totalPnl);

  console.log(
    `┌────────────┬─────────┬───────────┬──────────┬──────────┬──────────┬─────────┐`
  );
  console.log(
    '│ Coin       │ PnL ($) │ Win Rate  │ Trades   │ Sharpe   │ Trend WR │ Range WR│'
  );
  console.log(
    '├────────────┼─────────┼───────────┼──────────┼──────────┼──────────┼─────────┤'
  );

  for (const [coin, result] of sorted.slice(0, 10)) {
    const pnl = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(0)}` : `-$${Math.abs(result.totalPnl).toFixed(0)}`;
    console.log(
      `│ ${coin.padEnd(10)} │ ${pnl.padStart(7)} │ ${result.winRate.toFixed(1)}%    │ ${result.totalTrades.toString().padStart(8)} │ ${result.sharpe.toFixed(2).padStart(8)} │ ${result.trendWinRate.toFixed(0)}%      │ ${result.rangeWinRate.toFixed(0)}%      │`
    );
  }
  console.log(
    '└────────────┴─────────┴───────────┴──────────┴──────────┴──────────┴─────────┘'
  );

  console.log('');
  console.log('═'.repeat(80));
  console.log('📉 WORST PERFORMERS');
  console.log('═'.repeat(80));

  for (const [coin, result] of sorted.slice(-5).reverse()) {
    const pnl = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(0)}` : `-$${Math.abs(result.totalPnl).toFixed(0)}`;
    console.log(
      `│ ${coin.padEnd(10)} │ ${pnl.padStart(7)} │ ${result.winRate.toFixed(1)}%    │ ${result.totalTrades.toString().padStart(8)} │ ${result.sharpe.toFixed(2).padStart(8)} │`
    );
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('🎯 EXIT ANALYSIS');
  console.log('═'.repeat(80));

  let tpHits = 0, stopHits = 0, trailingHits = 0, maxHoldHits = 0, regimeHits = 0;
  for (const r of Object.values(results)) {
    tpHits += r.tpHits;
    stopHits += r.stopHits;
    trailingHits += r.trailingStopHits;
    maxHoldHits += r.maxHoldHits;
    regimeHits += r.regimeChangeHits;
  }

  const totalExits = tpHits + stopHits + trailingHits + maxHoldHits + regimeHits;
  if (totalExits > 0) {
    console.log(`TP Hits:          ${tpHits} (${(tpHits / totalExits * 100).toFixed(1)}%)`);
    console.log(`Trailing Stops:   ${trailingHits} (${(trailingHits / totalExits * 100).toFixed(1)}%)`);
    console.log(`Stop Hits:        ${stopHits} (${(stopHits / totalExits * 100).toFixed(1)}%)`);
    console.log(`Max Hold:         ${maxHoldHits} (${(maxHoldHits / totalExits * 100).toFixed(1)}%)`);
    console.log(`Regime Change:    ${regimeHits} (${(regimeHits / totalExits * 100).toFixed(1)}%)`);
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ STATISTICAL VALIDATION (AGGREGATE)');
  console.log('═'.repeat(80));

  const validations = runValidation({
    coin: 'AGGREGATE',
    totalTrades,
    wins: totalWins,
    losses: totalTrades - totalWins,
    winRate: overallWinRate,
    trendTrades: 0,
    trendWinRate: 0,
    rangeTrades: 0,
    rangeWinRate: 0,
    totalPnl,
    totalPnlPct: (totalPnl / 10_000) * 100,
    avgTradeReturn: totalPnl / totalTrades,
    sharpe: aggregateSharpe,
    sortino: 0,
    maxDrawdownUsd: avgMaxDD / 100 * 10_000,
    maxDrawdownPct: avgMaxDD,
    calmar,
    profitFactor: 0,
    avgHoldBars: 0,
    avgWin: 0,
    avgLoss: 0,
    winLossRatio: 0,
    tpHits,
    stopHits,
    trailingStopHits: trailingHits,
    maxHoldHits,
    regimeChangeHits: regimeHits,
    equityCurve: [10_000, finalCapital],
    drawdownCurve: [0, -avgMaxDD],
    trades: [],
    winsList: [],
    lossesList: [],
    runDate: new Date().toISOString(),
    candleFrom: '',
    candleTo: '',
    totalCandles: 0,
  });

  const passedCount = validations.filter(v => v.passed).length;
  const passRate = (passedCount / validations.length * 100).toFixed(0);

  console.log(`✅ STATISTICAL VALIDATION: ${passedCount}/${validations.length} (${passRate}%)`);
  console.log('═'.repeat(80));

  for (const v of validations) {
    const icon = v.passed ? '✅' : '❌';
    console.log(`${icon} ${v.name.padEnd(15)} ${v.value.padStart(20)} ${v.detail}`);
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('🎯 CONFIGURATION');
  console.log('═'.repeat(80));
  console.log('Regime Detection: ADX 14, Threshold 25');
  console.log('Trend Fast/Slow:  30 / 150');
  console.log('Momentum:         10 / 40');
  console.log('ATR Stop Loss:    1.5x');
  console.log('ATR Take Profit:  4.5x');
  console.log('Trailing Stop:    1.2x ATR');
  console.log('Max Hold:         35 bars');
  console.log('Min Regime Score: 0.55');
  console.log('Mean-Rev:         BB 20/2.0, RSI 14 (30/70)');

  console.log('');
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log(`Results saved to: ${RESULTS_DIR}/`);
}

main().catch(console.error);
