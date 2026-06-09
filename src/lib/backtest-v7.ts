/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST ENGINE V7 - DUAL REGIME (TREND + MEAN-REVERSION)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * INSPIRED BY: NASDAQ VAR-D P4 (Sharpe 2.03, WR 71.3%)
 *
 * KEY IMPROVEMENTS OVER V6:
 * 1. REGIME DETECTION: ADX-based trend vs range identification
 * 2. DUAL STRATEGY:
 *    - TREND MODE: Momentum + EMA crossover (like P4)
 *    - RANGE MODE: BB/RSI mean-reversion (like V6)
 * 3. BETTER R:R: 1:3 (TP 4.5x ATR, SL 1.5x ATR)
 * 4. TRAILING STOP: 1.2x ATR (protect profits)
 * 5. MIN REGIME SCORE: Only trade high-confidence setups
 * 6. BUG FIX: Correct RSI signal logic
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  calculateEMA,
  calculateBollingerBands,
  type BollingerBands,
} from './technical-utils';

// ═══════════════════════════════════════════════════════════════════════════════
// PADDED INDICATOR FUNCTIONS (match candle array length)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateEMAPadded(data: number[], period: number): number[] {
  const rawResult = calculateEMA(data, period);

  // Pad beginning with first value
  const padding = data.length - rawResult.length;
  const result: number[] = [];

  for (let i = 0; i < padding; i++) {
    result.push(data[i]);
  }

  result.push(...rawResult);

  return result;
}

function calculateATR(
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

  // Pad to match closes length
  const padding = closes.length - atr.length;
  for (let i = 0; i < padding; i++) {
    atr.unshift(0);
  }

  return atr;
}

function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];

  // Pad beginning with zeros
  for (let i = 0; i < period; i++) {
    result.push(0);
  }

  for (let i = period; i < closes.length; i++) {
    let gains = 0;
    let losses = 0;

    for (let j = i - period + 1; j <= i; j++) {
      const change = closes[j] - closes[j - 1];
      if (change > 0) {
        gains += change;
      } else {
        losses -= change;
      }
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      result.push(100);
    } else {
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

  // Pad beginning with neutral values
  const padding = closes.length - rawResult.length;
  const result: BollingerBands[] = [];

  for (let i = 0; i < padding; i++) {
    result.push({
      middle: closes[i],
      upper: closes[i],
      lower: closes[i],
      stdDev: 0,
    });
  }

  result.push(...rawResult);

  return result;
}

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

export type MarketRegime = 'TREND' | 'RANGE' | 'NEUTRAL';

export interface BacktestV7Options {
  // Regime Detection
  adxPeriod?: number;
  adxTrendThreshold?: number;  // ADX > 25 = trend
  minRegimeScore?: number;      // 0-1 confidence threshold

  // Trend Parameters (P4-inspired)
  trendFastEma?: number;        // 30
  trendSlowEma?: number;        // 150
  momentumPeriod?: number;      // 10
  momentumSignalPeriod?: number;// 40

  // Mean-Reversion Parameters (V6-inspired)
  bbPeriod?: number;
  bbStdDev?: number;
  rsiPeriod?: number;
  rsiOversold?: number;
  rsiOverbought?: number;

  // Risk Management (P4-inspired)
  atrPeriod?: number;
  atrStopMult?: number;         // 1.5x (tighter)
  atrTPMult?: number;           // 4.5x (asymmetric)
  trailingStopMult?: number;    // 1.2x ATR
  maxHoldBars?: number;

  // Filters
  minVolatility?: number;
  maxVolatility?: number;

  // Risk
  feeRate?: number;
  initialCapital?: number;
  maxRiskPerTrade?: number;
}

export interface TradeV7 {
  id: string;
  coin: string;
  regime: MarketRegime;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tpPrice: number;
  exitPrice: number;
  exitReason: 'STOP' | 'TP' | 'TRAILING_STOP' | 'MAX_HOLD' | 'REGIME_CHANGE';
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
  entryRegimeScore: number;
  entryADX: number;
  entryRSI?: number;
  entryBBPosition?: number;
  trendScore?: number;
  meanRevScore?: number;

  holdBars: number;
  atrAtEntry: number;
}

export interface BacktestV7Result {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;

  // By regime
  trendTrades: number;
  trendWinRate: number;
  rangeTrades: number;
  rangeWinRate: number;

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
  regimeChangeHits: number;

  // Curves
  equityCurve: number[];
  drawdownCurve: number[];

  // Trades
  trades: TradeV7[];
  winsList: TradeV7[];
  lossesList: TradeV7[];

  // Metadata
  runDate: string;
  candleFrom: string;
  candleTo: string;
  totalCandles: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INDICATOR FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number
): number[] {
  const adx: number[] = [];
  const dx: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const tr = Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    );

    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];

    const plusDM = (upMove > downMove && upMove > 0) ? upMove : 0;
    const minusDM = (downMove > upMove && downMove > 0) ? downMove : 0;

    // Smooth TR, +DM, -DM
    let smoothedTR = tr;
    let smoothedPlusDM = plusDM;
    let smoothedMinusDM = minusDM;

    if (i > period) {
      const prevSmoothedTR = adx.length > 0 ? (dx[dx.length - 1] * period) : tr;
      smoothedTR = prevSmoothedTR - (prevSmoothedTR / period) + tr;
      // Simplified - would use proper smoothing in production
    }

    const plusDI = smoothedTR !== 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
    const minusDI = smoothedTR !== 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

    const dxValue = smoothedTR !== 0
      ? (Math.abs(plusDI - minusDI) / (plusDI + minusDI)) * 100
      : 0;

    dx.push(dxValue);

    if (dx.length >= period) {
      const avgDX = dx.slice(-period).reduce((a, b) => a + b, 0) / period;
      adx.push(avgDX);
    } else {
      adx.push(0);
    }
  }

  // Pad beginning
  while (adx.length < closes.length) {
    adx.unshift(0);
  }

  return adx;
}

