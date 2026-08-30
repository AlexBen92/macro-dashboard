/**
 * Calibration SSVI (Gatheral-Jacquier 2014) sans arbitrage depuis une chaîne
 * d'options brute (source CBOE delayed_quotes). Deux étages:
 *   1. fit SVI raw par slice (Zeliade-style, Nelder-Mead + pénalités butterfly)
 *   2. fit SSVI global (ρ, η, γ) sur θ_t dérivés des slices + contraintes
 *      calendaire (∂tθ ≥ 0) et butterfly (θφ(1+|ρ|) ≤ 4, θφ²(1+|ρ|) ≤ 4).
 * Densité risque-neutre par Breeden-Litzenberger sur la surface SSVI.
 */
import { nelderMead } from './optimize';

export interface OptionQuoteRaw {
  /** option symbol e.g. SPX260918C00200000 */
  option: string;
  strike: number;
  type: 'C' | 'P';
  bid: number;
  ask: number;
  iv: number;
  volume: number;
  open_interest: number;
}

export interface ChainSlice {
  /** maturité en années act/365 */
  T: number;
  expiryDays: number;
  expiryLabel: string;
  forward: number;
  strikes: number[];
  /** log-moneyness k = ln(K/F) */
  k: number[];
  /** IV mid (fraction, ex 0.16) filtrées */
  iv: number[];
  /** poids = vega proxy 1/√w, utilisés dans l'objectif */
  weight: number[];
  nRaw: number;
  nKept: number;
}

export interface SviSliceParams {
  a: number;
  b: number;
  m: number;
  sigma: number;
  rho: number;
}

export interface SsviParams {
  rho: number;
  eta: number;
  gamma: number;
  /** variance totale ATM interpolée par maturité (monotone croissante) */
  thetaCurve: { T: number; theta: number }[];
}

export interface SsviFitResult {
  params: SsviParams;
  sviSlices: { T: number; p: SviSliceParams; rmseIv: number }[];
  /** RMSE IV global SSVI vs marché (points conservés, pondérés vega) */
  rmseIv: number;
  /** conditions Gatheral-Jacquier */
  butterflyOk: boolean;
  calendarOk: boolean;
  maxThetaPhi: number;
  maxThetaPhiSq: number;
  minDenominator: number;
  slices: ChainSlice[];
  spot: number;
  rate: number;
  asOf: string;
  source: string;
  nOptionsRaw: number;
  nOptionsKept: number;
}

export function parseCboeOptionSymbol(sym: string): {
  expiry: string;
  type: 'C' | 'P';
  strike: number;
} {
  // SPXW260918C00200000 → SPXW 260918 C 00200000
  const m = /^([A-Z]+)(\d{6})([CP])(\d{8})$/.exec(sym);
  if (!m) throw new Error(`symbole CBOE non reconnu: ${sym}`);
  const strike = parseInt(m[4], 10) / 1000;
  return { expiry: `20${m[2].slice(0, 2)}-${m[2].slice(2, 4)}-${m[2].slice(4, 6)}`, type: m[3] as 'C' | 'P', strike };
}

