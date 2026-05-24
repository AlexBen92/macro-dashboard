/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST ENGINE V6 - MEAN-REVERSION (CRYPTO OPTIMIZED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * APPRENED FROM V5 FAILURES:
 * - Trend-following failed: 27% WR, -$276K total loss
 * - Trailing stop killed 98.6% of trades
 * - Negative momentum outperformed positive (34.2% vs 26.3% WR)
 * - Whipsaw death: 52.8% of trades lost between -1R and 0R
 *
 * V6 HYPOTHESIS:
 * Crypto H1 is mean-reverting, not trending. Use BB/RSI for mean-reversion.
 *
 * KEY IMPROVEMENTS:
 * 1. Mean-Reversion signals (BB, RSI)
 * 2. R:R 1:1.5 (requires ~40% WR to break even)
 * 3. Stop: 2.5x ATR, TP: 1.5x ATR
 * 4. NO trailing stop (let winners run)
 * 5. Overbought/Oversold filters
 * 6. Optional: 4H timeframe
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  calculateATR,
  calculateEMA,
  calculateRSI,
  calculateBollingerBands,
} from './technical-utils';

export interface BtCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BacktestV6Options {
  // Mean-Reversion Parameters
  bbPeriod?: number;       // 20
  bbStdDev?: number;       // 2.0
  rsiPeriod?: number;      // 14

  // Entry Thresholds
  rsiOversold?: number;    // 30 (buy signal)
  rsiOverbought?: number;  // 70 (sell signal)
  bbLowerBand?: number;    // -2.0 sigma (buy signal)
  bbUpperBand?: number;    // +2.0 sigma (sell signal)

  // Risk Management
  atrPeriod?: number;
  atrStopMult?: number;    // 2.5x (relaxed)
  atrTPMult?: number;      // 1.5x (closer TP)
  maxHoldBars?: number;

  // Filters
  minVolatility?: number;   // Min ATR% to trade
  maxVolatility?: number;   // Max ATR% (skip crazy moves)
  volumeSpikeMult?: number; // Volume spike confirm

  // Risk
  feeRate?: number;
  initialCapital?: number;
  maxRiskPerTrade?: number;

  // Validation
  runMonteCarlo?: boolean;
  mcSimulations?: number;
}

export interface TradeV6 {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tpPrice: number;
  exitPrice: number;
  exitReason: 'STOP' | 'TP' | 'MAX_HOLD' | 'SIGNAL_REVERSAL';
  qty: number;
  riskUsd: number;
  feeEntry: number;
  feeExit: number;
  pnlGross: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS';
  balanceAfter: number;

  // Signals
  entryBB?: number;        // BB position at entry (-2 to +2)
  entryRSI?: number;       // RSI at entry
  bbSignal: boolean;       // Was BB signal triggered?
  rsiSignal: boolean;      // Was RSI signal triggered?

  holdBars: number;
  atrAtEntry: number;
}

export interface BacktestV6Result {
  // Basic
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

  // Metrics
  profitFactor: number;
  avgHoldBars: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;

  // Curves
  equityCurve: number[];
  drawdownCurve: number[];

  // Trades
  trades: TradeV6[];
  winsList: TradeV6[];
  lossesList: TradeV6[];

  // Signal Analysis
  bbSignalsTriggered: number;
  rsiSignalsTriggered: number;
  bothSignalsTriggered: number;

