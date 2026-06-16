/**
 * GARCH VOLATILITY REGIME ENGINE
 *
 * Modèle GARCH(1,1) pour estimation de volatilité conditionnelle
 * Références:
 * - Engle (1982) ARCH modeling
 * - Bollerslev (1986) GARCH extension
 * - Realized Volatility: Andersen, Bollerslev, Diebold (2003)
 *
 * Métriques calculées:
 * - sigma2_next: variance conditionnelle à t+1
 * - phi: persistance (α + β)
 * - sigma2_inf: variance long terme
 * - vol_ratio: ratio vol actuelle / vol long terme
 * - sigma2_h: projection multi-horizons
 *
 * Usage pour scalping:
 * - Filtrage des trades selon régime volatilité
 * - Ajustement sizing dynamique
 * - Calcul stops adaptatifs
 * - Timeout intelligent
 */

export interface GARCHParams {
  omega: number;    // constante (baseline vol)
  alpha: number;    // coefficient réaction aux chocs (0 < alpha < 1)
  beta: number;     // coefficient persistance (0 < beta < 1)
  nu?: number;      // degrés de liberté Student-t (queues épaisses)
}

export interface GARCHState {
  sigma2: number;   // variance conditionnelle courante
  lastReturn: number; // dernier return observé
  lastSigma2: number; // variance précédente
  n: number;        // nombre d'observations
}

export interface GARCHForecast {
  // One-step ahead
  sigma2_next: number;
  sigma_next: number;

  // Persistence
  phi: number;
  persistence: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

  // Long term
  sigma2_inf: number;
  sigma_inf: number;

  // Vol ratio (compression/surchauffe)
  vol_ratio: number;
  regime: 'COMPRESSED' | 'NORMAL' | 'ELEVATED' | 'EXPLOSIVE';

  // Multi-horizon projections (1, 5, 15, 60 minutes)
  sigma2_1m: number;
  sigma2_5m: number;
  sigma2_15m: number;
  sigma2_1h: number;

  // Risk metrics
  tail_risk: number;  // probabilité de move extrême
  max_move_95: number; // move attendu à 95%

  // Trading recommendations
  size_multiplier: number;
  stop_multiplier: number;
  timeout_adjustment: number;
  allowed_styles: ('TREND' | 'MEANREV' | 'SCALP' | 'NONE')[];
}

export interface GARCHInput {
  return: number;    // return (log ou pct)
  timestamp: number;
}

const DEFAULT_PARAMS: GARCHParams = {
  omega: 0.00001,
  alpha: 0.08,
  beta: 0.9,
  nu: 5,  // Student-t avec queues épaisses
};

const REGIME_THRESHOLDS = {
  COMPRESSED: { min: 0, max: 0.7 },      // vol faible → breakout possible
  NORMAL: { min: 0.7, max: 1.3 },       // vol normale
  ELEVATED: { min: 1.3, max: 2.0 },     // vol élevée → réduire taille
  EXPLOSIVE: { min: 2.0, max: Infinity }, // vol explosive → no-trade
};

export class GARCHEngine {
  private params: GARCHParams;
  private state: GARCHState;
  private history: GARCHInput[] = [];
  private readonly MAX_HISTORY = 1000;

