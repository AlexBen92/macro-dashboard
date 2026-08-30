/**
 * Calibration Bates (SVJ) sur la surface SSVI.
 * z = ln(S_T/F_T) retour log forward-martingale: E[e^z] = 1.
 * CF: E[e^{c z_T}] = exp(C(c) + D(c)·V0 + λT(E[e^{cJ}]−1)), c = s + iu,
 *   a = ½(c²−c), B = κ − ρσc, d = √(B² − σ²(c²−c)),
 *   g = (B−d)/(B+d), D = (B−d)/σ²·(1−e^{−dT})/(1−ge^{−dT}),
 *   C = κθ/σ²·[(B−d)T − 2 Log((1−ge^{−dT})/(1−g))].
 * Prix: intégrale de Lewis; IV par bissection. Feller rapporté, jamais imposé.
 */
import { nelderMead } from './optimize';
import { makeSsviSurface, type SsviParams } from './ssvi';

export interface BatesParams {
  kappa: number;
  theta: number;
  sigmaV: number;
  rho: number;
  V0: number;
  lambdaJ: number;
  nuJ: number;
  deltaJ: number;
}

export interface BatesFitResult {
  params: BatesParams;
  rmseIv: number;
  fellerOk: boolean;
  fellerRatio: number;
  grid: { k: number; T: number; ivSsvi: number; ivBates: number }[];
}

export function normCdf(x: number): number {
  // Zelen & Severo, précision ~1e-7
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const poly =
    t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const p = 1 - (Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)) * poly;
  return x >= 0 ? p : 1 - p;
}

/** CF Bates de z_T = ln(S_T/F_T) au point c = s + iu. */
export function batesCf(u: number, s: number, T: number, p: BatesParams): { re: number; im: number } {
  const { kappa, theta, sigmaV, rho, V0, lambdaJ, nuJ, deltaJ } = p;
  const sigma2 = sigmaV * sigmaV;
  // c² − c avec c = s + iu
  const cmcRe = s * s - u * u - s;
  const cmcIm = 2 * s * u - u;
  const BRe = kappa - rho * sigmaV * s;
  const BIm = -rho * sigmaV * u;
  // d² = B² − σ²(c²−c)
  const dSqRe = BRe * BRe - BIm * BIm - sigma2 * cmcRe;
  const dSqIm = 2 * BRe * BIm - sigma2 * cmcIm;
  const dMod = Math.sqrt(dSqRe * dSqRe + dSqIm * dSqIm);
  const dRe = Math.sqrt(Math.max((dMod + dSqRe) / 2, 0));
  let dIm = Math.sqrt(Math.max((dMod - dSqRe) / 2, 0));
  if (dSqIm < 0) dIm = -dIm;
  // g = (B−d)/(B+d)
  const denRe = BRe + dRe;
  const denIm = BIm + dIm;
  const denMod = denRe * denRe + denIm * denIm || 1e-18;
  const gRe = ((BRe - dRe) * denRe + (BIm - dIm) * denIm) / denMod;
  const gIm = ((BIm - dIm) * denRe - (BRe - dRe) * denIm) / denMod;
  // e = exp(−dT)
  const eRe = Math.exp(-dRe * T) * Math.cos(dIm * T);
  const eIm = -Math.exp(-dRe * T) * Math.sin(dIm * T);
  // 1 − g·e
  const geRe = gRe * eRe - gIm * eIm;
  const geIm = gRe * eIm + gIm * eRe;
  const omGeRe = 1 - geRe;
  const omGeIm = -geIm;
  const omGeMod = omGeRe * omGeRe + omGeIm * omGeIm || 1e-18;
  // ratio = (1−e)/(1−ge), 1−e = (1−eRe) − i·eIm
  const ratRe = ((1 - eRe) * omGeRe - eIm * omGeIm) / omGeMod;
  const ratIm = (-eIm * omGeRe - (1 - eRe) * omGeIm) / omGeMod;
  const DcRe = (BRe - dRe) / sigma2;
  const DcIm = (BIm - dIm) / sigma2;
  const DRe = DcRe * ratRe - DcIm * ratIm;
  const DIm = DcRe * ratIm + DcIm * ratRe;
  // ratio2 = (1−ge)/(1−g)
  const omGRe = 1 - gRe;
  const omGIm = -gIm;
  const omGMod = omGRe * omGRe + omGIm * omGIm || 1e-18;
  const r2Re = (omGeRe * omGRe + omGeIm * omGIm) / omGMod;
  const r2Im = (omGeIm * omGRe - omGeRe * omGIm) / omGMod;
  const r2Mod = Math.sqrt(r2Re * r2Re + r2Im * r2Im);
  const r2Arg = Math.atan2(r2Im, r2Re);
  const kts = (kappa * theta) / sigma2;
  const CRe = kts * ((BRe - dRe) * T - 2 * Math.log(Math.max(r2Mod, 1e-300)));
  const CIm = kts * ((BIm - dIm) * T - 2 * r2Arg);
  // sauts: E[e^{cJ}] = exp(cν + ½c²δ²), J = ν + δN, avec compensateur martingale
  // −c·λT·(E[e^J]−1) pour garantir E[S_T/F] = 1
  const jX = s * nuJ + 0.5 * (s * s - u * u) * deltaJ * deltaJ;
  const jY = u * nuJ + s * u * deltaJ * deltaJ;
  const mJump = Math.exp(nuJ + 0.5 * deltaJ * deltaJ) - 1;
  const wRe = lambdaJ * T * (Math.exp(jX) * Math.cos(jY) - 1) - s * lambdaJ * T * mJump;
  const wIm = lambdaJ * T * (Math.exp(jX) * Math.sin(jY)) - u * lambdaJ * T * mJump;
  const expRe = CRe + DRe * V0 + wRe;
  const expIm = CIm + DIm * V0 + wIm;
  const mod = Math.exp(expRe);
  return { re: mod * Math.cos(expIm), im: mod * Math.sin(expIm) };
}

