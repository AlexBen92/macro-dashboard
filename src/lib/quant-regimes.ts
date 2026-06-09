/**
 * QUANTITATIVE REGIME DETECTION
 *
 * Indicateurs quant pour détecter les régimes de marché:
 * - Trend-following vs Mean-reverting vs Random Walk
 * - Stationnarité / Persistence
 * - Efficience de marché
 *
 * Basé sur la littérature académique:
 * - Hurst (1951) - Long-term memory
 * - Lo (1991) - Modified Hurst estimation
 * - Dickey, Fuller (1979) - ADF test
 * - Kwiatkowski (1992) - KPSS test
 * - Lo, MacKinlay (1988) - Variance Ratio test
 */

interface Candle {
  o: number; h: number; l: number; c: number; v: number;
}

// ============================================================
// 1. HURST EXPONENT
// ============================================================

interface HurstResult {
  hurst: number;
  regime: 'trending' | 'mean_reverting' | 'random_walk';
  confidence: number;
  window: number;
}

/**
 * Calcule l'exposant de Hurst via R/S analysis
 *
 * H < 0.45: Mean-reverting (anti-persistent)
 * H ≈ 0.5: Random walk
 * H > 0.55: Trending (persistent)
 */
export function calculateHurst(
  prices: number[],
  window: number = 64
): HurstResult {
  if (prices.length < window * 2) {
    return {
      hurst: 0.5,
      regime: 'random_walk',
      confidence: 0,
      window,
    };
  }

  // Calculer les returns log
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const subset = returns.slice(-window);
  const n = subset.length;

  // Calculer les cumulative deviations
  const mean = subset.reduce((a, b) => a + b, 0) / n;
  const cumulativeDeviations: number[] = [];
  let acc = 0;

  for (let i = 0; i < n; i++) {
    acc += subset[i] - mean;
    cumulativeDeviations.push(acc);
  }

  // Range (max - min)
  const max = Math.max(...cumulativeDeviations);
  const min = Math.min(...cumulativeDeviations);
  const R = max - min;

  // Standard deviation
  const variance = subset.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const S = Math.sqrt(variance);

  // R/S ratio
  const RS = S > 0 ? R / S : 0;

  // Hurst via la formule: H = log(RS) / log(n)
  const hurst = RS > 0 ? Math.log(RS) / Math.log(n) : 0.5;

  // Classification du régime
  let regime: HurstResult['regime'] = 'random_walk';
  if (hurst < 0.45) {
    regime = 'mean_reverting';
  } else if (hurst > 0.55) {
    regime = 'trending';
  }

  // Confiance basée sur la distance à 0.5
  const confidence = Math.min(100, Math.abs(hurst - 0.5) * 200);

  return { hurst, regime, confidence: Math.round(confidence), window };
}

/**
 * Calcule Hurst sur plusieurs fenêtres pour la robustesse
 */
export function calculateMultiWindowHurst(
  prices: number[],
  windows: number[] = [64, 96, 128]
): {
  hurst_64: HurstResult;
  hurst_96: HurstResult;
  hurst_128: HurstResult;
  consensus: 'trending' | 'mean_reverting' | 'random_walk' | 'mixed';
  regime_score: number;
} {
  const results = windows.map(w => calculateHurst(prices, w));

  const trending = results.filter(r => r.regime === 'trending').length;
  const meanReverting = results.filter(r => r.regime === 'mean_reverting').length;
  const randomWalk = results.filter(r => r.regime === 'random_walk').length;

  let consensus: typeof results[0]['regime'] | 'mixed' = 'mixed';
  if (trending === results.length) consensus = 'trending';
  else if (meanReverting === results.length) consensus = 'mean_reverting';
  else if (randomWalk === results.length) consensus = 'random_walk';

  // Score de régime: +1 (trending) à -1 (mean reverting)
  const avgHurst = results.reduce((a, r) => a + r.hurst, 0) / results.length;
  const regime_score = Math.round((avgHurst - 0.5) * 2);

  return {
    hurst_64: results[0],
    hurst_96: results[1],
    hurst_128: results[2],
    consensus,
    regime_score,
  };
}

// ============================================================
// 2. STATIONARITY TESTS (ADF et KPSS simplifiés)
// ============================================================

interface StationarityTest {
  statistic: number;
  p_value: number;
  is_stationary: boolean;
  confidence: number;
}

