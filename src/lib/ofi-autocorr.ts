/**
 * OFI AUTOCORRELATION ENGINE — Order Flow Imbalance & Microstructure Signals
 * References: Cont et al. (2014) "Order Flow and Market Microstructure"
 *
 * Computes:
 * - OFI (Order Flow Imbalance) per tick
 * - Rolling ACF (Autocorrelation Function) for persistence detection
 * - Realized Volatility at multiple horizons (1s, 5s, 15s)
 * - Depth features (imbalance, slope, spread)
 */

// ─── TYPES ───

export interface L2Snapshot {
  bids: [number, number][]; // [price, size][]
  asks: [number, number][]; // [price, size][]
  timestamp: number;        // ms
}

export interface OFITick {
  ofi: number;        // raw OFI at this tick
  ofiNorm: number;    // z-score normalized OFI
  timestamp: number;
}

export interface ACFResult {
  lags: number[];          // [rho_1, rho_2, ..., rho_K]
  persistence: number;     // % ticks where OFI > 0 (0..1)
  sumACF: number;          // sum of rho_1..rho_5 (autocorr strength)
  direction: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  pContinuation: number;   // estimated prob of continuation (0..1)
}

export interface RVResult {
  rv1s: number;    // realized vol 1s
  rv5s: number;    // realized vol 5s
  rv15s: number;   // realized vol 15s
  logRV: number;   // log(rv5s) — stationary proxy
  regime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXPLOSIVE';
}

export interface DepthFeatures {
  depthImbalance: number;  // (bid_vol - ask_vol) / (bid_vol + ask_vol) on top 3 levels
  bookSlope: number;      // how fast size grows away from mid (flat = thin, steep = thick)
  spreadBps: number;      // bid-ask spread in bps
  midPrice: number;
}

// ─── CONSTANTS ───

const MAX_WINDOW = 200; // max ticks in rolling buffer
const K_LEVELS   = 5;   // LOB levels to use for OFI
const K_LAGS     = 10;  // ACF lags to compute

// ─── ENGINE CLASS ───

export class OFIEngine {
  private ofiBuffer: OFITick[] = [];
  private midBuffer: number[]  = [];    // for realized vol
  private prevSnapshot: L2Snapshot | null = null;

  // Rolling stats for z-score normalization (Welford's algorithm)
  private rollingMean = 0;
  private rollingVar  = 1;
  private rollingN    = 0;

  /** Call on every L2 update tick */
  update(snap: L2Snapshot): {
    ofiTick: OFITick;
    depth: DepthFeatures;
  } {
    const depth = this.computeDepth(snap);
    const rawOFI = this.computeRawOFI(snap, this.prevSnapshot);
    this.prevSnapshot = snap;

    // Welford online update for rolling mean/var
    this.rollingN++;
    const delta = rawOFI - this.rollingMean;
    this.rollingMean += delta / this.rollingN;
    const delta2 = rawOFI - this.rollingMean;
    this.rollingVar  += (delta * delta2 - this.rollingVar) / this.rollingN;

    // Normalize: z-score over rolling window
    const sigma = Math.sqrt(Math.max(this.rollingVar, 1e-9));
    const ofiNorm = (rawOFI - this.rollingMean) / sigma;

    const tick: OFITick = { ofi: rawOFI, ofiNorm, timestamp: snap.timestamp };

    // Push to buffer (FIFO, max MAX_WINDOW ticks)
    this.ofiBuffer.push(tick);
    if (this.ofiBuffer.length > MAX_WINDOW) this.ofiBuffer.shift();

    // Mid price for RV
    const mid = depth.midPrice;
    this.midBuffer.push(mid);
    if (this.midBuffer.length > MAX_WINDOW) this.midBuffer.shift();

    return { ofiTick: tick, depth };
  }

  /** Compute ACF features on current OFI buffer */
  computeACF(): ACFResult | null {
    if (this.ofiBuffer.length < 30) return null; // not enough data

    const series = this.ofiBuffer.map(t => t.ofiNorm);
    const n = series.length;
    const mean = series.reduce((a, b) => a + b, 0) / n;

    // Variance (denominator)
    const variance = series.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
    if (variance < 1e-9) return null;

    // ACF for lags 1..K_LAGS
    const lags: number[] = [];
    for (let k = 1; k <= K_LAGS; k++) {
      let cov = 0;
      for (let i = k; i < n; i++) {
        cov += (series[i] - mean) * (series[i - k] - mean);
      }
      lags.push(cov / ((n - k) * variance));
    }

    // Persistence: % of recent ticks where OFI > 0
    const recent = this.ofiBuffer.slice(-30);
    const persistence = recent.filter(t => t.ofi > 0).length / recent.length;

    // Sum of first 5 lags = autocorrelation strength
    const sumACF = lags.slice(0, 5).reduce((a, b) => a + b, 0);

    // Direction from weighted recent OFI
    const recentOFI = recent.slice(-10).reduce((s, t) => s + t.ofi, 0);
    const direction: ACFResult['direction'] =
      recentOFI > 0.2 ? 'BUY' : recentOFI < -0.2 ? 'SELL' : 'NEUTRAL';

    // Strength from sumACF + persistence
    const combined = Math.abs(sumACF) * 0.5 + Math.abs(persistence - 0.5) * 2 * 0.5;
    const strength: ACFResult['strength'] =
      combined > 0.5 ? 'STRONG' : combined > 0.25 ? 'MODERATE' : 'WEAK';

    // p(continuation): logistic-style estimate
    // Based on: persistence score + ACF(1) + direction alignment
    const acf1 = lags[0] ?? 0;
    const dirSign = direction === 'BUY' ? 1 : direction === 'SELL' ? -1 : 0;
    const logit = 0.3 * acf1 + 0.4 * (persistence - 0.5) * 2 + 0.3 * dirSign * 0.5;
    const pContinuation = 1 / (1 + Math.exp(-logit * 3));

    return { lags, persistence, sumACF, direction, strength, pContinuation };
  }