/** Call forward-normalisé (F=1) via Heston 2-probabilités + Gil-Pelaez:
 *  C = P₁ − e^k·P₂, P_j = ½ + (1/π)∫₀^∞ Im[e^{−iuk}φ_j(u)]/u du,
 *  φ₂ = CF de z (s=0), φ₁ = CF sous mesure action (s=1, martingale E[e^z]=1). */
export function batesCallF(k: number, T: number, p: BatesParams, N = 4000): number {
  const umax = 800;
  const du = umax / N;
  let p1 = 0;
  let p2 = 0;
  for (let i = 1; i <= N; i++) {
    const u = i * du;
    const c2 = batesCf(u, 0, T, p);
    const c1 = batesCf(u, 1, T, p);
    const c = Math.cos(u * k);
    const s = Math.sin(u * k);
    p2 += ((c * c2.im - s * c2.re) / u) * du;
    p1 += ((c * c1.im - s * c1.re) / u) * du;
  }
  const P2 = 0.5 + p2 / Math.PI;
  const P1 = 0.5 + p1 / Math.PI;
  return Math.max(P1 - Math.exp(k) * P2, 0);
}

/** IV Bates par bissection sur le prix BS forward (prix FFT par défaut: précision queue). */
export function batesIv(k: number, T: number, p: BatesParams, price?: number): number {
  const px = price ?? batesCallSurfaceFft([k], T, p, 2048).prices[0];
  let lo = 0.01;
  let hi = 2.5;
  const target = Math.max(px, 1e-12);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const sd = mid * Math.sqrt(T);
    const d1 = -k / sd + sd / 2;
    const bs = normCdf(d1) - Math.exp(k) * normCdf(d1 - sd);
    if (bs > target) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

/** FFT radix-2 in-place. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < len / 2; j++) {
        const ur = re[i + j];
        const ui = im[i + j];
        const vr = re[i + j + len / 2] * cr - im[i + j + len / 2] * ci;
        const vi = re[i + j + len / 2] * ci + im[i + j + len / 2] * cr;
        re[i + j] = ur + vr;
        im[i + j] = ui + vi;
        re[i + j + len / 2] = ur - vr;
        im[i + j + len / 2] = ui - vi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

/**
 * Prix call F=1 sur grille de strikes par densité FFT (Carr-Madan-like).
 * φ échantillonnée sur u ∈ [−U, U], densité z puis intégration du payoff.
 * Retourne {kGrid, prices, dens} — prices[i] = C(kGrid[i]).
 */
export function batesCallSurfaceFft(
  kGrid: number[],
  T: number,
  p: BatesParams,
  N = 4096
): { prices: number[]; z: number[]; dens: number[] } {
  const du = 0.4;
  const dz = (2 * Math.PI) / (N * du);
  const zMin = -(N / 2) * dz;
  // φ(u_k)·e^{−i u_k zMin}, k centré
  const phiRe = new Float64Array(N);
  const phiIm = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const u = (k - N / 2) * du;
    const cf = batesCf(Math.abs(u), 0, T, p);
    const sgn = u >= 0 ? 1 : -1;
    const cfRe = cf.re;
    const cfIm = sgn * cf.im; // φ(−u) = conj φ(u)
    const ph = -u * zMin;
    const wRe = Math.cos(ph);
    const wIm = Math.sin(ph);
    phiRe[k] = cfRe * wRe - cfIm * wIm;
    phiIm[k] = cfIm * wRe + cfRe * wIm;
  }
  // f(z_j) = (du/2π)·FFT[φ(u_k)e^{−iu_k z₀}]_j avec z_j = zMin + j·dz.
  // Tableau centré (k ↔ u=(k−N/2)du) → roll de N/2 (ifftshift) avant FFT.
  const xr = new Float64Array(N);
  const xi = new Float64Array(N);
  for (let k = 0; k < N; k++) {
    const kc = (k + N / 2) % N;
    xr[k] = phiRe[kc];
    xi[k] = phiIm[kc];
  }
  fft(xr, xi);
  const z: number[] = [];
  const dens: number[] = [];
  const norm = du / (2 * Math.PI);
  for (let j = 0; j < N; j++) {
    z.push(zMin + j * dz);
    dens.push(xr[j] * norm);
  }
  const prices = kGrid.map((k) => {
    let acc = 0;
    for (let j = 0; j < N; j++) {
      const pay = Math.exp(z[j]) - Math.exp(k);
      if (pay > 0) acc += pay * dens[j] * dz;
    }
    return acc;
  });
  return { prices, z, dens };
}