  // Metadata
  runDate: string;
  candleFrom: string;
  candleTo: string;
  totalCandles: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS (Mean-Reversion Optimized)
// ═══════════════════════════════════════════════════════════════════════════════

const V6_DEFAULTS = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,
  atrPeriod: 14,
  atrStopMult: 2.5,
  atrTPMult: 1.5,
  maxHoldBars: 50,
  minVolatility: 0.2,  // 0.2% ATR minimum
  maxVolatility: 5.0,  // 5% ATR maximum (skip chaos)
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BACKTEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function runBacktestV6(
  candles: BtCandle[],
  symbol: string,
  options: BacktestV6Options = {}
): BacktestV6Result {
  const opts = {
    ...V6_DEFAULTS,
    bbPeriod: options.bbPeriod ?? V6_DEFAULTS.bbPeriod,
    bbStdDev: options.bbStdDev ?? V6_DEFAULTS.bbStdDev,
    rsiPeriod: options.rsiPeriod ?? V6_DEFAULTS.rsiPeriod,
    rsiOversold: options.rsiOversold ?? V6_DEFAULTS.rsiOversold,
    rsiOverbought: options.rsiOverbought ?? V6_DEFAULTS.rsiOverbought,
    atrPeriod: options.atrPeriod ?? V6_DEFAULTS.atrPeriod,
    atrStopMult: options.atrStopMult ?? V6_DEFAULTS.atrStopMult,
    atrTPMult: options.atrTPMult ?? V6_DEFAULTS.atrTPMult,
    maxHoldBars: options.maxHoldBars ?? V6_DEFAULTS.maxHoldBars,
    minVolatility: options.minVolatility ?? V6_DEFAULTS.minVolatility,
    maxVolatility: options.maxVolatility ?? V6_DEFAULTS.maxVolatility,
    feeRate: options.feeRate ?? 0.0004,
    initialCapital: options.initialCapital ?? 10_000,
    maxRiskPerTrade: options.maxRiskPerTrade ?? 0.01,
  };

  const {
    bbPeriod, bbStdDev, rsiPeriod, rsiOversold, rsiOverbought,
    atrPeriod, atrStopMult, atrTPMult, maxHoldBars,
    minVolatility, maxVolatility,
    feeRate, initialCapital, maxRiskPerTrade,
  } = opts;

  // ═════════════════════════════════════════════════════════════════════════
  // PRE-COMPUTATIONS
  // ═════════════════════════════════════════════════════════════════════════

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volumes = candles.map(c => c.v);
  const times = candles.map(c => c.t);

  // Indicators
  const bb = calculateBollingerBands(closes, bbPeriod, bbStdDev);
  const rsi = calculateRSI(closes, rsiPeriod);
  const atr = calculateATR(highs, lows, closes, atrPeriod);
  const ema50 = calculateEMA(closes, 50);  // Trend filter

  // Volume SMA for spike detection
  const volumeSMA = volumes.map((_, i) => {
    if (i < 20) return volumes[i];
    const slice = volumes.slice(i - 20, i);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });

  // ═════════════════════════════════════════════════════════════════════════
  // BACKTEST LOOP
  // ═════════════════════════════════════════════════════════════════════════

  const trades: TradeV6[] = [];
  let capital = initialCapital;
  const equityCurve: number[] = [initialCapital];
  const drawdownCurve: number[] = [0];
  let peakEquity = initialCapital;

  let bbSignalsTriggered = 0;
  let rsiSignalsTriggered = 0;
  let bothSignalsTriggered = 0;

  // Position tracking
  let position: {
    direction: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    stopPrice: number;
    tpPrice: number;
    qty: number;
    riskUsd: number;
    atrAtEntry: number;
    entryBar: number;
    entryBB: number;
    entryRSI: number;
    bbSignal: boolean;
    rsiSignal: boolean;
  } | null = null;

  const minBarsForSignals = Math.max(bbPeriod, rsiPeriod, atrPeriod);
  const tradeCooldown = 3;  // bars

  for (let i = minBarsForSignals; i < candles.length; i++) {
    const current = candles[i];
    const currentATR = atr[i];
    const atrPct = (currentATR / current.c) * 100;
    const currentBB = bb[i];
    const currentRSI = rsi[i];
    const currentEma50 = ema50[i];

    // Skip if volatility is too low or too high
    if (atrPct < minVolatility || atrPct > maxVolatility) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // Check if we should close existing position
    if (position) {
      const barsHeld = i - position.entryBar;

      let closeReason: TradeV6['exitReason'] | null = null;
      let exitPrice = current.c;

      // Check exit conditions
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

      // Max hold check
      if (barsHeld >= maxHoldBars) {
        closeReason = 'MAX_HOLD';
      }

      // Mean-reversion signal reversal
      if (position.direction === 'LONG' && currentRSI > rsiOverbought) {
        closeReason = 'SIGNAL_REVERSAL';
      } else if (position.direction === 'SHORT' && currentRSI < rsiOversold) {
        closeReason = 'SIGNAL_REVERSAL';
      }

      if (closeReason) {
        // Close position
        const feeExit = exitPrice * position.qty * feeRate;
        const pnlGross = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const pnlNet = pnlGross - feeExit - position.entryPrice * position.qty * feeRate;
        const pnlR = pnlNet / position.riskUsd;
        const outcome = pnlNet > 0 ? 'WIN' : 'LOSS';

        capital += pnlNet;

        const trade: TradeV6 = {
          id: `v6-${symbol}-${position.entryTime}`,
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
          holdBars: barsHeld,
          atrAtEntry: position.atrAtEntry,
        };

        trades.push(trade);
        position = null;
      }

      // Update equity curve
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MEAN-REVERSION ENTRY SIGNALS
    // ═════════════════════════════════════════════════════════════════════════

    // Skip if last trade was too recent
    const lastTradeEntryBar = trades.length > 0 ? trades[trades.length - 1].holdBars + trades.length - trades.length : 0;
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      const lastEntryBar = i - lastTrade.holdBars;
      if (i - lastEntryBar < tradeCooldown) {
        equityCurve.push(capital);
        drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
        continue;
      }
    }

    // Calculate BB position (in standard deviations)
    const bbPosition = (current.c - currentBB.middle) / currentBB.stdDev;

    // Check signals
    const isBelowLowerBand = current.c < currentBB.lower;
    const isAboveUpperBand = current.c > currentBB.upper;
    const isRSIOversold = currentRSI < rsiOversold;
    const isRSIOverbought = currentRSI > rsiOverbought;

    // Trend filter: avoid strong trends (use EMA50)
    const isUpTrend = current.c > currentEma50;
    const isDownTrend = current.c < currentEma50;
    const isInStrongTrend = Math.abs(current.c - currentEma50) / currentEma50 > 0.02; // 2% away from MA

    // Skip if in strong trend (mean-reversion doesn't work)
    if (isInStrongTrend) {
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // LONG SIGNAL: Price at lower BB OR RSI oversold
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

    // SHORT SIGNAL: Price at upper BB OR RSI overbought
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

    // Count signals
    if (bbTriggeredLong || bbTriggeredShort) bbSignalsTriggered++;
    if (rsiTriggeredLong || rsiTriggeredShort) rsiSignalsTriggered++;
    if ((bbTriggeredLong || bbTriggeredShort) && (rsiTriggeredLong || rsiTriggeredShort)) {
      bothSignalsTriggered++;
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
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION SIZING & ENTRY
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

    // Open position
    position = {
      direction,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      tpPrice,
      qty,
      riskUsd: riskAmount,
      atrAtEntry: currentATR,
      entryBar: i,
      entryBB: bbPosition,
      entryRSI: currentRSI,
      bbSignal,
      rsiSignal,
    };

    // Update equity
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

  // Calculate Sharpe
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
  const sharpe = stdReturn !== 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 24) : 0;  // Annualized for H1

  // Sortino
  const negReturns = returns.filter(r => r < 0);
  const avgNegReturn = negReturns.reduce((a, b) => a + b, 0) / negReturns.length;
  const stdNegReturn = Math.sqrt(negReturns.map(r => Math.pow(r - avgNegReturn, 2)).reduce((a, b) => a + b, 0) / negReturns.length);
  const sortino = stdNegReturn !== 0 ? (avgReturn / stdNegReturn) * Math.sqrt(252 * 24) : 0;

  // Drawdown
  const maxDD = Math.min(...drawdownCurve);
  const maxDDUsd = (maxDD / 100) * initialCapital;
  const maxDDPct = Math.abs(maxDD);

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
    profitFactor,
    avgHoldBars,
    avgWin,
    avgLoss,
    winLossRatio,
    equityCurve,
    drawdownCurve,
    trades,
    winsList: wins,
    lossesList: losses,
    bbSignalsTriggered,
    rsiSignalsTriggered,
    bothSignalsTriggered,
    runDate: new Date().toISOString(),
    candleFrom: candles[0]?.t ? new Date(candles[0].t).toISOString() : '',
    candleTo: candles[candles.length - 1]?.t ? new Date(candles[candles.length - 1].t).toISOString() : '',
    totalCandles: candles.length,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH BACKTEST
// ═══════════════════════════════════════════════════════════════════════════════

export function runBatchBacktestV6(
  allCandles: Record<string, BtCandle[]>,
  options: BacktestV6Options = {}
): Record<string, BacktestV6Result> {
  const results: Record<string, BacktestV6Result> = {};

  for (const [symbol, candles] of Object.entries(allCandles)) {
    try {
      results[symbol] = runBacktestV6(candles, symbol, options);
    } catch (e) {
      console.error(`Failed to backtest ${symbol}:`, e);
    }
  }

  return results;
}
