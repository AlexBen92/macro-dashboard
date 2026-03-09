import type { YahooCandle, AsianRangeState, ScalpState, LondonBOState, MeanRevState, ORBState } from './types';
import { ema, rsi, bollingerBands, adx, atr, atrPercentile, sma } from './indicators';
import { calculateLotSize } from './risk';

// ══════════ GOLD ASIAN RANGE BREAKOUT ══════════
export function calcAsianRange(goldH1: YahooCandle[], goldDaily?: YahooCandle[]): AsianRangeState {
  const now = new Date();
  const hourUTC = now.getUTCHours();

  // Find today's Asian session candles (22:00 yesterday to 07:00 today)
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const asianStart = todayStart.getTime() - 2 * 3600 * 1000; // 22:00 yesterday
  const asianEnd = todayStart.getTime() + 7 * 3600 * 1000;   // 07:00 today

  const asianCandles = goldH1.filter(c => c.t >= asianStart && c.t <= asianEnd);

  if (asianCandles.length < 2) {
    return {
      rangeHigh: 0, rangeLow: 0, rangeWidth: 0,
      h4Trend: 'RANGE', breakoutDirection: 'NONE',
      h1ClosedAbove: false, h1ClosedBelow: false,
      status: 'FORMING', entry: null, stop: null, tp1: null, tp2: null,
    };
  }

  const rangeHigh = Math.max(...asianCandles.map(c => c.h));
  const rangeLow = Math.min(...asianCandles.map(c => c.l));
  const rangeWidth = rangeHigh - rangeLow;

  // H4 trend: use last 6 H1 candles grouped, or SMA
  let h4Trend: 'UP' | 'DOWN' | 'RANGE' = 'RANGE';
  if (goldH1.length >= 24) {
    const recent = goldH1.slice(-24);
    const firstHalf = recent.slice(0, 12).reduce((a, c) => a + c.c, 0) / 12;
    const secondHalf = recent.slice(12).reduce((a, c) => a + c.c, 0) / 12;
    if (secondHalf > firstHalf * 1.001) h4Trend = 'UP';
    else if (secondHalf < firstHalf * 0.999) h4Trend = 'DOWN';
  }
  // Daily SMA50 check
  if (goldDaily && goldDaily.length >= 50) {
    const sma50 = goldDaily.slice(-50).reduce((a, c) => a + c.c, 0) / 50;
    const lastPrice = goldH1[goldH1.length - 1]?.c ?? 0;
    if (lastPrice > sma50 && h4Trend === 'RANGE') h4Trend = 'UP';
    if (lastPrice < sma50 && h4Trend === 'RANGE') h4Trend = 'DOWN';
  }

  // Check H1 close above/below range
  const closedH1 = goldH1.filter(c => c.t >= asianEnd);
  const lastClosed = closedH1.length >= 2 ? closedH1[closedH1.length - 2] : null;
  const h1ClosedAbove = lastClosed ? lastClosed.c > rangeHigh : false;
  const h1ClosedBelow = lastClosed ? lastClosed.c < rangeLow : false;

  let status: AsianRangeState['status'] = 'FORMING';
  if (hourUTC < 7) status = 'FORMING';
  else if (hourUTC >= 7 && hourUTC < 16) {
    if (h1ClosedAbove || h1ClosedBelow) status = 'TRIGGERED';
    else status = 'READY';
  } else status = 'EXPIRED';

  const breakoutDirection = h1ClosedAbove ? 'ABOVE' : h1ClosedBelow ? 'BELOW' : 'NONE';

  // Calculate entry/stop/TP
  let entry: number | null = null, stop: number | null = null, tp1: number | null = null, tp2: number | null = null;
  if (breakoutDirection === 'ABOVE') {
    entry = rangeHigh;
    stop = rangeHigh - rangeWidth * 0.5;
    tp1 = rangeHigh + rangeWidth;
    tp2 = rangeHigh + rangeWidth * 1.5;
  } else if (breakoutDirection === 'BELOW') {
    entry = rangeLow;
    stop = rangeLow + rangeWidth * 0.5;
    tp1 = rangeLow - rangeWidth;
    tp2 = rangeLow - rangeWidth * 1.5;
  }

  return { rangeHigh, rangeLow, rangeWidth, h4Trend, breakoutDirection, h1ClosedAbove, h1ClosedBelow, status, entry, stop, tp1, tp2 };
}

