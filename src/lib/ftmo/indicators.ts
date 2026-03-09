import type { YahooCandle } from './types';

export function ema(candles: YahooCandle[], period: number): number[] {
  if (candles.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [candles[0].c];
  for (let i = 1; i < candles.length; i++) {
    result.push(candles[i].c * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function sma(candles: YahooCandle[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < period - 1) { result.push(NaN); continue; }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].c;
    result.push(sum / period);
  }
  return result;
}

export function rsi(candles: YahooCandle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const delta = candles[i].c - candles[i - 1].c;
    if (delta > 0) avgGain += delta; else avgLoss -= delta;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < candles.length; i++) {
    const delta = candles[i].c - candles[i - 1].c;
    if (delta > 0) { avgGain = (avgGain * (period - 1) + delta) / period; avgLoss = (avgLoss * (period - 1)) / period; }
    else { avgGain = (avgGain * (period - 1)) / period; avgLoss = (avgLoss * (period - 1) - delta) / period; }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function bollingerBands(candles: YahooCandle[], period = 20, mult = 2): { upper: number; middle: number; lower: number } {
  if (candles.length < period) return { upper: 0, middle: 0, lower: 0 };
  const recent = candles.slice(-period);
  const mid = recent.reduce((a, c) => a + c.c, 0) / period;
  const std = Math.sqrt(recent.reduce((a, c) => a + (c.c - mid) ** 2, 0) / period);
  return { upper: mid + mult * std, middle: mid, lower: mid - mult * std };
}

export function adx(candles: YahooCandle[], period = 14): number {
  if (candles.length < period * 2) return 20;
  const tr: number[] = [];
  const dmPlus: number[] = [];
  const dmMinus: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].h, l = candles[i].l, pc = candles[i - 1].c;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const up = candles[i].h - candles[i - 1].h;
    const down = candles[i - 1].l - candles[i].l;
    dmPlus.push(up > down && up > 0 ? up : 0);
    dmMinus.push(down > up && down > 0 ? down : 0);
  }
  // Smoothed
  let atr = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let sdmP = dmPlus.slice(0, period).reduce((a, b) => a + b, 0);
  let sdmM = dmMinus.slice(0, period).reduce((a, b) => a + b, 0);
  const dx: number[] = [];
  for (let i = period; i < tr.length; i++) {
    atr = atr - atr / period + tr[i];
    sdmP = sdmP - sdmP / period + dmPlus[i];
    sdmM = sdmM - sdmM / period + dmMinus[i];
    const diP = (sdmP / atr) * 100;
    const diM = (sdmM / atr) * 100;
    const sum = diP + diM;
    dx.push(sum > 0 ? (Math.abs(diP - diM) / sum) * 100 : 0);
  }
  if (dx.length < period) return dx.length > 0 ? dx[dx.length - 1] : 20;
  let adxVal = dx.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < dx.length; i++) {
    adxVal = (adxVal * (period - 1) + dx[i]) / period;
  }
  return adxVal;
}

export function atr(candles: YahooCandle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].h, l = candles[i].l, pc = candles[i - 1].c;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return trs.reduce((a, b) => a + b, 0) / trs.length;
  let val = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    val = (val * (period - 1) + trs[i]) / period;
  }
  return val;
}

export function atrPercentile(candles: YahooCandle[], currentATR: number, period = 14): number {
  // Calculate ATR for each point, then percentile rank current value
  const atrs: number[] = [];
  for (let i = period + 1; i < candles.length; i++) {
    const slice = candles.slice(i - period - 1, i);
    atrs.push(atr(slice, period));
  }
  if (atrs.length === 0) return 50;
  const below = atrs.filter(a => a < currentATR).length;
  return Math.round((below / atrs.length) * 100);
}
