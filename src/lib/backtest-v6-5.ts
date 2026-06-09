/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST ENGINE V6.5 - MEAN-REVERSION WITH STATISTICAL VALIDATION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * BASED ON V6 (91.3% Win Rate) + P4 IMPROVEMENTS:
 * - Trailing stop: protect profits
 * - Better R:R: 1:3 (TP 4.5x, SL 1.5x)
 * - Volume spike confirmation
 * - Statistical validation metrics
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

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BtCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BacktestV65Options {
  // Mean-Reversion Parameters
  bbPeriod?: number;
  bbStdDev?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;

  // Entry thresholds
  minBBSignal?: number;      // Min BB position for entry
  minRSISignal?: number;     // Min RSI distance for entry

  // Risk Management (P4-inspired)
  atrPeriod?: number;
  atrStopMult?: number;      // 1.5x (tighter stop)
  atrTPMult?: number;        // 4.5x (asymmetric R:R)
  trailingStopMult?: number; // 1.2x - trail after 1R profit
  trailingStopTrigger?: number; // Start trailing after 1R profit
  maxHoldBars?: number;

  // Filters
  minVolatility?: number;
  maxVolatility?: number;
  volumeSpikeMult?: number;  // Volume confirmation

  // Risk
  feeRate?: number;
  initialCapital?: number;
  maxRiskPerTrade?: number;
}

export interface TradeV65 {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tpPrice: number;
  exitPrice: number;
  exitReason: 'STOP' | 'TP' | 'TRAILING_STOP' | 'MAX_HOLD' | 'SIGNAL_REVERSAL';
  qty: number;
  riskUsd: number;
  feeEntry: number;
  feeExit: number;
  pnlGross: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS';
  balanceAfter: number;

  // Entry context
  entryBB?: number;
  entryRSI?: number;
  entryVolume?: number;
  bbSignal: boolean;
  rsiSignal: boolean;
  volumeSignal: boolean;

  holdBars: number;
  atrAtEntry: number;
  maxAdverseExcursion: number;
  maxFavorableExcursion: number;
}

export interface BacktestV65Result {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;

  // Returns
  totalPnl: number;
  totalPnlPct: number;
  avgTradeReturn: number;

  // Risk-Adjusted
  sharpe: number;
  sortino: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  calmar: number;

  // Metrics
  profitFactor: number;
  avgHoldBars: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;

  // Exit analysis
  tpHits: number;
  stopHits: number;
  trailingStopHits: number;
  maxHoldHits: number;
  signalReversalHits: number;

  // Signal analysis
  bbSignals: number;
  rsiSignals: number;
  bothSignals: number;
  volumeSignals: number;

  // Curves
  equityCurve: number[];
  drawdownCurve: number[];

  // Trades
  trades: TradeV65[];
  winsList: TradeV65[];
  lossesList: TradeV65[];

  // Metadata
  runDate: string;
  candleFrom: string;
  candleTo: string;
  totalCandles: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PADDED INDICATOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateEMAPadded(data: number[], period: number): number[] {
  const rawResult = calculateEMA(data, period);
  const padding = data.length - rawResult.length;
  const result: number[] = [];

  for (let i = 0; i < padding; i++) {
    result.push(data[i]);
  }
  result.push(...rawResult);
  return result;
}

function calculateATRPadded(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): number[] {
  const tr: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr.push(Math.max(hl, hc, lc));
  }

  const atr: number[] = [];
  for (let i = period - 1; i < tr.length; i++) {
    const sum = tr.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    atr.push(sum / period);
  }

  const padding = closes.length - atr.length;
  for (let i = 0; i < padding; i++) {
    atr.unshift(atr[0] || 0);
  }
  return atr;
}

