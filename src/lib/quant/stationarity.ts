/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * STATIONARITY TESTS MODULE — V4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Tests de stationnarité pour séries temporelles financières avant application
 * d'indicateurs techniques. Un momentum calculé sur une série I(1) non-différenciée
 * est biaisé statistiquement.
 *
 * MODULES:
 *  - ADF Test: Augmented Dickey-Fuller (H0: racine unitaire → non-stationnaire)
 *  - KPSS Test: Kwiatkowski-Phillips-Schmidt-Shin (H0: stationnaire)
 *  - Fractional Differentiation: López de Prado — différenciation minimale
 *  - Optimal D Finder: Trouve le d optimal pour stationnarité + mémoire
 *
 * REFERENCES:
 *  - Dickey, D.A. & Fuller, W.A. (1979). "Distribution of the Estimators for
 *    Autoregressive Time Series with a Unit Root." JASA 74(366).
 *  - Kwiatkowski, D., Phillips, P.C.B., Schmidt, P., & Shin, Y. (1992). "Testing
 *    the Null Hypothesis of Stationarity against the Alternative of a Unit Root."
 *    J. Econometrics 54(1-3).
 *  - López de Prado, M. (2018). "Advances in Financial Machine Learning."
 *    Wiley. Chapter 5: Fractional Differentiation.
 *
 * INPUT/OUTPUT:
 *  Input:  number[] (série de prix ou returns)
 *  Output: { statistic, pValue, isStationary, criticalValues/... }
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[], sample = true): number {
  if (arr.length <= 1) return 0;
  const m = mean(arr);
  const variance = arr.reduce((a, v) => a + (v - m) ** 2, 0) / (arr.length - (sample ? 1 : 0));
  return Math.sqrt(variance);
}

function diff(arr: number[]): number[] {
  const result: number[] = [];
  for (let i = 1; i < arr.length; i++) {
    result.push(arr[i] - arr[i - 1]);
  }
  return result;
}

function log(arr: number[]): number[] {
  return arr.map(v => Math.log(v));
}

function cumsum(arr: number[]): number[] {
  const result: number[] = [0];
  let sum = 0;
  for (const v of arr) {
    sum += v;
    result.push(sum);
  }
  return result.slice(1);
}

// Lagged values helper
function lag(arr: number[], periods: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    result.push(i >= periods ? arr[i - periods] : NaN);
  }
  return result;
}