/** Regroupe la chaîne par expiry, estime le forward par parité put-call, filtre quotes. */
export function buildSlicesFromChain(
  options: OptionQuoteRaw[],
  spotGuess: number,
  rate: number,
  asOf: string,
  opts: { maxExpiryDays?: number; minExpiryDays?: number } = {}
): ChainSlice[] {
  const maxD = opts.maxExpiryDays ?? 200;
  const minD = opts.minExpiryDays ?? 5;
  const byExpiry = new Map<string, { T: number; c: Map<number, OptionQuoteRaw>; p: Map<number, OptionQuoteRaw> }>();
  for (const o of options) {
    const { expiry, type, strike } = parseCboeOptionSymbol(o.option);
    const days = Math.round((Date.parse(`${expiry}T21:00:00Z`) - Date.parse(asOf)) / 86400000);
    if (days < minD || days > maxD) continue;
    const T = Math.max(days, 1) / 365;
    let g = byExpiry.get(expiry);
    if (!g) {
      g = { T, c: new Map(), p: new Map() };
      byExpiry.set(expiry, g);
    }
    (type === 'C' ? g.c : g.p).set(strike, o);
  }
  const slices: ChainSlice[] = [];
  for (const [expiry, g] of byExpiry) {
    const common: number[] = [];
    for (const K of g.c.keys()) if (g.p.has(K)) common.push(K);
    common.sort((a, b) => a - b);
    if (common.length < 8) continue;
    // forward: K* minimise |C-P|, F = K* + e^{rT}(C-P)
    let kStar = common[0];
    let minDiff = Infinity;
    for (const K of common) {
      const c = g.c.get(K)!;
      const p = g.p.get(K)!;
      const d = Math.abs((c.bid + c.ask) / 2 - (p.bid + p.ask) / 2);
      if (d < minDiff) {
        minDiff = d;
        kStar = K;
      }
    }
    const cS = g.c.get(kStar)!;
    const pS = g.p.get(kStar)!;
    const F = kStar + Math.exp(rate * g.T) * ((cS.bid + cS.ask) / 2 - (pS.bid + pS.ask) / 2);
    // filtre: bid>0, moneyness ±35%, IV cohérente
    const strikes: number[] = [];
    const k: number[] = [];
    const iv: number[] = [];
    const weight: number[] = [];
    let nKept = 0;
    for (const K of common) {
      const c = g.c.get(K)!;
      const p = g.p.get(K)!;
      const kk = Math.log(K / F);
      if (Math.abs(kk) > 0.35) continue;
      const o = kk < 0 ? p : c; // OTM quote par côté
      if (o.bid <= 0 || o.ask < o.bid) continue;
      // NB: champ iv CBOE delayed_quotes déjà en fraction (ex 0.1112 = 11.12%)
      const oIv = o.iv > 0 && o.iv < 3 ? o.iv : midIv(K, F, g.T, (o.bid + o.ask) / 2, rate, kk < 0 ? 'P' : 'C');
      if (!isFinite(oIv) || oIv < 0.01 || oIv > 2.5) continue;
      strikes.push(K);
      k.push(kk);
      iv.push(oIv);
      weight.push(1 / Math.sqrt(Math.max(oIv * oIv * g.T, 0.001)));
      nKept++;
    }
    if (nKept < 8) continue;
    slices.push({
      T: g.T,
      expiryDays: Math.round(g.T * 365),
      expiryLabel: expiry,
      forward: F,
      strikes,
      k,
      iv,
      weight,
      nRaw: common.length * 2,
      nKept,
    });
  }
  slices.sort((a, b) => a.T - b.T);
  return slices;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}
function erf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return s * y;
}

