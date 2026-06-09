/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST V7-PATTERN - OPTIMIZED FROM V6 ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * KEY CHANGES FROM V6:
 * - maxHoldBars: 5 (V6 losers avg 6.3 bars, winners 2.4)
 * - requireBothSignals: false (97% of V6 winners had BB only)
 * - Quick exit after 3 bars if no profit
 * - RSI filter: avoid <25 and >75 (50% of V6 losses were RSI extremes)
 * - Tighter TP for faster exits
 */

import {
  calculateATR,
  calculateEMA,
  calculateRSI,
  calculateBollingerBands,
  type BollingerBands,
} from './technical-utils';

export interface BtCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BacktestV7Options {
  bbPeriod?: number;
  bbStdDev?: number;
  rsiPeriod?: number;
  rsiOversold?: number;   // Filter: avoid below this
  rsiOverbought?: number; // Filter: avoid above this
  requireBothSignals?: boolean;
  atrPeriod?: number;
  atrStopMult?: number;
  atrTPMult?: number;
  maxHoldBars?: number;    // V7: 5 bars max
  quickExitBars?: number;  // V7: exit if no profit after X bars
  adxPeriod?: number;
  adxTrendThreshold?: number;
  feeRate?: number;
  initialCapital?: number;
  maxRiskPerTrade?: number;
}

export interface TradeV7 {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tpPrice: number;
  exitPrice: number;
  exitReason: 'STOP' | 'TP' | 'MAX_HOLD' | 'QUICK_EXIT';
  qty: number;
  riskUsd: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS';
  entryBB?: number;
  entryRSI?: number;
  entryADX?: number;
  bbSignal: boolean;
  rsiSignal: boolean;
  holdBars: number;
}

export interface BacktestV7Result {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  profitFactor: number;
  avgHoldBars: number;
  avgWin: number;
  avgLoss: number;
  trades: TradeV7[];
  equityCurve: number[];
  drawdownCurve: number[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PADDED INDICATORS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateEMAPadded(data: number[], period: number): number[] {
  const raw = calculateEMA(data, period);
  const padding = data.length - raw.length;
  const result: number[] = [];
  for (let i = 0; i < padding; i++) result.push(data[i]);
  result.push(...raw);
  return result;
}

function calculateATRPadded(h: number[], l: number[], c: number[], p: number): number[] {
  const tr: number[] = [];
  for (let i = 1; i < h.length; i++) {
    tr.push(Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1])));
  }
  const atr: number[] = [];
  for (let i = p - 1; i < tr.length; i++) {
    atr.push(tr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p);
  }
  const padding = c.length - atr.length;
  for (let i = 0; i < padding; i++) atr.unshift(atr[0] || 0);
  return atr;
}

function calculateRSIPadded(c: number[], p: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < p; i++) result.push(50);
  for (let i = p; i < c.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - p + 1; j <= i; j++) {
      const ch = c[j] - c[j-1];
      if (ch > 0) gains += ch; else losses -= ch;
    }
    result.push(losses === 0 ? 100 : 100 - (100 / (1 + (gains/p) / (losses/p))));
  }
  return result;
}

function calculateBollingerBandsPadded(c: number[], p: number, stdDev: number): BollingerBands[] {
  const raw = calculateBollingerBands(c, p, stdDev);
  const padding = c.length - raw.length;
  const result: BollingerBands[] = [];
  for (let i = 0; i < padding; i++) {
    result.push({ middle: c[i], upper: c[i], lower: c[i], stdDev: 0 });
  }
  result.push(...raw);
  return result;
}