interface StationarityResult {
  adf: StationarityTest;
  kpss: StationarityTest;
  classification: 'stationary' | 'nonstationary' | 'mixed';
  confidence: number;
}

/**
 * Test ADF simplifié (Dickey-Fuller augmenté)
 * H0: La série a une racine unitaire (non-stationnaire)
 * Rejet H0 → stationnaire
 */
function adfTest(series: number[]): StationarityTest {
  const n = series.length;
  if (n < 20) {
    return { statistic: 0, p_value: 1, is_stationary: false, confidence: 0 };
  }

  // Méthode simplifiée: régression sur première différence
  const returns: number[] = [];
  for (let i = 1; i < series.length; i++) {
    returns.push(series[i] - series[i - 1]);
  }

  // Auto-corrélation lag 1
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const num = returns.reduce((a, r, i) => i > 0 ? a + (r - mean) * (returns[i - 1] - mean) : a, 0);
  const den = returns.reduce((a, r) => a + (r - mean) ** 2, 0);
  const phi = den > 0 ? num / den : 0;

  // Statistique de test (simplifiée)
  const statistic = (phi - 1) * Math.sqrt(n);

  // P-value approximative (table critique)
  const criticalValue_5pct = -2.86;
  const is_stationary = statistic < criticalValue_5pct;

  // Confidence basée sur la distance à la valeur critique
  const confidence = Math.min(100, Math.abs(statistic - criticalValue_5pct) * 10);

  return {
    statistic,
    p_value: is_stationary ? 0.03 : 0.5,
    is_stationary,
    confidence: Math.round(confidence),
  };
}

/**
 * Test KPSS simplifié (Kwiatkowski-Phillips-Schmidt-Shin)
 * H0: La série est stationnaire
 * Rejet H0 → non-stationnaire
 */
function kpssTest(series: number[]): StationarityTest {
  const n = series.length;
  if (n < 20) {
    return { statistic: 0, p_value: 1, is_stationary: true, confidence: 0 };
  }

  // KPSS utilise la régression sur la série cumulée des résidus
  const mean = series.reduce((a, b) => a + b, 0) / n;
  const residuals = series.map(x => x - mean);

  // Cumulative sum
  const cumsum: number[] = [];
  let acc = 0;
  for (const r of residuals) {
    acc += r;
    cumsum.push(acc);
  }

  // Statistique LM
  const lm = cumsum.reduce((a, c) => a + c * c, 0) / (n * n);
  const variance = residuals.reduce((a, r) => a + r * r, 0) / n;
  const statistic = variance > 0 ? lm / variance : 0;

  // Valeur critique à 5%
  const criticalValue_5pct = 0.463;
  const is_stationary = statistic < criticalValue_5pct;

  const confidence = Math.min(100, (criticalValue_5pct - statistic) * 100);

  return {
    statistic,
    p_value: is_stationary ? 0.5 : 0.03,
    is_stationary,
    confidence: Math.round(Math.max(0, confidence)),
  };
}

/**
 * Test complet de stationnarité combinant ADF et KPSS
 */
export function testStationarity(prices: number[]): StationarityResult {
  // Tester sur les returns, pas les prix bruts
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }

  const adf = adfTest(returns);
  const kpss = kpssTest(returns);

  // Classification combinée
  let classification: StationarityResult['classification'] = 'mixed';
  let confidence = 0;

  if (adf.is_stationary && kpss.is_stationary) {
    classification = 'stationary';
    confidence = (adf.confidence + kpss.confidence) / 2;
  } else if (!adf.is_stationary && !kpss.is_stationary) {
    classification = 'nonstationary';
    confidence = (adf.confidence + kpss.confidence) / 2;
  } else {
    classification = 'mixed';
    confidence = Math.min(adf.confidence, kpss.confidence) / 2;
  }

  return {
    adf,
    kpss,
    classification,
    confidence: Math.round(confidence),
  };
}

// ============================================================
// 3. VARIANCE RATIO
// ============================================================

interface VarianceRatioResult {
  variance_ratio: number;
  regime: 'mean_reverting' | 'random_walk' | 'trending';
  statistic: number;
  p_value: number;
  confidence: number;
}

/**
 * Test de Variance Ratio (Lo-MacKinlay, 1988)
 * VR < 1: Mean-reverting
 * VR ≈ 1: Random Walk
 * VR > 1: Trending/Momentum
 */