function calculateMomentum(
  closes: number[],
  period: number
): number[] {
  const momentum: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      momentum.push(0);
    } else {
      momentum.push(closes[i] - closes[i - period]);
    }
  }
  return momentum;
}

function calculateRegimeScore(
  adx: number,
  adxThreshold: number,
  emaFast: number,
  emaSlow: number,
  close: number
): { regime: MarketRegime; score: number; trendScore: number } {
  // Normalize ADX to 0-1 (0-50 range)
  const adxScore = Math.min(adx / 50, 1);

  // Trend strength: EMA separation
  const emaSeparation = Math.abs(emaFast - emaSlow) / emaSlow;
  const trendStrength = Math.min(emaSeparation * 20, 1); // 5% separation = max score

  // Combined trend score
  const trendScore = (adxScore * 0.6 + trendStrength * 0.4);

  // Determine regime
  let regime: MarketRegime;
  if (adx > adxThreshold && trendScore > 0.5) {
    regime = 'TREND';
  } else if (adx < adxThreshold * 0.8 || trendScore < 0.3) {
    regime = 'RANGE';
  } else {
    regime = 'NEUTRAL';
  }

  return { regime, score: trendScore, trendScore };
}

function calculateMeanRevScore(
  rsi: number,
  bbPosition: number,
  rsiOversold: number,
  rsiOverbought: number,
  bbStdDev: number
): number {
  let score = 0;

  // RSI signal strength
  if (rsi < rsiOversold) {
    score += (rsiOversold - rsi) / rsiOversold; // 0 to 1
  } else if (rsi > rsiOverbought) {
    score += (rsi - rsiOverbought) / (100 - rsiOverbought);
  }

  // BB signal strength
  if (Math.abs(bbPosition) > bbStdDev) {
    score += (Math.abs(bbPosition) - bbStdDev) / bbStdDev;
  }

  return Math.min(score / 2, 1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// DEFAULTS (P4-inspired)
// ═══════════════════════════════════════════════════════════════════════════════

const V7_DEFAULTS = {
  // Regime Detection
  adxPeriod: 14,
  adxTrendThreshold: 25,
  minRegimeScore: 0.3,  // Lowered from 0.55

  // Trend Parameters
  trendFastEma: 30,
  trendSlowEma: 150,
  momentumPeriod: 10,
  momentumSignalPeriod: 40,

  // Mean-Reversion Parameters
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiOversold: 30,
  rsiOverbought: 70,

  // Risk Management (P4)
  atrPeriod: 14,
  atrStopMult: 1.5,
  atrTPMult: 4.5,
  trailingStopMult: 1.2,
  maxHoldBars: 35,

  // Filters
  minVolatility: 0.1,  // Lowered from 0.3
  maxVolatility: 10.0,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BACKTEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function runBacktestV7(
  candles: BtCandle[],
  symbol: string,
  options: BacktestV7Options = {}
): BacktestV7Result {
  const opts = {
    ...V7_DEFAULTS,
    ...options,
  };

  const {
    adxPeriod, adxTrendThreshold, minRegimeScore,
    trendFastEma, trendSlowEma, momentumPeriod, momentumSignalPeriod,
    bbPeriod, bbStdDev, rsiPeriod, rsiOversold, rsiOverbought,
    atrPeriod, atrStopMult, atrTPMult, trailingStopMult, maxHoldBars,
    minVolatility, maxVolatility,
    feeRate = 0.0004,
    initialCapital = 10_000,
    maxRiskPerTrade = 0.01,
  } = opts;

  // ═════════════════════════════════════════════════════════════════════════
  // PRE-COMPUTATIONS
  // ═════════════════════════════════════════════════════════════════════════

  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);
  const volumes = candles.map(c => c.v);
  const times = candles.map(c => c.t);

  // Indicators (padded to match candles length)
  const atr = calculateATR(highs, lows, closes, atrPeriod);
  const adx = calculateADX(highs, lows, closes, adxPeriod);
  const rsi = calculateRSI(closes, rsiPeriod);
  const bb = calculateBollingerBandsPadded(closes, bbPeriod, bbStdDev);

  // Trend indicators (padded)
  const emaFast = calculateEMAPadded(closes, trendFastEma);
  const emaSlow = calculateEMAPadded(closes, trendSlowEma);
  const momentum = calculateMomentum(closes, momentumPeriod);
  const momentumSignal = calculateEMAPadded(momentum, momentumSignalPeriod);

  // ═════════════════════════════════════════════════════════════════════════
  // BACKTEST LOOP
  // ═════════════════════════════════════════════════════════════════════════

  const trades: TradeV7[] = [];
  let capital = initialCapital;
  const equityCurve: number[] = [initialCapital];
  const drawdownCurve: number[] = [0];
  let peakEquity = initialCapital;

  // Exit tracking
  let tpHits = 0;
  let stopHits = 0;
  let trailingStopHits = 0;
  let maxHoldHits = 0;
  let regimeChangeHits = 0;

  // Regime tracking
  let trendTrades = 0;
  let trendWins = 0;
  let rangeTrades = 0;
  let rangeWins = 0;

  type Position = {
    direction: 'LONG' | 'SHORT';
    regime: MarketRegime;
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
    entryRegimeScore: number;
    entryADX: number;
    entryRSI?: number;
    entryBBPosition?: number;
    trendScore?: number;
    meanRevScore?: number;
  };

  let position: Position | null = null;

  const minBarsForSignals = Math.max(
    adxPeriod, trendSlowEma, momentumSignalPeriod, bbPeriod, rsiPeriod, atrPeriod
  );
  const tradeCooldown = 5;

  for (let i = minBarsForSignals; i < candles.length; i++) {
    const current = candles[i];
    const currentATR = atr[i];
    const atrPct = (currentATR / current.c) * 100;

    // Volatility filter
    if (atrPct < minVolatility || atrPct > maxVolatility) {
      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    const currentADX = adx[i];
    const currentEmaFast = emaFast[i];
    const currentEmaSlow = emaSlow[i];
    const currentRSI = rsi[i];
    const currentBB = bb[i];
    const currentMomentum = momentum[i];
    const currentMomentumSignal = momentumSignal[i];

    // Calculate regime
    const { regime, score: regimeScore, trendScore } = calculateRegimeScore(
      currentADX,
      adxTrendThreshold,
      currentEmaFast,
      currentEmaSlow,
      current.c
    );

    const bbPosition = (current.c - currentBB.middle) / currentBB.stdDev;

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION MANAGEMENT
    // ═════════════════════════════════════════════════════════════════════════

    if (position) {
      const barsHeld = i - position.entryBar;

      // Update trailing stop
      if (position.direction === 'LONG') {
        position.highestPrice = Math.max(position.highestPrice, current.h);
        const newTrailingStop = position.highestPrice - (position.atrAtEntry * trailingStopMult);
        position.trailingStopPrice = Math.max(position.trailingStopPrice, newTrailingStop);
      } else {
        position.lowestPrice = Math.min(position.lowestPrice, current.l);
        const newTrailingStop = position.lowestPrice + (position.atrAtEntry * trailingStopMult);
        position.trailingStopPrice = Math.min(position.trailingStopPrice, newTrailingStop);
      }

      let closeReason: TradeV7['exitReason'] | null = null;
      let exitPrice = current.c;

      // Check exit conditions
      if (position.direction === 'LONG') {
        // TP
        if (current.h >= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
          tpHits++;
        }
        // Trailing stop
        else if (current.l <= position.trailingStopPrice) {
          closeReason = 'TRAILING_STOP';
          exitPrice = position.trailingStopPrice;
          trailingStopHits++;
        }
        // Initial stop
        else if (current.l <= position.stopPrice) {
          closeReason = 'STOP';
          exitPrice = position.stopPrice;
          stopHits++;
        }
      } else {
        // SHORT
        if (current.l <= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
          tpHits++;
        }
        else if (current.h >= position.trailingStopPrice) {
          closeReason = 'TRAILING_STOP';
          exitPrice = position.trailingStopPrice;
          trailingStopHits++;
        }
        else if (current.h >= position.stopPrice) {
          closeReason = 'STOP';
          exitPrice = position.stopPrice;
          stopHits++;
        }
      }

      // Max hold
      if (barsHeld >= maxHoldBars && !closeReason) {
        closeReason = 'MAX_HOLD';
        maxHoldHits++;
      }

      // Regime change (exit if strategy context changes)
      if (!closeReason && position.regime !== regime && regimeScore > 0.7) {
        closeReason = 'REGIME_CHANGE';
        regimeChangeHits++;
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

        // Track regime stats
        if (position.regime === 'TREND') {
          trendTrades++;
          if (outcome === 'WIN') trendWins++;
        } else {
          rangeTrades++;
          if (outcome === 'WIN') rangeWins++;
        }

        capital += pnlNet;

        const trade: TradeV7 = {
          id: `v7-${symbol}-${position.entryTime}`,
          coin: symbol,
          regime: position.regime,
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
          entryRegimeScore: position.entryRegimeScore,
          entryADX: position.entryADX,
          entryRSI: position.entryRSI,
          entryBBPosition: position.entryBBPosition,
          trendScore: position.trendScore,
          meanRevScore: position.meanRevScore,
          holdBars: barsHeld,
          atrAtEntry: position.atrAtEntry,
        };

        trades.push(trade);
        position = null;
      }

      equityCurve.push(capital);
      peakEquity = Math.max(peakEquity, capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ENTRY SIGNALS (DUAL REGIME)
    // ═════════════════════════════════════════════════════════════════════════

    // Cooldown check
    if (trades.length > 0) {
      const lastTrade = trades[trades.length - 1];
      const lastEntryBar = i - lastTrade.holdBars;
      if (i - lastEntryBar < tradeCooldown) {
        equityCurve.push(capital);
        drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
        continue;
      }
    }

    // Skip if regime score is too low
    if (regimeScore < minRegimeScore) {
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    let direction: 'LONG' | 'SHORT' | null = null;
    let entryRegime = regime;
    let entryTrendScore = trendScore;
    let entryMeanRevScore = 0;

    // ═════════════════════════════════════════════════════════════════════════
    // TREND STRATEGY (like P4)
    // ═════════════════════════════════════════════════════════════════════════

    if (regime === 'TREND' || (regime === 'NEUTRAL' && trendScore > 0.4)) {
      const isBullishTrend = currentEmaFast > currentEmaSlow;
      const isBearishTrend = currentEmaFast < currentEmaSlow;

      // Momentum confirmation
      const isBullishMomentum = currentMomentum > currentMomentumSignal;
      const isBearishMomentum = currentMomentum < currentMomentumSignal;

      // Relaxed RSI filter for trend entries
      const rsiOK = currentRSI > 30 && currentRSI < 70;

      if (isBullishTrend && isBullishMomentum && rsiOK) {
        direction = 'LONG';
      } else if (isBearishTrend && isBearishMomentum && rsiOK) {
        direction = 'SHORT';
      }
    }

    // ═════════════════════════════════════════════════════════════════════════
    // MEAN-REVERSION STRATEGY (improved V6)
    // ═════════════════════════════════════════════════════════════════════════

    if (regime === 'RANGE' && !direction) {
      entryMeanRevScore = calculateMeanRevScore(
        currentRSI,
        bbPosition,
        rsiOversold,
        rsiOverbought,
        bbStdDev
      );

      // Lower threshold for mean-reversion
      if (entryMeanRevScore > 0.3) {
        const isBelowLowerBand = current.c < currentBB.lower;
        const isAboveUpperBand = current.c > currentBB.upper;
        const isRSIOversold = currentRSI < rsiOversold;
        const isRSIOverbought = currentRSI > rsiOverbought;

        // LONG: Price at lower BB OR RSI oversold
        if ((isBelowLowerBand || isRSIOversold) && currentRSI < 50) {
          direction = 'LONG';
        }
        // SHORT: Price at upper BB OR RSI overbought
        else if ((isAboveUpperBand || isRSIOverbought) && currentRSI > 50) {
          direction = 'SHORT';
        }
      }
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

    // Initialize trailing stop
    const initialTrailingStop = direction === 'LONG'
      ? entryPrice - stopDistance
      : entryPrice + stopDistance;

    // Open position
    position = {
      direction,
      regime: entryRegime,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      tpPrice,
      trailingStopPrice: initialTrailingStop,
      highestPrice: entryPrice,
      lowestPrice: entryPrice,
      qty,
      riskUsd: riskAmount,
      atrAtEntry: currentATR,
      entryBar: i,
      entryRegimeScore: regimeScore,
      entryADX: currentADX,
      entryRSI: currentRSI,
      entryBBPosition: bbPosition,
      trendScore: entryTrendScore,
      meanRevScore: entryMeanRevScore,
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

  // Calculate Sharpe
  const returns = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i-1]) / equityCurve[i-1]);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length);
  const sharpe = stdReturn !== 0 ? (avgReturn / stdReturn) * Math.sqrt(252 * 24) : 0;

  // Sortino
  const negReturns = returns.filter(r => r < 0);
  const avgNegReturn = negReturns.reduce((a, b) => a + b, 0) / negReturns.length;
  const stdNegReturn = Math.sqrt(negReturns.map(r => Math.pow(r - avgNegReturn, 2)).reduce((a, b) => a + b, 0) / negReturns.length);
  const sortino = stdNegReturn !== 0 ? (avgReturn / stdNegReturn) * Math.sqrt(252 * 24) : 0;

  // Drawdown & Calmar
  const maxDD = Math.min(...drawdownCurve);
  const maxDDUsd = (maxDD / 100) * initialCapital;
  const maxDDPct = Math.abs(maxDD);
  const cagr = Math.pow(capital / initialCapital, 365 / (candles.length / 24)) - 1; // Approximate annualized
  const calmar = maxDDPct !== 0 ? (cagr * 100) / maxDDPct : 0;

  // Regime stats
  const trendWinRate = trendTrades > 0 ? (trendWins / trendTrades) * 100 : 0;
  const rangeWinRate = rangeTrades > 0 ? (rangeWins / rangeTrades) * 100 : 0;

  return {
    coin: symbol,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    trendTrades,
    trendWinRate,
    rangeTrades,
    rangeWinRate,
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
    regimeChangeHits,
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

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH BACKTEST
// ═══════════════════════════════════════════════════════════════════════════════

export function runBatchBacktestV7(
  allCandles: Record<string, BtCandle[]>,
  options: BacktestV7Options = {}
): Record<string, BacktestV7Result> {
  const results: Record<string, BacktestV7Result> = {};

  for (const [symbol, candles] of Object.entries(allCandles)) {
    try {
      results[symbol] = runBacktestV7(candles, symbol, options);
    } catch (e) {
      console.error(`Failed to backtest ${symbol}:`, e);
    }
  }

  return results;
}
