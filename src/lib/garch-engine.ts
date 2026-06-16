// lib/garch-engine.ts
// GARCH(1,1) Volatility Engine for scalping regime detection
// σ²_{t+1} = ω + α·ε²_t + β·σ²_t
// Reference: Bollerslev (1986), Hansen & Lunde (2005), Realized GARCH

export interface GARCHParams {
  omega: number;  // ω — long-run variance weight
  alpha: number;  // α — ARCH term (reaction to shocks)
  beta: number;   // β — GARCH term (persistence)
  nu: number;     // ν — Student-t degrees of freedom (fat tails, >2)
}

// Default params calibrated for crypto scalping (high persistence)
// Fine-tune per asset once live data accumulates
const DEFAULT_PARAMS: GARCHParams = {
  omega: 0.000001,  // small: long-run vol ~0.1% per tick
  alpha: 0.08,      // react moderately to shocks
  beta:  0.90,      // high persistence (typical crypto)
  nu:    5.0,       // fat tails (lower = heavier tails),
};

export interface GARCHOutput {
  sigma2_next: number;   // one-step-ahead conditional variance
  sigma2_inf:  number;   // unconditional (long-run) variance = ω/(1-α-β)
  phi:         number;   // persistence = α+β (0..1)
  vol_ratio:   number;   // sigma2_next / sigma2_inf — key regime signal
  sigma2_h: {            // multi-horizon projections
    s1: number;          // 1 step  (~500ms)
    s5: number;          // 5 steps (~2.5s)
    s10: number;         // 10 steps (~5s)
    s20: number;         // 20 steps (~10s)
  };
  nu:          number;   // fat-tail parameter
  regime:      GARCHRegime;
  regimeLabel: string;
  // Risk management outputs
  stop_bps:      number;  // dynamic stop in bps based on vol
  timeout_ms:    number;  // max hold time in ms
  size_mult:     number;  // position size multiplier (0..1)
  allowed_style: ScalpStyle;
}

export type GARCHRegime =
  | 'COMPRESSED'   // vol_ratio < 0.7  — watch for expansion
  | 'NORMAL'       // vol_ratio 0.7–1.3 — standard scalp
  | 'ELEVATED'     // vol_ratio 1.3–2.0 — reduce size
  | 'EXPLOSIVE';   // vol_ratio > 2.0  — no trade

export type ScalpStyle =
  | 'TREND'        // directional scalp, OFI aligned
  | 'MEAN_REV'     // fade extremes, tight range
  | 'BREAKOUT'     // vol expansion, momentum
  | 'NO_TRADE';    // avoid — vol too high or too low/uncertain

export class GARCHEngine {
  private params: GARCHParams;
  private sigma2: number;        // current conditional variance
  private epsilon2: number;      // last squared residual (ε²_t)
  private returnBuffer: number[] = [];
  private readonly MAX_BUFFER = 500;

  constructor(params: Partial<GARCHParams> = {}) {
    this.params = { ...DEFAULT_PARAMS, ...params };
    this.sigma2  = this.params.omega / (1 - this.params.alpha - this.params.beta);
    this.epsilon2 = this.sigma2;
  }

  /** Feed a new log-return. Call every tick or every sampled interval. */
  update(logReturn: number): GARCHOutput {
    const { omega, alpha, beta, nu } = this.params;

    // ε²_t = squared demeaned return
    this.epsilon2 = logReturn * logReturn;

    // GARCH(1,1) recursion
    this.sigma2 = omega + alpha * this.epsilon2 + beta * this.sigma2;

    // Store for MLE re-estimation later
    this.returnBuffer.push(logReturn);
    if (this.returnBuffer.length > this.MAX_BUFFER) this.returnBuffer.shift();

    return this._computeOutput();
  }

  /** Called when you have a new mid-price (computes return internally) */
  updatePrice(newMid: number, prevMid: number): GARCHOutput {
    if (prevMid <= 0 || newMid <= 0) return this._computeOutput();
    const r = Math.log(newMid / prevMid);
    return this.update(r);
  }

  /** Get current output without new data */
  getOutput(): GARCHOutput {
    return this._computeOutput();
  }

  /** Online MLE re-estimation (call every ~100 updates to adapt params) */
  reestimate(): void {
    if (this.returnBuffer.length < 50) return;
    // Grid search over α,β — lightweight, no external lib needed
    const returns = this.returnBuffer;
    let bestLL = -Infinity;
    let bestParams = { ...this.params };

    for (let a = 0.02; a <= 0.20; a += 0.02) {
      for (let b = 0.75; b <= 0.97; b += 0.02) {
        if (a + b >= 1.0) continue;
        const w = this.params.omega; // keep omega fixed in grid
        const ll = this._logLikelihood(returns, w, a, b, this.params.nu);
        if (ll > bestLL) { bestLL = ll; bestParams = { ...this.params, alpha: a, beta: b }; }
      }
    }
    this.params = bestParams;
  }

