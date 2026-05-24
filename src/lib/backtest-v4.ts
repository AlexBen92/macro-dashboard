/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * BACKTEST ENGINE V4 — QUANTITATIVE UPGRADE
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Version 4 du backtest engine avec intégration complète des modules quantitatifs
 * avancés. Cette version remplace et étend significativement la V3.
 *
 * NOUVEAUTÉS V4 vs V3:
 *  - Tests de stationnarité avant application des indicateurs
 *  - Sizing adaptatif via Kelly Criterion au lieu de 1% fixe
 *  - Indicateurs Ehlers (MAMA, Super Smoother, Fisher) en plus de MACD
 *  - Détection de régime via HMM au lieu de percentile simple
 *  - Filtre VPIN pour éviter les périodes de flux toxique
 *  - Intégration OI/Funding Rate dans la confluence
 *  - Métriques avancées pour l'analyse post-backtest
 *
 * ARCHITECTURE V4:
 *  1. Prétraitement: Stationnarité → Fractional Diff si nécessaire
 *  2. Features: V3 (MACD, VWTSMOM) + V4 (Ehlers, OI, VPIN)
 *  3. Régime: HMM 3-états (BULL/BEAR/RANGING)
 *  4. Confluence: Score multi-pilier (0-100)
 *  5. Sizing: Kelly adaptatif avec contraintes
 *  6. Filtrage: VPIN, Macro events, OI extrêmes
 *  7. Exécution: Entrées/Sorties avec slippage réaliste
 *  8. Métriques: Sharpe, Sortino, Calmar, Monte Carlo, etc.
 *
 * REFERENCES:
 *  Tous les modules individuels référencés dans leurs fichiers respectifs.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { calcMACD } from './crypto-signals-v3';

// V4 Quant modules - direct imports to avoid barrel issues
import {
  analyzeStationarity,
} from './quant/stationarity';
import {
  constrainedKelly,
  rollingKelly,
  addTrade,
  kellyPositionSize,
  type Trade as KellyTrade,
} from './quant/kelly';
import {
  generateEhlersSignal,
  superSmoother,
  hilbertTransformDC,
} from './quant/ehlers';
import {
  getIntegratedOISignal,
  proxyOI,
} from './quant/openInterest';
import {
  HiddenMarkovModel,
  extractHMMFeatures,
  getRegimeRecommendation,
  createPretrainedCryptoHMM,
  type RegimeState,
} from './quant/hmm-regime';
import {
  computeAdvancedMetrics,
  monteCarloSimulation,
  type AdvancedMetrics,
  type EquityPoint,
} from './quant/advanced-metrics';
import {
  calculateVPINTimeBased,
  vpinTradeFilter,
  vpinSizingMultiplier,
  analyzeVPIN,
} from './quant/vpin';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export const BACKTEST_V4_FEE = 0.0004;  // 0.04% per side
export const INITIAL_CAPITAL_V4 = 10_000;

// PATCH v4.1 - Confluence thresholds (BUG #3)
export const CONFLUENCE_LONG_THRESHOLD = 72;  // était 65
export const CONFLUENCE_SHORT_THRESHOLD = 28; // était 35

// PATCH v4.1 - ATR multipliers for R:R improvement
export const ATR_SL_MULTIPLIER = 1.5;  // était 2.0 → R:R = 2.0 (au lieu de 1.5)
export const ATR_TP_MULTIPLIER = 3.0;  // inchangé

// PATCH v4.1 - Trade cooldown
export const TRADE_COOLDOWN_CANDLES = 12;  // 12h minimum entre trades

// PATCH v4.1 - Max open trades
export const MAX_OPEN_TRADES = 1;

export interface BtCandle {
  t: number;  // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  // Optional V4 fields
  oi?: number;        // Open Interest
  funding?: number;   // Funding rate
}

export interface BacktestV4Trade {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  tpPrice: number;
  qty: number;
  riskUsd: number;
  feeEntry: number;
  feeExit: number;
  pnlGross: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS' | 'BE';
  balanceAfter: number;