// Linear regression: y = a + bx
function linearRegression(y: number[], x: number[]): { a: number; b: number; residuals: number[]; r2: number } {
  const n = y.length;
  if (n !== x.length || n < 2) {
    return { a: 0, b: 0, residuals: [], r2: 0 };
  }

  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, v, i) => a + v * y[i], 0);
  const sumX2 = x.reduce((a, v) => a + v * v, 0);
  const sumY2 = y.reduce((a, v) => a + v * v, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return { a: 0, b: 0, residuals: y.map(() => 0), r2: 0 };
  }

  const b = (n * sumXY - sumX * sumY) / denominator;
  const a = (sumY - b * sumX) / n;

  const fitted = x.map(xi => a + b * xi);
  const residuals = y.map((yi, i) => yi - fitted[i]);

  // R² calculation
  const ssRes = residuals.reduce((a, v) => a + v * v, 0);
  const meanY = sumY / n;
  const ssTot = y.reduce((a, v) => a + (v - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { a, b, residuals, r2 };
}

// Critical values for ADF test (from MacKinnon, 2010)
// These are approximate values for different sample sizes
function getADFCriticalValues(n: number): { '1%': number; '5%': number; '10%': number } {
  // Interpolate based on sample size (simplified)
  if (n < 25) return { '1%': -4.38, '5%': -3.60, '10%': -3.24 };
  if (n < 50) return { '1%': -4.15, '5%': -3.50, '10%': -3.18 };
  if (n < 100) return { '1%': -4.00, '5%': -3.43, '10%': -3.13 };
  if (n < 250) return { '1%': -3.99, '5%': -3.43, '10%': -3.13 };
  if (n < 500) return { '1%': -3.98, '5%': -3.42, '10%': -3.13 };
  return { '1%': -3.96, '5%': -3.41, '10%': -3.12 };
}

// Critical values for KPSS test (from Kwiatkowski et al., 1992)
function getKPSSCriticalValues(n: number): { '1%': number; '5%': number; '10%': number } {
  // KPSS critical values are relatively stable across sample sizes
  // for the "level" version (no trend)
  return { '1%': 0.739, '5%': 0.463, '10%': 0.347 };
}

// ─────────────────────────────────────────────────────────────────────────────
// ADF TEST (Augmented Dickey-Fuller)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * H0: La série a une racine unitaire (non-stationnaire)
 * H1: La série n'a pas de racine unitaire (stationnaire)
 *
 * Si p-value < 0.05 → on rejette H0 → la série est stationnaire
 *
 * @param series - Série temporelle (prix ou returns)
 * @param maxLags - Nombre maximum de lags pour les termes de différence retardée
 * @returns Résultat du test ADF
 */
export interface ADFResult {
  statistic: number;           // Statistique de test ADF (plus négatif = plus stationnaire)
  pValue: number;              // p-value approximative
  isStationary: boolean;       // true si p-value < 0.05
  criticalValues: { '1%': number; '5%': number; '10%': number };
  usedLags: number;            // Nombre de lags utilisés
}

export function adfTest(series: number[], maxLags: number = 1): ADFResult {
  if (series.length < 10) {
    return {
      statistic: 0,
      pValue: 1,
      isStationary: false,
      criticalValues: { '1%': 0, '5%': 0, '10%': 0 },
      usedLags: 0,
    };
  }

  // Work with log differences if series looks like prices (high variance)
  const variance = std(series, false);
  const useLog = variance > 0.1 * Math.abs(mean(series));
  const workingSeries = useLog ? log(series) : [...series];

  // First difference
  const deltaY = diff(workingSeries);
  const lagY = workingSeries.slice(0, -1);
  const n = deltaY.length;

  // Determine optimal number of lags (Schwarz criterion simplified)
  const nLags = Math.min(maxLags, Math.max(1, Math.floor(Math.log(n) / Math.log(2))));

  // Build regression matrix: Δy_t = α + β*t + γ*y_{t-1} + Σδ_i*Δy_{t-i} + ε_t
  // Simplified version (no trend term for generality)
  const y: number[] = [];
  const xLagged: number[] = [];

  for (let i = nLags; i < n; i++) {
    y.push(deltaY[i]);
    xLagged.push(workingSeries[i]);
  }

  // Add lagged differences if nLags > 0
  const xMatrix: number[][] = xLagged.map((x, i) => [1, x]);

  if (nLags > 0) {
    for (let lag = 1; lag <= nLags; lag++) {
      for (let i = nLags; i < n; i++) {
        const idx = i - lag;
        xMatrix[i - nLags].push(idx >= 0 ? deltaY[idx] : 0);
      }
    }
  }

  // OLS regression (simplified - first pass without lagged diffs)
  // For simplicity, using basic regression on lagged level
  const regResult = linearRegression(y, xLagged);

  // ADF statistic is the t-statistic on the coefficient of y_{t-1}
  // We need the standard error of the coefficient
  const residuals = regResult.residuals;
  const sse = residuals.reduce((a, v) => a + v * v, 0);
  const mse = sse / (y.length - 2);
  const sumX2 = xLagged.reduce((a, v) => a + (v - mean(xLagged)) ** 2, 0);
  const seBeta = Math.sqrt(mse / sumX2);
  const tStat = seBeta > 0 ? regResult.b / seBeta : 0;

  const criticalValues = getADFCriticalValues(y.length);

  // Approximate p-value using interpolation on critical values
  let pValue = 1;
  if (tStat <= criticalValues['1%']) pValue = 0.01;
  else if (tStat <= criticalValues['5%']) pValue = 0.05;
  else if (tStat <= criticalValues['10%']) pValue = 0.10;
  else {
    // Linear interpolation for t-stat between critical values
    const range1 = criticalValues['5%'] - criticalValues['10%'];
    const offset = tStat - criticalValues['10%'];
    pValue = Math.min(1, Math.max(0.10, 0.10 + (offset / range1) * 0.05));
  }

  return {
    statistic: Math.round(tStat * 1000) / 1000,
    pValue: Math.round(pValue * 1000) / 1000,
    isStationary: pValue < 0.05,
    criticalValues,
    usedLags: nLags,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// KPSS TEST (Kwiatkowski-Phillips-Schmidt-Shin)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * H0: La série est stationnaire (autour d'une tendance déterministe)
 * H1: La série a une racine unitaire (non-stationnaire)
 *
 * À utiliser en conjonction avec ADF pour confirmation:
 * - ADF rejette H0 ET KPSS ne rejette pas H0 → série stationnaire
 * - ADF ne rejette pas H0 ET KPSS rejette H0 → série non-stationnaire
 *
 * @param series - Série temporelle
 * @param lags - Nombre de lags (auto ou fixe)
 * @returns Résultat du test KPSS
 */
export interface KPSSResult {
  statistic: number;
  pValue: number;
  isStationary: boolean;  // true si on ne rejette PAS H0 (p > 0.05)
  criticalValues: { '1%': number; '5%': number; '10%': number };
}

export function kpssTest(series: number[], lags: number | 'auto' = 'auto'): KPSSResult {
  if (series.length < 10) {
    return {
      statistic: 0,
      pValue: 1,
      isStationary: false,
      criticalValues: { '1%': 0, '5%': 0, '10%': 0 },
    };
  }

  const n = series.length;
  const y = [...series];

  // De-trending: regress y on constant and trend, get residuals
  const t = Array.from({ length: n }, (_, i) => i);
  const trendReg = linearRegression(y, t);
  const residuals = trendReg.residuals;

  // Calculate KPSS statistic
  const partialSum = cumsum(residuals);
  const numerator = partialSum.reduce((a, v) => a + v * v, 0) / (n * n);

  // Long-run variance estimation using Newey-West
  let nLags = lags === 'auto' ? Math.floor(4 * Math.pow(n / 100, 2 / 9)) : lags;
  nLags = Math.min(nLags, Math.floor(n / 4));

  const gamma0 = residuals.reduce((a, v) => a + v * v, 0) / n;
  let denominator = gamma0;

  for (let i = 1; i <= nLags; i++) {
    let sum = 0;
    for (let j = i; j < n; j++) {
      sum += residuals[j] * residuals[j - i];
    }
    const gammaI = (2 * sum / n) * (1 - i / (nLags + 1));  // Bartlett kernel
    denominator += gammaI;
  }

  const kpssStat = denominator > 0 ? numerator / denominator : 0;
  const criticalValues = getKPSSCriticalValues(n);

  // p-value approximation
  let pValue = 1;
  if (kpssStat >= criticalValues['1%']) pValue = 0.01;
  else if (kpssStat >= criticalValues['5%']) pValue = 0.05;
  else if (kpssStat >= criticalValues['10%']) pValue = 0.10;
  else pValue = 0.15;  // Above 10% critical value

  return {
    statistic: Math.round(kpssStat * 1000) / 1000,
    pValue: Math.round(pValue * 1000) / 1000,
    isStationary: pValue > 0.05,  // KPSS: ne pas rejeter H0 = stationnaire
    criticalValues,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FRACTIONAL DIFFERENTIATION (López de Prado)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Différenciation fractionnelle: trouve le degré minimal de différenciation
 * pour rendre la série stationnaire tout en préservant la mémoire.
 *
 * La différenciation standard (d=1) élimine la mémoire à long terme.
 * La différenciation fractionnelle (0<d<1) préserve plus d'information.
 *
 * Formule: (1-L)^d = Σ(-1)^k * C(d,k) * L^k
 * où C(d,k) = d(d-1)...(d-k+1)/k!
 *
 * @param series - Série de prix (doit être > 0 pour log transform)
 * @param d - Ordre de différenciation (typiquement 0 < d < 1)
 * @param threshold - Poids minimum pour inclure un terme (évite valeurs infinitésimales)
 * @returns Série différenciée de même longueur que l'entrée
 */
export function fracDiff(series: number[], d: number, threshold: number = 1e-5): number[] {
  if (series.length < 2 || d < 0) return series.map(() => 0);
  if (d === 0) return [...series];
  if (d === 1) return diff(series);

  const n = series.length;
  const result: number[] = [];

  // Calculate weights: w_k = -w_{k-1} * (d - k + 1) / k
  const weights: number[] = [1];
  let k = 1;
  while (k < n) {
    const w_k = -weights[k - 1] * ((d - k + 1) / k);
    weights.push(w_k);
    if (Math.abs(w_k) < threshold) break;
    k++;
  }

  // Apply fractional differencing
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < Math.min(weights.length, i + 1); j++) {
      sum += weights[j] * series[i - j];
    }
    result.push(sum);
  }

  return result;
}

/**
 * Trouve le d optimal pour la différenciation fractionnelle.
 *
 * Le but est de trouver le plus petit d tel que la série devient stationnaire
 * (test ADF p-value < 0.05) tout en préservant le maximum de mémoire.
 *
 * @param series - Série de prix
 * @param dRange - Plage de valeurs d à tester
 * @param threshold - Seuil pour les poids de différenciation
 * @returns d optimal et statistiques ADF pour chaque d testé
 */
export interface OptimalDResult {
  optimalD: number;
  adfStats: { d: number; pValue: number; isStationary: boolean }[];
  recommended: { d: number; reason: string };
}

export function findOptimalD(
  series: number[],
  dRange: number[] = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
  threshold: number = 1e-5
): OptimalDResult {
  const adfStats: { d: number; pValue: number; isStationary: boolean }[] = [];

  for (const d of dRange) {
    const diffSeries = fracDiff(series, d, threshold);
    // Remove NaN/Inf values
    const cleanSeries = diffSeries.filter(v => Number.isFinite(v) && v !== 0);
    if (cleanSeries.length > 20) {
      const adf = adfTest(cleanSeries, 1);
      adfStats.push({ d, pValue: adf.pValue, isStationary: adf.isStationary });
    }
  }

  // Find optimal d: smallest d that makes series stationary
  let optimalD = 1;  // Default to first difference
  for (const stat of adfStats) {
    if (stat.isStationary) {
      optimalD = stat.d;
      break;
    }
  }

  // Recommendation logic
  let recommended = { d: optimalD, reason: 'First stationary d found' };
  if (optimalD < 0.3) {
    recommended = { d: optimalD, reason: 'Low d: strong memory preserved, minimal differencing needed' };
  } else if (optimalD < 0.6) {
    recommended = { d: optimalD, reason: 'Medium d: moderate memory preserved' };
  } else {
    recommended = { d: optimalD, reason: 'High d: series strongly non-stationary, consider alternative features' };
  }

  return {
    optimalD: Math.round(optimalD * 100) / 100,
    adfStats,
    recommended,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// COMBINED STATIONARITY ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Analyse combinée ADF + KPSS + Fractional Differentiation.
 *
 * Stratégie:
 * 1. Tester la série brute avec ADF et KPSS
 * 2. Si non-stationnaire, tester la différenciation standard (d=1)
 * 3. Si d=1 détruit trop de mémoire, chercher d optimal via fracDiff
 *
 * @param series - Série de prix ou returns
 * @returns Analyse complète et recommandation
 */
export interface StationarityAnalysis {
  series: {
    type: 'prices' | 'returns' | 'unknown';
    mean: number;
    std: number;
    length: number;
  };
  adf: ADFResult;
  kpss: KPSSResult;
  conclusion: 'STATIONARY' | 'NON-STATIONARY' | 'MIXED';
  recommendation: {
    action: 'USE_AS_IS' | 'DIFF_STANDARD' | 'DIFF_FRACTIONAL' | 'TRANSFORM_LOG';
    d: number;
    reason: string;
  };
  memoryPreservation: 'HIGH' | 'MEDIUM' | 'LOW';
}

export function analyzeStationarity(series: number[]): StationarityAnalysis {
  // Determine series type
  const allPositive = series.every(v => v > 0);
  const varianceRatio = std(series, false) / (Math.abs(mean(series)) + 1e-10);
  const type = varianceRatio > 0.5 ? 'prices' : 'returns';

  const adf = adfTest(series);
  const kpss = kpssTest(series);

  // Combined conclusion
  let conclusion: StationarityAnalysis['conclusion'];
  if (adf.isStationary && kpss.isStationary) {
    conclusion = 'STATIONARY';
  } else if (!adf.isStationary && !kpss.isStationary) {
    conclusion = 'NON-STATIONARY';
  } else {
    conclusion = 'MIXED';  // Tests disagree
  }

  // Recommendation
  let recommendation: StationarityAnalysis['recommendation'];
  let memoryPreservation: StationarityAnalysis['memoryPreservation'];

  if (conclusion === 'STATIONARY') {
    recommendation = {
      action: 'USE_AS_IS',
      d: 0,
      reason: 'Series is already stationary (ADF + KPSS agree)',
    };
    memoryPreservation = 'HIGH';
  } else {
    // Try first difference
    const diffSeries = diff(series);
    const adfDiff = adfTest(diffSeries);
    const kpssDiff = kpssTest(diffSeries);

    if (adfDiff.isStationary && kpssDiff.isStationary) {
      // Check if fractional d could preserve memory
      const optimalD = findOptimalD(series);
      if (optimalD.optimalD < 0.8) {
        recommendation = {
          action: 'DIFF_FRACTIONAL',
          d: optimalD.optimalD,
          reason: `Fractional d=${optimalD.optimalD} achieves stationarity with better memory preservation`,
        };
        memoryPreservation = optimalD.optimalD < 0.4 ? 'HIGH' : 'MEDIUM';
      } else {
        recommendation = {
          action: 'DIFF_STANDARD',
          d: 1,
          reason: 'First difference makes series stationary',
        };
        memoryPreservation = 'LOW';
      }
    } else {
      // Try log transform first if prices
      if (allPositive && type === 'prices') {
        const logSeries = log(series);
        const adfLog = adfTest(logSeries);
        if (adfLog.isStationary) {
          recommendation = {
            action: 'TRANSFORM_LOG',
            d: 0,
            reason: 'Log transform achieves stationarity',
          };
          memoryPreservation = 'MEDIUM';
        } else {
          recommendation = {
            action: 'DIFF_FRACTIONAL',
            d: 0.5,
            reason: 'Complex case: try fractional differencing from d=0.5',
          };
          memoryPreservation = 'MEDIUM';
        }
      } else {
        recommendation = {
          action: 'DIFF_FRACTIONAL',
          d: 0.5,
          reason: 'Series highly non-stationary: fractional differencing recommended',
        };
        memoryPreservation = 'LOW';
      }
    }
  }

  return {
    series: {
      type,
      mean: Math.round(mean(series) * 1000) / 1000,
      std: Math.round(std(series) * 1000) / 1000,
      length: series.length,
    },
    adf,
    kpss,
    conclusion,
    recommendation,
    memoryPreservation,
  };
}