  constructor(params?: Partial<GARCHParams>) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.state = {
      sigma2: this.params.omega / (1 - this.params.alpha - this.params.beta),
      lastReturn: 0,
      lastSigma2: this.params.omega / (1 - this.params.alpha - this.params.beta),
      n: 0,
    };
  }

  /**
   * Met à jour le modèle avec un nouveau return
   * Formule GARCH(1,1):
   * σ²_t = ω + α·ε²_{t-1} + β·σ²_{t-1}
   */
  update(return_pct: number): void {
    const epsilon2 = return_pct * return_pct;

    // GARCH update
    const newSigma2 = this.params.omega +
                      this.params.alpha * epsilon2 +
                      this.params.beta * this.state.sigma2;

    // Stability check
    this.state.sigma2 = Math.max(newSigma2, 1e-10);
    this.state.lastReturn = return_pct;
    this.state.lastSigma2 = this.state.sigma2;
    this.state.n++;

    this.history.push({ return: return_pct, timestamp: Date.now() });
    if (this.history.length > this.MAX_HISTORY) {
      this.history.shift();
    }
  }

  /**
   * Calcule toutes les métriques GARCH
   */
  forecast(): GARCHForecast {
    const { omega, alpha, beta, nu } = this.params;
    const sigma2 = this.state.sigma2;

    // One-step ahead
    const sigma2_next = omega + alpha * Math.pow(this.state.lastReturn, 2) + beta * sigma2;
    const sigma_next = Math.sqrt(Math.max(sigma2_next, 0));

    // Persistence
    const phi = alpha + beta;
    let persistence: GARCHForecast['persistence'];
    if (phi < 0.85) persistence = 'LOW';
    else if (phi < 0.94) persistence = 'MODERATE';
    else if (phi < 0.98) persistence = 'HIGH';
    else persistence = 'EXTREME';

    // Long term variance
    const sigma2_inf = omega / (1 - phi);
    const sigma_inf = Math.sqrt(Math.max(sigma2_inf, 0));

    // Vol ratio
    const vol_ratio = sigma2_next / Math.max(sigma2_inf, 1e-10);
    let regime: GARCHForecast['regime'];
    if (vol_ratio < REGIME_THRESHOLDS.COMPRESSED.max) regime = 'COMPRESSED';
    else if (vol_ratio < REGIME_THRESHOLDS.NORMAL.max) regime = 'NORMAL';
    else if (vol_ratio < REGIME_THRESHOLDS.ELEVATED.max) regime = 'ELEVATED';
    else regime = 'EXPLOSIVE';

    // Multi-horizon projections
    const sigma2_1m = this.projectHorizon(1);
    const sigma2_5m = this.projectHorizon(5);
    const sigma2_15m = this.projectHorizon(15);
    const sigma2_1h = this.projectHorizon(60);

    // Tail risk (Student-t si nu défini)
    const tail_risk = nu ? this.computeTailRisk(sigma_next, nu) : 0.05;
    const max_move_95 = sigma_next * 1.96;

    // Trading adjustments based on regime
    const { size_multiplier, stop_multiplier, timeout_adjustment, allowed_styles } =
      this.computeTradingAdjustments(regime, phi, vol_ratio);

    return {
      sigma2_next,
      sigma_next,
      phi,
      persistence,
      sigma2_inf,
      sigma_inf,
      vol_ratio,
      regime,
      sigma2_1m,
      sigma2_5m,
      sigma2_15m,
      sigma2_1h,
      tail_risk,
      max_move_95,
      size_multiplier,
      stop_multiplier,
      timeout_adjustment,
      allowed_styles,
    };
  }

  /**
   * Projection multi-horizon
   * σ²_{t+h} = σ²_inf + φ^h · (σ²_t - σ²_inf)
   */
  private projectHorizon(steps: number): number {
    const { omega, alpha, beta } = this.params;
    const phi = alpha + beta;
    const sigma2_inf = omega / (1 - phi);
    const convergence = Math.pow(phi, steps);
    return sigma2_inf + convergence * (this.state.sigma2 - sigma2_inf);
  }

  /**
   * Calcule le risque de queue (Student-t)
   */
  private computeTailRisk(sigma: number, nu: number): number {
    // Approximation Student-t pour prob d'extrêmes
    // Plus nu est faible, plus les queues sont épaisses
    if (nu <= 2) return 0.15; // queues très épaisses
    if (nu <= 4) return 0.10;
    if (nu <= 6) return 0.05;
    return 0.025; // proche de normale
  }

  /**
   * Calcule les ajustements trading selon le régime
   */
  private computeTradingAdjustments(
    regime: GARCHForecast['regime'],
    phi: number,
    vol_ratio: number
  ): Pick<GARCHForecast, 'size_multiplier' | 'stop_multiplier' | 'timeout_adjustment' | 'allowed_styles'> {
    let size_multiplier = 1.0;
    let stop_multiplier = 1.0;
    let timeout_adjustment = 1.0;
    let allowed_styles: GARCHForecast['allowed_styles'] = ['TREND', 'MEANREV', 'SCALP'];

    switch (regime) {
      case 'COMPRESSED':
        // Vol faible → attention breakout
        size_multiplier = 1.2;
        stop_multiplier = 0.8; // stops plus serrés
        timeout_adjustment = 1.5; // attendre plus longtemps
        allowed_styles = ['TREND', 'SCALP']; // privilégier breakout
        break;

      case 'NORMAL':
        // Vol normale → trading standard
        size_multiplier = 1.0;
        stop_multiplier = 1.0;
        timeout_adjustment = 1.0;
        allowed_styles = ['TREND', 'MEANREV', 'SCALP'];
        break;

      case 'ELEVATED':
        // Vol élevée → réduire taille
        size_multiplier = 0.6;
        stop_multiplier = 1.4; // stops plus larges
        timeout_adjustment = 0.7; // réduire temps en position
        allowed_styles = ['SCALP', 'MEANREV']; // éviter trend following
        break;

      case 'EXPLOSIVE':
        // Vol explosive → no-trade ou taille min
        size_multiplier = 0.2;
        stop_multiplier = 2.0;
        timeout_adjustment = 0.3; // très court
        allowed_styles = ['NONE']; // no-trade preferred
        break;
    }

    // Ajustement additionnel selon persistance
    if (phi > 0.97) {
      // Forte persistance → plus de prudence après chocs
      stop_multiplier *= 1.2;
    }

    // Ajustement selon vol_ratio extrême
    if (vol_ratio > 2.5) {
      size_multiplier *= 0.5;
    }

    return { size_multiplier, stop_multiplier, timeout_adjustment, allowed_styles };
  }

  /**
   * Estimate MLE des paramètres GARCH depuis l'historique
   */
  estimateParams(): GARCHParams {
    if (this.history.length < 50) {
      return this.params; // Pas assez de données
    }

    // Estimation simple par moments
    const returns = this.history.map(h => h.return);
    const variance = returns.reduce((sum, r) => sum + r * r, 0) / returns.length;
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    // Alpha approximé par autocorrélation des carrés
    const n = returns.length;
    let acfSquared = 0;
    for (let k = 1; k <= Math.min(10, n - 1); k++) {
      let cov = 0;
      for (let i = k; i < n; i++) {
        cov += (returns[i] * returns[i] - variance) * (returns[i - k] * returns[i - k] - variance);
      }
      acfSquared += cov / (n * variance);
    }

    // Paramètres estimés (simplifiés)
    const alpha = Math.max(0.01, Math.min(0.3, acfSquared / 10));
    const beta = Math.max(0.5, Math.min(0.98, 0.9 - alpha));
    const omega = variance * (1 - alpha - beta);

    return { omega, alpha, beta, nu: 5 };
  }

  /**
   * Reset le modèle
   */
  reset(): void {
    this.state = {
      sigma2: this.params.omega / (1 - this.params.alpha - this.params.beta),
      lastReturn: 0,
      lastSigma2: this.params.omega / (1 - this.params.alpha - this.params.beta),
      n: 0,
    };
    this.history = [];
  }

  /**
   * Get current state
   */
  getState(): GARCHState {
    return { ...this.state };
  }

  /**
   * Get parameters
   */
  getParams(): GARCHParams {
    return { ...this.params };
  }

  /**
   * Set parameters
   */
  setParams(params: Partial<GARCHParams>): void {
    this.params = { ...this.params, ...params };
  }
}

// ─── SINGLETON REGISTRY PER ASSET ───────────────────────────────────────────

const engines: Record<string, GARCHEngine> = {};

export function getGARCHEngine(asset: string, params?: Partial<GARCHParams>): GARCHEngine {
  if (!engines[asset]) {
    engines[asset] = new GARCHEngine(params);
  }
  return engines[asset];
}

export function resetGARCHEngine(asset: string): void {
  if (engines[asset]) {
    engines[asset].reset();
  }
}

export function getAllGARCHEngines(): Record<string, GARCHEngine> {
  return engines;
}
