/**
 * Nelder-Mead simplexe partagé calibration SSVI / Bates.
 * Déterministe, sans dépendance externe. Multi-restarts scramblés seedés.
 */

export interface NMOpts {
  maxIter?: number;
  tol?: number;
  restarts?: number;
  seed?: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runSimplex(
  f: (x: number[]) => number,
  x0: number[],
  scale: number,
  maxIter: number,
  tol: number
): { x: number[]; fx: number } {
  const n = x0.length;
  const pts: number[][] = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const p = x0.slice();
    p[i] += scale * Math.max(1e-3, Math.abs(p[i]));
    pts.push(p);
  }
  let fx = pts.map((p) => f(p));
  let iter = 0;
  while (iter < maxIter) {
    const order = fx.map((v, i) => [v, i] as [number, number]).sort((a, b) => a[0] - b[0]);
    const idx = order.map(([, i]) => i);
    if (
      Math.abs(fx[idx[n]] - fx[idx[0]]) < tol * (Math.abs(fx[idx[0]]) + tol) ||
      Math.abs(fx[idx[n]] - fx[idx[0]]) < 1e-14
    ) {
      break;
    }
    const best = pts[idx[0]];
    const centroid = new Array(n).fill(0);
    for (let i = 0; i < n; i++) centroid[i] /= n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) centroid[j] += pts[idx[i]][j] / n;
    const worst = pts[idx[n]];
    const reflect = centroid.map((c, i) => c + (c - worst[i]));
    const fr = f(reflect);
    if (fr < fx[idx[0]]) {
      const expand = centroid.map((c, i) => c + 2 * (c - worst[i]));
      const fe = f(expand);
      if (fe < fr) {
        pts[idx[n]] = expand;
        fx[idx[n]] = fe;
      } else {
        pts[idx[n]] = reflect;
        fx[idx[n]] = fr;
      }
    } else if (fr < fx[idx[n - 1]]) {
      pts[idx[n]] = reflect;
      fx[idx[n]] = fr;
    } else {
      const contract = centroid.map((c, i) => c + 0.5 * (worst[i] - c));
      const fc = f(contract);
      if (fc < fx[idx[n]]) {
        pts[idx[n]] = contract;
        fx[idx[n]] = fc;
      } else {
        for (let i = 1; i <= n; i++) {
          pts[idx[i]] = pts[idx[0]].map((v, j) => v + 0.5 * (pts[idx[i]][j] - v));
          fx[idx[i]] = f(pts[idx[i]]);
        }
      }
    }
    iter++;
  }
  let bi = 0;
  for (let i = 1; i < fx.length; i++) if (fx[i] < fx[bi]) bi = i;
  return { x: pts[bi], fx: fx[bi] };
}

/** Minimise f sur espace contraint via transformations fournies par l'appelant (toFree/fromFree). */
export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  opts: NMOpts = {}
): { x: number[]; fx: number } {
  const { maxIter = 800, tol = 1e-9, restarts = 3, seed = 7 } = opts;
  const rng = mulberry32(seed);
  let best = runSimplex(f, x0, 0.08, maxIter, tol);
  for (let r = 0; r < restarts; r++) {
    const jitter = x0.map((v) => v * (1 + (rng() - 0.5) * 0.4) + (rng() - 0.5) * 0.02);
    const cand = runSimplex(f, jitter, 0.12, maxIter, tol);
    if (cand.fx < best.fx) best = cand;
  }
  return best;
}
