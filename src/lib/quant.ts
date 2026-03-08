export interface Candle {
  o: number; h: number; l: number; c: number; v: number;
}

export function calcReturns(candles: Candle[]): number[] {
  const ret: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    ret.push((candles[i].c - candles[i - 1].c) / candles[i - 1].c);
  }
  return ret;
}

export function calcSharpe(returns: number[]): number | null {
  if (returns.length < 24) return null;
  const m = returns.reduce((a, b) => a + b, 0) / returns.length;
  const std = Math.sqrt(
    returns.reduce((a, b) => a + (b - m) * (b - m), 0) / (returns.length - 1)
  );
  if (std === 0) return null;
  return (m * 8760 - 0.05) / (std * Math.sqrt(8760));
}

export function calcVaR95(returns: number[]): number {
  const sorted = [...returns].sort((a, b) => a - b);
  return sorted[Math.floor(0.05 * sorted.length)] * 100;
}

export function calcVWAP(candles: Candle[]): number | null {
  let cpv = 0, cv = 0;
  for (const c of candles) {
    const tp = (c.h + c.l + c.c) / 3;
    cpv += tp * c.v;
    cv += c.v;
  }
  return cv > 0 ? cpv / cv : null;
}

export function calcTWAP(candles: Candle[]): number {
  return candles.reduce((a, c) => a + c.c, 0) / candles.length;
}

export function classifySentiment(
  whaleLong: number,
  whaleShort: number
): string {
  const total = whaleLong + whaleShort;
  if (total === 0) return 'NEUTRAL';
  const ratio = (whaleLong - whaleShort) / total;
  if (ratio > 0.6) return 'STRONG LONG';
  if (ratio > 0.2) return 'LONG BIAS';
  if (ratio < -0.6) return 'STRONG SHORT';
  if (ratio < -0.2) return 'SHORT BIAS';
  return 'NEUTRAL';
}
