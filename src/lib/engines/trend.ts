export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type TrendDirection = 'bull' | 'bear' | 'range';

export interface TrendResult {
  direction: TrendDirection;
  strength: number;
  adx: number;
  emaSlope: number;
  donchianBreakout: boolean;
  timeframe: 'D' | '4H' | 'M15';
}

function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = new Array(values.length);
  out[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    out[i] = values[i] * k + out[i - 1] * (1 - k);
  }
  return out;
}

function trueRange(c: Candle[], prevClose: number): number {
  return Math.max(
    c[c.length - 1].high - c[c.length - 1].low,
    Math.abs(c[c.length - 1].high - prevClose),
    Math.abs(c[c.length - 1].low - prevClose),
  );
}

export function calcADX(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  let prevTr = 0;
  let prevPlusDM = 0;
  let prevMinusDM = 0;
  const trArr: number[] = [];
  const plusDMArr: number[] = [];
  const minusDMArr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const up = candles[i].high - candles[i - 1].high;
    const down = candles[i - 1].low - candles[i].low;
    const plusDM = up > down && up > 0 ? up : 0;
    const minusDM = down > up && down > 0 ? down : 0;
    const pc = candles[i - 1].close;
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - pc),
      Math.abs(candles[i].low - pc),
    );
    trArr.push(tr);
    plusDMArr.push(plusDM);
    minusDMArr.push(minusDM);
  }
  let tr = 0;
  let pdm = 0;
  let mdm = 0;
  for (let i = 0; i < period; i++) {
    tr += trArr[i];
    pdm += plusDMArr[i];
    mdm += minusDMArr[i];
  }
  const dxArr: number[] = [];
  for (let i = period; i < trArr.length; i++) {
    tr = tr - tr / period + trArr[i];
    pdm = pdm - pdm / period + plusDMArr[i];
    mdm = mdm - mdm / period + minusDMArr[i];
    const pdi = tr === 0 ? 0 : (100 * pdm) / tr;
    const mdi = tr === 0 ? 0 : (100 * mdm) / tr;
    const denom = pdi + mdi;
    const dx = denom === 0 ? 0 : (100 * Math.abs(pdi - mdi)) / denom;
    dxArr.push(dx);
  }
  if (dxArr.length === 0) return 0;
  if (dxArr.length < period) {
    return dxArr.reduce((s, v) => s + v, 0) / dxArr.length;
  }
  let adx = 0;
  for (let i = 0; i < period; i++) adx += dxArr[i];
  adx /= period;
  for (let i = period; i < dxArr.length; i++) {
    adx = (adx * (period - 1) + dxArr[i]) / period;
  }
  prevTr = tr;
  prevPlusDM = pdm;
  prevMinusDM = mdm;
  void prevTr;
  void prevPlusDM;
  void prevMinusDM;
  return adx;
}

function donchianBreakout(candles: Candle[], period = 20): boolean {
  if (candles.length < period + 1) return false;
  const last = candles[candles.length - 1];
  let upper = -Infinity;
  let lower = Infinity;
  for (let i = candles.length - period - 1; i < candles.length - 1; i++) {
    if (candles[i].high > upper) upper = candles[i].high;
    if (candles[i].low < lower) lower = candles[i].low;
  }
  return last.close > upper || last.close < lower;
}

export function classifyTrend(
  candles: Candle[],
  timeframe: 'D' | '4H' | 'M15',
): TrendResult {
  const closes = candles.map((c) => c.close);
  const ema20 = ema(closes, 20);
  const lastEma = ema20[ema20.length - 1];
  const prevEma = ema20[ema20.length - 2] ?? lastEma;
  const emaSlope = lastEma !== 0 ? (lastEma - prevEma) / lastEma : 0;
  const adx = calcADX(candles, 14);
  const breakout = donchianBreakout(candles, 20);

  let direction: TrendDirection = 'range';
  if (adx > 25 && emaSlope > 0) direction = 'bull';
  else if (adx > 25 && emaSlope < 0) direction = 'bear';

  const adxNorm = Math.min(100, (adx / 50) * 100);
  const slopeNorm = Math.min(100, Math.abs(emaSlope) * 1000);
  const breakoutScore = breakout ? 100 : 0;
  const strength = Math.round(
    adxNorm * 0.5 + slopeNorm * 0.3 + breakoutScore * 0.2,
  );

  return { direction, strength, adx, emaSlope, donchianBreakout: breakout, timeframe };
}