export function calculateVarianceRatio(
  prices: number[],
  window: number = 64,
  q: number = 2
): VarianceRatioResult {
  if (prices.length < window * 2) {
    return {
      variance_ratio: 1,
      regime: 'random_walk',
      statistic: 0,
      p_value: 1,
      confidence: 0,
    };
  }

  const subset = prices.slice(-window);

  // Returns 1-période
  const returns1: number[] = [];
  for (let i = 1; i < subset.length; i++) {
    returns1.push(subset[i] - subset[i - 1]);
  }

  // Returns q-période
  const returnsQ: number[] = [];
  for (let i = q; i < subset.length; i++) {
    returnsQ.push(subset[i] - subset[i - q]);
  }

  // Variances
  const mean1 = returns1.reduce((a, b) => a + b, 0) / returns1.length;
  const var1 = returns1.reduce((a, r) => a + (r - mean1) ** 2, 0) / (returns1.length - 1);

  const meanQ = returnsQ.reduce((a, b) => a + b, 0) / returnsQ.length;
  const varQ = returnsQ.reduce((a, r) => a + (r - meanQ) ** 2, 0) / (returnsQ.length - 1);

  // Variance Ratio
  const vr = var1 > 0 ? (varQ / q) / var1 : 1;

  // Classification
  let regime: VarianceRatioResult['regime'] = 'random_walk';
  if (vr < 0.8) {
    regime = 'mean_reverting';
  } else if (vr > 1.2) {
    regime = 'trending';
  }

  // Statistique de test simplifiée
  const n = returns1.length;
  const statistic = Math.abs(vr - 1) * Math.sqrt(n);

  // P-value approximative (normal dist)
  const p_value = 2 * (1 - normalCDF(Math.abs(statistic)));

  // Confidence basée sur la distance à 1
  const confidence = Math.min(100, Math.abs(vr - 1) * 100);

  return {
    variance_ratio: vr,
    regime,
    statistic,
    p_value,
    confidence: Math.round(confidence),
  };
}

// Helper: CDF normale standard
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

// ============================================================
// 4. HALF-LIFE OF MEAN REVERSION
// ============================================================

interface HalfLifeResult {
  half_life_bars: number;
  half_life_minutes: number;
  is_mean_reverting: boolean;
  speed: number; // Coefficient de réversion
}

/**
 * Calcule la demi-vie de retour à la moyenne
 * Basé sur un processus Ornstein-Uhlenbeck
 */
export function calculateHalfLife(
  prices: number[],
  window: number = 64
): HalfLifeResult {
  if (prices.length < window) {
    return {
      half_life_bars: Infinity,
      half_life_minutes: Infinity,
      is_mean_reverting: false,
      speed: 0,
    };
  }

  const subset = prices.slice(-window);

  // Écart à la moyenne
  const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
  const deviations = subset.map(p => p - mean);

  // Régression: Δy = λ * y + ε
  // Si λ < 0, il y a mean reversion
  const y = deviations.slice(0, -1);
  const dy: number[] = [];
  for (let i = 1; i < deviations.length; i++) {
    dy.push(deviations[i] - deviations[i - 1]);
  }

  // OLS simple
  const n = y.length;
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumDY = dy.reduce((a, b) => a + b, 0);
  const sumY2 = y.reduce((a, b) => a + b * b, 0);
  const sumYDY = y.reduce((a, yi, i) => a + yi * dy[i], 0);

  const lambda = (n * sumYDY - sumY * sumDY) / (n * sumY2 - sumY * sumY);

  // Demi-vie = -ln(2) / λ
  // Si lambda > 0, pas de mean reversion
  const is_mean_reverting = lambda < 0;
  const half_life_bars = is_mean_reverting && lambda !== 0
    ? Math.abs(Math.log(2) / lambda)
    : Infinity;

  return {
    half_life_bars: Math.round(half_life_bars),
    half_life_minutes: Math.round(half_life_bars * 15), // M15 timeframe
    is_mean_reverting,
    speed: lambda,
  };
}

// ============================================================
// 5. AUTOCORRELATION
// ============================================================

interface AutocorrelationResult {
  lag1: number;
  lag2: number;
  lag3: number;
  lag4: number;
  significance: 'positive' | 'negative' | 'none';
  regime: 'momentum' | 'mean_reverting' | 'noise';
}

