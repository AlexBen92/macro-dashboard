import type { StrategyFamily, Direction, ConfidenceLabel, MarketRow, MarketRegime } from '@/lib/opportunities/types';

interface StrategySignal {
  family: StrategyFamily;
  direction: Direction;
  confidenceLabel: ConfidenceLabel;
  baseScore: number;
  entryHorizon: string;
  explanation: string;
  invalidation: string;
}

const THRESHOLDS = {
  // Price
  priceChangeStrong: 3,
  priceChangeModerate: 1,
  priceChangeWeak: 0.3,

  // Funding (as decimals, so 0.001 = 0.1%)
  fundingVeryHigh: 0.0012,
  fundingHigh: 0.0008,
  fundingModerate: 0.0002,
  fundingLow: -0.0002,
  fundingNegative: -0.0008,
  fundingVeryNegative: -0.0012,

  // OI & Volume (for trend detection - will use null checks)
  oiThreshold: 0,
  volThreshold: 0,

  // Quality
  minOI: 500_000,
  minVolume: 1_000_000,
  highOI: 10_000_000,
  highVolume: 10_000_000,
} as const;

export function detectStrategy(
  row: MarketRow,
  regime: MarketRegime,
  prevRow?: MarketRow
): StrategySignal | null {
  const {
    change24h,
    openInterest,
    volume24h,
    fundingRate,
  } = row;

  // Skip if insufficient data
  if (change24h === null) {
    return null;
  }

  const priceTrend = change24h > 0 ? 'up' : change24h < 0 ? 'down' : 'stable';
  const priceStrength = Math.abs(change24h);
  const funding = fundingRate ?? 0;
  const oi = openInterest ?? 0;
  const vol = volume24h ?? 0;

  // Calculate OI and volume trends if previous data available
  let oiTrend: 'up' | 'down' | 'stable' = 'stable';
  let volTrend: 'up' | 'down' | 'stable' = 'stable';

  if (prevRow && prevRow.openInterest && prevRow.volume24h) {
    const oiChange = ((oi - prevRow.openInterest) / Math.abs(prevRow.openInterest)) * 100;
    const volChange = ((vol - prevRow.volume24h) / Math.abs(prevRow.volume24h)) * 100;

    if (Math.abs(oiChange) > 5) {
      oiTrend = oiChange > 0 ? 'up' : 'down';
    }
    if (Math.abs(volChange) > 5) {
      volTrend = volChange > 0 ? 'up' : 'down';
    }
  }

  // === STRATEGY A: Trend Continuation Long ===
  if (
    priceTrend === 'up' &&
    priceStrength >= THRESHOLDS.priceChangeModerate &&
    (oiTrend === 'up' || oiTrend === 'stable') &&
    (volTrend === 'up' || volTrend === 'stable') &&
    funding > THRESHOLDS.fundingLow &&
    funding < THRESHOLDS.fundingVeryHigh &&
    regime.quality !== 'low' &&
    vol >= THRESHOLDS.minVolume
  ) {
    const score = 75 + (regime.quality === 'high' ? 10 : 0) + (priceStrength > THRESHOLDS.priceChangeStrong ? 5 : 0);
    return {
      family: 'trend-continuation-long',
      direction: 'long',
      confidenceLabel: score >= 85 ? 'high' : 'good',
      baseScore: Math.min(score, 95),
      entryHorizon: '30m à 4h',
      explanation: `Tendance haussière confirmée par OI ${oiTrend === 'up' ? 'en hausse' : 'stable'} et volume ${volTrend === 'up' ? 'en hausse' : 'stable'}.`,
      invalidation: 'Prix sous le niveau d\'entrée initial ou OI chute massivement.',
    };
  }

  // === STRATEGY B: Trend Continuation Short ===
  if (
    priceTrend === 'down' &&
    priceStrength >= THRESHOLDS.priceChangeModerate &&
    (oiTrend === 'up' || oiTrend === 'stable') &&
    (volTrend === 'up' || volTrend === 'stable') &&
    funding < THRESHOLDS.fundingLow &&
    funding > THRESHOLDS.fundingVeryNegative &&
    regime.quality !== 'low' &&
    vol >= THRESHOLDS.minVolume
  ) {
    const score = 75 + (regime.quality === 'high' ? 10 : 0) + (priceStrength > THRESHOLDS.priceChangeStrong ? 5 : 0);
    return {
      family: 'trend-continuation-short',
      direction: 'short',
      confidenceLabel: score >= 85 ? 'high' : 'good',
      baseScore: Math.min(score, 95),
      entryHorizon: '30m à 4h',
      explanation: `Tendance baissière confirmée par OI ${oiTrend === 'up' ? 'en hausse' : 'stable'} et volume ${volTrend === 'up' ? 'en hausse' : 'stable'}.`,
      invalidation: 'Prix au-dessus du niveau d\'entrée initial ou OI chute massivement.',
    };
  }

  // === STRATEGY C: Short Squeeze Long ===
  if (
    priceTrend === 'up' &&
    priceStrength >= THRESHOLDS.priceChangeModerate &&
    (oiTrend === 'down' || oiTrend === 'stable') &&
    (funding < THRESHOLDS.fundingModerate || funding < 0) &&
    vol >= THRESHOLDS.minVolume
  ) {
    const score = 65 + (funding < THRESHOLDS.fundingLow ? 10 : 0) + (priceStrength > THRESHOLDS.priceChangeStrong ? 5 : 0);
    return {
      family: 'short-squeeze-long',
      direction: 'long',
      confidenceLabel: score >= 75 ? 'good' : 'watch',
      baseScore: Math.min(score, 85),
      entryHorizon: '15m à 2h',
      explanation: `Hausse sur OI ${oiTrend === 'down' ? 'en baisse' : 'stable'} avec funding ${funding < 0 ? 'négatif' : 'faible'}. Short squeeze probable.`,
      invalidation: 'Prix casse sous le niveau d\'entrée ou volume s\'effondre.',
    };
  }

  // === STRATEGY D: Long Liquidation Reversal (WATCH) ===
  if (
    priceTrend === 'down' &&
    priceStrength >= THRESHOLDS.priceChangeStrong &&
    oiTrend === 'down' &&
    volTrend === 'up' &&
    vol >= THRESHOLDS.minVolume
  ) {
    return {
      family: 'long-liquidation-reversal',
      direction: 'watch',
      confidenceLabel: 'watch',
      baseScore: 60,
      entryHorizon: '15m à 90m',
      explanation: 'Liquidation de longs avec OI en baisse et volume en hausse. Surveiller signaux de retournement.',
      invalidation: 'Prix continue de baisser avec volume croissant.',
    };
  }

  // === STRATEGY E: Crowded Long Fade (FRAGILE) ===
  if (
    priceTrend === 'up' &&
    funding >= THRESHOLDS.fundingVeryHigh &&
    oi >= THRESHOLDS.minOI &&
    vol >= THRESHOLDS.minVolume
  ) {
    return {
      family: 'crowded-long-fragile',
      direction: 'watch',
      confidenceLabel: 'watch',
      baseScore: 55,
      entryHorizon: '30m à 2h',
      explanation: `Hausse avec funding extrême (${(funding * 100).toFixed(2)}%). Longs surchargés, risque de flush.`,
      invalidation: 'Funding baisse rapidement ou prix accélère à la hausse.',
    };
  }

  // === Strong momentum without full confirmation ===
  if (priceStrength >= THRESHOLDS.priceChangeStrong && vol >= THRESHOLDS.minVolume) {
    if (priceTrend === 'up') {
      return {
        family: 'trend-continuation-long',
        direction: 'long',
        confidenceLabel: 'watch',
        baseScore: 58,
        entryHorizon: '30m à 2h',
        explanation: `Momentum haussier fort (+${change24h.toFixed(1)}%). Surveiller confirmation OI/volume.`,
        invalidation: 'Prix retourne sous le niveau de départ.',
      };
    }
    if (priceTrend === 'down') {
      return {
        family: 'trend-continuation-short',
        direction: 'short',
        confidenceLabel: 'watch',
        baseScore: 58,
        entryHorizon: '30m à 2h',
        explanation: `Momentum baissier fort (${change24h.toFixed(1)}%). Surveiller confirmation OI/volume.`,
        invalidation: 'Prix repasse au-dessus du niveau de départ.',
      };
    }
  }

  // === STRATEGY F: Neutral / No Trade ===
  return null;
}

export function getStrategyFamilyLabel(family: StrategyFamily): string {
  const labels = {
    'trend-continuation-long': 'Trend Continuation Long',
    'trend-continuation-short': 'Trend Continuation Short',
    'short-squeeze-long': 'Short Squeeze Long',
    'long-liquidation-reversal': 'Liquidation Reversal',
    'crowded-long-fragile': 'Crowded Long (Fragile)',
    'neutral': 'Neutre',
  };
  return labels[family];
}

export function getDirectionLabel(direction: Direction): string {
  const labels = {
    long: 'LONG',
    short: 'SHORT',
    watch: 'WATCH',
    neutral: 'NEUTRAL',
  };
  return labels[direction];
}