  // ─── Private ────────────────────────────────────────────────────

  private _computeOutput(): GARCHOutput {
    const { omega, alpha, beta, nu } = this.params;

    const sigma2_inf  = omega / Math.max(1 - alpha - beta, 1e-6);
    const phi         = alpha + beta;
    const vol_ratio   = this.sigma2 / Math.max(sigma2_inf, 1e-9);

    // Multi-horizon projection: σ²_{t+h} = σ²_inf + φ^h·(σ²_t - σ²_inf)
    const project = (h: number) =>
      sigma2_inf + Math.pow(phi, h) * (this.sigma2 - sigma2_inf);

    const sigma2_h = {
      s1:  project(1),
      s5:  project(5),
      s10: project(10),
      s20: project(20),
    };

    // Regime from vol_ratio
    const regime: GARCHRegime =
      vol_ratio > 2.0  ? 'EXPLOSIVE'  :
      vol_ratio > 1.3  ? 'ELEVATED'   :
      vol_ratio < 0.7  ? 'COMPRESSED' : 'NORMAL';

    const regimeLabel = {
      EXPLOSIVE:  '🔴 EXPLOSIVE',
      ELEVATED:   '🟠 ELEVATED',
      NORMAL:     '🟢 NORMAL',
      COMPRESSED: '🔵 COMPRESSED',
    }[regime];

    // ── Risk management outputs ──────────────────────────────────

    // Dynamic stop in bps (proportional to realized vol, min 20bps for crypto)
    const annualVol = Math.sqrt(this.sigma2 * 365 * 24 * 3600); // rough annualization
    const stop_bps  = Math.max(20, Math.min(150, Math.round(Math.sqrt(this.sigma2) * 10000 * 3)));

    // Timeout: shorter when vol is rising (sigma2_h.s5 > sigma2_h.s1)
    const volRising = sigma2_h.s5 > sigma2_h.s1 * 1.05;
    const timeout_ms = regime === 'EXPLOSIVE' ? 5000 :
                       regime === 'ELEVATED'  ? (volRising ? 8000  : 15000) :
                       regime === 'NORMAL'    ? (volRising ? 20000 : 30000) :
                       45000; // COMPRESSED

    // Size multiplier
    const size_mult =
      regime === 'EXPLOSIVE'  ? 0.0 :
      regime === 'ELEVATED'   ? 0.5 :
      regime === 'COMPRESSED' ? 0.7 :  // normal but watch
      1.0;

    // Allowed scalp style
    const allowed_style: ScalpStyle =
      regime === 'EXPLOSIVE'  ? 'NO_TRADE' :
      regime === 'ELEVATED'   ? 'MEAN_REV' :
      regime === 'COMPRESSED' ? 'BREAKOUT' :
      phi > 0.95              ? 'TREND'    : 'TREND';

    return {
      sigma2_next: this.sigma2,
      sigma2_inf,
      phi,
      vol_ratio,
      sigma2_h,
      nu,
      regime,
      regimeLabel,
      stop_bps,
      timeout_ms,
      size_mult,
      allowed_style,
    };
  }

  private _logLikelihood(
    returns: number[], omega: number, alpha: number, beta: number, nu: number
  ): number {
    let sigma2 = omega / (1 - alpha - beta);
    let ll = 0;
    for (const r of returns) {
      sigma2 = omega + alpha * r * r + beta * sigma2;
      if (sigma2 <= 0) return -Infinity;
      // Student-t log-likelihood (simplified)
      ll += -0.5 * Math.log(sigma2) - ((nu + 1) / 2) * Math.log(1 + r * r / (sigma2 * (nu - 2)));
    }
    return ll;
  }

  reset() {
    const { omega, alpha, beta } = this.params;
    this.sigma2   = omega / (1 - alpha - beta);
    this.epsilon2 = this.sigma2;
    this.returnBuffer = [];
  }
}

// ── Per-asset singleton registry ─────────────────────────────────────────────
const garchEngines: Record<string, GARCHEngine> = {};

export function getGARCHEngine(asset: string): GARCHEngine {
  if (!garchEngines[asset]) garchEngines[asset] = new GARCHEngine();
  return garchEngines[asset];
}