/**
 * Calcule l'autocorrélation des returns jusqu'au lag 4
 */
export function calculateAutocorrelation(
  prices: number[],
  window: number = 64
): AutocorrelationResult {
  if (prices.length < window + 4) {
    return {
      lag1: 0, lag2: 0, lag3: 0, lag4: 0,
      significance: 'none',
      regime: 'noise',
    };
  }

  const subset = prices.slice(-window);

  // Returns
  const returns: number[] = [];
  for (let i = 1; i < subset.length; i++) {
    returns.push(subset[i] - subset[i - 1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;

  // Autocorrélation pour chaque lag
  const acf = (lag: number) => {
    let num = 0;
    let den = 0;
    for (let i = lag; i < returns.length; i++) {
      num += (returns[i] - mean) * (returns[i - lag] - mean);
    }
    for (let i = 0; i < returns.length; i++) {
      den += (returns[i] - mean) ** 2;
    }
    return den > 0 ? num / den : 0;
  };

  const lag1 = acf(1);
  const lag2 = acf(2);
  const lag3 = acf(3);
  const lag4 = acf(4);

  // Significativité (approx: 2/sqrt(n))
  const threshold = 2 / Math.sqrt(returns.length);

  let significance: AutocorrelationResult['significance'] = 'none';
  if (Math.abs(lag1) > threshold) {
    significance = lag1 > 0 ? 'positive' : 'negative';
  }

  // Régime basé sur le signe de l'autocorrélation
  let regime: AutocorrelationResult['regime'] = 'noise';
  if (significance === 'positive') {
    regime = 'momentum';
  } else if (significance === 'negative') {
    regime = 'mean_reverting';
  }

  return {
    lag1: Math.round(lag1 * 1000) / 1000,
    lag2: Math.round(lag2 * 1000) / 1000,
    lag3: Math.round(lag3 * 1000) / 1000,
    lag4: Math.round(lag4 * 1000) / 1000,
    significance,
    regime,
  };
}

// ============================================================
// 6. Z-SCORE
// ============================================================

interface ZScoreResult {
  zscore_price: number;
  zscore_distance: number;
  percentile: number;
  is_extreme: boolean;
}

/**
 * Calcule le z-score du prix par rapport à sa moyenne rolling
 */
export function calculateZScore(
  prices: number[],
  window: number = 64
): ZScoreResult {
  if (prices.length < window) {
    return {
      zscore_price: 0,
      zscore_distance: 0,
      percentile: 50,
      is_extreme: false,
    };
  }

  const subset = prices.slice(-window);
  const mean = subset.reduce((a, b) => a + b, 0) / subset.length;
  const variance = subset.reduce((a, p) => a + (p - mean) ** 2, 0) / subset.length;
  const std = Math.sqrt(variance);

  const currentPrice = prices[prices.length - 1];
  const zscore = std > 0 ? (currentPrice - mean) / std : 0;

  // Distance en écart-types
  const zscore_distance = Math.abs(zscore);

  // Percentile approximatif
  const percentile = normalCDF(zscore) * 100;

  // Extrême si > 2 std
  const is_extreme = zscore_distance > 2;

  return {
    zscore_price: Math.round(zscore * 100) / 100,
    zscore_distance: Math.round(zscore_distance * 100) / 100,
    percentile: Math.round(percentile),
    is_extreme,
  };
}

// ============================================================
// 7. MARKET EFFICIENCY / NOISE
// ============================================================

interface EfficiencyResult {
  efficiency_ratio: number;
  choppiness_index: number;
  noise_level: 'low' | 'moderate' | 'high';
  trend_strength: 'strong' | 'weak' | 'none';
}

/**
 * Efficiency Ratio de Kaufman
 * ER = Direction / Volatility
 * ER proche de 1: trend fort
 * ER proche de 0: marché choppy/noisy
 */
export function calculateEfficiency(
  prices: number[],
  window: number = 64
): EfficiencyResult {
  if (prices.length < window) {
    return {
      efficiency_ratio: 0.5,
      choppiness_index: 50,
      noise_level: 'moderate',
      trend_strength: 'none',
    };
  }

  const subset = prices.slice(-window);

  // Direction: distance nette
  const direction = Math.abs(subset[subset.length - 1] - subset[0]);

  // Volatility: somme des mouvements
  let volatility = 0;
  for (let i = 1; i < subset.length; i++) {
    volatility += Math.abs(subset[i] - subset[i - 1]);
  }

  // Efficiency Ratio
  const efficiency_ratio = volatility > 0 ? direction / volatility : 0.5;

  // Choppiness Index (inverse de l'efficacité)
  const choppiness_index = 100 - efficiency_ratio * 100;

  // Classification
  let noise_level: EfficiencyResult['noise_level'] = 'moderate';
  let trend_strength: EfficiencyResult['trend_strength'] = 'none';

  if (efficiency_ratio > 0.7) {
    noise_level = 'low';
    trend_strength = 'strong';
  } else if (efficiency_ratio > 0.4) {
    noise_level = 'moderate';
    trend_strength = 'weak';
  } else {
    noise_level = 'high';
    trend_strength = 'none';
  }

  return {
    efficiency_ratio: Math.round(efficiency_ratio * 1000) / 1000,
    choppiness_index: Math.round(choppiness_index),
    noise_level,
    trend_strength,
  };
}

// ============================================================
// 8. NORMALIZED VOLATILITY
// ============================================================

interface VolatilityResult {
  atr_normalized: number;
  realized_vol: number;
  vol_percentile: number;
  vol_regime: 'low' | 'normal' | 'elevated' | 'extreme';
  range_position: number; // Position du prix dans le range (0-100)
}

/**
 * ATR (Average True Range) normalisé
 */
function calculateATR(prices: number[], window: number = 14): number {
  if (prices.length < window + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const high = Math.max(prices[i], prices[i - 1]);
    const low = Math.min(prices[i], prices[i - 1]);
    trueRanges.push(high - low);
  }

  const atr = trueRanges.slice(-window).reduce((a, tr) => a + tr, 0) / window;
  return atr;
}

/**
 * Volatilité normalisée et position dans le range
 */
export function calculateNormalizedVolatility(
  prices: number[],
  volWindow: number = 20,
  histWindow: number = 252
): VolatilityResult {
  if (prices.length < histWindow) {
    return {
      atr_normalized: 0,
      realized_vol: 0,
      vol_percentile: 50,
      vol_regime: 'normal',
      range_position: 50,
    };
  }

  const currentATR = calculateATR(prices, 14);
  const currentPrice = prices[prices.length - 1];

  // ATR normalisé par le prix
  const atr_normalized = currentPrice > 0 ? (currentATR / currentPrice) * 100 : 0;

  // Realized vol (écart-type des returns)
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push(Math.log(prices[i] / prices[i - 1]));
  }
  const recentReturns = returns.slice(-volWindow);
  const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
  const realized_vol = Math.sqrt(
    recentReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / recentReturns.length
  ) * Math.sqrt(252) * 100; // Annualisée

  // Historique de la vol pour percentile
  const historicalVols: number[] = [];
  for (let i = volWindow; i < returns.length; i++) {
    const windowReturns = returns.slice(i - volWindow, i);
    const wMean = windowReturns.reduce((a, b) => a + b, 0) / windowReturns.length;
    const vol = Math.sqrt(
      windowReturns.reduce((a, r) => a + (r - wMean) ** 2, 0) / windowReturns.length
    ) * Math.sqrt(252) * 100;
    historicalVols.push(vol);
  }

  // Percentile actuel
  const sorted = [...historicalVols].sort((a, b) => a - b);
  const percentile = sorted.findIndex(v => v >= realized_vol) / sorted.length * 100;

  // Régime de vol
  let vol_regime: VolatilityResult['vol_regime'] = 'normal';
  if (percentile < 25) vol_regime = 'low';
  else if (percentile > 90) vol_regime = 'extreme';
  else if (percentile > 75) vol_regime = 'elevated';

  // Position du prix dans son range
  const histPrices = prices.slice(-histWindow);
  const minPrice = Math.min(...histPrices);
  const maxPrice = Math.max(...histPrices);
  const range_position = maxPrice > minPrice
    ? ((currentPrice - minPrice) / (maxPrice - minPrice)) * 100
    : 50;

  return {
    atr_normalized: Math.round(atr_normalized * 100) / 100,
    realized_vol: Math.round(realized_vol * 100) / 100,
    vol_percentile: Math.round(percentile),
    vol_regime,
    range_position: Math.round(range_position),
  };
}

// ============================================================
// COMPOSITE REGIME SCORE
// ============================================================

export interface CompositeRegime {
  overall_regime: 'trend_following' | 'mean_reverting' | 'random_walk' | 'volatile_chop';
  trend_score: number; // -100 to +100
  confidence: number;
  breakdown: {
    hurst: number;
    stationarity: number;
    variance_ratio: number;
    efficiency: number;
    autocorr: number;
  };
  recommended_strategies: string[];
  risk_multiplier: number;
}

/**
 * Score composite de régime combinant tous les indicateurs
 */
export function calculateCompositeRegime(
  prices: number[],
  windows = { hurst: 64, stationarity: 64, vr: 64, efficiency: 64 }
): CompositeRegime {
  // Calculer tous les indicateurs
  const hurst = calculateMultiWindowHurst(prices);
  const stationarity = testStationarity(prices);
  const vr = calculateVarianceRatio(prices);
  const efficiency = calculateEfficiency(prices);
  const autocorr = calculateAutocorrelation(prices);

  // Scoring pour chaque indicateur (-1 à +1)
  const hurstScore = hurst.regime_score; // déjà -1 à +1
  const stationarityScore = stationarity.classification === 'stationary' ? -0.5 :
                           stationarity.classification === 'nonstationary' ? 0.5 : 0;
  const vrScore = vr.regime === 'trending' ? 0.5 :
                 vr.regime === 'mean_reverting' ? -0.5 : 0;
  const efficiencyScore = (efficiency.efficiency_ratio - 0.5) * 2; // -1 à +1
  const autocorrScore = autocorr.regime === 'momentum' ? 0.5 :
                      autocorr.regime === 'mean_reverting' ? -0.5 : 0;

  // Score de tendance pondéré
  const weights = { hurst: 0.3, stationarity: 0.2, vr: 0.2, efficiency: 0.2, autocorr: 0.1 };
  const trendScore = (
    hurstScore * weights.hurst +
    stationarityScore * weights.stationarity +
    vrScore * weights.vr +
    efficiencyScore * weights.efficiency +
    autocorrScore * weights.autocorr
  ) * 100; // -100 à +100

  // Confiance basée sur le consensus
  const confidence = Math.max(0, Math.min(100, (
    hurst.hurst_64.confidence +
    stationarity.confidence +
    vr.confidence +
    (efficiency.efficiency_ratio > 0.6 || efficiency.efficiency_ratio < 0.4 ? 80 : 40)
  ) / 4));

  // Classification du régime global
  let overall_regime: CompositeRegime['overall_regime'] = 'random_walk';
  if (trendScore > 30) {
    overall_regime = 'trend_following';
  } else if (trendScore < -30) {
    overall_regime = 'mean_reverting';
  } else if (vr.variance_ratio < 0.8 && efficiency.choppiness_index > 60) {
    overall_regime = 'volatile_chop';
  }

  // Stratégies recommandées
  let recommended_strategies: string[] = [];
  if (overall_regime === 'trend_following') {
    recommended_strategies = ['Momentum', 'Breakout', 'Trend Following'];
  } else if (overall_regime === 'mean_reverting') {
    recommended_strategies = ['Mean Reversion', 'RSI Reversal', 'Bollinger Reversion'];
  } else if (overall_regime === 'volatile_chop') {
    recommended_strategies = ['Range Trading', 'Wait for clarity'];
  } else {
    recommended_strategies = ['Wait', 'Reduce position size'];
  }

  // Risk multiplier basé sur la qualité du régime
  const risk_multiplier = overall_regime === 'trend_following' ? 1.2 :
                         overall_regime === 'mean_reverting' ? 1.0 :
                         overall_regime === 'random_walk' ? 0.5 : 0.3;

  return {
    overall_regime,
    trend_score: Math.round(trendScore),
    confidence: Math.round(confidence),
    breakdown: {
      hurst: Math.round(hurstScore * 100),
      stationarity: Math.round(stationarityScore * 100),
      variance_ratio: Math.round(vrScore * 100),
      efficiency: Math.round(efficiencyScore * 100),
      autocorr: Math.round(autocorrScore * 100),
    },
    recommended_strategies,
    risk_multiplier,
  };
}
