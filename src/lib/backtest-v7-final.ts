/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST V7 - OPTIMIZED FROM V6 PATTERN ANALYSIS
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * KEY CHANGES FROM V6:
 * - maxHoldBars: 5 (V6 losers avg 6.3 bars, winners 2.4)
 * - No SIGNAL_REVERSAL exit (caused premature exits)
 * - RSI filter: avoid <25 and >75 (50% of V6 losses were extremes)
 * - Everything else same as V6
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
  rsiOversold?: number;
  rsiOverbought?: number;
  atrPeriod?: number;
  atrStopMult?: number;
  atrTPMult?: number;
  maxHoldBars?: number;
  minVolatility?: number;
  maxVolatility?: number;
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
  exitReason: 'STOP' | 'TP' | 'MAX_HOLD';
  qty: number;
  riskUsd: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS';
  entryBB: number;
  entryRSI: number;
  bbSignal: boolean;
  rsiSignal: boolean;
  holdBars: number;
  atrAtEntry: number;
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

const V7_DEFAULTS = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  atrPeriod: 14,
  atrStopMult: 2.0,    // V10: Tighter stop (was 2.5, stops killing us)
  atrTPMult: 1.5,
  maxHoldBars: 20,    // V12: BE threshold at 1.0x ATR
  minVolatility: 0.2,
  maxVolatility: 5.0,
  feeRate: 0.001,
  initialCapital: 10000,
  maxRiskPerTrade: 0.01,
} as const;

