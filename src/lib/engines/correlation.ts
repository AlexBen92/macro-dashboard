export type CorrWindow = '24h' | '7d' | '30d' | '60d' | '120d' | '252d';

export interface CorrCell {
  a: string;
  b: string;
  r: number;
  window: CorrWindow;
  n: number;
}

export function pricesToLogReturns(prices: number[]): number[] {
  if (prices.length < 2) return [];
  const out: number[] = new Array(prices.length - 1);
  for (let i = 1; i < prices.length; i++) {
    out[i - 1] = Math.log(prices[i] / prices[i - 1]);
  }
  return out;
}

export function pearsonLogReturns(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < n; i++) {
    sa += a[i];
    sb += b[i];
  }
  const ma = sa / n;
  const mb = sb / n;
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}

export function correlationMatrix(
  series: Record<string, number[]>,
  window: number,
): CorrCell[] {
  const assets = Object.keys(series);
  const cells: CorrCell[] = [];
  for (let i = 0; i < assets.length; i++) {
    for (let j = i; j < assets.length; j++) {
      const a = assets[i];
      const b = assets[j];
      const sa = series[a];
      const sb = series[b];
      const len = Math.min(sa.length, sb.length, window);
      if (len < 2) continue;
      const sliceA = sa.slice(sa.length - len);
      const sliceB = sb.slice(sb.length - len);
      const r = pearsonLogReturns(sliceA, sliceB);
      cells.push({ a, b, r, window: windowToWindow(window), n: len });
    }
  }
  return cells;
}

function windowToWindow(w: number): CorrWindow {
  if (w <= 24) return '24h';
  if (w <= 30) return '30d';
  if (w <= 60) return '60d';
  if (w <= 120) return '120d';
  return '252d';
}

export function crisisCorrelation(
  refReturns: number[],
  otherReturns: number[],
  decile: number,
): number {
  const n = Math.min(refReturns.length, otherReturns.length);
  if (n < 2) return 0;
  const paired: Array<{ ref: number; other: number }> = new Array(n);
  for (let i = 0; i < n; i++) {
    paired[i] = { ref: refReturns[i], other: otherReturns[i] };
  }
  paired.sort((x, y) => x.ref - y.ref);
  const k = Math.max(1, Math.floor(n * decile));
  const worst = paired.slice(0, k);
  const refWorst = worst.map((p) => p.ref);
  const otherWorst = worst.map((p) => p.other);
  return pearsonLogReturns(refWorst, otherWorst);
}
