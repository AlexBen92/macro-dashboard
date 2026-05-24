/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * QUANT MODULES INDEX — V4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Point d'entrée central pour tous les modules quantitatifs avancés V4.
 * Chaque module est conçu pour être utilisable indépendamment ou en
 * combinaison avec les autres.
 *
 * MODULES DISPONIBLES:
 *  1. stationarity - Tests ADF, KPSS, différenciation fractionnelle
 *  2. kelly - Sizing adaptatif avec contraintes de drawdown
 *  3. ehlers - Indicateurs DSP (MAMA, Super Smoother, Fisher Transform)
 *  4. openInterest - Analyse OI et Funding Rates
 *  5. hmm-regime - Détection de régime par Hidden Markov Model
 *  6. advanced-metrics - Métriques de performance académiques
 *  7. vpin - VPIN (Volume-Synchronized PIN) pour toxicité du flux
 *
 * UTILISATION:
 *  import { analyzeStationarity, constrainedKelly } from '@/lib/quant';
 *  import { HiddenMarkovModel } from '@/lib/quant/hmm-regime';
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 1: STATIONARITY
// ─────────────────────────────────────────────────────────────────────────────
export {
  adfTest,
  kpssTest,
  fracDiff,
  findOptimalD,
  analyzeStationarity,
} from './stationarity';

export type {
  ADFResult,
  KPSSResult,
  OptimalDResult,
  StationarityAnalysis,
} from './stationarity';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 2: KELLY CRITERION
// ─────────────────────────────────────────────────────────────────────────────
export {
  kellyFraction,
  halfKelly,
  constrainedKelly,
  rollingKelly,
  portfolioKelly,
  drawdownConstrainedKelly,
  kellyPositionSize,
  addTrade,
} from './kelly';

export type {
  Trade as KellyTrade,
  KellyResult,
  PositionSize,
  AssetData,
  PortfolioKellyResult,
} from './kelly';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 3: EHLERS/DSP INDICATORS
// ─────────────────────────────────────────────────────────────────────────────
export {
  superSmoother,
  adaptiveSuperSmoother,
  hilbertTransformDC,
  MAMA,
  cycleMomentum,
  smoothedStochRSI,
  fisherTransform,
  generateEhlersSignal,
} from './ehlers';

export type {
  HilbertResult,
  MAMAResult,
  StochRSIResult,
  FisherResult,
  EhlersSignal,
} from './ehlers';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 4: OPEN INTEREST & FUNDING RATE
// ─────────────────────────────────────────────────────────────────────────────
export {
  oiSignal,
  oiVolumeRatio,
  interpretOIVolumeRatio,
  fundingRateSignal,
  liquidationZoneSignal,
  oiMomentumScore,
  proxyOI,
  getIntegratedOISignal,
} from './openInterest';

export type {
  OISignal,
  FundingSignal,
  LiquidationZone,
  OIMomentumScore,
  IntegratedOISignal,
} from './openInterest';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 5: HMM REGIME DETECTION
// ─────────────────────────────────────────────────────────────────────────────
export {
  extractHMMFeatures,
  HiddenMarkovModel,
  createPretrainedCryptoHMM,
  getRegimeRecommendation,
} from './hmm-regime';

export type {
  RegimeState,
  RegimeProbabilities,
  HMMState,
  HMMDiagnostics,
  RegimeRecommendation,
} from './hmm-regime';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 6: ADVANCED METRICS
// ─────────────────────────────────────────────────────────────────────────────
export {
  computeAdvancedMetrics,
  calculateCAGR,
  calculateExpectancy,
  calculateSharpe,
  calculateSortino,
  calculateCalmarRatio,
  calculateOmegaRatio,
  calculateTailRatio,
  calculateMaxDrawdown,
  calculateMaxDrawdownDuration,
  calculateAvgDrawdown,
  calculateUlcerIndex,
  calculateWinRate,
  calculateProfitFactor,
  calculatePayoffRatio,
  calculateExpectancyScore,
  calculateKellyFromTrades,
  calculateSkewness,
  calculateKurtosis,
  calculateVaR,
  calculateCVaR,
  calculateMaxConsecutiveLosses,
  calculateAvgHoldingTime,
  calculateTradesPerMonth,
  monteCarloSimulation,
  formatMetrics,
} from './advanced-metrics';

export type {
  Trade as PerformanceTrade,
  EquityPoint,
  AdvancedMetrics,
  DrawdownResult,
  MonteCarloResult,
} from './advanced-metrics';

// ─────────────────────────────────────────────────────────────────────────────
// MODULE 7: VPIN
// ─────────────────────────────────────────────────────────────────────────────
export {
  classifyVolume,
  classifyVolumeProportional,
  calculateVPIN,
  calculateVPINTimeBased,
  vpinTradeFilter,
  vpinSizingMultiplier,
  analyzeVPIN,
  formatVPIN,
  describeVPINLevel,
  compareVPINPeriods,
} from './vpin';

export type {
  VolumeClassification,
  VPINResult,
  VPINAnalysis,
  VPINFilter,
} from './vpin';

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Version du système quant V4.
 */
export const QUANT_V4_VERSION = '4.0.0';

/**
 * Informations sur les modules disponibles.
 */
export const MODULE_INFO = {
  stationarity: {
    name: 'Stationarity Tests',
    version: '1.0.0',
    description: 'ADF, KPSS, and Fractional Differentiation for time series preprocessing',
  },
  kelly: {
    name: 'Kelly Criterion',
    version: '1.0.0',
    description: 'Adaptive position sizing with drawdown constraints',
  },
  ehlers: {
    name: 'Ehlers/DSP Indicators',
    version: '1.0.0',
    description: 'MAMA, Super Smoother, Hilbert Transform, Fisher Transform',
  },
  openInterest: {
    name: 'Open Interest Analysis',
    version: '1.0.0',
    description: 'OI change rate, funding rates, liquidation heatmap',
  },
  hmm: {
    name: 'HMM Regime Detection',
    version: '1.0.0',
    description: 'Hidden Markov Model for market regime detection',
  },
  metrics: {
    name: 'Advanced Metrics',
    version: '1.0.0',
    description: 'Sharpe, Sortino, Calmar, Omega, Monte Carlo, etc.',
  },
  vpin: {
    name: 'VPIN',
    version: '1.0.0',
    description: 'Volume-Synchronized Probability of Informed Trading',
  },
} as const;