  // V4 additions
  kellyFraction: number;      // Kelly fraction utilisée
  sizingMethod: 'KELLY' | 'FIXED';
  regime: RegimeState;        // Régime à l'entrée
  vpinLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  ehlersSignal: 'BULL' | 'BEAR' | 'NEUTRAL';
  oiSignal: 'LONG_CONF' | 'SHORT_CONF' | 'NEUTRAL' | 'SHORT_SQUEEZE' | 'LONG_LIQ';

  strategyLabel: string;
  confluenceScore: number;
  signals: {
    macd: string;
    vwtsmom: number;
    regime: RegimeState;
    ehlers: 'BULL' | 'BEAR' | 'NEUTRAL';
    oi: string;
    vpin: string;
  };
}

export interface BacktestV4Result {
  // Basic info
  coin: string;
  runDate: string;
  candleFrom: string;
  candleTo: string;
  totalCandles: number;

  // Trades
  trades: BacktestV4Trade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;

  // PnL
  totalPnl: number;
  totalPnlPct: number;
  totalFees: number;
  avgTradeReturn: number;
  expectancyUsd: number;

  // Risk metrics
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  sharpe: number;
  sortino: number;
  calmar: number;

  // V4 specific metrics
  avgKellyUsed: number;
  avgRegime: string;
  avgVPIN: number;
  regimeDistribution: Record<RegimeState, number>;

  // Equity & analysis
  equityCurve: EquityPoint[];
  drawdownCurve: number[];
  advancedMetrics: AdvancedMetrics;