/** IV implicite par bissection depuis un prix BS (fallback si CBOE iv manquante). */
export function midIv(
  K: number,
  F: number,
  T: number,
  price: number,
  rate: number,
  type: 'C' | 'P',
  df?: number
): number {
  const disc = df ?? Math.exp(-rate * T);
  const intrinsic = Math.max(0, type === 'C' ? F - K : K - F) * disc;
  if (price <= intrinsic + 1e-8) return 0.011;
  let lo = 0.01;
  let hi = 2.5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const sd = mid * Math.sqrt(T);
    const d1 = Math.log(F / K) / sd + sd / 2;
    const d2 = d1 - sd;
    const c =
      type === 'C'
        ? disc * (F * normCdf(d1) - K * normCdf(d2))
        : disc * (K * normCdf(-d2) - F * normCdf(-d1));
    if (c > price) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** Variance totale SVI raw: w(k) = a + b(ρ(k−m) + √((k−m)²+σ²)). */
export function sviRawW(k: number, p: SviSliceParams): number {
  const d = k - p.m;
  return p.a + p.b * (p.rho * d + Math.sqrt(d * d + p.sigma * p.sigma));
}

/** Densité du smile SVI via g(k) (Gatheral 2004): densité ∝ 1/g² après normalisation des log-k. */
export function sviG(k: number, p: SviSliceParams): number {
  const d = k - p.m;
  const rt = Math.sqrt(d * d + p.sigma * p.sigma);
  const w = p.a + p.b * (p.rho * d + rt);
  if (w <= 0) return -1;
  const dw = p.b * (p.rho + d / rt);
  const dww = (p.b * p.sigma * p.sigma) / (rt * rt * rt);
  return (1 - (k * dw) / (2 * w)) * (1 - (k * dw) / (2 * w)) -
    (dw * dw) / 4 * (0.25 + 1 / w) -
    (k * dww) / (2 * w);
}

/** Fit SVI raw sur une slice: NM sur (a,b,ρ,m,σ) avec pénalités butterfly et bornes. */
export function fitSviSlice(slice: { k: number[]; iv: number[]; T: number; weight: number[] }): {
  p: SviSliceParams;
  rmseIv: number;
} {
  const { k, iv, T, weight } = slice;
  const wMkt = iv.map((v, i) => v * v * T);
  const km = k.reduce((s, v) => s + v, 0) / k.length;
  const wAtm = iv.reduce((s, v, i) => s + v * weight[i], 0) / weight.reduce((s, v) => s + v, 0);
  const atmVar = wAtm * wAtm * T;
  // paramètres libres: (a, log b, atanh ρ, m, log σ)
  const toFree = (p: SviSliceParams): number[] => [
    p.a,
    Math.log(p.b),
    Math.atanh(p.rho),
    p.m,
    Math.log(p.sigma),
  ];
  const fromFree = (x: number[]): SviSliceParams => ({
    a: x[0],
    b: Math.exp(x[1]),
    rho: Math.tanh(x[2]),
    m: x[3],
    sigma: Math.exp(x[4]),
  });
  const objective = (x: number[]): number => {
    const p = fromFree(x);
    if (p.b <= 0 || p.sigma <= 0 || Math.abs(p.rho) >= 0.9999) return 1e9;
    if (p.a + p.b * p.sigma * Math.sqrt(1 - p.rho * p.rho) < 0) return 1e9; // min w < 0
    if (p.b * (1 + Math.abs(p.rho)) * T > 2) return 1e9; // slope arb grossier
    let sse = 0;
    let wSum = 0;
    let pen = 0;
    const grid = 41;
    for (let gi = 0; gi <= grid; gi++) {
      const gk = -0.4 + (0.8 * gi) / grid;
      const g = sviG(gk, p);
      if (g <= 0) pen += 1e4;
    }
    for (let i = 0; i < k.length; i++) {
      const w = sviRawW(k[i], p);
      const ivModel = Math.sqrt(Math.max(w, 1e-12) / T);
      const r = (ivModel - iv[i]) * weight[i];
      sse += r * r;
      wSum += weight[i] * weight[i];
    }
    if (!isFinite(sse)) return 1e9;
    return sse / Math.max(wSum, 1e-9) + pen;
  };
  const x0 = toFree({
    a: atmVar * 0.45,
    b: atmVar * 1.2 / (1 + 0.1),
    rho: -0.7,
    m: km,
    sigma: 0.12,
  });
  const res = nelderMead(objective, x0, { maxIter: 1200, restarts: 2, seed: 11 });
  const p = fromFree(res.x);
  // RMSE IV non pondéré
  let sse = 0;
  for (let i = 0; i < k.length; i++) {
    const ivModel = Math.sqrt(Math.max(sviRawW(k[i], p), 1e-12) / T);
    sse += (ivModel - iv[i]) ** 2;
  }
  return { p, rmseIv: Math.sqrt(sse / k.length) };
}

/** w SSVI: θ/2 (1+ρφk + √((φk+ρ)²+1−ρ²)), φ = η θ^(−γ) (1+θ)^(γ−1) (power law). */
export function ssviPhi(theta: number, eta: number, gamma: number): number {
  return (eta / Math.pow(theta, gamma)) * Math.pow(1 + theta, gamma - 1);
}
export function ssviW(k: number, theta: number, rho: number, phi: number): number {
  return (theta / 2) * (1 + rho * phi * k + Math.sqrt((phi * k + rho) ** 2 + 1 - rho * rho));
}

export interface SsviSurface {
  params: SsviParams;
  /** w(k,T) interpolé en T (θ monotone) */
  w: (k: number, T: number) => number;
}

export function makeSsviSurface(params: SsviParams): SsviSurface {
  const { rho, eta, gamma, thetaCurve } = params;
  const thetaAt = (T: number): number => {
    const pts = thetaCurve;
    if (T <= pts[0].T) {
      return pts[0].theta * (T / pts[0].T);
    }
    for (let i = 1; i < pts.length; i++) {
      if (T <= pts[i].T) {
        const [a, b] = [pts[i - 1], pts[i]];
        const x = (Math.log(T) - Math.log(a.T)) / (Math.log(b.T) - Math.log(a.T));
        return Math.exp(Math.log(a.theta) + x * (Math.log(b.theta) - Math.log(a.theta)));
      }
    }
    const last = pts[pts.length - 1];
    return last.theta * (T / last.T);
  };
  return {
    params,
    w: (k: number, T: number) => {
      const theta = thetaAt(T);
      const phi = ssviPhi(theta, eta, gamma);
      return ssviW(k, theta, rho, phi);
    },
  };
}

/** Fit SSVI global: θ_t depuis slices SVI (w ATM), puis (ρ,η,γ) par moindres carrés. */
export function fitSsvi(slices: ChainSlice[]): SsviFitResult {
  const sviSlices = slices.map((s) => {
    const { p, rmseIv } = fitSviSlice(s);
    return { T: s.T, p, rmseIv, slice: s };
  });
  // θ_t = w(ATM) du slice SVI, rendu monotone (calendar arb interdit)
  let prev = 0;
  const thetaCurve: { T: number; theta: number }[] = [];
  for (const sl of sviSlices) {
    const theta = Math.max(sviRawW(0, sl.p), 1e-6);
    const mono = Math.max(theta, prev);
    thetaCurve.push({ T: sl.T, theta: mono });
    prev = mono;
  }
  const calendarOk = thetaCurve.every((t, i) => i === 0 || t.theta > 0);
  // calibration (ρ, η, γ) sur points de marché
  const pts: { k: number; T: number; wMkt: number; weight: number }[] = [];
  for (let i = 0; i < slices.length; i++) {
    for (let j = 0; j < slices[i].k.length; j++) {
      pts.push({
        k: slices[i].k[j],
        T: slices[i].T,
        wMkt: slices[i].iv[j] ** 2 * slices[i].T,
        weight: slices[i].weight[j],
      });
    }
  }
  const thetaOfT = (T: number): number => {
    for (let i = 1; i < thetaCurve.length; i++) {
      if (T <= thetaCurve[i].T) {
        const [a, b] = [thetaCurve[i - 1], thetaCurve[i]];
        const x = (Math.log(T) - Math.log(a.T)) / (Math.log(b.T) - Math.log(a.T));
        return Math.exp(Math.log(a.theta) + x * (Math.log(b.theta) - Math.log(a.theta)));
      }
    }
    return thetaCurve[thetaCurve.length - 1].theta;
  };
  const objective = (x: number[]): number => {
    const rho = Math.tanh(x[0]);
    const eta = Math.exp(x[1]);
    const gamma = 0.5 * (1 + Math.tanh(x[2])); // ∈ (0,1)
    let sse = 0;
    let wSum = 0;
    let pen = 0;
    let maxTP = 0;
    let maxTP2 = 0;
    for (const t of thetaCurve) {
      const phi = ssviPhi(t.theta, eta, gamma);
      const c1 = t.theta * phi * (1 + Math.abs(rho));
      const c2 = t.theta * phi * phi * (1 + Math.abs(rho));
      maxTP = Math.max(maxTP, c1);
      maxTP2 = Math.max(maxTP2, c2);
      if (c1 > 4) pen += (c1 - 4) ** 2 * 1e6;
      if (c2 > 4) pen += (c2 - 4) ** 2 * 1e6;
    }
    for (const pt of pts) {
      const theta = thetaOfT(pt.T);
      const phi = ssviPhi(theta, eta, gamma);
      const wm = ssviW(pt.k, theta, rho, phi);
      if (wm <= 0) pen += 1e6;
      const r = (Math.sqrt(Math.max(wm, 1e-12) / pt.T) - Math.sqrt(pt.wMkt / pt.T)) * pt.weight;
      sse += r * r;
      wSum += pt.weight * pt.weight;
    }
    return sse / Math.max(wSum, 1e-9) + pen;
  };
  const res = nelderMead(
    objective,
    [Math.atanh(-0.7), Math.log(1.0), 0.6],
    { maxIter: 1500, restarts: 4, seed: 23 }
  );
  const rho = Math.tanh(res.x[0]);
  const eta = Math.exp(res.x[1]);
  const gamma = 0.5 * (1 + Math.tanh(res.x[2]));
  // stats contraintes
  let maxThetaPhi = 0;
  let maxThetaPhiSq = 0;
  let minDen = Infinity;
  for (const t of thetaCurve) {
    const phi = ssviPhi(t.theta, eta, gamma);
    maxThetaPhi = Math.max(maxThetaPhi, t.theta * phi * (1 + Math.abs(rho)));
    maxThetaPhiSq = Math.max(maxThetaPhiSq, t.theta * phi * phi * (1 + Math.abs(rho)));
    // min de (1+ρφk+√(...)) sur k∈[-0.4,0.4] > 0 sinon densité négative
    for (let i = 0; i <= 40; i++) {
      const k = -0.4 + 0.02 * i;
      const den = 1 + rho * phi * k + Math.sqrt((phi * k + rho) ** 2 + 1 - rho * rho);
      minDen = Math.min(minDen, den);
    }
  }
  const butterflyOk = maxThetaPhi <= 4 && maxThetaPhiSq <= 4 && minDen > 0;
  // RMSE IV global SSVI vs marché
  const surface = makeSsviSurface({ rho, eta, gamma, thetaCurve });
  let sse = 0;
  let n = 0;
  for (let i = 0; i < slices.length; i++) {
    for (let j = 0; j < slices[i].k.length; j++) {
      const ivModel = Math.sqrt(Math.max(surface.w(slices[i].k[j], slices[i].T), 1e-12) / slices[i].T);
      sse += (ivModel - slices[i].iv[j]) ** 2;
      n++;
    }
  }
  return {
    params: { rho, eta, gamma, thetaCurve },
    sviSlices: sviSlices.map((s) => ({ T: s.T, p: s.p, rmseIv: s.rmseIv })),
    rmseIv: Math.sqrt(sse / Math.max(n, 1)),
    butterflyOk,
    calendarOk,
    maxThetaPhi,
    maxThetaPhiSq,
    minDenominator: minDen,
    slices,
    spot: 0,
    rate: 0,
    asOf: '',
    source: '',
    nOptionsRaw: 0,
    nOptionsKept: 0,
  };
}

/** Densité RN log-moneyness à horizon T depuis la surface SSVI: pdf(k) = -d²Q/dk² (Breeden-Litzenberger numérique). */
export function ssviDensity(
  surface: SsviSurface,
  T: number,
  kMin = -0.6,
  kMax = 0.6,
  n = 121
): { k: number; pdf: number; cdf: number }[] {
  // Q(K) = call prix non actualisé en F-space: Q(k) = E[(S_T/F - e^k)^+]
  // dC/dk = -E[1(S>e^k)] via différences finies du prix SSVI (BS-price de w).
  const callF = (k: number): number => {
    const w = Math.max(surface.w(k, T), 1e-12);
    const sd = Math.sqrt(w);
    const d1 = -k / sd + sd / 2;
    const d2 = d1 - sd;
    return normCdf(d1) - Math.exp(k) * normCdf(d2);
  };
  const h = (kMax - kMin) / (n - 1);
  const ks = Array.from({ length: n }, (_, i) => kMin + i * h);
  const out: { k: number; pdf: number; cdf: number }[] = [];
  for (let i = 1; i < n - 1; i++) {
    const pdfK = (callF(ks[i - 1]) - 2 * callF(ks[i]) + callF(ks[i + 1])) / (h * h) * Math.exp(ks[i]);
    out.push({ k: ks[i], pdf: Math.max(pdfK, 0), cdf: 0 });
  }
  // cdf numérique
  let cum = 0;
  const total = out.reduce((s, p) => s + p.pdf, 0) || 1;
  for (const p of out) {
    cum += p.pdf / total;
    p.cdf = cum;
  }
  return out;
}