export function fellerStatus(p: BatesParams): { ok: boolean; ratio: number } {
  const ratio = (2 * p.kappa * p.theta) / (p.sigmaV * p.sigmaV);
  return { ok: ratio > 1, ratio };
}

export function buildCalibGrid(ssvi: SsviParams): { k: number; T: number; ivSsvi: number }[] {
  const surface = makeSsviSurface(ssvi);
  const ks = [-0.3, -0.24, -0.18, -0.12, -0.06, 0, 0.06, 0.12, 0.18, 0.24, 0.3];
  const Ts = ssvi.thetaCurve.map((t) => t.T).slice(0, 12);
  const out: { k: number; T: number; ivSsvi: number }[] = [];
  for (const T of Ts) {
    for (const k of ks) {
      out.push({ k, T, ivSsvi: Math.sqrt(Math.max(surface.w(k, T), 1e-12) / T) });
    }
  }
  return out;
}

/** Calibration Bates sur la surface SSVI (RMSE IV minimisé, pricing FFT groupé par T). */
export function calibrateBates(ssvi: SsviParams): BatesFitResult {
  const grid = buildCalibGrid(ssvi);
  const Ts = [...new Set(grid.map((g) => g.T))];
  const fromFree = (x: number[]): BatesParams => ({
    kappa: Math.exp(x[0]),
    theta: Math.exp(x[1]),
    sigmaV: Math.exp(x[2]),
    rho: Math.tanh(x[3]),
    V0: Math.exp(x[4]),
    lambdaJ: Math.exp(x[5]),
    nuJ: x[6],
    deltaJ: Math.exp(x[7]),
  });
  const toFree = (p: BatesParams): number[] => [
    Math.log(p.kappa),
    Math.log(p.theta),
    Math.log(p.sigmaV),
    Math.atanh(p.rho),
    Math.log(p.V0),
    Math.log(p.lambdaJ),
    p.nuJ,
    Math.log(p.deltaJ),
  ];
  const ivByT = (p: BatesParams): number[] | null => {
    const out: number[] = [];
    for (const T of Ts) {
      const pts = grid.filter((g) => g.T === T);
      const { prices } = batesCallSurfaceFft(pts.map((g) => g.k), T, p, 2048);
      for (let i = 0; i < pts.length; i++) {
        if (!isFinite(prices[i])) return null;
        out.push(batesIv(pts[i].k, T, p, prices[i]));
      }
    }
    return out;
  };
  const objective = (x: number[]): number => {
    const p = fromFree(x);
    if (p.kappa > 60 || p.sigmaV > 5 || p.lambdaJ > 4 || p.deltaJ > 0.5 || p.V0 > 0.4) return 1e9;
    const ivs = ivByT(p);
    if (!ivs) return 1e9;
    let sse = 0;
    for (let i = 0; i < grid.length; i++) sse += (ivs[i] - grid[i].ivSsvi) ** 2;
    // pénalité Feller: éviter les minima dégénérés (2κθ/σv² < 1.2 ⇒ variance CIR
    // peut toucher 0 ⇒ queues mal pricées). Calibration instable run-to-run sans ça.
    const fellerRatio = (2 * p.kappa * p.theta) / (p.sigmaV * p.sigmaV);
    return (sse / grid.length) * (1 + Math.max(0, 1.2 - fellerRatio) * 5);
  };
  const res = nelderMead(
    objective,
    toFree({ kappa: 2, theta: 0.04, sigmaV: 0.5, rho: -0.75, V0: 0.03, lambdaJ: 0.3, nuJ: -0.08, deltaJ: 0.1 }),
    { maxIter: 500, restarts: 3, seed: 31 }
  );
  const params = fromFree(res.x);
  const ivs = ivByT(params)!;
  let sse = 0;
  const outGrid: { k: number; T: number; ivSsvi: number; ivBates: number }[] = [];
  for (let i = 0; i < grid.length; i++) {
    outGrid.push({ ...grid[i], ivBates: ivs[i] });
    sse += (ivs[i] - grid[i].ivSsvi) ** 2;
  }
  const feller = fellerStatus(params);
  return {
    params,
    rmseIv: Math.sqrt(sse / grid.length),
    fellerOk: feller.ok,
    fellerRatio: feller.ratio,
    grid: outGrid,
  };
}
