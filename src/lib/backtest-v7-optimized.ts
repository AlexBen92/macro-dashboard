/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST V7 - PATTERN-OPTIMIZED MEAN REVERSION
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * KEY INSIGHTS FROM V6 PATTERN ANALYSIS:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * WINNING PATTERNS (98.6% WR):
 *  - Avg Hold: 2.0 bars (FAST!)
 *  - BB Position: 0.30 (middle of bands - NOT extreme)
 *  - RSI Entry: 48.1 (NEUTRAL zone)
 *  - 97% of winners exit in <5 bars
 *  - Exit: TP (32) vs SIGNAL_REVERSAL (2)
 *
 * LOSING PATTERNS (25% WR):
 *  - Avg Hold: 6.3 bars (3.2x longer!)
 *  - BB Position: 0.80 (extreme)
 *  - RSI Extremes (<25 or >75): 50% of ALL losses
 *  - 50% of losing trades last >5 bars
 *  - SIGNAL_REVERSAL exit = bad sign
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 * V7 OPTIMIZATIONS:
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 1. HARD MAX HOLD: 5 bars - NO exceptions (pattern: >5 bars = 50% loss rate)
 * 2. RSI FILTER: Only enter when RSI in [35, 65] (avoid extremes)
 * 3. BB FILTER: Only enter when |bbPosition| < 1.5 sigma
 * 4. QUICK EXIT: If no profit after 3 bars, exit immediately
 * 5. TIGHT TP: 1.5x ATR (take profits fast, don't be greedy)
 * 6. NO REVERSAL: If signal reverses, exit at next bar
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

export interface BacktestV7Options {
  bbPeriod?: number;
  bbStdDev?: number;
  rsiPeriod?: number;

  // V7: RSI neutral zone only
  rsiMin?: number;  // 35 - avoid oversold traps
  rsiMax?: number;  // 65 - avoid overbought traps

  // V7: BB filter - avoid extremes
  bbMaxSigma?: number;  // 1.5 - max distance from middle

  // V7: Hard time limits
  maxHoldBars?: number;  // 5 - absolute max
  quickExitBars?: number; // 3 - exit if no profit

  // V7: Tighter targets
  atrPeriod?: number;
  atrStopMult?: number;
  atrTPMult?: number;  // 1.5 - take profits fast

  feeRate?: number;
  initialCapital?: number;
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
  exitReason: 'STOP' | 'TP' | 'MAX_HOLD' | 'QUICK_EXIT' | 'SIGNAL_FLIP';
  qty: number;
  riskUsd: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS';
  entryBB?: number;
  entryRSI?: number;
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

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BACKTEST
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULTS: BacktestV7Options = {
  bbPeriod: 20,
  bbStdDev: 2.0,
  rsiPeriod: 14,
  rsiMin: 35,      // Filter: Avoid <25 (V6 losers)
  rsiMax: 75,      // Filter: Avoid >75 (V6 losers)
  bbMaxSigma: 2.0, // Mean reversion at edges
  maxHoldBars: 5,  // HARD limit (V6 losers avg 6.3 bars)
  quickExitBars: 3, // Exit if no profit
  atrPeriod: 14,
  atrStopMult: 2.0,
  atrTPMult: 1.5,  // Quick TP like V6 winners
  feeRate: 0.001,
  initialCapital: 10000,
};

export function runBacktestV7(
  candles: BtCandle[],
  coin: string,
  options: BacktestV7Options = {}
): BacktestV7Result {
  const opts = { ...DEFAULTS, ...options };

  // Calculate indicators
  const closes = candles.map(c => c.c);
  const highs = candles.map(c => c.h);
  const lows = candles.map(c => c.l);

  const bb = calculateBollingerBandsPadded(closes, opts.bbPeriod!, opts.bbStdDev!);
  const rsi = calculateRSIPadded(closes, opts.rsiPeriod!);
  const atr = calculateATRPadded(highs, lows, closes, opts.atrPeriod!);

  // EMA for trend direction (fast)
  const emaFast: number[] = [];
  const emaSlow: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < 9) {
      emaFast.push(closes[i]);
    } else {
      const mult = 2 / (10);
      const prev = emaFast[i-1];
      emaFast.push((closes[i] - prev) * mult + prev);
    }
    if (i < 21) {
      emaSlow.push(closes[i]);
    } else {
      const mult = 2 / (22);
      const prev = emaSlow[i-1];
      emaSlow.push((closes[i] - prev) * mult + prev);
    }
  }

  // Track state
  let capital = opts.initialCapital!;
  const equityCurve: number[] = [capital];
  const drawdownCurve: number[] = [0];
  const trades: TradeV7[] = [];

  let position: TradeV7 | null = null;
  let peakEquity = capital;
  let tradeId = 0;

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTRY SIGNALS
  // ═══════════════════════════════════════════════════════════════════════════════

  for (let i = Math.max(opts.bbPeriod!, opts.rsiPeriod!) + 10; i < candles.length; i++) {
    const candle = candles[i];
    const close = candle.c;
    const currentBB = bb[i];
    const currentRSI = rsi[i];
    const currentATR = atr[i];

    // V7: Calculate BB position (sigma from middle)
    const bbWidth = currentBB.upper - currentBB.lower;
    const bbPosition = (close - currentBB.middle) / (bbWidth / 2);

    // V7: RSI filter - avoid EXTREME extremes (V6 losers had RSI <25 or >75)
    // But allow neutral RSI (40-70) which V6 winners had
    const rsiOK = currentRSI >= 35 && currentRSI <= 75;

    // V7: BB at edges for mean reversion (V6 winners had entryBB ≈ ±2.0)
    const priceAtLowerBB = close <= currentBB.lower || bbPosition < -1.8;
    const priceAtUpperBB = close >= currentBB.upper || bbPosition > 1.8;

    // V7: Momentum confirmation (price starting to reverse)
    const bullishCandle = close > candles[i-1].c && close > candle.o; // Green candle
    const bearishCandle = close < candles[i-1].c && close < candle.o; // Red candle

    // ═════════════════════════════════════════════════════════════════════════
    // ENTRY CONDITIONS (Classic mean reversion like V6 winners)
    // ═════════════════════════════════════════════════════════════════════════

    // LONG: Price at lower BB (oversold), RSI not extreme, starting to bounce
    const longSignal = priceAtLowerBB && rsiOK && bullishCandle;

    // SHORT: Price at upper BB (overbought), RSI not extreme, starting to drop
    const shortSignal = priceAtUpperBB && rsiOK && bearishCandle;

    // Trend detection for signal flip
    const uptrend = longSignal;
    const downtrend = shortSignal;
    const priceBelowLower = priceAtLowerBB;
    const priceAboveUpper = priceAtUpperBB;
    const rsiNeutral = rsiOK;

    // ═════════════════════════════════════════════════════════════════════════
    // MANAGE EXISTING POSITION
    // ═════════════════════════════════════════════════════════════════════════

    if (position) {
      const barsHeld = i - position.entryTime;
      const pnl = position.direction === 'LONG'
        ? (close - position.entryPrice) / position.entryPrice
        : (position.entryPrice - close) / position.entryPrice;

      // Check exit conditions
      let exitReason: TradeV7['exitReason'] | null = null;

      // Stop loss hit
      if (position.direction === 'LONG' && close <= position.stopPrice) exitReason = 'STOP';
      else if (position.direction === 'SHORT' && close >= position.stopPrice) exitReason = 'STOP';

      // Take profit hit
      else if (position.direction === 'LONG' && close >= position.tpPrice) exitReason = 'TP';
      else if (position.direction === 'SHORT' && close <= position.tpPrice) exitReason = 'TP';

      // V7: Quick exit - if no profit after quickExitBars
      else if (barsHeld >= opts.quickExitBars! && pnl <= 0) exitReason = 'QUICK_EXIT';

      // V7: Hard max hold
      else if (barsHeld >= opts.maxHoldBars!) exitReason = 'MAX_HOLD';

      // V7: Signal flip (trend reversal)
      else if (position.direction === 'LONG' && !uptrend && barsHeld > 0) exitReason = 'SIGNAL_FLIP';
      else if (position.direction === 'SHORT' && !downtrend && barsHeld > 0) exitReason = 'SIGNAL_FLIP';

      if (exitReason) {
        const exitPrice = close;
        const pnlNet = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;

        const fee = (position.entryPrice + exitPrice) * position.qty * opts.feeRate!;
        const pnlAfterFee = pnlNet - fee;

        capital += pnlAfterFee;

        const finalTrade: TradeV7 = {
          ...position,
          exitPrice,
          exitReason,
          pnlNet: pnlAfterFee,
          pnlR: pnlAfterFee / capital,
          outcome: pnlAfterFee >= 0 ? 'WIN' : 'LOSS',
          holdBars: barsHeld,
        };

        trades.push(finalTrade);
        position = null;
      }

      equityCurve.push(capital);
    } else {
      // ═════════════════════════════════════════════════════════════════════════
      // ENTER NEW POSITION
      // ═════════════════════════════════════════════════════════════════════════

      if (longSignal || shortSignal) {
        const direction = longSignal ? 'LONG' : 'SHORT';
        const entryPrice = close;
        const stopATR = currentATR * opts.atrStopMult!;
        const tpATR = currentATR * opts.atrTPMult!;

        const stopPrice = direction === 'LONG'
          ? entryPrice - stopATR
          : entryPrice + stopATR;

        const tpPrice = direction === 'LONG'
          ? entryPrice + tpATR
          : entryPrice - tpATR;

        const riskUsd = Math.abs(entryPrice - stopPrice);
        const maxRisk = capital * 0.02; // 2% max risk
        const qty = Math.min(capital / entryPrice, maxRisk / riskUsd);

        position = {
          id: `${coin}-${++tradeId}`,
          coin,
          direction,
          entryTime: i,
          entryPrice,
          stopPrice,
          tpPrice,
          exitPrice: 0,
          exitReason: 'STOP',
          qty,
          riskUsd,
          pnlNet: 0,
          pnlR: 0,
          outcome: 'LOSS',
          entryBB: bbPosition,
          entryRSI: currentRSI,
          bbSignal: priceBelowLower || priceAboveUpper,
          rsiSignal: rsiNeutral,
          holdBars: 0,
        };
      }

      equityCurve.push(capital);
    }

    // Update peak
    peakEquity = Math.max(peakEquity, capital);
    drawdownCurve.push(((peakEquity - capital) / peakEquity) * 100);
  }

  // Calculate metrics
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