// ══════════ SCALP GOLD LONDON/NY ══════════
export function calcScalp(goldM15: YahooCandle[], goldDaily?: YahooCandle[]): ScalpState {
  const now = new Date();
  const hourUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  const isOverlapActive = hourUTC >= 13 && hourUTC <= 16.5;

  if (goldM15.length < 50) {
    return {
      isOverlapActive, ema20: 0, ema50: 0, emaTrend: 'FLAT',
      pullbackToEMA: false, atrCurrent: 0, atrPercentile: 50,
      status: 'INACTIVE', direction: null, entry: null, stop: null, tp: null,
    };
  }

  const ema20Vals = ema(goldM15, 20);
  const ema50Vals = ema(goldM15, 50);
  const ema20Val = ema20Vals[ema20Vals.length - 1];
  const ema50Val = ema50Vals[ema50Vals.length - 1];
  const price = goldM15[goldM15.length - 1].c;

  let emaTrend: 'BULL' | 'BEAR' | 'FLAT' = 'FLAT';
  if (price > ema20Val && ema20Val > ema50Val) emaTrend = 'BULL';
  else if (price < ema20Val && ema20Val < ema50Val) emaTrend = 'BEAR';

  const distToEma20 = Math.abs(price - ema20Val);
  const atrVal = atr(goldM15, 14);
  const pullbackToEMA = distToEma20 < atrVal * 0.5;
  const pct = atrPercentile(goldDaily || goldM15, atrVal, 14);

  let status: ScalpState['status'] = 'INACTIVE';
  let direction: 'LONG' | 'SHORT' | null = null;
  let entry: number | null = null, stop: number | null = null, tp: number | null = null;

  if (!isOverlapActive) status = 'INACTIVE';
  else if (emaTrend === 'FLAT') status = 'WATCHING';
  else if (pullbackToEMA) {
    status = 'SETUP';
    direction = emaTrend === 'BULL' ? 'LONG' : 'SHORT';
    entry = ema20Val;
    stop = emaTrend === 'BULL' ? ema50Val : ema50Val;
    tp = emaTrend === 'BULL' ? price + atrVal * 2 : price - atrVal * 2;
  } else {
    status = 'ACTIVE';
  }

  return { isOverlapActive, ema20: ema20Val, ema50: ema50Val, emaTrend, pullbackToEMA, atrCurrent: atrVal, atrPercentile: pct, status, direction, entry, stop, tp };
}

// ══════════ LONDON BREAKOUT ══════════
export function calcLondonBO(candles1h: YahooCandle[], pair: string): LondonBOState {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const asianEnd = todayStart.getTime() + 7 * 3600 * 1000;

  const asianCandles = candles1h.filter(c => c.t >= todayStart.getTime() && c.t < asianEnd);

  if (asianCandles.length < 2) {
    return {
      pair, asianRangeHigh: 0, asianRangeLow: 0, rangeWidthPips: 0,
      tooWide: false, buyStop: null, sellStop: null, tpDistance: 0,
      eaStatus: 'OFF',
    };
  }

  const rangeHigh = Math.max(...asianCandles.map(c => c.h));
  const rangeLow = Math.min(...asianCandles.map(c => c.l));
  const pipMultiplier = pair.includes('JPY') ? 100 : 10000;
  const rangeWidthPips = Math.round((rangeHigh - rangeLow) * pipMultiplier);
  const maxPips = pair === 'EURUSD' ? 60 : 80;
  const tooWide = rangeWidthPips > maxPips;

  const offset = 2 / pipMultiplier; // 2 pips buffer
  const buyStop = tooWide ? null : rangeHigh + offset;
  const sellStop = tooWide ? null : rangeLow - offset;
  const tpDistance = rangeWidthPips * 1.5;

  let eaStatus: LondonBOState['eaStatus'] = 'OFF';
  if (hourUTC < 7) eaStatus = 'OFF';
  else if (hourUTC >= 7 && hourUTC < 8 && !tooWide) eaStatus = 'PLACING';
  else if (hourUTC >= 8 && hourUTC < 12 && !tooWide) eaStatus = 'LIVE';
  else eaStatus = 'DONE';

  return { pair, asianRangeHigh: rangeHigh, asianRangeLow: rangeLow, rangeWidthPips, tooWide, buyStop, sellStop, tpDistance, eaStatus };
}

// ══════════ MEAN REVERSION RSI/BB ══════════
export function calcMeanRev(candles4h: YahooCandle[], pair: string): MeanRevState {
  if (candles4h.length < 30) {
    return {
      pair, timeframe: 'H4', rsi14: 50, bbUpper: 0, bbLower: 0, bbMiddle: 0,
      priceVsBB: 'INSIDE', adx: 20, adxFilter: true, signalType: 'NONE',
      eaStatus: 'OFF', currentPrice: 0, nextCloseIn: '--',
    };
  }

  const rsiVal = rsi(candles4h, 14);
  const bb = bollingerBands(candles4h, 20, 2);
  const adxVal = adx(candles4h, 14);
  const price = candles4h[candles4h.length - 1].c;
  const adxFilter = adxVal < 25;

  let priceVsBB: MeanRevState['priceVsBB'] = 'INSIDE';
  if (price >= bb.upper) priceVsBB = 'ABOVE_UPPER';
  else if (price <= bb.lower) priceVsBB = 'BELOW_LOWER';

  let signalType: MeanRevState['signalType'] = 'NONE';
  if (adxFilter) {
    if (rsiVal < 30 && priceVsBB === 'BELOW_LOWER') signalType = 'BUY';
    else if (rsiVal > 70 && priceVsBB === 'ABOVE_UPPER') signalType = 'SELL';
  }

  let eaStatus: MeanRevState['eaStatus'] = 'OFF';
  if (!adxFilter) eaStatus = 'OFF';
  else if (signalType !== 'NONE') eaStatus = 'SIGNAL';
  else eaStatus = 'SCANNING';

  // Next H4 close
  const now = new Date();
  const h = now.getUTCHours();
  const nextH4 = Math.ceil((h + 1) / 4) * 4;
  const minsLeft = (nextH4 - h - 1) * 60 + (60 - now.getUTCMinutes());
  const nextCloseIn = `${Math.floor(minsLeft / 60)}h ${minsLeft % 60}m`;

  return { pair, timeframe: 'H4', rsi14: rsiVal, bbUpper: bb.upper, bbLower: bb.lower, bbMiddle: bb.middle, priceVsBB, adx: adxVal, adxFilter, signalType, eaStatus, currentPrice: price, nextCloseIn };
}