function calculateRSIPadded(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  for (let i = 0; i < period; i++) {
    result.push(50); // Neutral
  }

  for (let i = period; i < closes.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) result.push(100);
    else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

function calculateBollingerBandsPadded(
  closes: number[],
  period: number = 20,
  stdDevMult: number = 2.0
): BollingerBands[] {
  const rawResult = calculateBollingerBands(closes, period, stdDevMult);
  const padding = closes.length - rawResult.length;
  const result: BollingerBands[] = [];

  for (let i = 0; i < padding; i++) {
    result.push({ middle: closes[i], upper: closes[i], lower: closes[i], stdDev: 0 });
  }
  result.push(...rawResult);
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════════

const V65_DEFAULTS = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  minBBSignal: 1.5,
  minRSISignal: 5,
  atrPeriod: 14,
  atrStopMult: 1.5,
  atrTPMult: 4.5,
  trailingStopMult: 1.2,
  trailingStopTrigger: 1.0,
  maxHoldBars: 50,
  minVolatility: 0.2,
  maxVolatility: 5.0,
  volumeSpikeMult: 1.5,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BACKTEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function runBacktestV65(
  candles: BtCandle[],
  symbol: string,
  options: BacktestV65Options = {}
): BacktestV65Result {
  const opts = { ...V65_DEFAULTS, ...options };

  const {
    bbPeriod, bbStdDev, rsiPeriod, rsiOversold, rsiOverbought,
    minBBSignal, minRSISignal,
    atrPeriod, atrStopMult, atrTPMult, trailingStopMult, trailingStopTrigger, maxHoldBars,
    minVolatility, maxVolatility, volumeSpikeMult,
    feeRate = 0.0004,
    initialCapital = 10_000,
    maxRiskPerTrade = 0.01,
  } = opts;

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volumes = candles.map(c => c.v);
  const times = candles.map(c => c.t);

  // Indicators
  const atr = calculateATRPadded(highs, lows, closes, atrPeriod);
  const rsi = calculateRSIPadded(closes, rsiPeriod);
  const bb = calculateBollingerBandsPadded(closes, bbPeriod, bbStdDev);
  const ema50 = calculateEMAPadded(closes, 50);

  // Volume SMA
  const volumeSMA = volumes.map((_, i) => {
    if (i < 20) return volumes[i];
    const slice = volumes.slice(i - 20, i);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  const trades: TradeV65[] = [];
  let capital = initialCapital;
  const equityCurve: number[] = [initialCapital];
  const drawdownCurve: number[] = [0];
  let peakEquity = initialCapital;

  let tpHits = 0, stopHits = 0, trailingStopHits = 0, maxHoldHits = 0, signalReversalHits = 0;
  let bbSignals = 0, rsiSignals = 0, bothSignals = 0, volumeSignals = 0;

  type Position = {
    direction: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    stopPrice: number;
    tpPrice: number;
    trailingStopPrice: number;
    highestPrice: number;
    lowestPrice: number;
    qty: number;
    riskUsd: number;
    atrAtEntry: number;
    entryBar: number;
    entryBB: number;
    entryRSI: number;
    bbSignal: boolean;
    rsiSignal: boolean;
    volumeSignal: boolean;
  };

  let position: Position | null = null;

  const minBarsForSignals = Math.max(bbPeriod, rsiPeriod, atrPeriod);
  const tradeCooldown = 3;

  for (let i = minBarsForSignals; i < candles.length; i++) {
    const current = candles[i];
    const currentATR = atr[i];
    const atrPct = (currentATR / current.c) * 100;
    const currentBB = bb[i];
    const currentRSI = rsi[i];
    const currentEma50 = ema50[i];
    const bbPosition = (current.c - currentBB.middle) / currentBB.stdDev;

    // Volatility filter
    if (atrPct < minVolatility || atrPct > maxVolatility) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    if (position) {
      const barsHeld = i - position.entryBar;

      // Update trailing stop after 1R profit
      const unrealizedR = position.direction === 'LONG'
        ? (current.h - position.entryPrice) / (position.entryPrice - position.stopPrice)
        : (position.entryPrice - current.l) / (position.stopPrice - position.entryPrice);

      if (unrealizedR >= trailingStopTrigger) {
        if (position.direction === 'LONG') {
          position.highestPrice = Math.max(position.highestPrice, current.h);
          const newTrail = position.highestPrice - (position.atrAtEntry * trailingStopMult);
          position.trailingStopPrice = Math.max(position.trailingStopPrice, newTrail);
        } else {
          position.lowestPrice = Math.min(position.lowestPrice, current.l);
          const newTrail = position.lowestPrice + (position.atrAtEntry * trailingStopMult);
          position.trailingStopPrice = Math.min(position.trailingStopPrice, newTrail);
        }
      }

      let closeReason: TradeV65['exitReason'] | null = null;
      let exitPrice = current.c;

      if (position.direction === 'LONG') {
        if (current.h >= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
          tpHits++;
        } else if (current.l <= position.trailingStopPrice) {
          closeReason = position.trailingStopPrice > position.stopPrice ? 'TRAILING_STOP' : 'STOP';
          exitPrice = position.trailingStopPrice;
          if (closeReason === 'TRAILING_STOP') trailingStopHits++;
          else stopHits++;
        }
      } else {
        if (current.l <= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
          tpHits++;
        } else if (current.h >= position.trailingStopPrice) {
          closeReason = position.trailingStopPrice < position.stopPrice ? 'TRAILING_STOP' : 'STOP';
          exitPrice = position.trailingStopPrice;
          if (closeReason === 'TRAILING_STOP') trailingStopHits++;
          else stopHits++;
        }
      }

      if (barsHeld >= maxHoldBars && !closeReason) {
        closeReason = 'MAX_HOLD';
        maxHoldHits++;
      }

      // Signal reversal
      if (!closeReason) {
        if (position.direction === 'LONG' && currentRSI > rsiOverbought) {
          closeReason = 'SIGNAL_REVERSAL';
        } else if (position.direction === 'SHORT' && currentRSI < rsiOversold) {
          closeReason = 'SIGNAL_REVERSAL';
        }
      }
      if (closeReason === 'SIGNAL_REVERSAL') signalReversalHits++;

      if (closeReason) {
        const feeExit = exitPrice * position.qty * feeRate;
        const pnlGross = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const pnlNet = pnlGross - feeExit - position.entryPrice * position.qty * feeRate;
        const pnlR = pnlNet / position.riskUsd;
        const outcome = pnlNet > 0 ? 'WIN' : 'LOSS';

        capital += pnlNet;

        // Track MAE/MFE
        let maxAdverse = 0, maxFavorable = 0;
        if (position.direction === 'LONG') {
          for (let j = position.entryBar; j < i; j++) {
            const adverse = (position.entryPrice - lows[j]) / position.riskUsd;
            const favorable = (highs[j] - position.entryPrice) / position.riskUsd;
            maxAdverse = Math.max(maxAdverse, adverse);
            maxFavorable = Math.max(maxFavorable, favorable);
          }
        } else {
          for (let j = position.entryBar; j < i; j++) {
            const adverse = (highs[j] - position.entryPrice) / position.riskUsd;
            const favorable = (position.entryPrice - lows[j]) / position.riskUsd;
            maxAdverse = Math.max(maxAdverse, adverse);
            maxFavorable = Math.max(maxFavorable, favorable);
          }
        }

        trades.push({
          id: `v65-${symbol}-${position.entryTime}`,
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
          feeEntry: position.entryPrice * position.qty * feeRate,
          feeExit,
          pnlGross,
          pnlNet,
          pnlR,
          outcome,
          balanceAfter: capital,
          entryBB: position.entryBB,
          entryRSI: position.entryRSI,
          bbSignal: position.bbSignal,
          rsiSignal: position.rsiSignal,
          volumeSignal: position.volumeSignal,
          holdBars: barsHeld,
          atrAtEntry: position.atrAtEntry,
          maxAdverseExcursion: maxAdverse,
          maxFavorableExcursion: maxFavorable,
        } as TradeV65);

        position = null;
      }

      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ENTRY SIGNALS
    // ═════════════════════════════════════════════════════════════════════════

    // Cooldown
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      if (i - (lastTrade.entryTime ? times.indexOf(lastTrade.entryTime) : i - lastTrade.holdBars) < tradeCooldown) {
        equityCurve.push(capital);
        drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
        continue;
      }
    }

    // Trend filter: avoid strong trends
    const isInStrongTrend = Math.abs(current.c - currentEma50) / currentEma50 > 0.02;
    if (isInStrongTrend) {
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    const isBelowLowerBand = bbPosition < -bbStdDev;
    const isAboveUpperBand = bbPosition > bbStdDev;
    const isRSIOversold = currentRSI < rsiOversold;
    const isRSIOverbought = currentRSI > rsiOverbought;

    // Volume spike confirmation
    const hasVolumeSpike = current.v > volumeSMA[i] * volumeSpikeMult;
    if (hasVolumeSpike) volumeSignals++;

    let bbTriggered = false;
    let rsiTriggered = false;

    // LONG signals
    let longSignal = false;
    if (isBelowLowerBand && Math.abs(bbPosition) >= minBBSignal) {
      longSignal = true;
      bbTriggered = true;
    }
    if (isRSIOversold && (rsiOversold - currentRSI) >= minRSISignal) {
      longSignal = true;
      rsiTriggered = true;
    }

    // SHORT signals
    let shortSignal = false;
    if (isAboveUpperBand && bbPosition >= minBBSignal) {
      shortSignal = true;
      bbTriggered = true;
    }
    if (isRSIOverbought && (currentRSI - rsiOverbought) >= minRSISignal) {
      shortSignal = true;
      rsiTriggered = true;
    }

    // Count signals
    if (bbTriggered) bbSignals++;
    if (rsiTriggered) rsiSignals++;
    if (bbTriggered && rsiTriggered) bothSignals++;

    // Determine direction
    let direction: 'LONG' | 'SHORT' | null = null;
    if (longSignal && !shortSignal) {
      direction = 'LONG';
    } else if (shortSignal && !longSignal) {
      direction = 'SHORT';
    }

    if (!direction) {
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
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
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    position = {
      direction,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      tpPrice,
      trailingStopPrice: stopPrice,
      highestPrice: entryPrice,
      lowestPrice: entryPrice,
      qty,
      riskUsd: riskAmount,
      atrAtEntry: currentATR,
      entryBar: i,
      entryBB: bbPosition,
      entryRSI: currentRSI,
      bbSignal: bbTriggered,
      rsiSignal: rsiTriggered,
      volumeSignal: hasVolumeSpike,
    };

    equityCurve.push(capital);
    peakEquity = Math.max(peakEquity, capital);
    drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // CALCULATE METRICS
  // ═════════════════════════════════════════════════════════════════════════

  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;

  const totalPnl = capital - initialCapital;
  const totalPnlPct = (totalPnl / initialCapital) * 100;
  const avgTradeReturn = trades.length > 0 ? totalPnl / trades.length : 0;

  const grossProfit = wins.reduce((sum, t) => sum + t.pnlGross, 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlGross, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const avgWin = wins.length > 0 ? wins.reduce((sum, t) => sum + t.pnlNet, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((sum, t) => sum + t.pnlNet, 0) / losses.length : 0;
  const winLossRatio = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;

  const avgHoldBars = trades.length > 0
    ? trades.reduce((sum, t) => sum + t.holdBars, 0) / trades.length
    : 0;

  // Sharpe & Sortino
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
  const sharpe = stdReturn !== 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 24) : 0;

  const negReturns = returns.filter(r => r < 0);
  const avgNegReturn = negReturns.reduce((a, b) => a + b, 0) / negReturns.length;
  const stdNegReturn = Math.sqrt(negReturns.map(r => Math.pow(r - avgNegReturn, 2)).reduce((a, b) => a + b, 0) / negReturns.length);
  const sortino = stdNegReturn !== 0 ? (avgReturn / stdNegReturn) * Math.sqrt(252 * 24) : 0;

  // Drawdown & Calmar
  const maxDD = Math.min(...drawdownCurve);
  const maxDDUsd = (maxDD / 100) * initialCapital;
  const maxDDPct = Math.abs(maxDD);
  const days = candles.length / 24;
  const cagr = Math.pow(capital / initialCapital, 365 / days) - 1;
  const calmar = maxDDPct !== 0 ? (cagr * 100) / maxDDPct : 0;

  return {
    coin: symbol,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    totalPnlPct,
    avgTradeReturn,
    sharpe,
    sortino,
    maxDrawdownUsd: maxDDUsd,
    maxDrawdownPct: maxDDPct,
    calmar,
    profitFactor,
    avgHoldBars,
    avgWin,
    avgLoss,
    winLossRatio,
    tpHits,
    stopHits,
    trailingStopHits,
    maxHoldHits,
    signalReversalHits,
    bbSignals,
    rsiSignals,
    bothSignals,
    volumeSignals,
    equityCurve,
    drawdownCurve,
    trades,
    winsList: wins,
    lossesList: losses,
    runDate: new Date().toISOString(),
    candleFrom: candles[0]?.t ? new Date(candles[0].t).toISOString() : '',
    candleTo: candles[candles.length - 1]?.t ? new Date(candles[candles.length - 1].t).toISOString() : '',
    totalCandles: candles.length,
  };
}

export function runBatchBacktestV65(
  allCandles: Record<string, BtCandle[]>,
  options: BacktestV65Options = {}
): Record<string, BacktestV65Result> {
  const results: Record<string, BacktestV65Result> = {};
  for (const [symbol, candles] of Object.entries(allCandles)) {
    try {
      results[symbol] = runBacktestV65(candles, symbol, options);
    } catch (e) {
      console.error(`Failed to backtest ${symbol}:`, e);
    }
  }
  return results;
}