export function runBacktestV7(
  candles: BtCandle[],
  coin: string,
  options: Partial<BacktestV7Options> = {}
): BacktestV7Result {
  const opts = { ...V7_DEFAULTS, ...options };

  const {
    bbPeriod,
    bbStdDev,
    rsiPeriod,
    rsiOversold,
    rsiOverbought,
    atrPeriod,
    atrStopMult,
    atrTPMult,
    maxHoldBars,
    minVolatility,
    maxVolatility,
    feeRate,
    initialCapital,
    maxRiskPerTrade,
  } = opts;

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);

  // Calculate indicators
  const bb = calculateBollingerBands(closes, bbPeriod, bbStdDev);
  const rsi = calculateRSI(closes, rsiPeriod);
  const atr = calculateATR(highs, lows, closes, atrPeriod);
  const ema50 = calculateEMA(closes, 50);

  // Pad indicators
  const bbPad: (BollingerBands | null)[] = Array(bbPeriod - 1).fill(null).concat(bb);
  const rsiPad: number[] = Array(rsiPeriod - 1).fill(50).concat(rsi);
  const atrPad: number[] = Array(atrPeriod - 1).fill(atr[0] || 0).concat(atr);
  const ema50Pad: number[] = Array(49).fill(closes[0]).concat(ema50);

  const trades: TradeV7[] = [];
  let capital = initialCapital;
  const equityCurve: number[] = [capital];
  const drawdownCurve: number[] = [0];
  let peakEquity = capital;

  type Position = {
    direction: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    stopPrice: number;
    originalStopPrice: number;  // V11: Track original stop
    tpPrice: number;
    qty: number;
    riskUsd: number;
    atrAtEntry: number;
    entryBar: number;
    entryBB: number;
    entryRSI: number;
    bbSignal: boolean;
    rsiSignal: boolean;
    breakevenReached: boolean;  // V11: Track if stop moved to BE
  };

  let position: Position | null = null;

  const minBarsForSignals = Math.max(bbPeriod, rsiPeriod, atrPeriod);
  const tradeCooldown = 3;

  for (let i = minBarsForSignals; i < candles.length; i++) {
    const current = candles[i];
    const currentATR = atrPad[i] || 0;
    const atrPct = (currentATR / current.c) * 100;
    const currentBB = bbPad[i];
    const currentRSI = rsiPad[i] || 50;
    const currentEma50 = ema50Pad[i] || current.c;

    if (!currentBB || currentATR === 0) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // V9: RSI EXTREME FILTER DISABLED - was too aggressive
    // if (currentRSI < 25 || currentRSI > 75) {
    //   equityCurve.push(capital);
    //   peakEquity = Math.max(peakEquity, capital);
    //   drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
    //   continue;
    // }

    // Volatility filter
    if (atrPct < minVolatility || atrPct > maxVolatility) {
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

      // Calculate unrealized PnL %
      const unrealizedPnl = position.direction === 'LONG'
        ? (current.c - position.entryPrice) / position.entryPrice
        : (position.entryPrice - current.c) / position.entryPrice;

      // V12 Variant 4: No trailing stop - removed to test stricter entries

      let closeReason: TradeV7['exitReason'] | null = null;
      let exitPrice = current.c;

      if (position.direction === 'LONG') {
        if (current.l <= position.stopPrice) {
          closeReason = 'STOP';
          exitPrice = position.stopPrice;
        } else if (current.h >= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
        }
      } else {
        if (current.h >= position.stopPrice) {
          closeReason = 'STOP';
          exitPrice = position.stopPrice;
        } else if (current.l <= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
        }
      }

      // V11: Hard max hold
      if (!closeReason && barsHeld >= maxHoldBars) {
        closeReason = 'MAX_HOLD';
      }

      if (closeReason) {
        const feeExit = exitPrice * position.qty * feeRate;
        const pnlGross = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const pnlNet = pnlGross - feeExit - position.entryPrice * position.qty * feeRate;
        const pnlR = pnlNet / position.riskUsd;
        const outcome = pnlNet > 0 ? 'WIN' : 'LOSS';

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
          outcome,
          entryBB: position.entryBB,
          entryRSI: position.entryRSI,
          bbSignal: position.bbSignal,
          rsiSignal: position.rsiSignal,
          holdBars: barsHeld,
          atrAtEntry: position.atrAtEntry,
        });

        position = null;
      }

      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ENTRY SIGNALS (Same as V6)
    // ═════════════════════════════════════════════════════════════════════════

    // Cooldown
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      const lastEntryBar = i - lastTrade.holdBars;
      if (i - lastEntryBar < tradeCooldown) {
        equityCurve.push(capital);
        peakEquity = Math.max(peakEquity, capital);
        drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
        continue;
      }
    }

    // BB position
    const bbPosition = (current.c - currentBB.middle) / currentBB.stdDev;

    // Check signals
    const isBelowLowerBand = current.c < currentBB.lower;
    const isAboveUpperBand = current.c > currentBB.upper;
    const isRSIOversold = currentRSI < rsiOversold;
    const isRSIOverbought = currentRSI > rsiOverbought;

    // Trend filter
    const isUpTrend = current.c > currentEma50;
    const isDownTrend = current.c < currentEma50;
    const isInStrongTrend = Math.abs(current.c - currentEma50) / currentEma50 > 0.02;

    if (isInStrongTrend) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    // LONG SIGNAL
    let longSignal = false;
    let bbTriggeredLong = false;
    let rsiTriggeredLong = false;

    if ((isBelowLowerBand || bbPosition < -bbStdDev) && !isUpTrend) {
      longSignal = true;
      bbTriggeredLong = true;
    }
    if (isRSIOversold && !isUpTrend) {
      longSignal = true;
      rsiTriggeredLong = true;
    }

    // SHORT SIGNAL
    let shortSignal = false;
    let bbTriggeredShort = false;
    let rsiTriggeredShort = false;

    if ((isAboveUpperBand || bbPosition > bbStdDev) && !isDownTrend) {
      shortSignal = true;
      bbTriggeredShort = true;
    }
    if (isRSIOverbought && !isDownTrend) {
      shortSignal = true;
      rsiTriggeredShort = true;
    }

    // Determine direction
    let direction: 'LONG' | 'SHORT' | null = null;
    let bbSignal = false;
    let rsiSignal = false;

    if (longSignal && !shortSignal) {
      direction = 'LONG';
      bbSignal = bbTriggeredLong;
      rsiSignal = rsiTriggeredLong;
    } else if (shortSignal && !longSignal) {
      direction = 'SHORT';
      bbSignal = bbTriggeredShort;
      rsiSignal = rsiTriggeredShort;
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
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
      continue;
    }

    position = {
      direction,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      originalStopPrice: stopPrice,  // V11: Track original
      tpPrice,
      qty,
      riskUsd: riskAmount,
      atrAtEntry: currentATR,
      entryBar: i,
      entryBB: bbPosition,
      entryRSI: currentRSI,
      bbSignal,
      rsiSignal,
      breakevenReached: false,  // V11: Track BE state
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
  const downsideVariance = downsideReturns.reduce((a, b) => a + b * b, 0) / (downsideReturns.length || 1);
  const sortino = downsideVariance !== 0 ? (mean / Math.sqrt(downsideVariance)) * Math.sqrt(252 * 24) : 0;

  const maxDD = Math.max(...drawdownCurve);

  const grossWins = wins.reduce((s, t) => s + t.pnlNet + feeRate * (t.entryPrice + t.exitPrice) * t.qty, 0);
  const grossLosses = Math.abs(losses.reduce((s, t) => s + t.pnlNet - feeRate * (t.entryPrice + t.exitPrice) * t.qty, 0));
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
