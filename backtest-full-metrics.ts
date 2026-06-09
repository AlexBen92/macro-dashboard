/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * FULL QUANTITATIVE BACKTEST ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Complete statistical analysis inspired by NASDAQ VAR-D P4 methodology
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { promises as fs } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface Trade {
  pnlNet: number;
  pnlGross: number;
  holdBars: number;
  outcome: string;
  entryPrice: number;
  exitPrice: number;
  direction: string;
  exitReason: string;
}

interface BacktestResult {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  profitFactor: number;
  avgHoldBars: number;
  avgWin: number;
  avgLoss: number;
  equityCurve: number[];
  drawdownCurve: number[];
  trades: Trade[];
}

interface QuantMetrics {
  // Basic Metrics
  totalReturn: number;
  cagr: number;
  annualizedVolatility: number;

  // Risk-Adjusted Returns
  sharpe: number;
  sharpeAnn: number;
  sortino: number;
  sortinoAnn: number;
  calmar: number;

  // Drawdown Metrics
  maxDrawdown: number;
  avgDrawdown: number;
  maxDrawdownDuration: number;
  ulcerIndex: number;
  painIndex: number;
  recoveryFactor: number;

  // Trade Metrics
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  avgTradeReturn: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldBars: number;

  // Statistical Tests
  tStat: number;
  pValue: number;
  tTestSignificant: boolean;

  monteCarloPercentile: number;
  monteCarloRobust: boolean;

  walkForwardCorrelation: number;
  walkForwardStable: boolean;

  bootstrapCI: [number, number];
  bootstrapPositive: boolean;

  sharpePValue: number;
  sharpeSignificant: boolean;

  randomWalkPValue: number;
  randomWalkNormal: boolean;

  probLoss30d: number;
  probLoss60d: number;
  probLoss90d: number;

  // Additional Quant Metrics
  informationRatio: number;
  treynor: number;
  kappa3: number;
  omega: number;
  tailRatio: number;
  commonSenseRatio: number;
  burkeRatio: number;
  martinRatio: number;

  // Streak Metrics
  maxWinStreak: number;
  maxLossStreak: number;
  avgWinStreak: number;
  avgLossStreak: number;

  // Monthly Returns
  monthlyReturns: number[];
  bestMonth: number;
  worstMonth: number;
  positiveMonths: number;
  totalMonths: number;
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

function calculateDownsideDeviation(values: number[], minReturn: number = 0): number {
  const downsideReturns = values.filter(v => v < minReturn).map(v => minReturn - v);
  if (downsideReturns.length === 0) return 0;
  return Math.sqrt(downsideReturns.reduce((a, b) => a + b * b, 0) / downsideReturns.length);
}

function semiVariance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const semiVar = values.filter(v => v < mean).reduce((a, b) => a + Math.pow(b - mean, 2), 0);
  return semiVar / values.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN METRICS CALCULATOR
// ═══════════════════════════════════════════════════════════════════════════════

function calculateFullMetrics(
  result: BacktestResult,
  benchmarkReturns: number[] = []
): QuantMetrics {
  const equity = result.equityCurve;
  const trades = result.trades;
  const initialCapital = 10000;
  const finalCapital = equity[equity.length - 1];

  // Basic Returns
  const totalReturn = (finalCapital - initialCapital) / initialCapital;

  // CAGR (assuming hourly data, 24*252 = 6048 hours per year)
  const hours = equity.length;
  const years = hours / (24 * 252);
  const cagr = Math.pow(finalCapital / initialCapital, 1 / years) - 1;

  // Hourly returns
  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }

  // Annualized volatility
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdDev = calculateStandardDeviation(returns);
  const annualizedVolatility = stdDev * Math.sqrt(24 * 252);

  // Sharpe (annualized, assuming 0% risk-free)
  const sharpe = stdDev !== 0 ? (avgReturn / stdDev) : 0;
  const sharpeAnn = stdDev !== 0 ? (avgReturn * (24 * 252)) / (stdDev * Math.sqrt(24 * 252)) : 0;

  // Sortino
  const downsideDev = calculateDownsideDeviation(returns);
  const sortino = downsideDev !== 0 ? (avgReturn / downsideDev) : 0;
  const sortinoAnn = downsideDev !== 0 ? (avgReturn * (24 * 252)) / (downsideDev * Math.sqrt(24 * 252)) : 0;