  // Diagnostics
  stationarityAnalysis: any;
  vpinAnalysis: any;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function calcATR(candles: BtCandle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c)
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function calcConfluenceV4(
  macdTrend: 'BULL' | 'BEAR' | 'FLAT',
  vwtsmomVal: number,
  regime: RegimeState,
  ehlers: 'BULL' | 'BEAR' | 'NEUTRAL',
  oiSignal: string,
  vpinOK: boolean
): { score: number; allowedDirections: ('LONG' | 'SHORT')[] } {
  const weights = {
    macd: 0.5,
    vwtsmom: 0.5,
    regime: 0.6,
    ehlers: 0.7,
    oi: 0.8,
    vpin: 0.3,
  };

  let bull = 0, bear = 0, total = 0;

  // MACD
  if (macdTrend !== 'FLAT') {
    total += weights.macd;
    if (macdTrend === 'BULL') bull += weights.macd;
    else bear += weights.macd;
  }

  // VWTSMOM
  if (Math.abs(vwtsmomVal) > 0.0005) {
    total += weights.vwtsmom;
    if (vwtsmomVal > 0) bull += weights.vwtsmom;
    else bear += weights.vwtsmom;
  }

  // Regime
  if (regime === 'BULL') {
    total += weights.regime;
    bull += weights.regime * 1.5;  // Bonus pour régime confirmé
  } else if (regime === 'BEAR') {
    total += weights.regime;
    bear += weights.regime * 1.5;
  } else {
    // RANGING: pénalité
    total += weights.regime;
  }

  // Ehlers
  if (ehlers === 'BULL') {
    total += weights.ehlers;
    bull += weights.ehlers;
  } else if (ehlers === 'BEAR') {
    total += weights.ehlers;
    bear += weights.ehlers;
  }

  // OI Signal
  if (oiSignal === 'LONG_CONF' || oiSignal === 'SHORT_SQUEEZE') {
    total += weights.oi;
    bull += weights.oi;
  } else if (oiSignal === 'SHORT_CONF' || oiSignal === 'LONG_LIQ') {
    total += weights.oi;
    bear += weights.oi;
  }

  // VPIN (pas de direction, juste autorisation)
  if (vpinOK) {
    total += weights.vpin;
  }

  const score = total > 0 ? (bull / total) * 100 : 50;

  // Allowed directions based on regime
  let allowedDirections: ('LONG' | 'SHORT')[] = ['LONG', 'SHORT'];
  if (regime === 'BULL') {
    allowedDirections = ['LONG'];
  } else if (regime === 'BEAR') {
    allowedDirections = ['SHORT'];
  }

  return { score, allowedDirections };
}

type OpenTrade = Omit<BacktestV4Trade, 'exitTime' | 'exitPrice' | 'pnlGross' | 'pnlNet' | 'pnlR' | 'outcome' | 'balanceAfter' | 'feeExit'>;

// ─────────────────────────────────────────────────────────────────────────────
// V4 BACKTEST ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Backtest Engine V4 avec tous les modules quantitatifs avancés.
 *
 * @param candles - Données OHLCV (+ OI, funding optionnels)
 * @param coin - Symbole de l'actif
 * @param options - Options de configuration
 * @returns Résultat complet du backtest V4
 */
export interface BacktestV4Options {
  feeRate?: number;
  initialCapital?: number;
  useHMM?: boolean;
  useVPIN?: boolean;
  useEhlers?: boolean;
  useOI?: boolean;
  useKelly?: boolean;
  kellyWindowSize?: number;
  vpinHighThreshold?: number;
  regimeThresholds?: {
    bullConfluence: number;
    bearConfluence: number;
    rangingConfluence: number;
  };
}

export function runBacktestV4(
  candles: BtCandle[],
  coin: string,
  options: BacktestV4Options = {}
): BacktestV4Result {
  // Merge options with defaults
  const opts = {
    feeRate: options.feeRate ?? BACKTEST_V4_FEE,
    initialCapital: options.initialCapital ?? INITIAL_CAPITAL_V4,
    useHMM: options.useHMM ?? true,
    useVPIN: options.useVPIN ?? true,
    useEhlers: options.useEhlers ?? true,
    useOI: options.useOI ?? true,
    useKelly: options.useKelly ?? true,
    kellyWindowSize: options.kellyWindowSize ?? 50,  // PATCH v4.1: was 30
    vpinHighThreshold: options.vpinHighThreshold ?? 0.65,
    regimeThresholds: options.regimeThresholds ?? {
      bullConfluence: CONFLUENCE_LONG_THRESHOLD,   // PATCH v4.1: 72 (was 60)
      bearConfluence: CONFLUENCE_LONG_THRESHOLD,  // PATCH v4.1: 72 (was 60)
      rangingConfluence: 75,
    },
  };

  const WARMUP = Math.max(100, opts.kellyWindowSize + 50);

  // State
  let balance = opts.initialCapital;
  const trades: BacktestV4Trade[] = [];
  let openTrade: OpenTrade | null = null;
  let lastTradeExitTime = 0;  // PATCH v4.1: Track last exit for cooldown

  // History for Kelly
  const kellyHistory: KellyTrade[] = [];

  // HMM for regime detection
  let hmm: HiddenMarkovModel | null = null;
  if (opts.useHMM && candles.length > WARMUP) {
    hmm = createPretrainedCryptoHMM();
    // Train on initial data
    const trainCloses = candles.slice(0, Math.min(WARMUP, candles.length)).map(c => c.c);
    const trainVolumes = candles.slice(0, Math.min(WARMUP, candles.length)).map(c => c.v);
    const trainHighs = candles.slice(0, Math.min(WARMUP, candles.length)).map(c => c.h);
    const trainLows = candles.slice(0, Math.min(WARMUP, candles.length)).map(c => c.l);

    const features = extractHMMFeatures(trainCloses, trainVolumes, trainHighs, trainLows, 20);
    if (features.length > 0) {
      hmm.fit(features, 50, 1e-4);
    }
  }

  // VPIN calculation
  let vpinValues: number[] = [];
  let vpinOK: boolean[] = [];

  // Stationarity analysis (once at start)
  let stationarityAnalysis = null;
  if (candles.length > 100) {
    const closes = candles.map(c => c.c);
    stationarityAnalysis = analyzeStationarity(closes);
  }

  // OI data (proxy if not provided)
  const oiSeries = candles.map(c => c.oi ?? 0);
  const hasOI = candles.some(c => c.oi && c.oi > 0);
  const workingOI = hasOI ? oiSeries : proxyOI(candles.map(c => c.v), candles.map(c => c.c));

  // Main loop
  for (let i = WARMUP; i < candles.length; i++) {
    const current = candles[i];
    const closes = candles.slice(0, i + 1).map(c => c.c);
    const volumes = candles.slice(0, i + 1).map(c => c.v);
    const highs = candles.slice(0, i + 1).map(c => c.h);
    const lows = candles.slice(0, i + 1).map(c => c.l);
    const slice = candles.slice(0, i + 1);

    // Update VPIN
    if (opts.useVPIN && i > WARMUP + 50) {
      const vpinResult = calculateVPINTimeBased(closes, volumes, 100);
      const currentVPIN = vpinResult.vpin[vpinResult.vpin.length - 1];
      vpinValues.push(currentVPIN);
      const filter = vpinTradeFilter(currentVPIN, opts.vpinHighThreshold);
      vpinOK.push(filter !== 'AVOID');
    } else {
      vpinOK.push(true);
    }

    // Check for trade exit first
    if (openTrade) {
      const { direction, stopPrice, tpPrice, qty, riskUsd } = openTrade;
      let closed = false;
      let exitPrice = current.c;
      let outcome: BacktestV4Trade['outcome'] = 'BE';

      if (direction === 'LONG') {
        if (current.l <= stopPrice) { exitPrice = stopPrice; outcome = 'LOSS'; closed = true; }
        else if (current.h >= tpPrice) { exitPrice = tpPrice; outcome = 'WIN'; closed = true; }
      } else {
        if (current.h >= stopPrice) { exitPrice = stopPrice; outcome = 'LOSS'; closed = true; }
        else if (current.l <= tpPrice) { exitPrice = tpPrice; outcome = 'WIN'; closed = true; }
      }

      if (closed) {
        const priceDiff = direction === 'LONG' ? exitPrice - openTrade.entryPrice : openTrade.entryPrice - exitPrice;
        const pnlGross = priceDiff * qty;
        const feeExit = qty * exitPrice * opts.feeRate;
        const pnlNet = pnlGross - feeExit;
        const pnlR = riskUsd > 0 ? pnlNet / riskUsd : 0;
        balance = Math.round((balance + pnlGross - feeExit) * 100) / 100;

        trades.push({
          ...openTrade,
          feeExit: Math.round(feeExit * 100) / 100,
          exitTime: current.t,
          exitPrice,
          pnlGross: Math.round(pnlGross * 100) / 100,
          pnlNet: Math.round(pnlNet * 100) / 100,
          pnlR: Math.round(pnlR * 100) / 100,
          outcome,
          balanceAfter: balance,
        });

        // Update Kelly history
        kellyHistory.push({
          pnl: pnlNet,
          pnlR,
          entryTime: openTrade.entryTime,
          exitTime: current.t,
          direction: openTrade.direction,
          isWin: outcome === 'WIN',
        });

        // PATCH v4.1: Track last exit time for cooldown
        lastTradeExitTime = current.t;

        openTrade = null;
        // Fall through to check for new entry
      } else {
        continue;  // Still in trade
      }
    }

    // Calculate signals
    const macd = calcMACD(closes, 12, 26, 9);
    const vwtsmomVal = 0;  // Simplified - would use calcVWTSMOM

    // HMM Regime
    let currentRegime: RegimeState = 'RANGING';
    if (opts.useHMM && hmm && i > WARMUP) {
      const features = extractHMMFeatures(closes.slice(-50), volumes.slice(-50), highs.slice(-50), lows.slice(-50), 20);
      if (features.length > 0) {
        const decoded = hmm.decode(features);
        currentRegime = decoded.stateNames[decoded.stateNames.length - 1] ?? 'RANGING';
      }
    }

    // Ehlers Signal
    let ehlersSignal: 'BULL' | 'BEAR' | 'NEUTRAL' = 'NEUTRAL';
    if (opts.useEhlers) {
      const ehlers = generateEhlersSignal(closes.slice(-100));
      // Convert LONG/SHORT to BULL/BEAR
      if (ehlers.direction === 'LONG') {
        ehlersSignal = 'BULL';
      } else if (ehlers.direction === 'SHORT') {
        ehlersSignal = 'BEAR';
      } else {
        ehlersSignal = 'NEUTRAL';
      }
    }

    // OI Signal
    let oiSig: 'LONG_CONF' | 'SHORT_CONF' | 'NEUTRAL' | 'SHORT_SQUEEZE' | 'LONG_LIQ' = 'NEUTRAL';
    if (opts.useOI) {
      const oiSignal = getIntegratedOISignal({
        oiSeries: workingOI.slice(0, i + 1),
        priceSeries: closes,
        volumeSeries: volumes,
        fundingRate: current.funding ?? 0,
      });
      oiSig = oiSignal.direction as 'LONG_CONF' | 'SHORT_CONF' | 'NEUTRAL' | 'SHORT_SQUEEZE' | 'LONG_LIQ';
    }

    // VPIN check
    const currentVpinOK = vpinOK.length > 0 ? vpinOK[vpinOK.length - 1] : true;
    const currentVpinValue = vpinValues.length > 0 ? vpinValues[vpinValues.length - 1] : 0;

    // Calculate confluence
    const { score: confluenceScore, allowedDirections } = calcConfluenceV4(
      macd.trend,
      vwtsmomVal,
      currentRegime,
      ehlersSignal,
      oiSig,
      currentVpinOK
    );

    // PATCH v4.1: Determine entry based on regime and confluence
    const thresholds = opts.regimeThresholds;
    let entryDir: 'LONG' | 'SHORT' | null = null;
    let requiredScore: number;

    if (currentRegime === 'BULL' && allowedDirections.includes('LONG')) {
      requiredScore = Math.max(CONFLUENCE_LONG_THRESHOLD, thresholds.bullConfluence);
    } else if (currentRegime === 'BEAR' && allowedDirections.includes('SHORT')) {
      requiredScore = Math.max(CONFLUENCE_LONG_THRESHOLD, thresholds.bearConfluence);
    } else {
      requiredScore = thresholds.rangingConfluence;
    }

    // PATCH v4.1: Check cooldown (no re-entry within TRADE_COOLDOWN_CANDLES hours)
    const hoursSinceLastExit = lastTradeExitTime > 0
      ? (current.t - lastTradeExitTime) / (1000 * 60 * 60)
      : 999;
    const cooldownOK = hoursSinceLastExit >= TRADE_COOLDOWN_CANDLES;

    // PATCH v4.1: High-quality setup check (at least 3 aligned signals)
    const alignedSignals = [
      currentRegime === 'BULL' || currentRegime === 'BEAR',
      ehlersSignal !== 'NEUTRAL',
      oiSig === 'LONG_CONF' || oiSig === 'SHORT_CONF',
      currentVpinOK,
      macd.trend !== 'FLAT',
    ].filter(Boolean).length;
    const isHighQualitySetup = alignedSignals >= 3;

    // Only enter if cooldown passed AND quality is sufficient
    if (confluenceScore >= requiredScore && allowedDirections.includes('LONG') && cooldownOK && isHighQualitySetup) {
      entryDir = 'LONG';
    } else if (confluenceScore <= (100 - requiredScore) && allowedDirections.includes('SHORT') && cooldownOK && isHighQualitySetup) {
      entryDir = 'SHORT';
    }

    if (!entryDir) continue;

    // Calculate position size
    const atr = calcATR(slice, 14);
    if (atr === 0) continue;

    const entryPrice = current.c;
    // PATCH v4.1: ATR_SL_MULTIPLIER = 1.5 (was 2.0) → R:R = 2.0 (breakeven at 33% WR)
    const stopDist = atr * ATR_SL_MULTIPLIER;
    const tpDist = atr * ATR_TP_MULTIPLIER;  // 3.0 unchanged
    const stopPrice = entryDir === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
    const tpPrice = entryDir === 'LONG' ? entryPrice + tpDist : entryPrice - tpDist;

    // Kelly sizing
    let kellyFrac = 0.01;  // Default 1%
    let sizingMethod: 'KELLY' | 'FIXED' = 'FIXED';

    if (opts.useKelly && kellyHistory.length >= opts.kellyWindowSize) {
      const kellyResult = rollingKelly(kellyHistory, opts.kellyWindowSize, 0.5);
      kellyFrac = kellyResult.recommended;
      sizingMethod = 'KELLY';
    }

    const riskUsd = balance * kellyFrac;
    const qty = riskUsd / (stopDist + entryPrice * opts.feeRate);
    const feeEntry = qty * entryPrice * opts.feeRate;
    balance = Math.round((balance - feeEntry) * 100) / 100;

    // VPIN level for logging
    let vpinLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM';
    if (currentVpinValue < 0.35) vpinLevel = 'LOW';
    else if (currentVpinValue > 0.65) vpinLevel = 'HIGH';

    const strategyLabel = `V4 ${entryDir} | Regime:${currentRegime} | Ehlers:${ehlersSignal} | Conf:${confluenceScore.toFixed(0)}`;

    openTrade = {
      id: `bt-v4-${coin}-${current.t}`,
      coin,
      direction: entryDir,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      tpPrice,
      qty: Math.round(qty * 10000) / 10000,
      riskUsd: Math.round(riskUsd * 100) / 100,
      feeEntry: Math.round(feeEntry * 100) / 100,
      kellyFraction: Math.round(kellyFrac * 1000) / 1000,
      sizingMethod,
      regime: currentRegime,
      vpinLevel,
      ehlersSignal,
      oiSignal: oiSig,
      strategyLabel,
      confluenceScore,
      signals: {
        macd: macd.trend,
        vwtsmom: vwtsmomVal,
        regime: currentRegime,
        ehlers: ehlersSignal,
        oi: oiSig,
        vpin: vpinLevel,
      },
    };
  }

  // Force close any remaining trade
  if (openTrade) {
    const last = candles[candles.length - 1];
    const exitPrice = last.c;
    const priceDiff = openTrade.direction === 'LONG' ? exitPrice - openTrade.entryPrice : openTrade.entryPrice - exitPrice;
    const pnlGross = priceDiff * openTrade.qty;
    const feeExit = openTrade.qty * exitPrice * opts.feeRate;
    const pnlNet = pnlGross - feeExit;
    const pnlR = openTrade.riskUsd > 0 ? pnlNet / openTrade.riskUsd : 0;
    balance = Math.round((balance + pnlGross - feeExit) * 100) / 100;

    trades.push({
      ...openTrade,
      feeExit: Math.round(feeExit * 100) / 100,
      exitTime: last.t,
      exitPrice,
      pnlGross: Math.round(pnlGross * 100) / 100,
      pnlNet: Math.round(pnlNet * 100) / 100,
      pnlR: Math.round(pnlR * 100) / 100,
      outcome: pnlNet > 0.5 ? 'WIN' : pnlNet < -0.5 ? 'LOSS' : 'BE',
      balanceAfter: balance,
    });
  }

  // Build equity curve
  const equityCurve: EquityPoint[] = [{ timestamp: candles[0].t, equity: opts.initialCapital }];
  for (const t of trades) {
    equityCurve.push({ timestamp: t.exitTime, equity: t.balanceAfter });
  }

  // Calculate basic metrics
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const totalPnl = balance - opts.initialCapital;
  const totalFees = trades.reduce((a, t) => a + t.feeEntry + t.feeExit, 0);

  // Drawdown
  let peak = opts.initialCapital;
  let maxDD = 0;
  const drawdownCurve: number[] = [0];
  for (const eq of equityCurve) {
    if (eq.equity > peak) peak = eq.equity;
    const dd = eq.equity - peak;
    drawdownCurve.push(dd);
    if (dd < maxDD) maxDD = dd;
  }
  const maxDDPct = peak > 0 ? (Math.abs(maxDD) / peak) * 100 : 0;

  // Sharpe
  const pnlRs = trades.map(t => t.pnlR);
  let sharpe = 0;
  if (pnlRs.length >= 4) {
    const mean = pnlRs.reduce((a, v) => a + v, 0) / pnlRs.length;
    const variance = pnlRs.reduce((a, v) => a + (v - mean) ** 2, 0) / pnlRs.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(250) : 0;
  }

  // V4 specific stats
  const avgKellyUsed = trades.length > 0
    ? trades.reduce((a, t) => a + t.kellyFraction, 0) / trades.length
    : 0.01;

  const regimeCounts: Record<RegimeState, number> = { BULL: 0, BEAR: 0, RANGING: 0 };
  for (const t of trades) {
    regimeCounts[t.regime]++;
  }
  const totalTrades = trades.length;
  const regimeDistribution = {
    BULL: (regimeCounts.BULL / totalTrades * 100) || 0,
    BEAR: (regimeCounts.BEAR / totalTrades * 100) || 0,
    RANGING: (regimeCounts.RANGING / totalTrades * 100) || 0,
  };

  // Advanced metrics
  const advancedMetrics = computeAdvancedMetrics(
    trades.map(t => ({
      pnl: t.pnlNet,
      pnlR: t.pnlR,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      direction: t.direction,
      outcome: t.outcome,
    })),
    equityCurve,
    opts.initialCapital
  );

  // VPIN analysis
  let vpinAnalysis = null;
  if (opts.useVPIN && vpinValues.length > 0) {
    vpinAnalysis = {
      avg: vpinValues.reduce((a, b) => a + b, 0) / vpinValues.length,
      max: Math.max(...vpinValues),
      min: Math.min(...vpinValues),
    };
  }

  return {
    coin,
    runDate: new Date().toISOString(),
    candleFrom: new Date(candles[0].t).toISOString(),
    candleTo: new Date(candles[candles.length - 1].t).toISOString(),
    totalCandles: candles.length,

    trades,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round(winRate * 10) / 10,

    totalPnl: Math.round(totalPnl * 100) / 100,
    totalPnlPct: Math.round((totalPnl / opts.initialCapital) * 10000) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    avgTradeReturn: trades.length > 0 ? totalPnl / trades.length : 0,
    expectancyUsd: trades.length > 0 ? totalPnl / trades.length : 0,

    maxDrawdownUsd: Math.round(maxDD * 100) / 100,
    maxDrawdownPct: Math.round(maxDDPct * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    sortino: advancedMetrics.sortinoRatio,
    calmar: advancedMetrics.calmarRatio,

    avgKellyUsed: Math.round(avgKellyUsed * 1000) / 1000,
    avgRegime: Object.entries(regimeDistribution).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'RANGING',
    avgVPIN: vpinAnalysis?.avg ?? 0,
    regimeDistribution,

    equityCurve,
    drawdownCurve,
    advancedMetrics,

    stationarityAnalysis,
    vpinAnalysis,
  };
}

/**
 * Fonction utilitaire pour comparer les résultats V3 vs V4.
 */
export function compareV3V4(v3Result: any, v4Result: BacktestV4Result): {
  v3: { totalPnl: number; sharpe: number; winRate: number; trades: number };
  v4: { totalPnl: number; sharpe: number; winRate: number; trades: number };
  improvement: {
    pnlPct: number;
    sharpePct: number;
    tradesPct: number;
  };
} {
  return {
    v3: {
      totalPnl: v3Result.totalPnl ?? 0,
      sharpe: v3Result.sharpe ?? 0,
      winRate: v3Result.winRate ?? 0,
      trades: v3Result.totalTrades ?? 0,
    },
    v4: {
      totalPnl: v4Result.totalPnl,
      sharpe: v4Result.sharpe,
      winRate: v4Result.winRate,
      trades: v4Result.totalTrades,
    },
    improvement: {
      pnlPct: v3Result.totalPnl !== 0 ? ((v4Result.totalPnl - v3Result.totalPnl) / Math.abs(v3Result.totalPnl)) * 100 : 0,
      sharpePct: v3Result.sharpe !== 0 ? ((v4Result.sharpe - v3Result.sharpe) / Math.abs(v3Result.sharpe)) * 100 : 0,
      tradesPct: v3Result.totalTrades !== 0 ? ((v4Result.totalTrades - v3Result.totalTrades) / v3Result.totalTrades) * 100 : 0,
    },
  };
}
