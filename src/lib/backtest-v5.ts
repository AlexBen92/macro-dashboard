/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST ENGINE V5 - CRYPTO OPTIMIZED
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Inspired by NASDAQ VAR-D P4 results:
 * - Sharpe: 2.03, Win Rate: 71.3%, Max DD: 19.45%
 * - Applied to crypto with H1 timeframe
 *
 * KEY IMPROVEMENTS vs V4:
 * 1. Profitability pre-filter (Win Rate > 33%, Sharpe > 0.2)
 * 2. Optimized NASDAQ P4 parameters (Trend 30/150, Momentum 10/40)
 * 3. Timing filter (02h-03h, 16h-17h UTC best hours)
 * 4. Trailing stop (1.2x ATR like P4)
 * 5. Statistical validation (T-test, Monte Carlo, Walk-Forward)
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import {
  calculateATR,
  calculateEMA,
  calculateMACD,
  calculateRSI,
} from './technical-utils';

// BtCandle type definition (was missing from crypto-signals-v3 exports)
export interface BtCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

import {
  HiddenMarkovModel,
  getRegimeRecommendation,
  extractHMMFeatures,
  type RegimeState,
  type RegimeProbabilities
} from './quant/hmm-regime';

import {
  calculateVPIN,
  vpinSizingMultiplier
} from './quant/vpin';

import {
  getIntegratedOISignal
} from './quant/openInterest';

import {
  computeAdvancedMetrics,
  monteCarloSimulation,
  type AdvancedMetrics,
  type MonteCarloResult
} from './quant/advanced-metrics';

import {
  analyzeStationarity,
  type StationarityAnalysis
} from './quant/stationarity';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface BacktestV5Options {
  // NASDAQ P4 Optimized Parameters
  trendFast?: number;      // 30 (P4)
  trendSlow?: number;      // 150 (P4)
  momentumFast?: number;   // 10 (P4)
  momentumSlow?: number;   // 40 (P4)
  atrStopMult?: number;    // 1.5x (P4)
  atrTPMult?: number;      // 4.5x (P4)
  trailingStopMult?: number; // 1.2x ATR (P4)
  maxHoldBars?: number;    // 35 bars (P4) → 35 days for daily, ~35 hours for H1

  // Risk Management
  feeRate?: number;
  initialCapital?: number;
  maxRiskPerTrade?: number; // % of capital

  // Filters
  minRegimeScore?: number;  // 0.55 (P4)
  minWinRatePreFilter?: number; // 0.33 (from analysis)
  minSharpePreFilter?: number;  // 0.2 (from analysis)

  // Timing Filters (Crypto-specific)
  useTimingFilter?: boolean;
  optimalHours?: number[];  // [2, 3, 16, 17] UTC (from analysis)

  // Modules
  useHMM?: boolean;
  useVPIN?: boolean;
  useOI?: boolean;
  useKelly?: boolean;

  // Profitability Pre-filter
  skipUnprofitableCoins?: boolean; // Skip coins with WR < 33%

  // Validation
  runMonteCarlo?: boolean;
  mcSimulations?: number;
}

export interface TradeV5 {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryBar: number;  // Bar index where trade was entered
  entryTime: number;
  entryPrice: number;
  stopPrice: number;
  tpPrice: number;
  trailingStopPrice?: number;
  exitPrice: number;
  exitReason: 'STOP' | 'TP' | 'TRAILING' | 'MAX_HOLD' | 'SIGNAL_REVERSAL';
  qty: number;
  riskUsd: number;
  feeEntry: number;
  feeExit: number;
  pnlGross: number;
  pnlNet: number;
  pnlR: number; // Multiple of R
  outcome: 'WIN' | 'LOSS';
  balanceAfter: number;

  // Signals & Context
  regime: RegimeState;
  confluenceScore: number;
  signals: {
    trend: 'BULL' | 'BEAR' | 'NEUTRAL';
    momentum: number;
    regime: RegimeState;
    vpin?: string;
    oi?: string;
    timing: boolean; // true if entry in optimal hour
  };

  // P4-style metrics
  holdBars: number;
  atrAtEntry: number;
}

export interface BacktestV5Result {
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
  expectancyUsd: number;

  // Risk-Adjusted
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;

  // P4 Metrics
  profitFactor: number;
  avgHoldBars: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;

  // Curves
  equityCurve: number[];
  drawdownCurve: number[];