  /** Realized Volatility at multiple horizons */
  computeRV(windowMs = 5000): RVResult {
    const now = Date.now();
    const series1s  = this.getRecentMids(now, 1000);
    const series5s  = this.getRecentMids(now, 5000);
    const series15s = this.getRecentMids(now, 15000);

    const rv1s  = this.rollingRV(series1s);
    const rv5s  = this.rollingRV(series5s);
    const rv15s = this.rollingRV(series15s);
    const logRV = Math.log(Math.max(rv5s, 1e-9));

    // Regime detection from rv5s vs historical
    // Simple percentile approach — calibrate thresholds per asset
    const regime: RVResult['regime'] =
      rv5s > 0.002  ? 'EXPLOSIVE' :
      rv5s > 0.0008 ? 'HIGH'      :
      rv5s > 0.0002 ? 'NORMAL'    : 'LOW';

    return { rv1s, rv5s, rv15s, logRV, regime };
  }

  // ─── Private helpers ───

  private computeRawOFI(snap: L2Snapshot, prev: L2Snapshot | null): number {
    if (!prev) return 0;

    let ofi = 0;
    const levels = Math.min(K_LEVELS, snap.bids.length, snap.asks.length,
                                      prev.bids.length, prev.asks.length);

    for (let k = 0; k < levels; k++) {
      const bidNew = snap.bids[k]?.[1] ?? 0;
      const bidOld = prev.bids[k]?.[1] ?? 0;
      const askNew = snap.asks[k]?.[1] ?? 0;
      const askOld = prev.asks[k]?.[1] ?? 0;

      // If best bid/ask price changed: treat old as removed, new as added
      const bidPriceNew = snap.bids[k]?.[0] ?? 0;
      const bidPriceOld = prev.bids[k]?.[0] ?? 0;
      const askPriceNew = snap.asks[k]?.[0] ?? 0;
      const askPriceOld = prev.asks[k]?.[0] ?? 0;

      const deltaBid = bidPriceNew !== bidPriceOld ? bidNew : (bidNew - bidOld);
      const deltaAsk = askPriceNew !== askPriceOld ? -askNew : -(askNew - askOld);

      ofi += deltaBid + deltaAsk;
    }

    return ofi;
  }

  private computeDepth(snap: L2Snapshot): DepthFeatures {
    const topBids = snap.bids.slice(0, 3);
    const topAsks = snap.asks.slice(0, 3);

    const bidVol = topBids.reduce((s, [, sz]) => s + sz, 0);
    const askVol = topAsks.reduce((s, [, sz]) => s + sz, 0);
    const total  = bidVol + askVol;

    const depthImbalance = total > 0 ? (bidVol - askVol) / total : 0;

    // Book slope: how quickly size grows from level 1 → level 3
    const bidSlope = topBids.length >= 3
      ? (topBids[2][1] - topBids[0][1]) / Math.max(topBids[0][1], 1)
      : 0;
    const askSlope = topAsks.length >= 3
      ? (topAsks[2][1] - topAsks[0][1]) / Math.max(topAsks[0][1], 1)
      : 0;
    const bookSlope = (bidSlope + askSlope) / 2;

    const bestBid = snap.bids[0]?.[0] ?? 0;
    const bestAsk = snap.asks[0]?.[0] ?? 0;
    const midPrice = (bestBid + bestAsk) / 2;
    const spreadBps = midPrice > 0
      ? ((bestAsk - bestBid) / midPrice) * 10000
      : 0;

    return { depthImbalance, bookSlope, spreadBps, midPrice };
  }

  private rollingRV(prices: number[]): number {
    if (prices.length < 2) return 0;
    let sumSq = 0;
    for (let i = 1; i < prices.length; i++) {
      const r = Math.log(prices[i] / prices[i - 1]);
      sumSq += r * r;
    }
    return Math.sqrt(sumSq / (prices.length - 1));
  }

  private getRecentMids(now: number, windowMs: number): number[] {
    // midBuffer is indexed but we don't store timestamps for mids
    // Use a rough approximation: last N ticks ≈ last windowMs ms
    // (assumes ~10 ticks/s; adjust per asset liquidity)
    const ticksPerMs = 0.01; // 10 ticks/s
    const n = Math.max(2, Math.round(windowMs * ticksPerMs));
    return this.midBuffer.slice(-n);
  }

  /** Reset rolling stats (call when switching timeframe / asset) */
  reset() {
    this.ofiBuffer  = [];
    this.midBuffer  = [];
    this.prevSnapshot = null;
    this.rollingMean = 0;
    this.rollingVar  = 1;
    this.rollingN    = 0;
  }

  /** Get current OFI buffer length */
  getBufferLength(): number {
    return this.ofiBuffer.length;
  }

  /** Get last computed depth features */
  getLastDepth(): DepthFeatures | null {
    if (this.midBuffer.length === 0) return null;
    // Re-compute from last snapshot if available
    return this.prevSnapshot ? this.computeDepth(this.prevSnapshot) : null;
  }
}

// ─── SINGLETON REGISTRY PER ASSET ───

const engines: Record<string, OFIEngine> = {};

export function getOFIEngine(asset: string): OFIEngine {
  if (!engines[asset]) {
    engines[asset] = new OFIEngine();
  }
  return engines[asset];
}

export function resetOFIEngine(asset: string) {
  if (engines[asset]) {
    engines[asset].reset();
  }
}

export function getAllOFIEngines(): Record<string, OFIEngine> {
  return engines;
}
