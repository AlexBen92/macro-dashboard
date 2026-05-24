/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * EHLERS/DSP INDICATORS MODULE — V4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Indicateurs adaptatifs basés sur le traitement du signal numérique (DSP)
 * par John Ehlers. Remplacent les indicateurs classiques (MACD, RSI) avec
 * des versions adaptatives qui s'ajustent aux cycles du marché.
 *
 * INDICATEURS:
 *  - Super Smoother: Filtre passe-bas à 2 pôles, zéro lag
 *  - Hilbert Transform: Détection du cycle dominant en temps réel
 *  - MAMA/FAMA: MESA Adaptive Moving Average
 *  - Cycle Momentum: Momentum adapté au cycle détecté
 *  - Stochastic RSI avec Super Smoother
 *  - Fisher Transform: Normalisation gaussienne des prix
 *
 * REFERENCES:
 *  - Ehlers, J.F. (2013). "Cycle Analytics for Traders." Wiley.
 *  - Ehlers, J.F. (2002). "Using The Fisher Transform." TASC Magazine.
 *  - Ehlers, J.F. (2000). " adaptive Indicators." Technical Analysis of Stocks & Commodities.
 *
 * INPUT/OUTPUT:
 *  Input:  number[] (série de prix OHLC)
 *  Output: number[] (valeurs indicatrices) + signaux de trading
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// SUPER SMOOTHER FILTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Super Smoother Filter (Ehlers 2013).
 *
 * Filtre passe-bas récursif à 2 pôles qui élimine le bruit haute fréquence
 * tout en préservant les composantes de basse fréquence (trend).
 *
 * Avantages vs EMA:
 *  - Lag réduit pour même fréquence de coupure
 *  - Meilleure atténuation des hautes fréquences
 *  - Phase linéaire (pas de distorsion temporelle)
 *
 * Formule:
 *  a = e^(-ω * √2)
 *  b = 2 * a * cos(ω * √2)
 *  c2 = b
 *  c3 = -a²
 *  c1 = 1 - c2 - c3
 *  smoothed[i] = c1*price + c2*smoothed[i-1] + c3*smoothed[i-2]
 *
 * @param series - Série de prix
 * @param period - Période de coupure (défaut 10)
 * @returns Série filtrée de même longueur
 */
export function superSmoother(series: number[], period: number = 10): number[] {
  if (series.length < 3) return series.map(() => 0);

  const n = series.length;
  const result: number[] = [];

  // Calculate coefficients
  const rad = 2 * Math.PI / period;
  const a1 = Math.exp(-rad * Math.sqrt(2));
  const b1 = 2 * a1 * Math.cos(rad * Math.sqrt(2));
  const c2 = b1;
  const c3 = -a1 * a1;
  const c1 = 1 - c2 - c3;

  // Initialize with first value
  result.push(series[0]);
  result.push(series[1]);

  // Apply filter
  for (let i = 2; i < n; i++) {
    const smoothed = c1 * series[i] + c2 * result[i - 1] + c3 * result[i - 2];
    result.push(smoothed);
  }

  return result;
}

/**
 * Super Smoother avec fréquence de coupure adaptative.
 *
 * Ajuste la période de coupure en fonction de la volatilité:
 *  - Volatilité élevée → période plus courte (plus réactif)
 *  - Volatilité faible → période plus longue (plus lissé)
 *
 * @param series - Série de prix
 * @param minPeriod - Période minimum (défaut 5)
 * @param maxPeriod - Période maximum (défaut 20)
 * @returns Série filtrée
 */