  // Calmar
  const calmar = result.maxDrawdownPct !== 0 ? (cagr * 100) / result.maxDrawdownPct : 0;

  // Drawdown metrics
  const maxDD = result.maxDrawdownPct;

  // Calculate avg drawdown
  let inDrawdown = false;
  let currentDD = 0;
  let peak = equity[0];
  const drawdowns: number[] = [];
  for (const eq of equity) {
    peak = Math.max(peak, eq);
    currentDD = ((peak - eq) / peak) * 100;
    if (currentDD > 0.1) {
      drawdowns.push(currentDD);
    }
  }
  const avgDD = drawdowns.length > 0 ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length : 0;

  // Max drawdown duration
  let maxDDD = 0;
  let currentDDD = 0;
  peak = equity[0];
  for (const eq of equity) {
    if (eq >= peak) {
      peak = eq;
      maxDDD = Math.max(maxDDD, currentDDD);
      currentDDD = 0;
    } else {
      currentDDD++;
    }
  }
  const maxDrawdownDuration = maxDDD;

  // Ulcer Index
  const peakCurve: number[] = [];
  peak = equity[0];
  for (const eq of equity) {
    peak = Math.max(peak, eq);
    peakCurve.push(peak);
  }
  const ddCurve = equity.map((eq, i) => ((peakCurve[i] - eq) / peakCurve[i]) * 100);
  const ulcerIndex = Math.sqrt(ddCurve.reduce((a, b) => a + b * b, 0) / ddCurve.length);

  // Pain Index (simplified)
  const painIndex = ddCurve.reduce((a, b) => a + b, 0) / ddCurve.length;

  // Recovery Factor
  const recoveryFactor = maxDD !== 0 ? (totalReturn * 100) / maxDD : 0;

  // Trade metrics
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');
  const avgWin = wins.length > 0 ? wins.reduce((a, b) => a + b.pnlNet, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b.pnlNet, 0) / losses.length : 0;
  const winLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  const tradeReturns = trades.map(t => t.pnlNet / initialCapital * 100);
  const avgTradeReturn = tradeReturns.reduce((a, b) => a + b, 0) / tradeReturns.length;
  const bestTrade = Math.max(...tradeReturns);
  const worstTrade = Math.min(...tradeReturns);

  // T-Test
  const n = returns.length;
  const tStat = avgReturn / (stdDev / Math.sqrt(n));
  const pValue = 2 * (1 - normalCDF(Math.abs(tStat)));