function calculateADX(h: number[], l: number[], c: number[], p: number): number[] {
  const adx: number[] = [];
  const dx: number[] = [];

  for (let i = 1; i < c.length; i++) {
    const tr = Math.max(h[i] - l[i], Math.abs(h[i] - c[i-1]), Math.abs(l[i] - c[i-1]));
    const upMove = h[i] - h[i-1];
    const downMove = l[i-1] - l[i];
    const plusDM = (upMove > downMove && upMove > 0) ? upMove : 0;
    const minusDM = (downMove > upMove && downMove > 0) ? downMove : 0;

    const alpha = 1 / p;
    const smoothTR = i === 1 ? tr : (tr * alpha + (tr * (1 - alpha)));
    const plusDI = smoothTR !== 0 ? (plusDM / smoothTR) * 100 : 0;
    const minusDI = smoothTR !== 0 ? (minusDM / smoothTR) * 100 : 0;

    const dxVal = smoothTR !== 0 ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100 : 0;
    dx.push(dxVal);

    if (dx.length >= p) {
      adx.push(dx.slice(-p).reduce((a, b) => a + b, 0) / p);
    } else {
      adx.push(0);
    }
  }

  while (adx.length < c.length) adx.unshift(0);
  return adx;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS - V7 OPTIMIZED
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULTS: BacktestV7Options = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiOversold: 30,   // V7: Filter extremes (<30 = skip)
  rsiOverbought: 70, // V7: Filter extremes (>70 = skip)
  requireBothSignals: false, // V7: BB only was 97% of V6 winners
  atrPeriod: 14,
  atrStopMult: 2.0,
  atrTPMult: 1.5,
  maxHoldBars: 5,    // V7: HARD limit (losers avg 6.3 bars)
  quickExitBars: 3,  // V7: Exit if no profit after 3 bars
  adxPeriod: 14,
  adxTrendThreshold: 25, // Skip strong trends
  feeRate: 0.001,
  initialCapital: 10000,
  maxRiskPerTrade: 0.01,
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BACKTEST
// ═══════════════════════════════════════════════════════════════════════════════

export function runBacktestV7(
  candles: BtCandle[],
  coin: string,
  options: BacktestV7Options = {}
): BacktestV7Result {
  const opts = { ...DEFAULTS, ...options };

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);

  const atr = calculateATRPadded(highs, lows, closes, opts.atrPeriod!);
  const rsi = calculateRSIPadded(closes, opts.rsiPeriod!);
  const bb = calculateBollingerBandsPadded(closes, opts.bbPeriod!, opts.bbStdDev!);
  const ema50 = calculateEMAPadded(closes, 50);
  const adx = calculateADX(highs, lows, closes, opts.adxPeriod!);

  const trades: TradeV7[] = [];
  let capital = opts.initialCapital!;
  const equityCurve: number[] = [capital];
  const drawdownCurve: number[] = [0];
  let peakEquity = capital;
  let tradeId = 0;

  type Position = {
    direction: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    stopPrice: number;
    tpPrice: number;
    qty: number;
    riskUsd: number;
    entryBar: number;
    entryBB: number;
    entryRSI: number;
    entryADX: number;
    bbSignal: boolean;
    rsiSignal: boolean;
  };

  let position: Position | null = null;

  const minBars = Math.max(opts.bbPeriod!, opts.rsiPeriod!, opts.atrPeriod!, opts.adxPeriod!);
  const tradeCooldown = 5;

  for (let i = minBars; i < candles.length; i++) {
    const current = candles[i];
    const currentATR = atr[i];
    const currentBB = bb[i];
    const currentRSI = rsi[i];
    const currentADX = adx[i];
    const currentEma50 = ema50[i];
    const bbPosition = (current.c - currentBB.middle) / currentBB.stdDev;

    // V7: RSI EXTREME FILTER (skip if RSI <25 or >75 - these were 50% of V6 losses)
    if (currentRSI < 25 || currentRSI > 75) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // TREND FILTER: Skip strong trends
    if (currentADX > opts.adxTrendThreshold!) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // TREND FILTER: Skip if far from EMA50
    const emaDistance = Math.abs(current.c - currentEma50) / currentEma50;
    if (emaDistance > 0.02) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    if (position) {
      const barsHeld = i - position.entryBar;
      const unrealizedPnl = position.direction === 'LONG'
        ? (current.c - position.entryPrice) / position.entryPrice
        : (position.entryPrice - current.c) / position.entryPrice;

      let closeReason: TradeV7['exitReason'] | null = null;
      let exitPrice = current.c;

      // Standard exits
      if (position.direction === 'LONG') {
        if (current.h >= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
        } else if (current.l <= position.stopPrice) {
          closeReason = 'STOP';
          exitPrice = position.stopPrice;
        }
      } else {
        if (current.l <= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
        } else if (current.h >= position.stopPrice) {
          closeReason = 'STOP';
          exitPrice = position.stopPrice;
        }
      }

      // V7: Quick exit if no profit after quickExitBars
      if (!closeReason && barsHeld >= opts.quickExitBars! && unrealizedPnl <= 0) {
        closeReason = 'QUICK_EXIT';
      }

      // V7: Hard max hold
      if (!closeReason && barsHeld >= opts.maxHoldBars!) {
        closeReason = 'MAX_HOLD';
      }

      if (closeReason) {
        const pnlGross = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const fee = (exitPrice + position.entryPrice) * position.qty * opts.feeRate!;
        const pnlNet = pnlGross - fee;
        const pnlR = pnlNet / position.riskUsd;

        capital += pnlNet;

        trades.push({
          id: `v7-${coin}-${position.entryTime}`,
          coin,
          direction: position.direction,
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          stopPrice: position.stopPrice,
          tpPrice: position.tpPrice,
          exitPrice,
          exitReason: closeReason,
          qty: position.qty,
          riskUsd: position.riskUsd,
          pnlNet,
          pnlR,
          outcome: pnlNet > 0 ? 'WIN' : 'LOSS',
          entryBB: position.entryBB,
          entryRSI: position.entryRSI,
          entryADX: position.entryADX,
          bbSignal: position.bbSignal,
          rsiSignal: position.rsiSignal,
          holdBars: barsHeld,
        });

        position = null;
      }

      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ENTRY SIGNALS (Same as V6 but with requireBothSignals=false)
    // ═════════════════════════════════════════════════════════════════════════

    // Cooldown
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      const lastEntryIndex = Math.max(0, i - lastTrade.holdBars - 10);
      if (i - lastEntryIndex < tradeCooldown) {
        equityCurve.push(capital);
        peakEquity = Math.max(peakEquity, capital);
        drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
        continue;
      }
    }

    const isBelowLowerBand = current.c < currentBB.lower;
    const isAboveUpperBand = current.c > currentBB.upper;
    const isRSIOversold = currentRSI < opts.rsiOversold!;
    const isRSIOverbought = currentRSI > opts.rsiOverbought!;

    let bbSignal = false;
    let rsiSignal = false;
    let direction: 'LONG' | 'SHORT' | null = null;

    // LONG signals
    if (isBelowLowerBand && currentRSI < 50) {
      bbSignal = true;
      if (isRSIOversold) rsiSignal = true;
    } else if (isRSIOversold && current.c < currentBB.middle) {
      rsiSignal = true;
    }

    if ((bbSignal || rsiSignal) && !isAboveUpperBand && currentRSI < 60) {
      if (opts.requireBothSignals!) {
        if (bbSignal && rsiSignal) direction = 'LONG';
      } else {
        if (bbSignal || rsiSignal) direction = 'LONG';
      }
    }

    // SHORT signals
    if (!direction) {
      if (isAboveUpperBand && currentRSI > 50) {
        bbSignal = isAboveUpperBand;
        if (isRSIOverbought) rsiSignal = true;
      } else if (isRSIOverbought && current.c > currentBB.middle) {
        rsiSignal = true;
      }

      if ((bbSignal || rsiSignal) && !isBelowLowerBand && currentRSI > 40) {
        if (opts.requireBothSignals!) {
          if (bbSignal && rsiSignal) direction = 'SHORT';
        } else {
          if (bbSignal || rsiSignal) direction = 'SHORT';
        }
      }
    }

    if (!direction) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION SIZING
    // ═════════════════════════════════════════════════════════════════════════

    const stopDistance = currentATR * opts.atrStopMult!;
    const tpDistance = currentATR * opts.atrTPMult!;

    const entryPrice = current.c;
    const stopPrice = direction === 'LONG'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
    const tpPrice = direction === 'LONG'
      ? entryPrice + tpDistance
      : entryPrice - tpDistance;

    const riskPerShare = Math.abs(entryPrice - stopPrice);
    const riskAmount = capital * opts.maxRiskPerTrade!;
    const qty = Math.floor(riskAmount / riskPerShare * 100) / 100;

    if (qty <= 0) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    position = {
      direction,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      tpPrice,
      qty,
      riskUsd: riskAmount,
      entryBar: i,
      entryBB: bbPosition,
      entryRSI: currentRSI,
      entryADX: currentADX,
      bbSignal,
      rsiSignal,
    };

    equityCurve.push(capital);
    peakEquity = Math.max(peakEquity, capital);
    drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CALCULATE METRICS
  // ═════════════════════════════════════════════════════════════════════════

  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');

  const totalPnl = trades.reduce((s, t) => s + t.pnlNet, 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev !== 0 ? (mean / stdDev) * Math.sqrt(252 * 24) : 0;

  const downsideReturns = returns.filter(r => r < 0);
  const downsideVariance = downsideReturns.reduce((a, b) => a + b * b, 0) / downsideReturns.length || 0;
  const sortino = downsideVariance !== 0 ? (mean / Math.sqrt(downsideVariance)) * Math.sqrt(252 * 24) : 0;

  const maxDD = Math.max(...drawdownCurve);

  const grossWins = wins.reduce((s, t) => s + t.pnlNet + opts.feeRate! * (t.entryPrice + t.exitPrice) * t.qty, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnlNet - opts.feeRate! * (t.entryPrice + t.exitPrice) * t.qty, 0));
  const profitFactor = grossLosses !== 0 ? grossWins / grossLosses : 0;

  const avgHoldBars = trades.length > 0
    ? trades.reduce((s, t) => s + t.holdBars, 0) / trades.length
    : 0;

  const avgWin = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlNet, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlNet, 0) / losses.length : 0;

  return {
    coin,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    sharpe,
    sortino,
    maxDrawdownPct: maxDD,
    profitFactor,
    avgHoldBars,
    avgWin,
    avgLoss,
    trades,
    equityCurve,
    drawdownCurve,
  };
}
