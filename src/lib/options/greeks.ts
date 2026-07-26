const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

export function normalCdf(x: number): number {
  const L = Math.abs(x);
  const k = 1 / (1 + 0.2316419 * L);
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const poly =
    a1 * k + a2 * k * k + a3 * k ** 3 + a4 * k ** 4 + a5 * k ** 5;
  const cdf = 1 - normalPdf(L) * poly;
  return x >= 0 ? cdf : 1 - cdf;
}

function d1(S: number, K: number, T: number, sigma: number): number {
  const sigmaSqrtT = sigma * Math.sqrt(T);
  if (sigmaSqrtT === 0) return NaN;
  return (Math.log(S / K) + 0.5 * sigma * sigma * T) / sigmaSqrtT;
}

export function bsGamma(S: number, K: number, T: number, sigma: number): number {
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return 0;
  const d = d1(S, K, T, sigma);
  if (!Number.isFinite(d)) return 0;
  return normalPdf(d) / (S * sigma * Math.sqrt(T));
}

export function bsDelta(
  S: number,
  K: number,
  T: number,
  sigma: number,
  isCall: boolean,
): number {
  if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) return 0;
  const d = d1(S, K, T, sigma);
  if (!Number.isFinite(d)) return 0;
  const n = normalCdf(d);
  return isCall ? n : n - 1;
}