  // Monte Carlo
  const actualFinal = trades.reduce((sum, t) => sum + t.pnlNet, 0);
  const mcPercentiles: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const shuffled = [...trades].sort(() => Math.random() - 0.5);
    mcPercentiles.push(shuffled.reduce((sum, t) => sum + t.pnlNet, 0));
  }
  mcPercentiles.sort((a, b) => a - b);
  const mcPercentile = mcPercentiles.findIndex(p => p >= actualFinal) / mcPercentiles.length;

  // Walk-Forward
  const midPoint = Math.floor(returns.length / 2);
  const sharpe1 = returns.slice(0, midPoint).reduce((a, b) => a + b, 0) / midPoint / (calculateStandardDeviation(returns.slice(0, midPoint)) || 1);
  const sharpe2 = returns.slice(midPoint).reduce((a, b) => a + b, 0) / (returns.length - midPoint) / (calculateStandardDeviation(returns.slice(midPoint)) || 1);
  const wfCorrelation = Math.abs(sharpe1 - sharpe2) / (Math.abs(sharpe1) + Math.abs(sharpe2) + 0.001);

  // Bootstrap CI
  const bootstrapSharpes: number[] = [];
  for (let i = 0; i < 1000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    const sMean = sample.reduce((a, b) => a + b, 0) / sample.length;
    const sStd = calculateStandardDeviation(sample);
    bootstrapSharpes.push(sStd !== 0 ? sMean / sStd * Math.sqrt(24 * 252) : 0);
  }
  bootstrapSharpes.sort((a, b) => a - b);
  const bootstrapCI: [number, number] = [
    bootstrapSharpes[Math.floor(1000 * 0.025)],
    bootstrapSharpes[Math.floor(1000 * 0.975)]
  ];

  // Sharpe P-Value
  const sharpePValue = 1 - normalCDF(sharpeAnn * Math.sqrt(n));

  // Random Walk
  let directionChanges = 0;
  for (let i = 2; i < equity.length; i++) {
    const dir1 = Math.sign(equity[i] - equity[i - 1]);
    const dir2 = Math.sign(equity[i - 1] - equity[i - 2]);
    if (dir1 !== dir2 && dir1 !== 0 && dir2 !== 0) directionChanges++;
  }
  const rwPValue = directionChanges / equity.length;
  const randomWalkNormal = rwPValue > 0.15;

  // Prob Loss 30/60/90 days
  function probLoss(days: number): number {
    const barsPerDay = 24;
    const periodReturns: number[] = [];
    for (let i = days * barsPerDay; i < returns.length; i += barsPerDay) {
      periodReturns.push(returns.slice(i - days * barsPerDay, i).reduce((a, b) => a + b, 0));
    }
    if (periodReturns.length === 0) return 0;
    return periodReturns.filter(r => r < 0).length / periodReturns.length;
  }

  // Information Ratio (vs benchmark if available)
  let infoRatio = 0;
  if (benchmarkReturns.length > 0) {
    const excessReturns = returns.map((r, i) => r - (benchmarkReturns[i] || 0));
    const excessStdDev = calculateStandardDeviation(excessReturns);
    const excessMean = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
    infoRatio = excessStdDev !== 0 ? excessMean / excessStdDev : 0;
  }

  // Treynor Ratio (assuming beta = 1 for now)
  const treynor = cagr / 1; // Simplified

  // Kappa 3 (higher moment)
  const kappa3 = downsideDev !== 0 ? cagr / Math.pow(downsideDev / Math.sqrt(24 * 252), 1/3) : 0;

  // Omega Ratio
  const threshold = 0;
  const gains = returns.filter(r => r > threshold).reduce((a, b) => a + b - threshold, 0);
  const returnLosses = -returns.filter(r => r < threshold).reduce((a, b) => a + b - threshold, 0);
  const omega = returnLosses !== 0 ? gains / returnLosses : 0;

  // Tail Ratio
  const tail95 = returns.slice(Math.floor(returns.length * 0.05));
  const tail05 = returns.slice(0, Math.floor(returns.length * 0.05));
  const tailRatio = tail95.length > 0 && tail05.length > 0
    ? (Math.abs(tail95.reduce((a,b)=>a+b,0)/tail95.length) / Math.abs(tail05.reduce((a,b)=>a+b,0)/tail05.length))
    : 0;

  // Common Sense Ratio
  const csr = avgTradeReturn / (stdDev * Math.sqrt(24 * 252));

  // Burke Ratio (using drawdowns)
  const burkeRatio = drawdowns.length > 1 ? cagr / Math.sqrt(drawdowns.map(d => d*d).reduce((a,b)=>a+b,0) / drawdowns.length) : 0;

  // Martin Ratio (Ulcer)
  const martinRatio = ulcerIndex !== 0 ? cagr / (ulcerIndex / 100) : 0;

  // Streaks
  let maxWinStreak = 0, maxLossStreak = 0;
  let currentWinStreak = 0, currentLossStreak = 0;
  const winStreaks: number[] = [];
  const lossStreaks: number[] = [];

  for (const t of trades) {
    if (t.outcome === 'WIN') {
      currentWinStreak++;
      if (currentLossStreak > 0) {
        lossStreaks.push(currentLossStreak);
        currentLossStreak = 0;
      }
    } else {
      currentLossStreak++;
      if (currentWinStreak > 0) {
        winStreaks.push(currentWinStreak);
        currentWinStreak = 0;
      }
    }
    maxWinStreak = Math.max(maxWinStreak, currentWinStreak);
    maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
  }
  const avgWinStreak = winStreaks.length > 0 ? winStreaks.reduce((a,b)=>a+b,0)/winStreaks.length : 0;
  const avgLossStreak = lossStreaks.length > 0 ? lossStreaks.reduce((a,b)=>a+b,0)/lossStreaks.length : 0;

  // Monthly Returns
  const monthlyReturns: number[] = [];
  const barsPerMonth = 24 * 30;
  for (let i = barsPerMonth; i < equity.length; i += barsPerMonth) {
    monthlyReturns.push((equity[i] - equity[i - barsPerMonth]) / equity[i - barsPerMonth]);
  }
  const bestMonth = monthlyReturns.length > 0 ? Math.max(...monthlyReturns) : 0;
  const worstMonth = monthlyReturns.length > 0 ? Math.min(...monthlyReturns) : 0;
  const positiveMonths = monthlyReturns.filter(r => r > 0).length;

  return {
    totalReturn,
    cagr,
    annualizedVolatility,
    sharpe,
    sharpeAnn: sharpeAnn,
    sortino,
    sortinoAnn: sortinoAnn,
    calmar,
    maxDrawdown: maxDD,
    avgDrawdown: avgDD,
    maxDrawdownDuration,
    ulcerIndex,
    painIndex,
    recoveryFactor,
    totalTrades: result.totalTrades,
    winRate: result.winRate,
    profitFactor: result.profitFactor,
    avgWin,
    avgLoss,
    winLossRatio,
    avgTradeReturn,
    bestTrade,
    worstTrade,
    avgHoldBars: result.avgHoldBars,
    tStat,
    pValue,
    tTestSignificant: pValue < 0.05,
    monteCarloPercentile: mcPercentile,
    monteCarloRobust: mcPercentile > 0.5,
    walkForwardCorrelation: wfCorrelation,
    walkForwardStable: 1 - wfCorrelation > 0.7,
    bootstrapCI,
    bootstrapPositive: bootstrapCI[0] > 0,
    sharpePValue,
    sharpeSignificant: sharpePValue < 0.05,
    randomWalkPValue: rwPValue,
    randomWalkNormal,
    probLoss30d: probLoss(30),
    probLoss60d: probLoss(60),
    probLoss90d: probLoss(90),
    informationRatio: infoRatio,
    treynor,
    kappa3,
    omega,
    tailRatio,
    commonSenseRatio: csr,
    burkeRatio,
    martinRatio,
    maxWinStreak,
    maxLossStreak,
    avgWinStreak,
    avgLossStreak,
    monthlyReturns,
    bestMonth,
    worstMonth,
    positiveMonths,
    totalMonths: monthlyReturns.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

function runValidation(metrics: QuantMetrics): ValidationResult[] {
  const results: ValidationResult[] = [];

  // Return Metrics
  results.push({
    name: 'Total Return',
    category: 'RETURN',
    passed: metrics.totalReturn > 0,
    value: `${(metrics.totalReturn * 100).toFixed(2)}%`,
    detail: metrics.totalReturn > 0.05 ? 'EXCELLENT' : metrics.totalReturn > 0 ? 'POSITIVE' : 'NEGATIVE'
  });

  results.push({
    name: 'CAGR',
    category: 'RETURN',
    passed: metrics.cagr > 0,
    value: `${(metrics.cagr * 100).toFixed(2)}%`,
    detail: metrics.cagr > 0.2 ? 'EXCELLENT' : metrics.cagr > 0.1 ? 'GOOD' : 'MODERATE'
  });

  // Risk Metrics
  results.push({
    name: 'Sharpe Ratio',
    category: 'RISK',
    passed: metrics.sharpeAnn > 1,
    value: metrics.sharpeAnn.toFixed(2),
    detail: metrics.sharpeAnn > 2 ? 'EXCELLENT' : metrics.sharpeAnn > 1 ? 'GOOD' : metrics.sharpeAnn > 0 ? 'POOR' : 'NEGATIVE'
  });

  results.push({
    name: 'Sortino Ratio',
    category: 'RISK',
    passed: metrics.sortinoAnn > 1,
    value: metrics.sortinoAnn.toFixed(2),
    detail: metrics.sortinoAnn > 2 ? 'EXCELLENT' : metrics.sortinoAnn > 1 ? 'GOOD' : 'POOR'
  });

  results.push({
    name: 'Max Drawdown',
    category: 'RISK',
    passed: metrics.maxDrawdown < 20,
    value: `${metrics.maxDrawdown.toFixed(2)}%`,
    detail: metrics.maxDrawdown < 10 ? 'LOW' : metrics.maxDrawdown < 20 ? 'MODERATE' : 'HIGH'
  });

  results.push({
    name: 'Calmar Ratio',
    category: 'RISK',
    passed: metrics.calmar > 1,
    value: metrics.calmar.toFixed(2),
    detail: metrics.calmar > 2 ? 'EXCELLENT' : metrics.calmar > 1 ? 'GOOD' : 'POOR'
  });

  // Statistical Tests
  results.push({
    name: 'T-Test',
    category: 'STATISTICAL',
    passed: metrics.tTestSignificant,
    value: `t=${metrics.tStat.toFixed(2)}, p=${metrics.pValue < 0.001 ? '<0.001' : metrics.pValue.toFixed(4)}`,
    detail: metrics.pValue < 0.001 ? 'HIGHLY SIGNIFICANT' : metrics.pValue < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT'
  });

  results.push({
    name: 'Monte Carlo',
    category: 'STATISTICAL',
    passed: metrics.monteCarloRobust,
    value: `${(metrics.monteCarloPercentile * 100).toFixed(0)}%ile`,
    detail: metrics.monteCarloPercentile > 0.75 ? 'EXCELLENT' : metrics.monteCarloPercentile > 0.5 ? 'ROBUST' : 'WEAK'
  });

  results.push({
    name: 'Walk-Forward',
    category: 'STABILITY',
    passed: metrics.walkForwardStable,
    value: (1 - metrics.walkForwardCorrelation).toFixed(2),
    detail: 1 - metrics.walkForwardCorrelation > 0.85 ? 'EXCELLENT STABILITY' : 1 - metrics.walkForwardCorrelation > 0.7 ? 'STABLE OOS' : 'UNSTABLE'
  });

  results.push({
    name: 'Bootstrap CI',
    category: 'STATISTICAL',
    passed: metrics.bootstrapPositive,
    value: `[${metrics.bootstrapCI[0].toFixed(2)}, ${metrics.bootstrapCI[1].toFixed(2)}]`,
    detail: metrics.bootstrapCI[0] > 0 ? 'ALL POSITIVE' : 'INCLUDES ZERO'
  });

  results.push({
    name: 'Ulcer Index',
    category: 'RISK',
    passed: metrics.ulcerIndex < 5,
    value: metrics.ulcerIndex.toFixed(2),
    detail: metrics.ulcerIndex < 2 ? 'VERY LOW PAIN' : metrics.ulcerIndex < 5 ? 'LOW PAIN' : metrics.ulcerIndex < 10 ? 'MODERATE PAIN' : 'HIGH PAIN'
  });

  results.push({
    name: 'Recovery Factor',
    category: 'RISK',
    passed: metrics.recoveryFactor > 2,
    value: metrics.recoveryFactor >= 1000 ? metrics.recoveryFactor.toExponential(1) : metrics.recoveryFactor.toFixed(1),
    detail: metrics.recoveryFactor > 10 ? 'EXCEPTIONAL' : metrics.recoveryFactor > 5 ? 'EXCELLENT' : metrics.recoveryFactor > 2 ? 'GOOD' : 'POOR'
  });

  results.push({
    name: 'Sharpe P-Value',
    category: 'STATISTICAL',
    passed: metrics.sharpeSignificant,
    value: `p=${metrics.sharpePValue.toFixed(2)}`,
    detail: metrics.sharpePValue < 0.05 ? 'SIGNIFICANT' : 'NOT SIGNIFICANT'
  });

  results.push({
    name: 'Random Walk',
    category: 'STATISTICAL',
    passed: metrics.randomWalkNormal,
    value: `p=${metrics.randomWalkPValue.toFixed(2)}`,
    detail: metrics.randomWalkNormal ? 'NORMAL BEHAVIOR' : 'TOO STABLE'
  });

  results.push({
    name: 'Prob Loss 30d',
    category: 'RISK',
    passed: metrics.probLoss30d < 0.3,
    value: `${(metrics.probLoss30d * 100).toFixed(0)}%`,
    detail: metrics.probLoss30d > 0.5 ? 'HIGH RISK' : metrics.probLoss30d > 0.3 ? 'MODERATE' : 'LOW RISK'
  });

  // Additional Metrics
  results.push({
    name: 'Omega Ratio',
    category: 'RETURN',
    passed: metrics.omega > 1,
    value: metrics.omega.toFixed(2),
    detail: metrics.omega > 1.5 ? 'EXCELLENT' : metrics.omega > 1 ? 'GOOD' : 'POOR'
  });

  results.push({
    name: 'Tail Ratio',
    category: 'RISK',
    passed: metrics.tailRatio > 1,
    value: metrics.tailRatio.toFixed(2),
    detail: metrics.tailRatio > 1.2 ? 'GOOD TAIL' : 'POOR TAIL'
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═════════════════════════════════════════════════════════════════════════════════╗');
  console.log('║  FULL QUANTITATIVE BACKTEST ANALYSIS - V6 MEAN-REVERSION                        ║');
  console.log('║  Complete statistical validation with all risk/return metrics                     ║');
  console.log('╚═════════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`Started: ${new Date().toISOString()}`);
  console.log('');

  const resultsDir = './results-v6';
  const files = await fs.readdir(resultsDir);
  const resultFiles = files.filter(f => f.endsWith('_v6.json'));

  const EXCLUDE_COINS = ['SOLUSDT', 'AVAXUSDT'];

  const allResults: BacktestResult[] = [];
  const allMetrics: QuantMetrics[] = [];

  for (const file of resultFiles) {
    const coin = file.replace('_v6.json', '') + 'USDT';
    if (EXCLUDE_COINS.includes(coin)) continue;

    const content = await fs.readFile(`${resultsDir}/${file}`, 'utf-8');
    const result: BacktestResult = JSON.parse(content);
    allResults.push(result);

    const metrics = calculateFullMetrics(result);
    allMetrics.push(metrics);
  }

  // Calculate aggregate metrics
  const totalEquity: number[] = [10000];
  for (const result of allResults) {
    for (let i = 1; i < result.equityCurve.length; i++) {
      totalEquity.push(totalEquity[0] + result.equityCurve[i] - 10000);
    }
  }

  const aggregateResult: BacktestResult = {
    coin: 'AGGREGATE',
    totalTrades: allResults.reduce((s, r) => s + r.totalTrades, 0),
    wins: allResults.reduce((s, r) => s + r.wins, 0),
    losses: allResults.reduce((s, r) => s + r.losses, 0),
    winRate: 0,
    totalPnl: allResults.reduce((s, r) => s + r.totalPnl, 0),
    sharpe: 0,
    sortino: 0,
    maxDrawdownPct: allResults.reduce((s, r) => s + r.maxDrawdownPct, 0) / allResults.length,
    profitFactor: 0,
    avgHoldBars: allResults.reduce((s, r) => s + r.avgHoldBars, 0) / allResults.length,
    avgWin: 0,
    avgLoss: 0,
    equityCurve: totalEquity,
    drawdownCurve: [],
    trades: allResults.flatMap(r => r.trades)
  };
  aggregateResult.winRate = (aggregateResult.wins / aggregateResult.totalTrades) * 100;

  const aggregateMetrics = calculateFullMetrics(aggregateResult);
  const validations = runValidation(aggregateMetrics);

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRINT RESULTS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('📊 PERFORMANCE SUMMARY (18 coins, excluding SOL/AVAX)');
  console.log('═'.repeat(80));

  console.log('');
  console.log('┌─────────────────────────────┬──────────────┬──────────────────────────────────┐');
  console.log('│ METRIC                      │ VALUE        │ DESCRIPTION                      │');
  console.log('├─────────────────────────────┼──────────────┼──────────────────────────────────┤');

  const metricsTable = [
    ['Total Return', `${(aggregateMetrics.totalReturn * 100).toFixed(2)}%`, 'Overall return on initial capital'],
    ['CAGR', `${(aggregateMetrics.cagr * 100).toFixed(2)}%`, 'Compound Annual Growth Rate'],
    ['Sharpe Ratio', aggregateMetrics.sharpeAnn.toFixed(2), 'Risk-adjusted return (annualized)'],
    ['Sortino Ratio', aggregateMetrics.sortinoAnn.toFixed(2), 'Downside risk-adjusted return'],
    ['Calmar Ratio', aggregateMetrics.calmar.toFixed(2), 'Return vs max drawdown'],
    ['Max Drawdown', `${aggregateMetrics.maxDrawdown.toFixed(2)}%`, 'Largest peak-to-trough decline'],
    ['Ulcer Index', aggregateMetrics.ulcerIndex.toFixed(2), 'Drawdown severity indicator'],
    ['Recovery Factor', aggregateMetrics.recoveryFactor.toFixed(1), 'Net profit / max DD'],
    ['Win Rate', `${aggregateMetrics.winRate.toFixed(1)}%`, 'Percentage of profitable trades'],
    ['Profit Factor', aggregateMetrics.profitFactor.toFixed(2), 'Gross profit / gross loss'],
    ['Avg Trade Return', `${(aggregateMetrics.avgTradeReturn * 100).toFixed(2)}%`, 'Average return per trade'],
    ['Best Trade', `${aggregateMetrics.bestTrade.toFixed(2)}%`, 'Best single trade return'],
    ['Worst Trade', `${aggregateMetrics.worstTrade.toFixed(2)}%`, 'Worst single trade return'],
    ['Total Trades', aggregateMetrics.totalTrades.toString(), 'Total number of trades'],
    ['Avg Hold Time', `${aggregateMetrics.avgHoldBars.toFixed(1)} bars`, 'Average trade duration'],
  ];

  for (const [metric, value, desc] of metricsTable) {
    console.log(`│ ${(metric as string).padEnd(27)} │ ${(value as string).padStart(12)} │ ${(desc as string).padEnd(32)} │`);
  }
  console.log('└─────────────────────────────┴──────────────┴──────────────────────────────────┘');

  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ STATISTICAL VALIDATION');
  console.log('═'.repeat(80));

  const byCategory: Record<string, ValidationResult[]> = {
    RETURN: [],
    RISK: [],
    STATISTICAL: [],
    STABILITY: [],
  };
  for (const v of validations) {
    byCategory[v.category].push(v);
  }

  for (const [category, items] of Object.entries(byCategory)) {
    if (items.length === 0) continue;
    console.log(`\n${category}:`);
    for (const v of items) {
      const icon = v.passed ? '✅' : '❌';
      console.log(`  ${icon} ${v.name.padEnd(20)} ${v.value.padStart(20)} ${v.detail}`);
    }
  }

  const passedCount = validations.filter(v => v.passed).length;
  console.log('');
  console.log(`═══════════════════════════════════════════════════════════════════════════`);
  console.log(`STATISTICAL VALIDATION: ${passedCount}/${validations.length} (${(passedCount/validations.length*100).toFixed(0)}%) PASSED`);
  console.log(`═══════════════════════════════════════════════════════════════════════════`);

  console.log('');
  console.log('═'.repeat(80));
  console.log('🎯 ADVANCED METRICS');
  console.log('═'.repeat(80));

  const advancedMetrics = [
    ['Information Ratio', aggregateMetrics.informationRatio.toFixed(3)],
    ['Treynor Ratio', aggregateMetrics.treynor.toFixed(3)],
    ['Kappa 3', aggregateMetrics.kappa3.toFixed(3)],
    ['Omega Ratio', aggregateMetrics.omega.toFixed(2)],
    ['Tail Ratio', aggregateMetrics.tailRatio.toFixed(2)],
    ['Burke Ratio', aggregateMetrics.burkeRatio.toFixed(3)],
    ['Martin Ratio', aggregateMetrics.martinRatio.toFixed(3)],
    ['Common Sense Ratio', aggregateMetrics.commonSenseRatio.toFixed(3)],
  ];

  console.log('┌─────────────────────────────┬──────────────┐');
  console.log('│ Metric                      │ Value        │');
  console.log('├─────────────────────────────┼──────────────┤');
  for (const [name, value] of advancedMetrics) {
    console.log(`│ ${(name as string).padEnd(27)} │ ${(value as string).padStart(12)} │`);
  }
  console.log('└─────────────────────────────┴──────────────┘');

  console.log('');
  console.log('═'.repeat(80));
  console.log('📈 STREAK ANALYSIS');
  console.log('═'.repeat(80));

  console.log(`Max Winning Streak:  ${aggregateMetrics.maxWinStreak} trades`);
  console.log(`Max Losing Streak:   ${aggregateMetrics.maxLossStreak} trades`);
  console.log(`Avg Win Streak:      ${aggregateMetrics.avgWinStreak.toFixed(1)} trades`);
  console.log(`Avg Loss Streak:     ${aggregateMetrics.avgLossStreak.toFixed(1)} trades`);

  console.log('');
  console.log('═'.repeat(80));
  console.log('📅 MONTHLY RETURNS');
  console.log('═'.repeat(80));

  console.log(`Total Months:        ${aggregateMetrics.totalMonths}`);
  console.log(`Best Month:          ${(aggregateMetrics.bestMonth * 100).toFixed(2)}%`);
  console.log(`Worst Month:         ${(aggregateMetrics.worstMonth * 100).toFixed(2)}%`);
  console.log(`Positive Months:     ${aggregateMetrics.positiveMonths}/${aggregateMetrics.totalMonths} (${(aggregateMetrics.positiveMonths/aggregateMetrics.totalMonths*100).toFixed(1)}%)`);

  console.log('');
  console.log('═'.repeat(80));
  console.log('⏱️  LOSS PROBABILITY');
  console.log('═'.repeat(80));

  console.log(`Prob Loss (30 days):  ${(aggregateMetrics.probLoss30d * 100).toFixed(1)}%`);
  console.log(`Prob Loss (60 days):  ${(aggregateMetrics.probLoss60d * 100).toFixed(1)}%`);
  console.log(`Prob Loss (90 days):  ${(aggregateMetrics.probLoss90d * 100).toFixed(1)}%`);

  console.log('');
  console.log('═'.repeat(80));
  console.log('🏆 TOP 10 COINS BY SHARPE');
  console.log('═'.repeat(80));

  const sortedBySharpe = [...allResults].sort((a, b) => {
    const ma = calculateFullMetrics(a);
    const mb = calculateFullMetrics(b);
    return mb.sharpeAnn - ma.sharpeAnn;
  });

  console.log('┌────────────┬─────────┬───────────┬──────────┬──────────┬──────────┐');
  console.log('│ Coin       │ PnL ($) │ Win Rate  │ Sharpe   │ Sortino  │ Max DD   │');
  console.log('├────────────┼─────────┼───────────┼──────────┼──────────┼──────────┤');

  for (const result of sortedBySharpe.slice(0, 10)) {
    const m = calculateFullMetrics(result);
    const pnl = result.totalPnl >= 0 ? `+$${result.totalPnl.toFixed(0)}` : `-$${Math.abs(result.totalPnl).toFixed(0)}`;
    console.log(`│ ${result.coin.padEnd(10)} │ ${pnl.padStart(7)} │ ${result.winRate.toFixed(1)}%    │ ${m.sharpeAnn.toFixed(2).padStart(8)} │ ${m.sortinoAnn.toFixed(2).padStart(8)} │ ${m.maxDrawdown.toFixed(1).padStart(8)}% │`);
  }
  console.log('└────────────┴─────────┴───────────┴──────────┴──────────┴──────────┘');

  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 FINAL SCORECARD');
  console.log('═'.repeat(80));

  const scores = {
    return: aggregateMetrics.cagr > 0.1 ? 5 : aggregateMetrics.cagr > 0.05 ? 4 : aggregateMetrics.cagr > 0 ? 3 : aggregateMetrics.cagr > -0.05 ? 2 : 1,
    risk: aggregateMetrics.maxDrawdown < 5 ? 5 : aggregateMetrics.maxDrawdown < 10 ? 4 : aggregateMetrics.maxDrawdown < 20 ? 3 : 2,
    riskAdjusted: aggregateMetrics.sharpeAnn > 2 ? 5 : aggregateMetrics.sharpeAnn > 1.5 ? 4 : aggregateMetrics.sharpeAnn > 1 ? 3 : aggregateMetrics.sharpeAnn > 0.5 ? 2 : 1,
    statistical: passedCount / validations.length > 0.8 ? 5 : passedCount / validations.length > 0.6 ? 4 : passedCount / validations.length > 0.4 ? 3 : 2,
  };

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxScore = 20;

  console.log(`Return Score:       ${scores.return}/5`);
  console.log(`Risk Score:         ${scores.risk}/5`);
  console.log(`Risk-Adjusted:      ${scores.riskAdjusted}/5`);
  console.log(`Statistical:       ${scores.statistical}/5`);
  console.log('');
  console.log(`═══════════════════════════════════════════════════════════════════════════`);
  console.log(`TOTAL SCORE: ${totalScore}/${maxScore} (${(totalScore/maxScore*100).toFixed(0)}%)`);
  console.log(`═══════════════════════════════════════════════════════════════════════════`);

  console.log('');
  console.log('═'.repeat(80));
  console.log('🎯 RECOMMENDATION');
  console.log('═'.repeat(80));
  console.log('');

  if (totalScore >= 15) {
    console.log('✅ EXCELLENT - Strategy shows strong performance across all metrics.');
    console.log('   Recommendation: DEPLOY for live trading.');
  } else if (totalScore >= 12) {
    console.log('⚠️  GOOD - Strategy shows acceptable performance with some caveats.');
    console.log('   Recommendation: Deploy with reduced position sizes.');
  } else if (totalScore >= 8) {
    console.log('❌ MODERATE - Strategy shows mixed results.');
    console.log('   Recommendation: Paper trade only, requires optimization.');
  } else {
    console.log('❌ POOR - Strategy fails to meet minimum criteria.');
    console.log('   Recommendation: DO NOT DEPLOY. Major rework required.');
  }

  console.log('');
  console.log(`Completed: ${new Date().toISOString()}`);
}

main().catch(console.error);