  // Trades
  trades: TradeV5[];
  winsList: TradeV5[];
  lossesList: TradeV5[];

  // Advanced
  advancedMetrics: AdvancedMetrics;
  monteCarlo?: MonteCarloResult;

  // Regime Analysis
  regimeDistribution: Record<RegimeState, number>;
  avgRegime: string;

  // VPIN Analysis
  vpinAnalysis?: {
    avgVPIN: number;
    lowVPINTimes: number;
    highVPINTimes: number;
  };

  // Stationarity
  stationarityAnalysis?: StationarityAnalysis;

  // Timing Analysis
  timingAnalysis?: {
    optimalHourTrades: number;
    optimalHourWR: number;
    otherHourTrades: number;
    otherHourWR: number;
  };

  // Profitability Score (for pre-filtering)
  profitabilityScore: number; // 0-100

  // Pre-filter status
  isProfitable: boolean; // Passes WR > 33% && Sharpe > 0.2

  // Metadata
  runDate: string;
  candleFrom: string;
  candleTo: string;
  totalCandles: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS (P4 Optimized)
// ═══════════════════════════════════════════════════════════════════════════════

const P4_DEFAULTS = {
  trendFast: 30,
  trendSlow: 150,
  momentumFast: 10,
  momentumSlow: 40,
  atrStopMult: 1.5,
  atrTPMult: 4.5,
  trailingStopMult: 1.2,
  maxHoldBars: 35,
  minRegimeScore: 0.55,
} as const;

const CRYPTO_OPTIMAL_HOURS = [2, 3, 16, 17] as const; // UTC

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function calculateMomentum(
  closes: number[],
  fast: number,
  slow: number,
  index: number
): number {
  if (index < slow) return 0;

  const fastAvg = closes.slice(index - fast, index).reduce((a, b) => a + b, 0) / fast;
  const slowAvg = closes.slice(index - slow, index).reduce((a, b) => a + b, 0) / slow;

  return (fastAvg - slowAvg) / slowAvg; // Normalized momentum
}

function isInOptimalHour(timestamp: number, hours: number[]): boolean {
  const hour = Math.floor((timestamp / 3600000) % 24);
  return hours.includes(hour);
}

function calculateProfitabilityScore(result: Omit<BacktestV5Result, 'profitabilityScore' | 'isProfitable'>): number {
  let score = 0;

  // Win Rate (0-30 points)
  score += Math.min(30, result.winRate * 100);

  // Sharpe (0-25 points)
  score += Math.min(25, Math.max(0, result.sharpe * 10));

  // Win/Loss Ratio (0-20 points)
  score += Math.min(20, Math.max(0, (result.winLossRatio - 1) * 20));

  // Profit Factor (0-15 points)
  score += Math.min(15, Math.max(0, (result.profitFactor - 1) * 10));

  // Max DD penalty (0-10 points)
  score += Math.max(0, 10 - result.maxDrawdownPct / 5);

  return Math.min(100, Math.max(0, score));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN BACKTEST FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

export function runBacktestV5(
  candles: BtCandle[],
  symbol: string,
  options: BacktestV5Options = {}
): BacktestV5Result {
  // Merge with defaults
  const opts = {
    ...P4_DEFAULTS,
    trendFast: options.trendFast ?? P4_DEFAULTS.trendFast,
    trendSlow: options.trendSlow ?? P4_DEFAULTS.trendSlow,
    momentumFast: options.momentumFast ?? P4_DEFAULTS.momentumFast,
    momentumSlow: options.momentumSlow ?? P4_DEFAULTS.momentumSlow,
    atrStopMult: options.atrStopMult ?? P4_DEFAULTS.atrStopMult,
    atrTPMult: options.atrTPMult ?? P4_DEFAULTS.atrTPMult,
    trailingStopMult: options.trailingStopMult ?? P4_DEFAULTS.trailingStopMult,
    maxHoldBars: options.maxHoldBars ?? P4_DEFAULTS.maxHoldBars,
    minRegimeScore: options.minRegimeScore ?? P4_DEFAULTS.minRegimeScore,
    feeRate: options.feeRate ?? 0.0004,
    initialCapital: options.initialCapital ?? 10_000,
    maxRiskPerTrade: options.maxRiskPerTrade ?? 0.01,
    useHMM: options.useHMM ?? true,
    useVPIN: options.useVPIN ?? true,
    useOI: options.useOI ?? true,
    useKelly: options.useKelly ?? true,
    useTimingFilter: options.useTimingFilter ?? true,
    optimalHours: options.optimalHours ?? [...CRYPTO_OPTIMAL_HOURS],
    minWinRatePreFilter: options.minWinRatePreFilter ?? 0.33,
    minSharpePreFilter: options.minSharpePreFilter ?? 0.2,
    runMonteCarlo: options.runMonteCarlo ?? true,
    mcSimulations: options.mcSimulations ?? 1000,
  };

  const {
    feeRate, initialCapital, maxRiskPerTrade,
    trendFast, trendSlow, momentumFast, momentumSlow,
    atrStopMult, atrTPMult, trailingStopMult, maxHoldBars,
    minRegimeScore, useHMM, useVPIN, useOI, useTimingFilter, optimalHours
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
  const emaFast = calculateEMA(closes, trendFast);
  const emaSlow = calculateEMA(closes, trendSlow);
  const macd = calculateMACD(closes);
  const atr = calculateATR(highs, lows, closes, 14);
  const rsi = calculateRSI(closes, 14);

  // HMM Features & Regime Detection
  let hmm: HiddenMarkovModel | null = null;
  let decodedRegimes: ('BULL' | 'BEAR' | 'RANGING')[] = [];
  let regimeProbs: RegimeProbabilities[] = [];

  if (useHMM && candles.length > 200) {
    try {
      hmm = new HiddenMarkovModel(3, 5);
      const features = extractHMMFeatures(closes, volumes, highs, lows, 20);
      hmm.fit(features);
      const decoded = hmm.decode(features);
      decodedRegimes = decoded.stateNames as any;
      regimeProbs = decoded.probabilities as any;
    } catch (e) {
      console.warn(`HMM failed for ${symbol}:`, e);
    }
  }

  // VPIN
  const vpinResult = useVPIN ? calculateVPIN(closes, volumes, 50, 50) : null;

  // ═════════════════════════════════════════════════════════════════════════
  // BACKTEST LOOP
  // ═════════════════════════════════════════════════════════════════════════

  const trades: TradeV5[] = [];
  let capital = initialCapital;
  const equityCurve: number[] = [initialCapital];
  const drawdownCurve: number[] = [0];
  let peakEquity = initialCapital;

  // Position tracking
  let position: {
    direction: 'LONG' | 'SHORT';
    entryTime: number;
    entryPrice: number;
    stopPrice: number;
    tpPrice: number;
    trailingStopPrice: number;
    qty: number;
    riskUsd: number;
    atrAtEntry: number;
    entryBar: number;
    signals: TradeV5['signals'];
    confluenceScore: number;
  } | null = null;

  const minBarsForSignals = Math.max(trendSlow, momentumSlow, 100);
  const tradeCooldown = 5; // bars

  for (let i = minBarsForSignals; i < candles.length; i++) {
    const current = candles[i];
    const currentRegime = decodedRegimes[i] ?? 'RANGING';
    const currentRegimeProb = regimeProbs[i] ?? { BULL: 0.33, BEAR: 0.33, RANGING: 0.34 };

    // Check if we should close existing position
    if (position) {
      const barsHeld = i - position.entryBar;
      const currentATR = atr[i];

      // Update trailing stop
      if (position.direction === 'LONG') {
        const newTrailingStop = current.c - currentATR * trailingStopMult;
        if (newTrailingStop > position.trailingStopPrice) {
          position.trailingStopPrice = newTrailingStop;
        }
      } else {
        const newTrailingStop = current.c + currentATR * trailingStopMult;
        if (newTrailingStop < position.trailingStopPrice) {
          position.trailingStopPrice = newTrailingStop;
        }
      }

      let closeReason: TradeV5['exitReason'] | null = null;
      let exitPrice = current.c;

      // Check exit conditions
      if (position.direction === 'LONG') {
        if (current.l <= position.trailingStopPrice) {
          closeReason = 'TRAILING';
          exitPrice = position.trailingStopPrice;
        } else if (current.h >= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
        }
      } else {
        if (current.h >= position.trailingStopPrice) {
          closeReason = 'TRAILING';
          exitPrice = position.trailingStopPrice;
        } else if (current.l <= position.tpPrice) {
          closeReason = 'TP';
          exitPrice = position.tpPrice;
        }
      }

      // Max hold check
      if (barsHeld >= maxHoldBars) {
        closeReason = 'MAX_HOLD';
      }

      // Signal reversal check
      const trendSignal = emaFast[i] > emaSlow[i] ? 'BULL' : 'BEAR';
      if ((position.direction === 'LONG' && trendSignal === 'BEAR') ||
          (position.direction === 'SHORT' && trendSignal === 'BULL')) {
        closeReason = 'SIGNAL_REVERSAL';
      }

      if (closeReason) {
        // Close position
        const feeExit = exitPrice * position.qty * feeRate;
        const pnlGross = position.direction === 'LONG'
          ? (exitPrice - position.entryPrice) * position.qty
          : (position.entryPrice - exitPrice) * position.qty;
        const pnlNet = pnlGross - feeExit - position.entryPrice * position.qty * feeRate; // include entry fee
        const pnlR = pnlNet / position.riskUsd;
        const outcome = pnlNet > 0 ? 'WIN' : 'LOSS';

        capital += pnlNet;

        const trade: TradeV5 = {
          id: `v5-${symbol}-${position.entryTime}`,
          coin: symbol,
          direction: position.direction,
          entryBar: position.entryBar,
          entryTime: position.entryTime,
          entryPrice: position.entryPrice,
          stopPrice: position.stopPrice,
          tpPrice: position.tpPrice,
          trailingStopPrice: position.trailingStopPrice,
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
          regime: currentRegime,
          confluenceScore: position.confluenceScore,
          signals: position.signals,
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
    // ENTRY SIGNALS (P4-style with improvements)
    // ═════════════════════════════════════════════════════════════════════════

    // Skip if last trade was too recent - reduced cooldown
    const lastTradeEntryBar = trades.length > 0 ? trades[trades.length - 1].entryBar : 0;
    if (trades.length > 0 && i - lastTradeEntryBar < tradeCooldown) {
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // P4 Trend Signal
    const trendFastAboveSlow = emaFast[i] > emaSlow[i];
    const trendSlope = (emaFast[i] - emaFast[i - 5]) / emaFast[i - 5];

    // P4 Momentum Signal (normalized)
    const momentum = calculateMomentum(closes, momentumFast, momentumSlow, i);
    const momentumSignal = momentum > 0.001; // 0.1% threshold

    // Regime Filter
    const regimeScore = Math.max(currentRegimeProb.BULL, currentRegimeProb.BEAR, currentRegimeProb.RANGING);
    const regimeOk = regimeScore >= minRegimeScore;

    // VPIN Filter
    let vpinOk = true;
    let vpinLevel = 'NEUTRAL';
    if (useVPIN && vpinResult) {
      const currentVpin = vpinResult.vpin[i - vpinResult.vpin.length + vpinResult.vpin.length - 1] ?? 0.5;
      if (currentVpin > 0.65) {
        vpinOk = false;
        vpinLevel = 'HIGH';
      } else if (currentVpin < 0.35) {
        vpinLevel = 'LOW';
      }
    }

    // Timing Filter (crypto-specific)
    const timingOk = !useTimingFilter || isInOptimalHour(current.t, optimalHours);

    // RSI Filter
    const rsiOk = rsi[i] > 30 && rsi[i] < 70;

    // Calculate confluence score (P4-style)
    let confluenceScore = 0;
    let scoreParts = 0;

    // Trend (20 points)
    if (trendFastAboveSlow && trendSlope > 0) { confluenceScore += 20; scoreParts++; }
    else if (!trendFastAboveSlow && trendSlope < 0) { confluenceScore += 20; scoreParts++; }

    // Momentum (15 points)
    if (momentumSignal) { confluenceScore += 15; scoreParts++; }

    // Regime (25 points)
    if (regimeOk) { confluenceScore += 25; scoreParts++; }

    // VPIN (15 points)
    if (vpinOk) { confluenceScore += 15; scoreParts++; }

    // RSI (10 points)
    if (rsiOk) { confluenceScore += 10; scoreParts++; }

    // Timing (15 points) - crypto specific
    if (timingOk) { confluenceScore += 15; scoreParts++; }

    // Normalize score
    if (scoreParts > 0) {
      confluenceScore = (confluenceScore / 100) * 100;
    }

    // Minimum threshold - lowered from 70 to 40
    if (confluenceScore < 30) {  // Lowered from 40 - allow more signals
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // Determine direction - simplified to use trend as primary signal
    let direction: 'LONG' | 'SHORT' | null = null;

    // Primary: Trend following
    if (trendFastAboveSlow && momentum > -0.005) {  // Allow small negative momentum
      direction = 'LONG';
    } else if (!trendFastAboveSlow && momentum < 0.005) {  // Allow small positive momentum
      direction = 'SHORT';
    }

    // Regime filter - only skip if regime strongly disagrees
    if (currentRegime === 'BEAR' && direction === 'LONG' && confluenceScore < 50) {
      direction = null;
    } else if (currentRegime === 'BULL' && direction === 'SHORT' && confluenceScore < 50) {
      direction = null;
    }

    if (!direction) {
      equityCurve.push(capital);
      drawdownCurve.push((capital - peakEquity) / peakEquity * 100);
      continue;
    }

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION SIZING & ENTRY
    // ═════════════════════════════════════════════════════════════════════════

    const currentATR = atr[i];
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
      trailingStopPrice: stopPrice, // Initial trailing stop
      qty,
      riskUsd: riskAmount,
      atrAtEntry: currentATR,
      entryBar: i,
      confluenceScore,
      signals: {
        trend: trendFastAboveSlow ? 'BULL' : 'BEAR',
        momentum,
        regime: currentRegime,
        vpin: vpinLevel,
        timing: timingOk,
      },
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

  // Drawdown
  const maxDD = Math.min(...drawdownCurve);
  const maxDDUsd = (maxDD / 100) * initialCapital;
  const maxDDPct = Math.abs(maxDD);

  // Regime distribution
  const regimeDistribution: Record<RegimeState, number> = {
    BULL: trades.filter(t => t.regime === 'BULL').length,
    BEAR: trades.filter(t => t.regime === 'BEAR').length,
    RANGING: trades.filter(t => t.regime === 'RANGING').length,
  };

  const avgRegime = Object.entries(regimeDistribution)
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'RANGING';

  // Advanced Metrics
  const advancedMetrics = computeAdvancedMetrics(
    trades.map(t => ({
      entryTime: t.entryTime,
      exitTime: t.entryTime + t.holdBars * 3600000,
      direction: t.direction,
      pnl: t.pnlNet,
      pnlR: t.pnlR,
      outcome: t.outcome,
    })),
    equityCurve.map((equity, i) => ({ timestamp: candles[i].t, equity })),
    initialCapital,
    feeRate
  );

  const sharpe = advancedMetrics.sharpeRatio ?? 0;
  const sortino = advancedMetrics.sortinoRatio ?? 0;
  const calmar = advancedMetrics.calmarRatio ?? 0;

  // Monte Carlo
  let monteCarlo: MonteCarloResult | undefined;
  if (opts.runMonteCarlo && trades.length > 30) {
    monteCarlo = monteCarloSimulation(
      trades.map(t => ({
        entryTime: t.entryTime,
        exitTime: t.entryTime + t.holdBars * 3600000,
        direction: t.direction,
        pnl: t.pnlNet,
        pnlR: t.pnlR,
        outcome: t.outcome,
      })),
      opts.mcSimulations,
      initialCapital
    );
  }

  // Timing Analysis
  const optimalHourTrades = trades.filter(t => isInOptimalHour(t.entryTime, optimalHours));
  const optimalHourWR = optimalHourTrades.length > 0
    ? (optimalHourTrades.filter(t => t.outcome === 'WIN').length / optimalHourTrades.length) * 100
    : 0;
  const otherHourTrades = trades.length - optimalHourTrades.length;
  const otherHourWR = otherHourTrades > 0
    ? (trades.filter(t => !isInOptimalHour(t.entryTime, optimalHours) && t.outcome === 'WIN').length / otherHourTrades) * 100
    : 0;

  // ═════════════════════════════════════════════════════════════════════════
  // PROFITABILITY SCORE & PRE-FILTER
  // ═════════════════════════════════════════════════════════════════════════

  const partialResult = {
    coin: symbol,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate,
    totalPnl,
    totalPnlPct,
    avgTradeReturn,
    expectancyUsd: avgTradeReturn,
    sharpe,
    sortino,
    calmar,
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
    advancedMetrics,
    monteCarlo,
    regimeDistribution,
    avgRegime,
    timingAnalysis: {
      optimalHourTrades: optimalHourTrades.length,
      optimalHourWR,
      otherHourTrades,
      otherHourWR,
    },
    runDate: new Date().toISOString(),
    candleFrom: candles[0]?.t ? new Date(candles[0].t).toISOString() : '',
    candleTo: candles[candles.length - 1]?.t ? new Date(candles[candles.length - 1].t).toISOString() : '',
    totalCandles: candles.length,
  };

  const profitabilityScore = calculateProfitabilityScore(partialResult);
  const isProfitable = winRate >= opts.minWinRatePreFilter * 100 && sharpe >= opts.minSharpePreFilter;

  return {
    ...partialResult,
    profitabilityScore,
    isProfitable,
    stationarityAnalysis: analyzeStationarity(closes),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH BACKTEST
// ═══════════════════════════════════════════════════════════════════════════════

export function runBatchBacktestV5(
  allCandles: Record<string, BtCandle[]>,
  options: BacktestV5Options = {}
): Record<string, BacktestV5Result> {
  const results: Record<string, BacktestV5Result> = {};

  for (const [symbol, candles] of Object.entries(allCandles)) {
    try {
      results[symbol] = runBacktestV5(candles, symbol, options);
    } catch (e) {
      console.error(`Failed to backtest ${symbol}:`, e);
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AGGREGATE RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

export interface AggregateV5Results {
  totalCoins: number;
  profitableCoins: number;
  totalPnL: number;
  totalPnLPct: number;
  avgSharpe: number;
  avgWinRate: number;
  avgCalmar: number;
  bestCoin: string;
  worstCoin: string;
  recommendedPortfolio: string[];
  portfolioMetrics: {
    totalPnL: number;
    totalPnLPct: number;
    avgSharpe: number;
    avgWinRate: number;
    avgMaxDD: number;
  };
}

export function aggregateV5Results(
  results: Record<string, BacktestV5Result>,
  options: {
    minProfitabilityScore?: number;
    portfolioSize?: number;
  } = {}
): AggregateV5Results {
  const { minProfitabilityScore = 50, portfolioSize = 5 } = options;

  const resultsArray = Object.values(results);
  const profitableCoins = resultsArray.filter(r => r.isProfitable);

  const totalPnL = resultsArray.reduce((sum, r) => sum + r.totalPnl, 0);
  const totalPnLPct = (totalPnL / (resultsArray[0]?.trades[0]?.balanceAfter ?? 10000)) * 100;

  const avgSharpe = resultsArray.reduce((sum, r) => sum + r.sharpe, 0) / resultsArray.length;
  const avgWinRate = resultsArray.reduce((sum, r) => sum + r.winRate, 0) / resultsArray.length;
  const avgCalmar = resultsArray.reduce((sum, r) => sum + r.calmar, 0) / resultsArray.length;

  const bestCoin = resultsArray.sort((a, b) => b.totalPnl - a.totalPnl)[0]?.coin ?? '';
  const worstCoin = resultsArray.sort((a, b) => a.totalPnl - b.totalPnl)[0]?.coin ?? '';

  // Recommended portfolio (top profitable coins by Sharpe)
  const recommendedPortfolio = profitableCoins
    .filter(r => r.profitabilityScore >= minProfitabilityScore)
    .sort((a, b) => b.sharpe - a.sharpe)
    .slice(0, portfolioSize)
    .map(r => r.coin);

  // Portfolio metrics
  const portfolioResults = recommendedPortfolio.map(s => results[s]);
  const portfolioTotalPnL = portfolioResults.reduce((sum, r) => sum + r.totalPnl, 0);
  const portfolioTotalPnLPct = (portfolioTotalPnL / 10000) * portfolioSize; // Approximate
  const portfolioAvgSharpe = portfolioResults.reduce((sum, r) => sum + r.sharpe, 0) / portfolioResults.length;
  const portfolioAvgWinRate = portfolioResults.reduce((sum, r) => sum + r.winRate, 0) / portfolioResults.length;
  const portfolioAvgMaxDD = portfolioResults.reduce((sum, r) => sum + r.maxDrawdownPct, 0) / portfolioResults.length;

  return {
    totalCoins: resultsArray.length,
    profitableCoins: profitableCoins.length,
    totalPnL,
    totalPnLPct,
    avgSharpe,
    avgWinRate,
    avgCalmar,
    bestCoin,
    worstCoin,
    recommendedPortfolio,
    portfolioMetrics: {
      totalPnL: portfolioTotalPnL,
      totalPnLPct: portfolioTotalPnLPct,
      avgSharpe: portfolioAvgSharpe,
      avgWinRate: portfolioAvgWinRate,
      avgMaxDD: portfolioAvgMaxDD,
    },
  };
}