export function adaptiveSuperSmoother(
  series: number[],
  minPeriod: number = 5,
  maxPeriod: number = 20
): number[] {
  if (series.length < 20) return series.map(() => 0);

  // Calculate rolling volatility
  const window = 14;
  const volatilities: number[] = [];

  for (let i = 0; i < series.length; i++) {
    if (i < window) {
      volatilities.push(maxPeriod);
      continue;
    }

    const slice = series.slice(i - window, i + 1);
    const returns: number[] = [];
    for (let j = 1; j < slice.length; j++) {
      returns.push((slice[j] - slice[j - 1]) / slice[j - 1]);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / returns.length;
    const std = Math.sqrt(variance);

    // Map volatility to period (inverse relationship)
    const volPctile = Math.min(1, std / 0.05);  // Assume 5% daily vol is "high"
    const adaptivePeriod = maxPeriod - (maxPeriod - minPeriod) * volPctile;
    volatilities.push(adaptivePeriod);
  }

  // Apply adaptive smoothing
  const result: number[] = [];
  result.push(series[0]);
  result.push(series[1]);

  for (let i = 2; i < series.length; i++) {
    const period = volatilities[i];
    const rad = 2 * Math.PI / period;
    const a1 = Math.exp(-rad * Math.sqrt(2));
    const b1 = 2 * a1 * Math.cos(rad * Math.sqrt(2));
    const c2 = b1;
    const c3 = -a1 * a1;
    const c1 = 1 - c2 - c3;

    const smoothed = c1 * series[i] + c2 * result[i - 1] + c3 * result[i - 2];
    result.push(smoothed);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// HILBERT TRANSFORM - DOMINANT CYCLE DETECTION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Hilbert Transform pour détecter le cycle dominant.
 *
 * La transformée de Hilbert décompose le signal en composantes:
 *  - InPhase (I): composante en phase
 *  - Quadrature (Q): composante en quadrature (déphasée de 90°)
 *
 * À partir de I et Q, on calcule:
 *  - Phase = atan(Q/I)
 *  - Amplitude = √(I² + Q²)
 *  - Cycle dominant = dérivée de la phase
 *
 * @param series - Série de prix
 * @param maxPeriod - Période maximum à détecter (défaut 48)
 * @returns { dominantCycle, phase, amplitude }
 */
export interface HilbertResult {
  dominantCycle: number[];   // Période détectée bougie par bougie
  phase: number[];           // Phase du cycle (0-360°)
  amplitude: number[];       // Amplitude du cycle
}

export function hilbertTransformDC(series: number[], maxPeriod: number = 48): HilbertResult {
  const n = series.length;
  const dominantCycle: number[] = new Array(n).fill(maxPeriod / 2);
  const phase: number[] = new Array(n).fill(0);
  const amplitude: number[] = new Array(n).fill(0);

  if (n < 10) {
    return { dominantCycle, phase, amplitude };
  }

  // Smoothed price for Hilbert transform
  const smoothed = superSmoother(series, 10);

  // Hilbert Transform components
  const inPhase: number[] = new Array(n).fill(0);
  const quadrature: number[] = new Array(n).fill(0);

  // Hilbert transform using simple approximations
  // Real implementation requires complex number arithmetic
  for (let i = 2; i < n; i++) {
    // Compute analytic signal components
    const delta = smoothed[i] - smoothed[i - 1];
    const delta2 = smoothed[i] - 2 * smoothed[i - 1] + smoothed[i - 2];

    // InPhase component (real part)
    inPhase[i] = smoothed[i] - 0.5 * delta + 0.25 * delta2;

    // Quadrature component (imaginary part) - 90° phase shift
    quadrature[i] = 0.75 * delta + 0.25 * delta2;

    // Compute phase
    phase[i] = Math.atan2(quadrature[i], inPhase[i]) * 180 / Math.PI;
    if (phase[i] < 0) phase[i] += 360;

    // Compute amplitude
    amplitude[i] = Math.sqrt(inPhase[i] ** 2 + quadrature[i] ** 2);
  }

  // Compute dominant cycle from phase changes
  for (let i = 3; i < n; i++) {
    const phaseChange = phase[i] - phase[i - 1];
    // Handle phase wrap-around
    const adjustedChange = phaseChange < 0 ? phaseChange + 360 : phaseChange;

    if (adjustedChange > 0.1) {
      // Cycle length = 360 / phase change per bar
      const cycle = 360 / adjustedChange;
      // Clamp to reasonable range
      dominantCycle[i] = Math.max(4, Math.min(maxPeriod, cycle));
    }
  }

  // Smooth the dominant cycle
  const smoothedCycle = superSmoother(dominantCycle, 10);

  return {
    dominantCycle: smoothedCycle,
    phase,
    amplitude,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MESA ADAPTIVE MOVING AVERAGE (MAMA)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * MESA Adaptive Moving Average (MAMA).
 *
 * MAMA s'adapte automatiquement à la vitesse du marché:
 *  - Marché rapide/trending → MAMA suit rapidement (rapide)
 *  - Marché lent/ranging → MAMA est plus lente (filtre le bruit)
 *
 * Le degré d'adaptation est contrôlé par "fastLimit" et "slowLimit".
 *
 * @param series - Série de prix
 * @param fastLimit - Limite rapide (défaut 0.5)
 * @param slowLimit - Limite lente (défaut 0.05)
 * @returns { mama, fama, signal }
 */
export interface MAMAResult {
  mama: number[];              // MESA Adaptive Moving Average
  fama: number[];              // Following Adaptive Moving Average
  signal: ('BULL' | 'BEAR' | 'NEUTRAL')[];  // Signal de trading
}

export function MAMA(series: number[], fastLimit: number = 0.5, slowLimit: number = 0.05): MAMAResult {
  const n = series.length;
  const mama: number[] = new Array(n).fill(series[0]);
  const fama: number[] = new Array(n).fill(series[0]);
  const signal: ('BULL' | 'BEAR' | 'NEUTRAL')[] = new Array(n).fill('NEUTRAL');

  if (n < 10) {
    return { mama, fama, signal };
  }

  // Get dominant cycle using Hilbert transform
  const { dominantCycle } = hilbertTransformDC(series);

  // Calculate MAMA
  for (let i = 1; i < n; i++) {
    const period = dominantCycle[i];
    const normalizedPeriod = Math.max(4, Math.min(48, period));

    // Convert period to alpha (smoothing factor)
    // Shorter period = faster response
    const alpha = 2 / (normalizedPeriod + 1);

    // Adaptive scaling based on cycle phase
    const cyclePosition = (i % normalizedPeriod) / normalizedPeriod;
    const adaptiveAlpha = slowLimit + (fastLimit - slowLimit) * Math.abs(Math.sin(cyclePosition * Math.PI));

    // MAMA update
    mama[i] = adaptiveAlpha * series[i] + (1 - adaptiveAlpha) * mama[i - 1];

    // FAMA update (slower follower)
    fama[i] = 0.5 * adaptiveAlpha * mama[i] + (1 - 0.5 * adaptiveAlpha) * fama[i - 1];

    // Generate signal
    if (i > 5) {
      const mamaTrend = mama[i] - mama[i - 1];
      const famaTrend = fama[i] - fama[i - 1];

      if (mama[i] > fama[i] && mamaTrend > 0) {
        signal[i] = 'BULL';
      } else if (mama[i] < fama[i] && mamaTrend < 0) {
        signal[i] = 'BEAR';
      } else {
        signal[i] = 'NEUTRAL';
      }
    }
  }

  return { mama, fama, signal };
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLE MOMENTUM
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Cycle Momentum: Momentum adapté au cycle dominant.
 *
 * Contrairement au momentum classique (période fixe), le cycle momentum
 * adapte sa période de calcul en fonction du cycle détecté.
 *
 * @param series - Série de prix
 * @param dominantCycles - Cycles dominants (depuis Hilbert Transform)
 * @returns Indice de momentum adapté
 */
export function cycleMomentum(series: number[], dominantCycles: number[]): number[] {
  const n = series.length;
  const momentum: number[] = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const period = Math.round(dominantCycles[i]);
    const lookback = Math.max(1, Math.min(i, period));

    // Calculate momentum over adaptive lookback
    const currentPrice = series[i];
    const pastPrice = series[i - lookback];
    const mom = (currentPrice - pastPrice) / pastPrice;

    // Normalize by ATR-like volatility measure
    const atr = calculateLocalATR(series, i, Math.min(14, i));
    const normalizedMom = atr > 0 ? mom / atr : 0;

    momentum[i] = normalizedMom * 100;  // Scale to more readable values
  }

  return momentum;
}

/**
 * Calcule l'ATR local autour d'un index.
 */
function calculateLocalATR(series: number[], index: number, period: number): number {
  if (index < period + 1) return 0;

  let sumTR = 0;
  for (let i = index - period + 1; i <= index; i++) {
    const high = series[i];
    const low = series[i];
    const prevClose = series[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    sumTR += tr;
  }

  return sumTR / period;
}

// ─────────────────────────────────────────────────────────────────────────────
// STOCHASTIC RSI WITH SUPER SMOOTHER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Stochastic RSI lissé avec Super Smoother.
 *
 * Réduit les faux signaux par rapport au StochRSI classique grâce
 * au filtrage des hautes fréquences.
 *
 * @param series - Série de prix
 * @param rsiPeriod - Période RSI (défaut 14)
 * @param stochPeriod - Période Stochastique (défaut 14)
 * @returns { k, d } - Lignes %K et %D
 */
export interface StochRSIResult {
  k: number[];   // Fast Stochastic RSI
  d: number[];   // Smoothed %K (%D)
}

export function smoothedStochRSI(
  series: number[],
  rsiPeriod: number = 14,
  stochPeriod: number = 14
): StochRSIResult {
  const n = series.length;
  const k: number[] = new Array(n).fill(50);
  const d: number[] = new Array(n).fill(50);

  if (n < rsiPeriod + stochPeriod) {
    return { k, d };
  }

  // Calculate RSI
  const rsiValues = calculateRSI(series, rsiPeriod);

  // Calculate Stochastic RSI
  const rawK: number[] = [];
  for (let i = rsiPeriod; i < n; i++) {
    const rsiSlice = rsiValues.slice(i - stochPeriod, i);
    const maxRSI = Math.max(...rsiSlice);
    const minRSI = Math.min(...rsiSlice);

    if (maxRSI - minRSI > 0) {
      rawK.push(((rsiValues[i] - minRSI) / (maxRSI - minRSI)) * 100);
    } else {
      rawK.push(50);
    }
  }

  // Apply Super Smoother to reduce false signals
  const smoothedK = superSmoother(rawK, 5);
  const smoothedD = superSmoother(smoothedK, 3);

  // Pad with zeros to match original length
  const padLength = n - smoothedK.length;
  for (let i = 0; i < padLength; i++) {
    k[i] = 50;
    d[i] = 50;
  }
  for (let i = 0; i < smoothedK.length; i++) {
    k[padLength + i] = smoothedK[i];
    d[padLength + i] = smoothedD[i];
  }

  return { k, d };
}

/**
 * Calcule le RSI standard.
 */
function calculateRSI(series: number[], period: number): number[] {
  const n = series.length;
  const rsi: number[] = new Array(n).fill(50);

  if (n < period + 1) {
    return rsi;
  }

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < n; i++) {
    const change = series[i] - series[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First RSI value using SMA
  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  rsi[period] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

  // Subsequent RSI using Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    rsi[i + 1] = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
  }

  return rsi;
}

// ─────────────────────────────────────────────────────────────────────────────
// FISHER TRANSFORM
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fisher Transform.
 *
 * Normalise les prix en une distribution gaussienne (normale).
 * Utile pour générer des signaux de retournement précis aux extrêmes.
 *
 * Formule:
 *  y = 0.5 * ln((1 + x) / (1 - x))  où x est le prix normalisé à [-1, 1]
 *
 * Les signaux de trading:
 *  - Fisher > 1.96 → Surachat (signal SHORT potentiel)
 *  - Fisher < -1.96 → Survente (signal LONG potentiel)
 *
 * @param series - Série de prix
 * @param period - Période de lissage (défaut 10)
 * @returns { fisher, trigger } - Valeur Fisher et ligne trigger
 */
export interface FisherResult {
  fisher: number[];
  trigger: number[];
  signal: ('OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL')[];
}

export function fisherTransform(series: number[], period: number = 10): FisherResult {
  const n = series.length;
  const fisher: number[] = new Array(n).fill(0);
  const trigger: number[] = new Array(n).fill(0);
  const signal: ('OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL')[] = new Array(n).fill('NEUTRAL');

  if (n < period + 1) {
    return { fisher, trigger, signal };
  }

  // Normalize price to [-1, 1] range using median over period
  const maxLookback = period;

  for (let i = maxLookback; i < n; i++) {
    const slice = series.slice(i - maxLookback, i + 1);
    const minPrice = Math.min(...slice);
    const maxPrice = Math.max(...slice);
    const range = maxPrice - minPrice;

    let x = 0;
    if (range > 0) {
      x = ((series[i] - minPrice) / range) * 2 - 1;  // Map to [-1, 1]
    }

    // Clamp to avoid infinity
    x = Math.max(-0.999, Math.min(0.999, x));

    // Fisher transform
    const fisherValue = 0.5 * Math.log((1 + x) / (1 - x));
    fisher[i] = fisherValue;

    // Trigger line (previous value smoothed)
    trigger[i] = i > 0 ? 0.5 * fisherValue + 0.5 * fisher[i - 1] : fisherValue;

    // Generate signal
    if (fisherValue > 1.96) {
      signal[i] = 'OVERBOUGHT';
    } else if (fisherValue < -1.96) {
      signal[i] = 'OVERSOLD';
    } else {
      signal[i] = 'NEUTRAL';
    }
  }

  return { fisher, trigger, signal };
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATED SIGNAL GENERATION
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Génère un signal de trading combiné depuis les indicateurs Ehlers.
 *
 * Combine:
 *  - MAMA crossover
 *  - Cycle Momentum
 *  - Fisher Transform extrema
 *
 * @param series - Série de prix (close)
 * @returns Signal combiné
 */
export interface EhlersSignal {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: number;          // 0-100
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  components: {
    mama: 'BULL' | 'BEAR' | 'NEUTRAL';
    cycleMom: number;        // >0 bullish, <0 bearish
    fisher: 'OVERBOUGHT' | 'OVERSOLD' | 'NEUTRAL';
    dominantCycle: number;   // Période actuelle
  };
}

export function generateEhlersSignal(series: number[]): EhlersSignal {
  const n = series.length;
  if (n < 50) {
    return {
      direction: 'NEUTRAL',
      strength: 0,
      confidence: 'LOW',
      components: {
        mama: 'NEUTRAL',
        cycleMom: 0,
        fisher: 'NEUTRAL',
        dominantCycle: 24,
      },
    };
  }

  // Calculate components
  const { mama, fama, signal: mamaSignal } = MAMA(series);
  const { dominantCycle } = hilbertTransformDC(series);
  const cycleMom = cycleMomentum(series, dominantCycle);
  const { fisher, signal: fisherSignal } = fisherTransform(series);

  // Get latest values
  const i = n - 1;
  const latestMama = mamaSignal[i];
  const latestCycleMom = cycleMom[i];
  const latestFisher = fisherSignal[i];
  const latestCycle = dominantCycle[i];

  // Combine signals
  let bullScore = 0;
  let bearScore = 0;

  // MAMA component
  if (latestMama === 'BULL') bullScore += 0.4;
  else if (latestMama === 'BEAR') bearScore += 0.4;

  // Cycle Momentum component
  if (latestCycleMom > 2) bullScore += 0.3;
  else if (latestCycleMom > 0.5) bullScore += 0.15;
  else if (latestCycleMom < -2) bearScore += 0.3;
  else if (latestCycleMom < -0.5) bearScore += 0.15;

  // Fisher component (contrarian at extremes)
  if (latestFisher === 'OVERSOLD') bullScore += 0.3;
  else if (latestFisher === 'OVERBOUGHT') bearScore += 0.3;

  // Determine direction and strength
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  let strength = 0;
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH';

  if (bullScore > 0.6) {
    direction = 'LONG';
    strength = Math.min(100, Math.round(bullScore * 100));
  } else if (bearScore > 0.6) {
    direction = 'SHORT';
    strength = Math.min(100, Math.round(bearScore * 100));
  } else {
    direction = 'NEUTRAL';
    strength = Math.round(Math.abs(bullScore - bearScore) * 100);
  }

  // Confidence based on alignment
  if (strength >= 75) confidence = 'HIGH';
  else if (strength >= 50) confidence = 'MEDIUM';
  else confidence = 'LOW';

  return {
    direction,
    strength,
    confidence,
    components: {
      mama: latestMama,
      cycleMom: Math.round(latestCycleMom * 10) / 10,
      fisher: latestFisher,
      dominantCycle: Math.round(latestCycle),
    },
  };
}
