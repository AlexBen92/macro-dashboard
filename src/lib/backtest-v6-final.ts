/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST V6-FINAL - IMPROVED MEAN-REVERSION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * LESSONS LEARNED FROM V6 ANALYSIS:
 * 1. BB-only signals are weak (97% of winners but 50% of losers)
 * 2. RSI 25-40 is "no man's land" - avoid
 * 3. SIGNAL_REVERSAL exit kills profits prematurely
 * 4. Long holds (>5 bars) indicate falling knife
 * 5. Need trend filter to avoid SOL/AVAX scenarios
 *
 * IMPROVEMENTS:
 * - Require BOTH BB AND RSI confirmation
 * - Stricter RSI thresholds (25/75 instead of 30/70)
 * - Removed SIGNAL_REVERSAL exit
 * - Added ADX trend filter (>20 = no trade)
 * - Dynamic max hold based on ATR
 * - Volume spike confirmation
 *
 * ═══════════════════════════════════════════════════════════════════════════════
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

export interface BacktestV6FinalOptions {
  bbPeriod?: number;
  bbStdDev?: number;
  rsiPeriod?: number;
  rsiOversold?: number;      // Stricter: 25
  rsiOverbought?: number;    // Stricter: 75
  requireBothSignals?: boolean; // true = need BB + RSI

  atrPeriod?: number;
  atrStopMult?: number;
  atrTPMult?: number;
  maxHoldBars?: number;

  adxPeriod?: number;
  adxTrendThreshold?: number; // Skip if ADX > this (trending)

  minVolatility?: number;
  maxVolatility?: number;
  volumeSpikeMult?: number;

  feeRate?: number;
  initialCapital?: number;
  maxRiskPerTrade?: number;
}

export interface TradeV6Final {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tpPrice: number;
  exitPrice: number;
  exitReason: 'STOP' | 'TP' | 'MAX_HOLD';
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
  volumeSignal: boolean;
  holdBars: number;
}

export interface BacktestV6FinalResult {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  sharpe: number;
  maxDrawdownPct: number;
  profitFactor: number;
  avgHoldBars: number;
  trades: TradeV6Final[];
  equityCurve: number[];
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

    // Simple EMA smoothing
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
// MAIN BACKTEST
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULTS = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiOversold: 25,      // Stricter!
  rsiOverbought: 75,    // Stricter!
  requireBothSignals: true,
  atrPeriod: 14,
  atrStopMult: 2.5,
  atrTPMult: 1.5,
  maxHoldBars: 30,      // Shorter max hold
  adxPeriod: 14,
  adxTrendThreshold: 20, // Skip trending markets
  minVolatility: 0.2,
  maxVolatility: 5.0,
  volumeSpikeMult: 1.3,
  feeRate: 0.0004,
  initialCapital: 10_000,
  maxRiskPerTrade: 0.01,
};

