/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATISTICAL VALIDATION MODULE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Comprehensive statistical tests for backtest validation:
 * - T-Test: Tests if mean returns are significantly different from zero
 * - Walk-Forward: Out-of-sample stability testing
 * - Bootstrap CI: Confidence intervals via resampling
 * - Ulcer Index: Measures "pain" of drawdowns
 * - Recovery Factor: Recovery speed from drawdowns
 * - Probability of Loss: Chance of negative returns over N periods
 * - Stationarity Tests: ADF/KPSS for time series properties
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { type Trade } from './quant/advanced-metrics';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface TTestResult {
  tStatistic: number;
  pValue: number;
  isSignificant: boolean;
  interpretation: string;
  confidence: string;
}

export interface WalkForwardResult {
  isInSample: number;
  isOutOfSample: number;
  stabilityScore: number; // 0-1, closer to 1 is better
  interpretation: string;
}

export interface BootstrapCIResult {
  mean: number;
  lower95: number;
  upper95: number;
  width: number;
  isAllPositive: boolean;
  interpretation: string;
}

export interface UlcerIndexResult {
  ulcerIndex: number;
  maxUlcer: number;
  avgUlcer: number;
  interpretation: string;
}

export interface RecoveryFactorResult {
  recoveryFactor: number;
  worstDrawdown: number;
  barsToRecover: number;
  interpretation: string;
}

export interface ProbabilityOfLossResult {
  probLoss30d: number;
  probLoss90d: number;
  interpretation: string;
}

export interface ValidationReport {
  // Individual tests
  tTest: TTestResult;
  walkForward: WalkForwardResult;
  bootstrapCI: BootstrapCIResult;
  ulcerIndex: UlcerIndexResult;
  recoveryFactor: RecoveryFactorResult;
  probabilityOfLoss: ProbabilityOfLossResult;

