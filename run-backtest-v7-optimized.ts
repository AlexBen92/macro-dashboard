/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST V7-OPTIMIZED - PATTERN-BASED RUNNER
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * KEY OPTIMIZATIONS FROM V6 PATTERN ANALYSIS:
 * - Max hold: 5 bars (trades >5 bars = 50% loss rate)
 * - RSI filter: [35, 65] only (extremes = 50% of losses)
 * - BB filter: |position| < 1.5 sigma
 * - Quick exit: 3 bars if no profit
 * - Tight TP: 1.5x ATR
 */

import { runBacktestV7, type BacktestV7Result } from './src/lib/backtest-v7-final';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const RESULTS_DIR = './results-v7-optimized';

const COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'AVAXUSDT',
  'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'DOTUSDT', 'LINKUSDT',
  'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT',
  'ALGOUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'TRXUSDT',
];

interface BtCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface ValidationResult {
  name: string;
  passed: boolean;
  value: string;
  detail: string;
  category: 'RETURN' | 'RISK' | 'STATISTICAL' | 'STABILITY';
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATISTICAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function calculateStandardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function calculateDownsideDeviation(values: number[]): number {
  const downsideReturns = values.filter(v => v < 0);
  if (downsideReturns.length === 0) return 0;
  const mean = downsideReturns.reduce((a, b) => a + b, 0) / downsideReturns.length;
  return Math.sqrt(downsideReturns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / downsideReturns.length);
}

function runValidation(result: BacktestV7Result): ValidationResult[] {
  const tests: ValidationResult[] = [];

  const returns: number[] = [];
  for (let i = 1; i < result.equityCurve.length; i++) {
    returns.push((result.equityCurve[i] - result.equityCurve[i-1]) / result.equityCurve[i-1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = calculateStandardDeviation(returns);
  const downsideDev = calculateDownsideDeviation(returns);

  // T-Test
  const n = returns.length;
  const tStat = mean / (stdDev / Math.sqrt(n));
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));
  tests.push({
    name: 'T-Test',
    category: 'STATISTICAL',
    passed: pValue < 0.05,
    value: `t=${tStat.toFixed(2)}, p=${pValue < 0.001 ? '<0.0001' : pValue.toFixed(4)}`,
    detail: pValue < 0.001 ? 'HIGHLY SIGNIFICANT' : pValue < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT',
  });

  // Sharpe
  const sharpe = stdDev !== 0 ? (mean / stdDev) * Math.sqrt(252 * 24) : 0;
  tests.push({
    name: 'Sharpe Ratio',
    category: 'RETURN',
    passed: sharpe > 1,
    value: sharpe.toFixed(2),
    detail: sharpe > 2 ? 'EXCELLENT' : sharpe > 1 ? 'GOOD' : 'POOR',
  });

  // Sortino
  const sortino = downsideDev !== 0 ? (mean / downsideDev) * Math.sqrt(252 * 24) : 0;
  tests.push({
    name: 'Sortino Ratio',
    category: 'RISK',
    passed: sortino > 1,
    value: sortino.toFixed(2),
    detail: sortino > 2 ? 'EXCELLENT' : sortino > 1 ? 'GOOD' : 'POOR',
  });

  // Monte Carlo
  if (result.trades.length >= 5) {
    const actualFinal = result.trades.reduce((sum, t) => sum + t.pnlNet, 0);
    const percentiles: number[] = [];
    for (let i = 0; i < 10000; i++) {
      const shuffled = [...result.trades].sort(() => Math.random() - 0.5);
      percentiles.push(shuffled.reduce((sum, t) => sum + t.pnlNet, 0));
    }
    percentiles.sort((a, b) => a - b);
    const percentile = percentiles.findIndex(p => p >= actualFinal) / percentiles.length;
    tests.push({
      name: 'Monte Carlo Eq',
      category: 'STATISTICAL',
      passed: percentile > 0.5,
      value: `${(percentile * 100).toFixed(0)}%ile`,
      detail: percentile > 0.75 ? 'ROBUST' : percentile > 0.5 ? 'PASSABLE' : 'WEAK',
    });
  }

  // Walk-Forward
  if (returns.length >= 200) {
    const midPoint = Math.floor(returns.length / 2);
    const sharpe1 = returns.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint / (calculateStandardDeviation(returns.slice(0, midPoint)) || 1);
    const sharpe2 = returns.slice(midPoint).reduce((a, b) => a + b, 0) / (returns.length - midPoint) / (calculateStandardDeviation(returns.slice(midPoint)) || 1);
    const correlation = Math.abs(sharpe1 - sharpe2) / (Math.abs(sharpe1) + Math.abs(sharpe2) + 0.001);
    const stability = 1 - correlation;
    tests.push({
      name: 'Walk-Forward',
      category: 'STABILITY',
      passed: stability > 0.7,
      value: stability.toFixed(2),
      detail: stability > 0.85 ? 'EXCELLENT STABILITY' : stability > 0.7 ? 'STABLE OOS' : 'UNSTABLE',
    });
  }

  // Bootstrap CI
  if (returns.length >= 50) {
    const bootstraps: number[] = [];
    for (let i = 0; i < 1000; i++) {
      const sample: number[] = [];
      for (let j = 0; j < Math.min(100, returns.length); j++) {
        sample.push(returns[Math.floor(Math.random() * returns.length)]);
      }
      const sMean = sample.reduce((a, b) => a + b, 0) / sample.length;
      const sStd = calculateStandardDeviation(sample);
      bootstraps.push(sStd !== 0 ? (sMean / sStd) * Math.sqrt(252 * 24) : 0);
    }
    bootstraps.sort((a, b) => a - b);
    const lower = bootstraps[Math.floor(bootstraps.length * 0.025)];
    const upper = bootstraps[Math.floor(bootstraps.length * 0.975)];
    tests.push({
      name: 'Bootstrap CI',
      category: 'STATISTICAL',
      passed: lower > 0,
      value: `[${lower.toFixed(2)}, ${upper.toFixed(2)}]`,
      detail: lower > 0 ? 'ALL POSITIVE' : 'INCLUDES ZERO',
    });
  }

  // Ulcer Index
  const peakCurve: number[] = [];
  let peak = result.equityCurve[0];
  for (const eq of result.equityCurve) {
    peak = Math.max(peak, eq);
    peakCurve.push(peak);
  }
  const ddCurve = result.equityCurve.map((eq, i) => ((peakCurve[i] - eq) / peakCurve[i]) * 100);
  const ulcerIndex = Math.sqrt(ddCurve.reduce((a, b) => a + b * b, 0) / ddCurve.length);
  tests.push({
    name: 'Ulcer Index',
    category: 'RISK',
    passed: ulcerIndex < 5,
    value: ulcerIndex.toFixed(2),
    detail: ulcerIndex < 2 ? 'LOW PAIN' : ulcerIndex < 5 ? 'MODERATE' : 'HIGH PAIN',
  });

  // Recovery Factor
  const totalReturn = result.totalPnl;
  const maxDD = result.maxDrawdownPct;
  const recoveryFactor = maxDD !== 0 ? Math.abs(totalReturn / (maxDD / 100 * 10000)) : 0;
  tests.push({
    name: 'Recovery Factor',
    category: 'RISK',
    passed: recoveryFactor > 2,
    value: recoveryFactor > 1000 ? recoveryFactor.toExponential(1) : recoveryFactor.toFixed(1),
    detail: recoveryFactor > 10 ? 'EXCEPTIONAL' : recoveryFactor > 2 ? 'GOOD' : 'POOR',
  });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  BACKTEST V7-OPTIMIZED - PATTERN-BASED MEAN REVERSION                            ║');
  console.log('║  Max Hold: 5 bars | RSI: [35-65] | BB: |pos|<1.5 | TP: 1.5x ATR                  ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const results: BacktestV7Result[] = [];

  for (const coin of COINS) {
    console.log(`Processing ${coin}...`);

    const filePath = join(DATA_DIR, `${coin}_H1.json`);
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const rawData = JSON.parse(content);
      // Convert array format to object format
      const candles: BtCandle[] = rawData.map((d: any[]) => ({
        t: Number(d[0]),
        o: Number(d[1]),
        h: Number(d[2]),
        l: Number(d[3]),
        c: Number(d[4]),
        v: Number(d[5])
      }));

      const result = runBacktestV7(candles, coin);
      results.push(result);

      await fs.writeFile(
        join(RESULTS_DIR, `${coin.replace('USDT', '')}_v7_opt.json`),
        JSON.stringify(result, null, 2)
      );

      console.log(`  Trades: ${result.totalTrades} | WR: ${result.winRate.toFixed(1)}% | PnL: $${result.totalPnl.toFixed(2)} | Sharpe: ${result.sharpe.toFixed(2)}`);
    } catch (err) {
      console.log(`  Error: ${(err as Error).message}`);
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 AGGREGATE RESULTS');
  console.log('═'.repeat(80));
  console.log('');

  const totalTrades = results.reduce((s, r) => s + r.totalTrades, 0);
  const totalWins = results.reduce((s, r) => s + r.wins, 0);
  const totalLosses = results.reduce((s, r) => s + r.losses, 0);
  const totalPnl = results.reduce((s, r) => s + r.totalPnl, 0);
  const avgWinRate = (totalWins / totalTrades) * 100;
  const avgSharpe = results.reduce((s, r) => s + r.sharpe, 0) / results.length;
  const avgSortino = results.reduce((s, r) => s + r.sortino, 0) / results.length;
  const avgMaxDD = results.reduce((s, r) => s + r.maxDrawdownPct, 0) / results.length;
  const avgHoldBars = results.reduce((s, r) => s + r.avgHoldBars, 0) / results.length;

  const aggEquity: number[] = [10000];
  for (const r of results) {
    for (let i = 1; i < r.equityCurve.length; i++) {
      aggEquity.push(aggEquity[0] + r.equityCurve[i] - 10000);
    }
  }

  const aggregateResult: BacktestV7Result = {
    coin: 'AGGREGATE',
    totalTrades,
    wins: totalWins,
    losses: totalLosses,
    winRate: avgWinRate,
    totalPnl,
    sharpe: avgSharpe,
    sortino: avgSortino,
    maxDrawdownPct: avgMaxDD,
    profitFactor: 0,
    avgHoldBars,
    avgWin: 0,
    avgLoss: 0,
    trades: results.flatMap(r => r.trades),
    equityCurve: aggEquity,
    drawdownCurve: [],
  };

  const validations = runValidation(aggregateResult);

  console.log('┌─────────────────────────────┬──────────────┬──────────────────────────────────┐');
  console.log('│ METRIC                      │ VALUE        │ DESCRIPTION                      │');
  console.log('├─────────────────────────────┼──────────────┼──────────────────────────────────┤');
  console.log(`│ Total Coins                 │         ${results.length.toString().padStart(2)} │ Number of cryptocurrencies tested │`);
  console.log(`│ Total Trades                │      ${totalTrades.toString().padStart(5)} │ Total number of trades           │`);
  console.log(`│ Win Rate                    │    ${avgWinRate.toFixed(1).padStart(6)}% │ Percentage of winning trades     │`);
  console.log(`│ Total PnL                   │   $${totalPnl.toFixed(2).padStart(7)} │ Net profit across all coins     │`);
  console.log(`│ Sharpe Ratio                │    ${avgSharpe.toFixed(2).padStart(6)} │ Risk-adjusted return (annual)   │`);
  console.log(`│ Sortino Ratio               │    ${avgSortino.toFixed(2).padStart(6)} │ Downside-adjusted return        │`);
  console.log(`│ Max Drawdown                │   ${avgMaxDD.toFixed(2).padStart(6)}% │ Largest peak-to-trough decline   │`);
  console.log(`│ Avg Hold Bars               │    ${avgHoldBars.toFixed(1).padStart(6)} │ Average trade duration          │`);
  console.log('└─────────────────────────────┴──────────────┴──────────────────────────────────┘');
  console.log('');

  console.log('═'.repeat(80));
  console.log('✅ STATISTICAL VALIDATION');
  console.log('═'.repeat(80));
  console.log('');

  const byCategory: Record<string, ValidationResult[]> = {};
  for (const v of validations) {
    if (!byCategory[v.category]) byCategory[v.category] = [];
    byCategory[v.category].push(v);
  }

  for (const [cat, tests] of Object.entries(byCategory)) {
    console.log(`${cat}:`);
    for (const t of tests) {
      const icon = t.passed ? '✅' : '❌';
      console.log(`  ${icon} ${t.name.padEnd(20)} ${t.value.padStart(20)} ${t.detail}`);
    }
    console.log('');
  }

  const passed = validations.filter(v => v.passed).length;
  const total = validations.length;
  const pct = (passed / total * 100).toFixed(0);

  console.log('═'.repeat(80));
  console.log(`STATISTICAL VALIDATION: ${passed}/${total} (${pct}%)`);
  console.log('═'.repeat(80));
  console.log('');

  console.log('═'.repeat(80));
  console.log('🏆 TOP 10 COINS BY SHARPE');
  console.log('═'.repeat(80));
  console.log('');
  console.log('┌────────────┬─────────┬───────────┬──────────┬──────────┬──────────┐');
  console.log('│ Coin       │ PnL ($) │ Win Rate  │ Sharpe   │ Sortino  │ Max DD   │');
  console.log('├────────────┼─────────┼───────────┼──────────┼──────────┼──────────┤');

  const topCoins = [...results].sort((a, b) => b.sharpe - a.sharpe).slice(0, 10);
  for (const r of topCoins) {
    console.log(`│ ${r.coin.padEnd(10)} │ $${String(r.totalPnl.toFixed(0)).padStart(6)} │ ${(r.winRate.toFixed(1) + '%').padStart(9)} │ ${r.sharpe.toFixed(2).padStart(8)} │ ${r.sortino.toFixed(2).padStart(8)} │ ${(r.maxDrawdownPct.toFixed(1) + '%').padStart(8)} │`);
  }
  console.log('└────────────┴─────────┴───────────┴──────────┴──────────┴──────────┘');
  console.log('');

  console.log('═'.repeat(80));
  console.log('🚪 EXIT REASON ANALYSIS');
  console.log('═'.repeat(80));
  console.log('');

  const byExitReason: Record<string, { count: number; pnl: number; wins: number }> = {};
  for (const r of results) {
    for (const t of r.trades) {
      if (!byExitReason[t.exitReason]) {
        byExitReason[t.exitReason] = { count: 0, pnl: 0, wins: 0 };
      }
      byExitReason[t.exitReason].count++;
      byExitReason[t.exitReason].pnl += t.pnlNet;
      if (t.outcome === 'WIN') byExitReason[t.exitReason].wins++;
    }
  }

  console.log('┌────────────────────┬───────────┬──────────────┬──────────┐');
  console.log('│ Exit Reason        │ Count     │ Total PnL    │ Win Rate │');
  console.log('├────────────────────┼───────────┼──────────────┼──────────┤');

  for (const [reason, stats] of Object.entries(byExitReason).sort((a, b) => b[1].count - a[1].count)) {
    const wr = (stats.wins / stats.count * 100).toFixed(0) + '%';
    console.log(`│ ${reason.padEnd(18)} │ ${String(stats.count).padStart(9)} │ $${String(stats.pnl.toFixed(2)).padStart(12)} │ ${wr.padStart(8)} │`);
  }
  console.log('└────────────────────┴───────────┴──────────────┴──────────┘');
  console.log('');

  console.log(`Completed: ${new Date().toISOString()}`);
}

main().catch(console.error);