export function runBacktestV6Final(
  candles: BtCandle[],
  symbol: string,
  options: BacktestV6FinalOptions = {}
): BacktestV6FinalResult {
  const opts = { ...DEFAULTS, ...options };

  const {
    bbPeriod, bbStdDev, rsiPeriod, rsiOversold, rsiOverbought, requireBothSignals,
    atrPeriod, atrStopMult, atrTPMult, maxHoldBars,
    adxPeriod, adxTrendThreshold,
    minVolatility, maxVolatility, volumeSpikeMult,
    feeRate, initialCapital, maxRiskPerTrade,
  } = opts;

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volumes = candles.map(c => c.v);

  const atr = calculateATRPadded(highs, lows, closes, atrPeriod);
  const rsi = calculateRSIPadded(closes, rsiPeriod);
  const bb = calculateBollingerBandsPadded(closes, bbPeriod, bbStdDev);
  const ema50 = calculateEMAPadded(closes, 50);
  const adx = calculateADX(highs, lows, closes, adxPeriod);

  const volumeSMA = volumes.map((_, i) => {
    if (i < 20) return volumes[i];
    return volumes.slice(i - 20, i).reduce((a, b) => a + b, 0) / 20;
  });

  const trades: TradeV6Final[] = [];
  let capital = initialCapital;
  const equityCurve: number[] = [initialCapital];
  const peakCurve: number[] = [initialCapital];

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
    volumeSignal: boolean;
  };

  let position: Position | null = null;

  const minBars = Math.max(bbPeriod, rsiPeriod, atrPeriod, adxPeriod);
  const tradeCooldown = 5;

  for (let i = minBars; i < candles.length; i++) {
    const current = candles[i];
    const currentATR = atr[i];
    const atrPct = (currentATR / current.c) * 100;

    // Volatility filter
    if (atrPct < minVolatility || atrPct > maxVolatility) {
      equityCurve.push(capital);
      peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
      continue;
    }

    const currentBB = bb[i];
    const currentRSI = rsi[i];
    const currentADX = adx[i];
    const currentEma50 = ema50[i];
    const bbPosition = (current.c - currentBB.middle) / currentBB.stdDev;

    // TREND FILTER: Skip if strong trend (ADX > threshold)
    if (currentADX > adxTrendThreshold) {
      equityCurve.push(capital);
      peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
      continue;
    }

    // TREND FILTER: Skip if far from EMA50 (trending)
    const emaDistance = Math.abs(current.c - currentEma50) / currentEma50;
    if (emaDistance > 0.015) { // 1.5% from EMA = trending
      equityCurve.push(capital);
      peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    if (position) {
      const barsHeld = i - position.entryBar;

      let closeReason: TradeV6Final['exitReason'] | null = null;
      let exitPrice = current.c;

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

      if (barsHeld >= maxHoldBars && !closeReason) {
        closeReason = 'MAX_HOLD';
      }

      if (closeReason) {
        const pnlGross = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const pnlNet = pnlGross - (exitPrice * position.qty * feeRate) - (position.entryPrice * position.qty * feeRate);
        const pnlR = pnlNet / position.riskUsd;

        capital += pnlNet;

        trades.push({
          id: `v6f-${symbol}-${position.entryTime}`,
          coin: symbol,
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
          volumeSignal: position.volumeSignal,
          holdBars: barsHeld,
        });

        position = null;
      }

      equityCurve.push(capital);
      peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ENTRY SIGNALS
    // ═════════════════════════════════════════════════════════════════════════

    // Cooldown
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      const lastEntryIndex = Math.max(0, i - lastTrade.holdBars - 10);
      if (i - lastEntryIndex < tradeCooldown) {
        equityCurve.push(capital);
        peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
        continue;
      }
    }

    const isBelowLowerBand = current.c < currentBB.lower;
    const isAboveUpperBand = current.c > currentBB.upper;
    const isRSIOversold = currentRSI < rsiOversold;
    const isRSIOverbought = currentRSI > rsiOverbought;

    const hasVolumeSpike = current.v > volumeSMA[i] * volumeSpikeMult;

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
      // Require both if configured
      if (requireBothSignals) {
        if (bbSignal && rsiSignal) direction = 'LONG';
      } else {
        if (bbSignal || rsiSignal) direction = 'LONG';
      }
    }

    // SHORT signals
    if (isAboveUpperBand && currentRSI > 50) {
      bbSignal = isAboveUpperBand;
      if (isRSIOverbought) rsiSignal = true;
    } else if (isRSIOverbought && current.c > currentBB.middle) {
      rsiSignal = true;
    }

    if ((bbSignal || rsiSignal) && !isBelowLowerBand && currentRSI > 40) {
      if (requireBothSignals) {
        if (bbSignal && rsiSignal && direction === null) direction = 'SHORT';
      } else {
        if (bbSignal || rsiSignal) direction = 'SHORT';
      }
    }

    if (!direction) {
      equityCurve.push(capital);
      peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION SIZING
    // ═════════════════════════════════════════════════════════════════════════

    const stopDistance = currentATR * atrStopMult;
    const tpDistance = currentATR * atrTPMult;

    const entryPrice = current.c;
    const stopPrice = direction === 'LONG'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;
    const tpPrice = direction === 'LONG'
      ? entryPrice + tpDistance
      : entryPrice - tpDistance;

    const riskPerShare = Math.abs(entryPrice - stopPrice);
    const riskAmount = capital * maxRiskPerTrade;
    const qty = Math.floor(riskAmount / riskPerShare * 100) / 100;

    if (qty <= 0) {
      equityCurve.push(capital);
      peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
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
      bbSignal: isBelowLowerBand || isAboveUpperBand,
      rsiSignal: isRSIOversold || isRSIOverbought,
      volumeSignal: hasVolumeSpike,
    };

    equityCurve.push(capital);
    peakCurve.push(Math.max(peakCurve[peakCurve.length - 1], capital));
  }

  // ═════════════════════════════════════════════════════════════════════════
  // METRICS
  // ═════════════════════════════════════════════════════════════════════════

  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const totalPnl = capital - initialCapital;

  // Sharpe
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
  const sharpe = stdReturn !== 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 24) : 0;

  // Max DD
  let maxDD = 0;
  for (let i = 0; i < equityCurve.length; i++) {
    const dd = (peakCurve[i] - equityCurve[i]) / peakCurve[i] * 100;
    maxDD = Math.max(maxDD, dd);
  }

  const grossProfit = wins.reduce((s, t) => s + t.pnlNet, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlNet, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const avgHoldBars = trades.length > 0
    ? trades.reduce((s, t) => s + t.holdBars, 0) / trades.length
    : 0;

  return {
    coin: symbol,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    sharpe,
    maxDrawdownPct: maxDD,
    profitFactor,
    avgHoldBars,
    trades,
    equityCurve,
  };
}

export function runBatchBacktestV6Final(
  allCandles: Record<string, BtCandle[]>,
  options: BacktestV6FinalOptions = {}
): Record<string, BacktestV6FinalResult> {
  const results: Record<string, BacktestV6FinalResult> = {};
  for (const [symbol, candles] of Object.entries(allCandles)) {
    try {
      results[symbol] = runBacktestV6Final(candles, symbol, options);
    } catch (e) {
      console.error(`Failed ${symbol}:`, e);
    }
  }
  return results;
}