// ══════════ ORB NAS100/US30 ══════════
export function calcORB(candles5m: YahooCandle[], candles1h: YahooCandle[], instrument: string): ORBState {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  const minUTC = now.getUTCMinutes();
  const decimalHour = hourUTC + minUTC / 60;

  const orbStartH = 14.5; // 14:30
  const orbEndH = 14.75;  // 14:45

  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const orbStartMs = todayStart.getTime() + orbStartH * 3600 * 1000;
  const orbEndMs = todayStart.getTime() + orbEndH * 3600 * 1000;

  const orbCandles = candles5m.filter(c => c.t >= orbStartMs && c.t <= orbEndMs);

  let orbHigh: number | null = null, orbLow: number | null = null, orbWidthPoints: number | null = null;
  if (orbCandles.length >= 2) {
    orbHigh = Math.max(...orbCandles.map(c => c.h));
    orbLow = Math.min(...orbCandles.map(c => c.l));
    orbWidthPoints = Math.round(orbHigh - orbLow);
  }

  // H1 bias
  let h1Bias: ORBState['h1Bias'] = 'NEUTRAL';
  if (candles1h.length >= 6) {
    const recent = candles1h.slice(-6);
    const vwapApprox = recent.reduce((a, c) => a + (c.h + c.l + c.c) / 3 * c.v, 0) / recent.reduce((a, c) => a + c.v, 0);
    const lastPrice = candles1h[candles1h.length - 1].c;
    if (lastPrice > vwapApprox * 1.001) h1Bias = 'BULL';
    else if (lastPrice < vwapApprox * 0.999) h1Bias = 'BEAR';
  }

  let breakoutDirection: ORBState['breakoutDirection'] = 'NONE';
  if (orbHigh != null && orbLow != null && candles5m.length > 0) {
    const lastPrice = candles5m[candles5m.length - 1].c;
    if (lastPrice > orbHigh) breakoutDirection = 'ABOVE';
    else if (lastPrice < orbLow) breakoutDirection = 'BELOW';
  }

  let status: ORBState['status'] = 'WAITING';
  if (decimalHour < orbStartH) status = 'WAITING';
  else if (decimalHour < orbEndH) status = 'FORMING';
  else if (decimalHour < 16.5) {
    if (breakoutDirection !== 'NONE') status = 'TRIGGERED';
    else status = 'READY';
  } else status = 'EXPIRED';

  const minutesUntilOpen = Math.max(0, Math.round((orbStartH - decimalHour) * 60));

  return { instrument, orbHigh, orbLow, orbWidthPoints, h1Bias, breakoutDirection, status, minutesUntilOpen };
}

// ══════════ CURRENCY STRENGTH ══════════
export function calcCurrencyStrength(
  instruments: Record<string, { change24h: number }>
): { currency: string; strength: number; change24h: number }[] {
  const pairs: Record<string, { base: string; quote: string; key: string }> = {
    EURUSD: { base: 'EUR', quote: 'USD', key: 'EURUSD' },
    GBPUSD: { base: 'GBP', quote: 'USD', key: 'GBPUSD' },
    USDJPY: { base: 'USD', quote: 'JPY', key: 'USDJPY' },
    USDCHF: { base: 'USD', quote: 'CHF', key: 'USDCHF' },
    AUDUSD: { base: 'AUD', quote: 'USD', key: 'AUDUSD' },
    USDCAD: { base: 'USD', quote: 'CAD', key: 'USDCAD' },
  };

  const scores: Record<string, number[]> = {};
  for (const [, p] of Object.entries(pairs)) {
    const data = instruments[p.key];
    if (!data) continue;
    const ch = data.change24h;
    if (!scores[p.base]) scores[p.base] = [];
    if (!scores[p.quote]) scores[p.quote] = [];
    scores[p.base].push(ch);
    scores[p.quote].push(-ch);
  }

  return Object.entries(scores)
    .map(([currency, vals]) => {
      const avg = vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
      return { currency, strength: Math.round(avg * 100), change24h: avg };
    })
    .sort((a, b) => b.strength - a.strength);
}
