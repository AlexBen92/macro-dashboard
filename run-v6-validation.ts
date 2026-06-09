import { runBacktestV6 } from './src/lib/backtest-v6';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const RESULTS_DIR = './results-v6-validated';

const COINS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'AVAXUSDT',
  'ADAUSDT', 'DOGEUSDT', 'XRPUSDT', 'DOTUSDT', 'LINKUSDT',
  'UNIUSDT', 'LTCUSDT', 'ATOMUSDT', 'ETCUSDT', 'XLMUSDT',
  'ALGOUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT', 'TRXUSDT',
];

// Validation functions
function normalCDF(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function tTest(returns: number[]) {
  if (returns.length < 2) return { name: 'T-Test', passed: false, value: 'N/A', detail: 'Insufficient data' };
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

function monteCarloEquity(trades: any[], simulations: number = 10000) {
  if (trades.length < 5) return { name: 'Monte Carlo Eq', passed: false, value: 'N/A', detail: 'Insufficient trades' };
  const actualFinal = trades.reduce((sum, t) => sum + t.pnlNet, 0);
  const percentiles: number[] = [];
  for (let i = 0; i < simulations; i++) {
    const shuffled = [...trades].sort(() => Math.random() - 0.5);
    percentiles.push(shuffled.reduce((sum, t) => sum + t.pnlNet, 0));
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

function calculateSharpe(returns: number[]) {
  if (returns.length < 2) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  return stdDev !== 0 ? (mean / stdDev) * Math.sqrt(252 * 24) : 0;
}

function walkForward(returns: number[], trainSize: number = 100) {
  if (returns.length < trainSize * 2) return { name: 'Walk-Forward', passed: false, value: 'N/A', detail: 'Insufficient data' };
  const midPoint = Math.floor(returns.length / 2);
  const sharpe1 = calculateSharpe(returns.slice(0, midPoint));
  const sharpe2 = calculateSharpe(returns.slice(midPoint));
  const correlation = Math.abs(sharpe1 - sharpe2) / (Math.abs(sharpe1) + Math.abs(sharpe2) + 0.001);
  const stability = 1 - correlation;
  return {
    name: 'Walk-Forward',
    passed: stability > 0.7,
    value: stability.toFixed(2),
    detail: stability > 0.85 ? 'EXCELLENT STABILITY' : stability > 0.7 ? 'STABLE OOS' : 'UNSTABLE',
  };
}

function bootstrapCI(returns: number[], simulations: number = 1000) {
  if (returns.length < 10) return { name: 'Bootstrap CI', passed: false, value: 'N/A', detail: 'Insufficient data' };
  const sharpes: number[] = [];
  for (let i = 0; i < simulations; i++) {
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

function ulcerIndex(drawdownCurve: number[]) {
  const squares = drawdownCurve.map(dd => dd * dd);
  const ui = Math.sqrt(squares.reduce((a, b) => a + b, 0) / squares.length);
  return {
    name: 'Ulcer Index',
    passed: ui < 5,
    value: ui.toFixed(2),
    detail: ui < 2 ? 'VERY LOW PAIN' : ui < 5 ? 'LOW PAIN' : ui < 10 ? 'MODERATE PAIN' : 'HIGH PAIN',
  };
}

function recoveryFactor(totalPnl: number, maxDrawdownUsd: number) {
  const rf = Math.abs(totalPnl / (maxDrawdownUsd || 1));
  return {
    name: 'Recovery Factor',
    passed: rf > 2,
    value: rf >= 1000 ? `${rf.toExponential(1)}` : rf.toFixed(1),
    detail: rf > 10 ? 'EXCEPTIONAL' : rf > 5 ? 'EXCELLENT' : rf > 2 ? 'GOOD' : 'POOR',
  };
}

async function loadCandles(symbol: string) {
  const filePath = join(DATA_DIR, `${symbol}_H1.json`);
  const data = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(data);
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  BACKTEST V6 - MEAN-REVERSION + STATISTICAL VALIDATION                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const results: any[] = [];
  let totalPnl = 0, totalTrades = 0, totalWins = 0, profitableCoins = 0;

  for (const coin of COINS) {
    process.stdout.write(`\r🔄 Testing ${coin}...`);
    try {
      const candles = await loadCandles(coin);
      const result = runBacktestV6(candles, coin);

      results.push(result);
      totalPnl += result.totalPnl;
      totalTrades += result.totalTrades;
      totalWins += result.wins;
      if (result.totalPnl > 0) profitableCoins++;

      await fs.writeFile(
        join(RESULTS_DIR, `${coin.replace('USDT', '')}_v6_valid.json`),
        JSON.stringify(result, null, 2)
      );

      const status = result.totalPnl > 0 ? '✅' : '❌';
      const pnlStr = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(2)}` : `-$${Math.abs(result.totalPnl).toFixed(2)}`;
      process.stdout.write(`\r${status} ${coin}: ${pnlStr} (${result.winRate.toFixed(1)}% WR, ${result.totalTrades} trades)\n`);

    } catch (error: any) {
      process.stdout.write(`\r❌ ${coin}: ${error.message}\n`);
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 AGGREGATE RESULTS');
  console.log('═'.repeat(80));

  const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;

  const allReturns: number[] = [];
  for (const result of results) {
    for (let i = 1; i < result.equityCurve.length; i++) {
      allReturns.push((result.equityCurve[i] - result.equityCurve[i-1]) / result.equityCurve[i-1]);
    }
  }
  const aggregateSharpe = calculateSharpe(allReturns);
  const avgMaxDD = results.reduce((sum, r) => sum + r.maxDrawdownPct, 0) / results.length;

  console.log(`Total PnL:        $${totalPnl.toFixed(2)}`);
  console.log(`Total Trades:     ${totalTrades}`);
  console.log(`Win Rate:         ${overallWinRate.toFixed(2)}%`);
  console.log(`Sharpe:           ${aggregateSharpe.toFixed(2)}`);
  console.log(`Max DD (avg):     ${avgMaxDD.toFixed(2)}%`);
  console.log(`Profitable Coins: ${profitableCoins}/${COINS.length} (${(profitableCoins / COINS.length * 100).toFixed(1)}%)`);
  console.log('');

  // Aggregate validation
  console.log('═'.repeat(80));
  console.log('✅ STATISTICAL VALIDATION (AGGREGATE)');
  console.log('═'.repeat(80));

  const validations = [
    tTest(allReturns),
    monteCarloEquity(results.flatMap(r => r.trades), 10000),
    walkForward(allReturns),
    bootstrapCI(allReturns),
    ulcerIndex(results.flatMap(r => r.drawdownCurve)),
    recoveryFactor(totalPnl, avgMaxDD / 100 * 10_000),
  ];

  const passedCount = validations.filter(v => v.passed).length;
  console.log(`✅ STATISTICAL VALIDATION: ${passedCount}/${validations.length} (${(passedCount / validations.length * 100).toFixed(0)}%)`);
  console.log('═'.repeat(80));

  for (const v of validations) {
    const icon = v.passed ? '✅' : '❌';
    console.log(`${icon} ${v.name.padEnd(18)} ${v.value.padStart(18)} ${v.detail}`);
  }

  console.log('');
  console.log(`Completed: ${new Date().toISOString()}`);
  console.log(`Results saved to: ${RESULTS_DIR}/`);
}

main().catch(console.error);