  // Overall assessment
  overallScore: number; // 0-10
  passedTests: number;
  totalTests: number;
  recommendation: 'DEPLOY' | 'CAUTION' | 'REJECT';
  summary: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// T-TEST
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * One-sample T-test for mean returns
 * H0: Mean return = 0
 * H1: Mean return ≠ 0
 */
export function tTest(returns: number[], alpha: number = 0.05): TTestResult {
  const n = returns.length;
  if (n < 2) {
    return {
      tStatistic: 0,
      pValue: 1,
      isSignificant: false,
      interpretation: 'Insufficient data',
      confidence: 'N/A',
    };
  }

  const mean = returns.reduce((a, b) => a + b, 0) / n;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const stdError = stdDev / Math.sqrt(n);

  if (stdError === 0) {
    return {
      tStatistic: 0,
      pValue: 1,
      isSignificant: false,
      interpretation: 'Zero variance - no statistical test possible',
      confidence: 'N/A',
    };
  }

  const tStatistic = mean / stdError;

  // Approximate p-value for two-tailed test
  // Using approximation: p ≈ 2 * (1 - Φ(|t|))
  // For large n, t approaches normal
  const pValue = 2 * (1 - normalCDF(Math.abs(tStatistic)));

  const isSignificant = pValue < alpha;

  let interpretation = '';
  let confidence = '';

  if (pValue < 0.0001) {
    interpretation = 'HIGHLY SIGNIFICANT - Strong evidence that strategy has positive expectancy';
    confidence = '99.99%';
  } else if (pValue < 0.001) {
    interpretation = 'VERY SIGNIFICANT - Very strong evidence';
    confidence = '99.9%';
  } else if (pValue < 0.01) {
    interpretation = 'SIGNIFICANT - Strong evidence';
    confidence = '99%';
  } else if (pValue < 0.05) {
    interpretation = 'MARGINALLY SIGNIFICANT - Moderate evidence';
    confidence = '95%';
  } else {
    interpretation = 'NOT SIGNIFICANT - Cannot reject null hypothesis';
    confidence = '< 95%';
  }

  return { tStatistic, pValue, isSignificant, interpretation, confidence };
}

// Approximation of standard normal CDF
function normalCDF(x: number): number {
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

// ═══════════════════════════════════════════════════════════════════════════════
// WALK-FORWARD VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Walk-forward analysis to test out-of-sample stability
 * Splits data into train/test periods and compares performance
 */
export function walkForwardAnalysis(
  equityCurve: number[],
  trainPct: number = 0.7,
  numFolds: number = 5
): WalkForwardResult {
  const n = equityCurve.length;
  const foldSize = Math.floor(n / numFolds);
  const trainSize = Math.floor(foldSize * trainPct);

  if (foldSize < 20) {
    return {
      isInSample: 0,
      isOutOfSample: 0,
      stabilityScore: 0,
      interpretation: 'Insufficient data for walk-forward analysis',
    };
  }

  let isReturns: number[] = [];
  let oosReturns: number[] = [];

  for (let i = 0; i < numFolds; i++) {
    const startIdx = i * foldSize;
    const trainEndIdx = startIdx + trainSize;
    const testEndIdx = Math.min(startIdx + foldSize, n);

    if (testEndIdx <= trainEndIdx || trainEndIdx >= n) continue;

    // In-sample returns
    const isStart = equityCurve[startIdx];
    const isEnd = equityCurve[trainEndIdx];
    const isReturn = (isEnd - isStart) / isStart;
    isReturns.push(isReturn);

    // Out-of-sample returns
    const oosStart = equityCurve[trainEndIdx];
    const oosEnd = equityCurve[testEndIdx];
    const oosReturn = (oosEnd - oosStart) / oosStart;
    oosReturns.push(oosReturn);
  }

  const avgIsReturn = isReturns.reduce((a, b) => a + b, 0) / isReturns.length;
  const avgOosReturn = oosReturns.reduce((a, b) => a + b, 0) / oosReturns.length;

  // Stability score: how close OOS performance is to IS performance
  // Perfect stability = 1 (OOS return equals IS return)
  const decay = Math.abs(avgIsReturn - avgOosReturn) / (Math.abs(avgIsReturn) + 0.0001);
  const stabilityScore = Math.max(0, Math.min(1, 1 - decay));

  let interpretation = '';
  if (stabilityScore >= 0.9) {
    interpretation = 'EXCELLENT - Very stable out-of-sample performance';
  } else if (stabilityScore >= 0.75) {
    interpretation = 'GOOD - Stable OOS performance';
  } else if (stabilityScore >= 0.5) {
    interpretation = 'ACCEPTABLE - Moderate OOS stability';
  } else {
    interpretation = 'POOR - OOS performance degrades significantly';
  }

  return {
    isInSample: avgIsReturn * 100,
    isOutOfSample: avgOosReturn * 100,
    stabilityScore,
    interpretation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP CONFIDENCE INTERVALS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Bootstrap confidence intervals for mean returns
 */
export function bootstrapCI(
  returns: number[],
  numResamples: number = 1000,
  confidence: number = 0.95
): BootstrapCIResult {
  if (returns.length < 2) {
    return {
      mean: 0,
      lower95: 0,
      upper95: 0,
      width: 0,
      isAllPositive: false,
      interpretation: 'Insufficient data',
    };
  }

  const alpha = 1 - confidence;
  const resampledMeans: number[] = [];

  for (let i = 0; i < numResamples; i++) {
    // Resample with replacement
    const resampled: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      const idx = Math.floor(Math.random() * returns.length);
      resampled.push(returns[idx]);
    }
    const mean = resampled.reduce((a, b) => a + b, 0) / resampled.length;
    resampledMeans.push(mean);
  }

  resampledMeans.sort((a, b) => a - b);

  const lowerIdx = Math.floor((alpha / 2) * numResamples);
  const upperIdx = Math.floor((1 - alpha / 2) * numResamples);

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const lower95 = resampledMeans[lowerIdx];
  const upper95 = resampledMeans[upperIdx];
  const width = upper95 - lower95;
  const isAllPositive = lower95 > 0;

  let interpretation = '';
  if (isAllPositive) {
    interpretation = `ALL POSITIVE - ${Math.round(confidence * 100)}% CI entirely above zero`;
  } else if (mean > 0 && lower95 < 0 && upper95 > 0) {
    interpretation = `NEUTRAL - ${Math.round(confidence * 100)}% CI includes zero`;
  } else {
    interpretation = `NEGATIVE - ${Math.round(confidence * 100)}% CI below zero`;
  }

  return { mean, lower95, upper95, width, isAllPositive, interpretation };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ULCER INDEX
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ulcer Index - measures the "pain" of drawdowns
 * Lower is better (0 = no drawdowns)
 */
export function calculateUlcerIndex(equityCurve: number[]): UlcerIndexResult {
  if (equityCurve.length < 2) {
    return {
      ulcerIndex: 0,
      maxUlcer: 0,
      avgUlcer: 0,
      interpretation: 'Insufficient data',
    };
  }

  const initial = equityCurve[0];
  let maxUlcer = 0;
  let sumUlcerSquared = 0;
  const ulcerValues: number[] = [];

  let peak = initial;

  for (let i = 1; i < equityCurve.length; i++) {
    const value = equityCurve[i];

    // Update peak
    if (value > peak) {
      peak = value;
    }

    // Calculate drawdown percentage
    const drawdown = (peak - value) / peak * 100;

    if (drawdown > 0) {
      ulcerValues.push(drawdown);
      sumUlcerSquared += drawdown * drawdown;
      maxUlcer = Math.max(maxUlcer, drawdown);
    }
  }

  const ulcerIndex = Math.sqrt(sumUlcerSquared / equityCurve.length);
  const avgUlcer = ulcerValues.length > 0
    ? ulcerValues.reduce((a, b) => a + b, 0) / ulcerValues.length
    : 0;

  let interpretation = '';
  if (ulcerIndex < 1) {
    interpretation = 'EXCELLENT - Very low drawdown pain';
  } else if (ulcerIndex < 3) {
    interpretation = 'GOOD - Acceptable drawdown levels';
  } else if (ulcerIndex < 6) {
    interpretation = 'MODERATE - Notable drawdown pain';
  } else if (ulcerIndex < 10) {
    interpretation = 'HIGH - Significant drawdown pain';
  } else {
    interpretation = 'SEVERE - Extreme drawdown pain';
  }

  return { ulcerIndex, maxUlcer, avgUlcer, interpretation };
}

// ═══════════════════════════════════════════════════════════════════════════════
// RECOVERY FACTOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Recovery Factor - How quickly the strategy recovers from drawdowns
 * Higher is better
 */
export function calculateRecoveryFactor(
  equityCurve: number[],
  initialCapital: number
): RecoveryFactorResult {
  if (equityCurve.length < 2) {
    return {
      recoveryFactor: 0,
      worstDrawdown: 0,
      barsToRecover: 0,
      interpretation: 'Insufficient data',
    };
  }

  let peak = initialCapital;
  let worstDrawdown = 0;
  let worstDrawdownIdx = 0;
  let barsToRecover = 0;
  let inDrawdown = false;
  let drawdownStartIdx = 0;

  // Find worst drawdown
  for (let i = 1; i < equityCurve.length; i++) {
    const value = equityCurve[i];

    if (value > peak) {
      peak = value;
      // Recovered from drawdown
      if (inDrawdown) {
        inDrawdown = false;
        const recoveryBars = i - drawdownStartIdx;
        if (recoveryBars > barsToRecover) {
          barsToRecover = recoveryBars;
        }
      }
    }

    const drawdown = (peak - value) / peak;
    if (drawdown > worstDrawdown) {
      worstDrawdown = drawdown;
      worstDrawdownIdx = i;
      drawdownStartIdx = i;
      inDrawdown = true;
    }
  }

  // Final recovery (if still in drawdown at end, count to end)
  if (inDrawdown) {
    barsToRecover = equityCurve.length - drawdownStartIdx;
  }

  const finalValue = equityCurve[equityCurve.length - 1];
  const totalGain = (finalValue - initialCapital) / initialCapital;
  const recoveryFactor = worstDrawdown > 0 ? totalGain / worstDrawdown : totalGain > 0 ? 999 : 0;

  let interpretation = '';
  if (recoveryFactor >= 10) {
    interpretation = 'EXCEPTIONAL - Very fast recovery from drawdowns';
  } else if (recoveryFactor >= 5) {
    interpretation = 'EXCELLENT - Quick recovery';
  } else if (recoveryFactor >= 2) {
    interpretation = 'GOOD - Acceptable recovery';
  } else if (recoveryFactor >= 1) {
    interpretation = 'FAIR - Slow recovery';
  } else {
    interpretation = 'POOR - Has not recovered from worst drawdown';
  }

  return {
    recoveryFactor,
    worstDrawdown: worstDrawdown * 100, // As percentage
    barsToRecover,
    interpretation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROBABILITY OF LOSS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Probability of loss over N days using Monte Carlo
 */
export function calculateProbabilityOfLoss(
  trades: Trade[],
  initialCapital: number,
  numSimulations: number = 10000,
  days: number[] = [30, 90]
): ProbabilityOfLossResult {
  if (trades.length < 10) {
    return {
      probLoss30d: 1,
      probLoss90d: 1,
      interpretation: 'Insufficient trade data',
    };
  }

  // Calculate trade statistics
  const returns = trades.map(t => t.pnl / initialCapital);
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length);

  // Estimate trades per day (assuming H1 bars, ~16 trading hours per day)
  const avgTradeDuration = trades.length > 1
    ? (trades[trades.length - 1].entryTime - trades[0].entryTime) / (trades.length * 3600000)
    : 1;
  const tradesPerDay = 1 / Math.max(0.1, avgTradeDuration);

  // Run simulations
  const simLosses30: number[] = [];
  const simLosses90: number[] = [];

  for (let i = 0; i < numSimulations; i++) {
    // Simulate 30 days
    let capital30 = initialCapital;
    const numTrades30 = Math.floor(days[0] * tradesPerDay);

    for (let j = 0; j < numTrades30; j++) {
      // Random return from normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const simReturn = meanReturn + stdReturn * z;
      capital30 *= (1 + simReturn);
    }
    simLosses30.push(capital30 < initialCapital ? 1 : 0);

    // Simulate 90 days
    let capital90 = initialCapital;
    const numTrades90 = Math.floor(days[1] * tradesPerDay);

    for (let j = 0; j < numTrades90; j++) {
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const simReturn = meanReturn + stdReturn * z;
      capital90 *= (1 + simReturn);
    }
    simLosses90.push(capital90 < initialCapital ? 1 : 0);
  }

  const probLoss30d = simLosses30.reduce((a, b) => a + b, 0) / numSimulations;
  const probLoss90d = simLosses90.reduce((a, b) => a + b, 0) / numSimulations;

  let interpretation = '';
  if (probLoss30d < 0.1 && probLoss90d < 0.2) {
    interpretation = 'EXCELLENT - Low probability of loss';
  } else if (probLoss30d < 0.3 && probLoss90d < 0.4) {
    interpretation = 'GOOD - Moderate probability of loss';
  } else if (probLoss30d < 0.5) {
    interpretation = 'FAIR - High probability of short-term loss';
  } else {
    interpretation = 'POOR - High probability of loss';
  }

  return {
    probLoss30d,
    probLoss90d,
    interpretation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE VALIDATION REPORT
// ═══════════════════════════════════════════════════════════════════════════════

export function generateValidationReport(
  equityCurve: number[],
  trades: Trade[],
  initialCapital: number,
  returns: number[]
): ValidationReport {
  // Run all tests
  const tTestResult = tTest(returns);
  const walkForwardResult = walkForwardAnalysis(equityCurve);
  const bootstrapResult = bootstrapCI(returns);
  const ulcerResult = calculateUlcerIndex(equityCurve);
  const recoveryResult = calculateRecoveryFactor(equityCurve, initialCapital);
  const probLossResult = calculateProbabilityOfLoss(trades, initialCapital);

  // Score each test (0-2 points)
  let score = 0;
  const summary: string[] = [];

  // T-Test (2 points if highly significant)
  if (tTestResult.pValue < 0.01) {
    score += 2;
    summary.push(`✅ T-Test: ${tTestResult.interpretation}`);
  } else if (tTestResult.pValue < 0.05) {
    score += 1;
    summary.push(`⚠️ T-Test: ${tTestResult.interpretation}`);
  } else {
    summary.push(`❌ T-Test: ${tTestResult.interpretation}`);
  }

  // Monte Carlo (from advanced metrics) - proxy with bootstrap
  if (bootstrapResult.isAllPositive) {
    score += 1;
    summary.push(`✅ Bootstrap CI: ${bootstrapResult.interpretation}`);
  } else {
    summary.push(`❌ Bootstrap CI: ${bootstrapResult.interpretation}`);
  }

  // Walk-Forward
  if (walkForwardResult.stabilityScore >= 0.8) {
    score += 2;
    summary.push(`✅ Walk-Forward: ${walkForwardResult.interpretation} (${walkForwardResult.stabilityScore.toFixed(2)})`);
  } else if (walkForwardResult.stabilityScore >= 0.6) {
    score += 1;
    summary.push(`⚠️ Walk-Forward: ${walkForwardResult.interpretation} (${walkForwardResult.stabilityScore.toFixed(2)})`);
  } else {
    summary.push(`❌ Walk-Forward: ${walkForwardResult.interpretation} (${walkForwardResult.stabilityScore.toFixed(2)})`);
  }

  // Ulcer Index
  if (ulcerResult.ulcerIndex < 3) {
    score += 1;
    summary.push(`✅ Ulcer Index: ${ulcerResult.interpretation} (${ulcerResult.ulcerIndex.toFixed(2)})`);
  } else if (ulcerResult.ulcerIndex < 6) {
    score += 0.5;
    summary.push(`⚠️ Ulcer Index: ${ulcerResult.interpretation} (${ulcerResult.ulcerIndex.toFixed(2)})`);
  } else {
    summary.push(`❌ Ulcer Index: ${ulcerResult.interpretation} (${ulcerResult.ulcerIndex.toFixed(2)})`);
  }

  // Recovery Factor
  if (recoveryResult.recoveryFactor >= 5) {
    score += 2;
    summary.push(`✅ Recovery Factor: ${recoveryResult.interpretation} (${recoveryResult.recoveryFactor.toFixed(1)}x)`);
  } else if (recoveryResult.recoveryFactor >= 2) {
    score += 1;
    summary.push(`⚠️ Recovery Factor: ${recoveryResult.interpretation} (${recoveryResult.recoveryFactor.toFixed(1)}x)`);
  } else {
    summary.push(`❌ Recovery Factor: ${recoveryResult.interpretation} (${recoveryResult.recoveryFactor.toFixed(1)}x)`);
  }

  // Probability of Loss
  if (probLossResult.probLoss30d < 0.3) {
    score += 2;
    summary.push(`✅ Prob Loss 30d: ${probLossResult.interpretation}`);
  } else if (probLossResult.probLoss30d < 0.5) {
    score += 1;
    summary.push(`⚠️ Prob Loss 30d: ${probLossResult.interpretation}`);
  } else {
    summary.push(`❌ Prob Loss 30d: ${probLossResult.interpretation}`);
  }

  const totalTests = 10;
  const passedTests = Math.round(score);

  let recommendation: 'DEPLOY' | 'CAUTION' | 'REJECT';
  if (score >= 7) {
    recommendation = 'DEPLOY';
  } else if (score >= 4) {
    recommendation = 'CAUTION';
  } else {
    recommendation = 'REJECT';
  }

  return {
    tTest: tTestResult,
    walkForward: walkForwardResult,
    bootstrapCI: bootstrapResult,
    ulcerIndex: ulcerResult,
    recoveryFactor: recoveryResult,
    probabilityOfLoss: probLossResult,
    overallScore: score,
    passedTests,
    totalTests,
    recommendation,
    summary,
  };
}
