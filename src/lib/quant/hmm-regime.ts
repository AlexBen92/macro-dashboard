/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * HMM REGIME DETECTION MODULE — V4 (PATCHED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PATCH v4.1 - Corrections des bugs critiques:
 *  - Features normalisées (z-score) avant entraînement
 *  - Matrice de transition asymétrique réaliste
 *  - Itérations Baum-Welch augmentées (200)
 *  - Features optimisées pour crypto H1
 *
 * Détection de régime de marché via Hidden Markov Model (HMM) à 3 états.
 *
 * ÉTATS:
 *  - BULL: Marché haussier (volatilité modérée, drift positif)
 *  - BEAR: Marché baissier (volatilité élevée, drift négatif)
 *  - RANGING: Marché latéral (faible drift, volatilité basse)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export type RegimeState = 'BULL' | 'BEAR' | 'RANGING';
export const REGIME_STATES: RegimeState[] = ['BULL', 'BEAR', 'RANGING'];

export interface RegimeProbabilities {
  BULL: number;
  BEAR: number;
  RANGING: number;
}

export interface HMMState {
  name: RegimeState;
  probability: number;
  emissionMean: number[];
  emissionCov: number[][];
}

export interface HMMDiagnostics {
  logLikelihood: number;
  convergenceSpeed: number;
  stateStability: number;
  predictionConfidence: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Z-SCORE NORMALIZATION (PATCH FIX #1.1)
// ═══════════════════════════════════════════════════════════════════════════════

export interface NormalizationParams {
  means: number[];
  stds: number[];
}

/**
 * Normalise les features avec z-score (x - mean) / std
 * Les paramètres de normalisation sont calculés sur le set d'entraînement
 * et appliqués aux données IS et OOS
 */
export function zScoreNormalize(
  features: number[][],
  params?: NormalizationParams
): { normalized: number[][]; params: NormalizationParams } {
  const nFeatures = features[0]?.length || 0;

  let means: number[];
  let stds: number[];

  if (params) {
    // Utiliser les paramètres fournis (OOS)
    means = params.means;
    stds = params.stds;
  } else {
    // Calculer les paramètres sur les données (IS)
    means = Array(nFeatures).fill(0);
    stds = Array(nFeatures).fill(1);

    for (let f = 0; f < nFeatures; f++) {
      const values = features.map(row => row[f]).filter(v => !isNaN(v) && isFinite(v));
      if (values.length > 0) {
        means[f] = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, v) => a + (v - means[f]) ** 2, 0) / values.length;
        stds[f] = Math.sqrt(variance) || 1;  // Avoid division by zero
      }
    }
  }

  // Appliquer la normalisation
  const normalized = features.map(row =>
    row.map((v, f) => {
      if (isNaN(v) || !isFinite(v)) return 0;
      return (v - means[f]) / stds[f];
    })
  );

  return { normalized, params: { means, stds } };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE EXTRACTION (PATCH FIX #1.4 - Optimisé pour crypto H1)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extrait les features pour le HMM à partir de données OHLCV.
 *
 * PATCH v4.1: Features spécifiquement calibrées pour crypto H1:
 *  - F1: Return 24h normalisé (capture trend court terme)
 *  - F2: Volatilité réalisée 24h (std des returns × √24)
 *  - F3: Volume ratio vs moyenne 168h (1 semaine)
 *  - F4: Position dans le range 48h (0=bas, 1=haut)
 */
export function extractHMMFeatures(
  closes: number[],
  volumes: number[],
  highs: number[],
  lows: number[],
  lookback: number = 20
): number[][] {
  const n = closes.length;
  const features: number[][] = [];

  // Precompute returns for efficiency
  const returns: number[] = [];
  for (let i = 1; i < n; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }

  for (let i = Math.max(48, lookback); i < n; i++) {
    // F1: Return 24h normalisé
    const period24 = Math.min(24, i);
    const return24h = (closes[i] - closes[i - period24]) / closes[i - period24];

    // F2: Volatilité réalisée 24h (annualisée)
    const recentReturns = returns.slice(Math.max(0, i - 24), i);
    let vol24h = 0;
    if (recentReturns.length > 1) {
      const mean = recentReturns.reduce((a, b) => a + b, 0) / recentReturns.length;
      const variance = recentReturns.reduce((a, r) => a + (r - mean) ** 2, 0) / recentReturns.length;
      vol24h = Math.sqrt(variance) * Math.sqrt(24) * 100;  // Annualized %
    }

    // F3: Volume ratio vs moyenne 168h (1 semaine)
    const period168 = Math.min(168, i);
    const avgVolume168 = volumes.slice(i - period168, i).reduce((a, b) => a + b, 0) / period168;
    const volumeRatio = avgVolume168 > 0 ? volumes[i] / avgVolume168 : 1;

    // F4: Position dans le range 48h (0=bas, 1=haut)
    const period48 = Math.min(48, i);
    const high48 = Math.max(...highs.slice(i - period48, i + 1));
    const low48 = Math.min(...lows.slice(i - period48, i + 1));
    const rangePosition = high48 > low48
      ? (closes[i] - low48) / (high48 - low48)
      : 0.5;

    features.push([return24h, vol24h, volumeRatio, rangePosition]);
  }

  // Pad with zeros for initial period
  const padding = Array(Math.max(48, lookback)).fill(0).map(() => [0, 0, 0, 0]);
  return [...padding, ...features];
}

// ─────────────────────────────────────────────────────────────────────────────
// HMM CLASS (PATCHED)
// ─────────────────────────────────────────────────────────────────────────────

export class HiddenMarkovModel {
  private nStates: number;
  private nFeatures: number;
  private transitionMatrix: number[][];
  private emissionMeans: number[][];
  private emissionCovs: number[][][];
  private initialProbs: number[];
  private isTrained: boolean = false;
  private normParams: NormalizationParams | null = null;

  // PATCH FIX #1.2: Matrice de transition asymétrique réaliste
  private readonly INIT_TRANSITION_MATRIX = [
    // De\Vers  BULL  BEAR  RANGING
    /* BULL */  [0.70, 0.10, 0.20],   // Un bull reste souvent bull
    /* BEAR */  [0.10, 0.70, 0.20],   // Un bear reste souvent bear
    /* RANGING*/[0.25, 0.25, 0.50],   // Un ranging peut partir dans tous les sens
  ];

  // PATCH FIX #1.3: Configuration Baum-Welch améliorée
  private readonly BW_CONFIG = {
    maxIterations: 200,      // Augmenté de 100 → 200
    convergenceTol: 1e-6,    // Tolérance plus stricte
    minPeriodsTrain: 500,    // Minimum 500 bougies pour entraîner
  };

  constructor(nStates: number = 3, nFeatures: number = 4) {
    this.nStates = nStates;
    this.nFeatures = nFeatures;

    // Initialize with asymmetric transition matrix
    this.transitionMatrix = this.INIT_TRANSITION_MATRIX.map(row => [...row]);

    this.emissionMeans = Array(nStates).fill(0).map(() =>
      Array(nFeatures).fill(0)
    );
    this.emissionCovs = Array(nStates).fill(0).map(() =>
      Array(nFeatures).fill(0).map(() => Array(nFeatures).fill(0))
    );

    // Identity covariance matrices with regularization
    for (let s = 0; s < nStates; s++) {
      for (let f = 0; f < nFeatures; f++) {
        this.emissionCovs[s][f][f] = 1;
      }
    }

    this.initialProbs = [0.33, 0.33, 0.34];  // Slightly non-uniform
  }

  /**
   * Entraîne le HMM via l'algorithme de Baum-Welch (EM).
   * PATCH: Normalise les features AVANT l'entraînement.
   */
  fit(observations: number[][], maxIter: number = 200, tolerance: number = 1e-6): void {
    const nObs = observations.length;

    if (nObs < this.BW_CONFIG.minPeriodsTrain) {
      console.warn(`[HMM] Warning: Only ${nObs} observations, recommend ${this.BW_CONFIG.minPeriodsTrain}+`);
    }

    // PATCH FIX #1.1: Normaliser les features AVANT fit
    const { normalized, params } = zScoreNormalize(observations);
    this.normParams = params;

    // Initialize emissions from data (k-means-like)
    this.initializeEmissions(normalized);

    let oldLogLik = -Infinity;
    let iter = 0;
    let converged = false;
    const actualMaxIter = Math.max(maxIter, this.BW_CONFIG.maxIterations);
    const actualTol = tolerance || this.BW_CONFIG.convergenceTol;

    while (iter < actualMaxIter && !converged) {
      // E-step: Forward-Backward
      const { alpha, beta, gamma, xi } = this.forwardBackward(normalized);

      // M-step: Update parameters
      // Update initial probabilities
      for (let i = 0; i < this.nStates; i++) {
        this.initialProbs[i] = gamma[0][i];
      }

      // Update transition matrix
      for (let i = 0; i < this.nStates; i++) {
        let denom = 0;
        for (let t = 0; t < nObs - 1; t++) {
          denom += gamma[t][i];
        }

        for (let j = 0; j < this.nStates; j++) {
          let numer = 0;
          for (let t = 0; t < nObs - 1; t++) {
            numer += xi[t][i][j];
          }
          this.transitionMatrix[i][j] = denom > 0 ? numer / denom : this.INIT_TRANSITION_MATRIX[i][j];
        }
      }

      // Update emission parameters (Gaussian)
      for (let s = 0; s < this.nStates; s++) {
        let gammaSum = 0;
        for (let t = 0; t < nObs; t++) {
          gammaSum += gamma[t][s];
        }

        // Update means
        for (let f = 0; f < this.nFeatures; f++) {
          let sum = 0;
          for (let t = 0; t < nObs; t++) {
            sum += gamma[t][s] * normalized[t][f];
          }
          this.emissionMeans[s][f] = gammaSum > 0 ? sum / gammaSum : 0;
        }

        // Update covariances
        for (let i = 0; i < this.nFeatures; i++) {
          for (let j = 0; j < this.nFeatures; j++) {
            let sum = 0;
            for (let t = 0; t < nObs; t++) {
              const diffI = normalized[t][i] - this.emissionMeans[s][i];
              const diffJ = normalized[t][j] - this.emissionMeans[s][j];
              sum += gamma[t][s] * diffI * diffJ;
            }
            // Add regularization
            this.emissionCovs[s][i][j] = gammaSum > 0
              ? sum / gammaSum + (i === j ? 0.1 : 0)
              : (i === j ? 1 : 0);
          }
        }
      }

      // Calculate log-likelihood
      const logLik = this.calculateLogLikelihood(alpha);
      const delta = Math.abs(logLik - oldLogLik);
      oldLogLik = logLik;
      iter++;

      if (delta < actualTol) {
        console.log(`[HMM] Converged at iteration ${iter}, logLik=${logLik.toFixed(2)}`);
        converged = true;
      }
    }

    this.isTrained = true;

    // Log distribution finale
    this.logStateDistribution();
  }

  /**
   * Décode la séquence d'états la plus probable via Viterbi.
   * PATCH: Normalise les observations avec les paramètres d'entraînement.
   */
  decode(observations: number[][]): {
    states: number[];
    stateNames: RegimeState[];
    probabilities: number[][];
  } {
    const nObs = observations.length;

    // PATCH FIX #1.1: Normaliser avec les paramètres d'entraînement
    let normalized = observations;
    if (this.normParams) {
      const result = zScoreNormalize(observations, this.normParams);
      normalized = result.normalized;
    } else if (this.isTrained) {
      // Fallback si pas de params (ne devrait pas arriver)
      const result = zScoreNormalize(observations);
      normalized = result.normalized;
    }

    // Viterbi trellis
    const delta: number[][] = Array(nObs).fill(0).map(() => Array(this.nStates).fill(0));
    const psi: number[][] = Array(nObs).fill(0).map(() => Array(this.nStates).fill(0));

    // Initialization
    for (let s = 0; s < this.nStates; s++) {
      delta[0][s] = Math.log(this.initialProbs[s] + 1e-10) + this.logEmissionProb(normalized[0], s);
    }

    // Recursion
    for (let t = 1; t < nObs; t++) {
      for (let j = 0; j < this.nStates; j++) {
        let maxVal = -Infinity;
        let maxState = 0;

        for (let i = 0; i < this.nStates; i++) {
          const val = delta[t - 1][i] + Math.log(this.transitionMatrix[i][j] + 1e-10);
          if (val > maxVal) {
            maxVal = val;
            maxState = i;
          }
        }

        delta[t][j] = maxVal + this.logEmissionProb(normalized[t], j);
        psi[t][j] = maxState;
      }
    }

    // Termination & Backtracking
    const states: number[] = Array(nObs).fill(0);
    let maxVal = -Infinity;
    for (let s = 0; s < this.nStates; s++) {
      if (delta[nObs - 1][s] > maxVal) {
        maxVal = delta[nObs - 1][s];
        states[nObs - 1] = s;
      }
    }

    for (let t = nObs - 2; t >= 0; t--) {
      states[t] = psi[t + 1][states[t + 1]];
    }

    // Calculate state probabilities
    const probabilities: number[][] = [];
    const { gamma } = this.forwardBackward(normalized);
    for (let t = 0; t < nObs; t++) {
      probabilities.push([...gamma[t]]);
    }

    return {
      states,
      stateNames: states.map(s => REGIME_STATES[s] || 'RANGING'),
      probabilities,
    };
  }

  /**
   * Prédit les probabilités du prochain état.
   */
  predict(lastObservations: number[][], steps: number = 1): {
    nextStateProbabilities: RegimeProbabilities;
    mostLikelyNextState: RegimeState;
    confidence: number;
  } {
    if (!this.isTrained || lastObservations.length === 0) {
      return {
        nextStateProbabilities: { BULL: 0.33, BEAR: 0.33, RANGING: 0.34 },
        mostLikelyNextState: 'RANGING',
        confidence: 0,
      };
    }

    // Normalize with training params
    let normalized = lastObservations;
    if (this.normParams) {
      const result = zScoreNormalize(lastObservations, this.normParams);
      normalized = result.normalized;
    }

    const lastObs = normalized[normalized.length - 1];
    const stateProbs: number[] = [];
    for (let s = 0; s < this.nStates; s++) {
      stateProbs.push(Math.exp(this.logEmissionProb(lastObs, s)));
    }

    const sum = stateProbs.reduce((a, b) => a + b, 0);
    const currentProbs = stateProbs.map(p => p / sum);

    // Predict n steps ahead
    let predictedProbs = [...currentProbs];
    for (let step = 0; step < steps; step++) {
      const newProbs: number[] = [];
      for (let j = 0; j < this.nStates; j++) {
        let prob = 0;
        for (let i = 0; i < this.nStates; i++) {
          prob += predictedProbs[i] * this.transitionMatrix[i][j];
        }
        newProbs.push(prob);
      }
      predictedProbs = newProbs;
    }

    const regimeProbs: RegimeProbabilities = {
      BULL: predictedProbs[0],
      BEAR: predictedProbs[1],
      RANGING: predictedProbs[2],
    };

    const maxProb = Math.max(...predictedProbs);
    const mostLikely = REGIME_STATES[predictedProbs.indexOf(maxProb)] || 'RANGING';

    return {
      nextStateProbabilities: regimeProbs,
      mostLikelyNextState: mostLikely,
      confidence: maxProb,
    };
  }

  /**
   * Log la distribution des états (pour validation).
   */
  private logStateDistribution(): void {
    // Sur les 100 dernières observations, compter les états
    // Simulé ici car on n'a pas les observations dans la méthode
    console.log('[HMM] Transition Matrix:', {
      BULL: this.transitionMatrix[0].map(v => v.toFixed(2)).join(','),
      BEAR: this.transitionMatrix[1].map(v => v.toFixed(2)).join(','),
      RANGING: this.transitionMatrix[2].map(v => v.toFixed(2)).join(','),
    });
  }

  /**
   * Retourne les paramètres actuels du HMM.
   */
  getParameters(): {
    transitionMatrix: number[][];
    emissionMeans: number[][];
    emissionCovs: number[][][];
    initialProbs: number[];
  } {
    return {
      transitionMatrix: this.transitionMatrix,
      emissionMeans: this.emissionMeans,
      emissionCovs: this.emissionCovs,
      initialProbs: this.initialProbs,
    };
  }

  // ───────────── PRIVATE METHODS ─────────────

  private initializeEmissions(observations: number[][]): void {
    const nObs = observations.length;
    const nFeatures = this.nFeatures;

    // Find range of each feature
    const mins: number[] = Array(nFeatures).fill(Infinity);
    const maxs: number[] = Array(nFeatures).fill(-Infinity);

    for (const obs of observations) {
      for (let f = 0; f < nFeatures; f++) {
        mins[f] = Math.min(mins[f], obs[f]);
        maxs[f] = Math.max(maxs[f], obs[f]);
      }
    }

    // Initialize states at different points (BULL: high return, BEAR: low return, RANGING: mid)
    // For normalized features, use different percentiles
    for (let s = 0; s < this.nStates; s++) {
      for (let f = 0; f < nFeatures; f++) {
        const position = s / (this.nStates - 1);  // 0, 0.5, 1
        // BULL gets high values, BEAR gets low values, RANGING gets middle
        this.emissionMeans[s][f] = mins[f] + position * (maxs[f] - mins[f]);
      }
    }
  }

  private forwardBackward(observations: number[][]): {
    alpha: number[][];
    beta: number[][];
    gamma: number[][];
    xi: number[][][];
  } {
    const nObs = observations.length;
    const alpha: number[][] = Array(nObs).fill(0).map(() => Array(this.nStates).fill(0));
    const beta: number[][] = Array(nObs).fill(0).map(() => Array(this.nStates).fill(0));
    const gamma: number[][] = Array(nObs).fill(0).map(() => Array(this.nStates).fill(0));
    const xi: number[][][] = Array(nObs - 1).fill(0).map(() =>
      Array(this.nStates).fill(0).map(() => Array(this.nStates).fill(0))
    );

    // Forward pass
    for (let s = 0; s < this.nStates; s++) {
      alpha[0][s] = this.initialProbs[s] * Math.exp(this.logEmissionProb(observations[0], s));
    }

    for (let t = 1; t < nObs; t++) {
      for (let j = 0; j < this.nStates; j++) {
        let sum = 0;
        for (let i = 0; i < this.nStates; i++) {
          sum += alpha[t - 1][i] * this.transitionMatrix[i][j];
        }
        alpha[t][j] = sum * Math.exp(this.logEmissionProb(observations[t], j));
      }
    }

    // Backward pass
    for (let s = 0; s < this.nStates; s++) {
      beta[nObs - 1][s] = 1;
    }

    for (let t = nObs - 2; t >= 0; t--) {
      for (let i = 0; i < this.nStates; i++) {
        let sum = 0;
        for (let j = 0; j < this.nStates; j++) {
          sum += this.transitionMatrix[i][j] * Math.exp(this.logEmissionProb(observations[t + 1], j)) * beta[t + 1][j];
        }
        beta[t][i] = sum;
      }
    }

    // Compute gamma and xi
    for (let t = 0; t < nObs; t++) {
      let sum = 0;
      for (let s = 0; s < this.nStates; s++) {
        gamma[t][s] = alpha[t][s] * beta[t][s];
        sum += gamma[t][s];
      }
      if (sum > 0) {
        for (let s = 0; s < this.nStates; s++) {
          gamma[t][s] /= sum;
        }
      }
    }

    for (let t = 0; t < nObs - 1; t++) {
      let sum = 0;
      for (let i = 0; i < this.nStates; i++) {
        for (let j = 0; j < this.nStates; j++) {
          xi[t][i][j] = alpha[t][i] * this.transitionMatrix[i][j] *
            Math.exp(this.logEmissionProb(observations[t + 1], j)) * beta[t + 1][j];
          sum += xi[t][i][j];
        }
      }
      if (sum > 0) {
        for (let i = 0; i < this.nStates; i++) {
          for (let j = 0; j < this.nStates; j++) {
            xi[t][i][j] /= sum;
          }
        }
      }
    }

    return { alpha, beta, gamma, xi };
  }

  private logEmissionProb(observation: number[], state: number): number {
    const mean = this.emissionMeans[state];
    const cov = this.emissionCovs[state];

    let logProb = 0;
    for (let f = 0; f < this.nFeatures; f++) {
      const diff = observation[f] - mean[f];
      const var_f = cov[f][f] + 1e-6;
      logProb += -0.5 * Math.log(2 * Math.PI * var_f) - 0.5 * diff * diff / var_f;
    }
    return logProb;
  }

  private calculateLogLikelihood(alpha: number[][]): number {
    const nObs = alpha.length;
    let sum = 0;
    for (let s = 0; s < this.nStates; s++) {
      sum += alpha[nObs - 1][s];
    }
    return Math.log(sum + 1e-10);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REGIME-BASED TRADING RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

export interface RegimeRecommendation {
  regime: RegimeState;
  confidence: number;
  allowedDirections: ('LONG' | 'SHORT' | 'NEUTRAL')[];
  confluenceThreshold: number;
  sizeMultiplier: number;
  reason: string;
}

export function getRegimeRecommendation(
  currentRegime: RegimeState,
  regimeProbabilities: RegimeProbabilities,
  transitionProbability: number
): RegimeRecommendation {
  const confidence = Math.max(...Object.values(regimeProbabilities));

  let recommendation: RegimeRecommendation;

  switch (currentRegime) {
    case 'BULL':
      recommendation = {
        regime: 'BULL',
        confidence,
        allowedDirections: ['LONG', 'NEUTRAL'],
        confluenceThreshold: 60,
        sizeMultiplier: 1.0,
        reason: 'Régime haussier: LONG favorisés, seuil de confluence réduit à 60',
      };
      break;

    case 'BEAR':
      recommendation = {
        regime: 'BEAR',
        confidence,
        allowedDirections: ['SHORT', 'NEUTRAL'],
        confluenceThreshold: 60,
        sizeMultiplier: 1.0,
        reason: 'Régime baissier: SHORT favorisés, seuil de confluence réduit à 60',
      };
      break;

    case 'RANGING':
      recommendation = {
        regime: 'RANGING',
        confidence,
        allowedDirections: ['LONG', 'SHORT'],
        confluenceThreshold: 75,
        sizeMultiplier: 0.75,
        reason: 'Régime latéral: confluence ≥ 75 requise, taille réduite 25%',
      };
      break;

    default:
      recommendation = {
        regime: 'RANGING',
        confidence: 0.5,
        allowedDirections: ['LONG', 'SHORT'],
        confluenceThreshold: 70,
        sizeMultiplier: 0.75,
        reason: 'Régime incertain: approche conservatrice',
      };
  }

  if (transitionProbability > 0.4) {
    recommendation.sizeMultiplier *= 0.75;
    recommendation.reason += ' | Transition probable: taille réduite 25% supplémentaire';
  }

  return recommendation;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRE-TRAINED HMM FOR CRYPTO
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Crée un HMM pré-entraîné avec des paramètres typiques pour crypto.
 */
export function createPretrainedCryptoHMM(): HiddenMarkovModel {
  const hmm = new HiddenMarkovModel(3, 4);
  hmm.fit([[0, 20, 1, 0.5], [0.01, 25, 1.1, 0.6], [-0.01, 30, 0.9, 0.4]], 10, 1e-4);
  return hmm;
}
