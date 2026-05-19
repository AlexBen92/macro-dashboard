import type { MarketRow, MarketBias } from './types';

interface InterpretationInput {
  change24h: number | null;
  openInterest: number | null;
  volume24h: number | null;
  fundingRate: number | null;
  volatility24h: number | null;
  prevOpenInterest: number | null;
  prevVolume: number | null;
}

const THRESHOLDS = {
  fundingHigh: 0.0005,
  fundingLow: -0.0005,
  fundingModerate: 0.0001,
  volElevated: 0.05,
  volHigh: 0.08,
  volVeryHigh: 0.12,
  oiChangeThreshold: 0.05,
  volChangeThreshold: 0.10,
} as const;

function getTrend(value: number | null, prev: number | null): 'up' | 'down' | 'stable' | null {
  if (value === null || prev === null) return null;
  if (prev === 0) return value > 0 ? 'up' : 'stable';
  const change = (value - prev) / Math.abs(prev);
  if (Math.abs(change) < THRESHOLDS.oiChangeThreshold) return 'stable';
  return change > 0 ? 'up' : 'down';
}

export function deriveMarketBias(row: InterpretationInput): MarketBias {
  const {
    change24h,
    openInterest,
    volume24h,
    fundingRate,
    volatility24h,
    prevOpenInterest,
    prevVolume,
  } = row;

  if (change24h === null || openInterest === null || volume24h === null) {
    return {
      label: 'Insufficient data',
      color: 'gray',
      strengthScore: null,
      interpretation: 'Données insuffisantes pour une lecture fiable.',
    };
  }

  const priceTrend = change24h > 0 ? 'up' : change24h < 0 ? 'down' : 'stable';
  const oiTrend = getTrend(openInterest, prevOpenInterest);
  const volTrend = getTrend(volume24h, prevVolume);
  const funding = fundingRate ?? 0;
  const vol = volatility24h ?? 0;

  const isFundingVeryPositive = funding > THRESHOLDS.fundingHigh * 2;
  const isFundingPositive = funding > THRESHOLDS.fundingModerate;
  const isFundingNegative = funding < THRESHOLDS.fundingLow;
  const isFundingVeryNegative = funding < THRESHOLDS.fundingLow * 2;
  const isVolElevated = vol > THRESHOLDS.volElevated;
  const isVolHigh = vol > THRESHOLDS.volHigh;
  const isVolVeryHigh = vol > THRESHOLDS.volVeryHigh;
  const isVolModerate = vol > 0.02 && vol <= THRESHOLDS.volElevated;

  // Règles d'interprétation

  // 1. Bullish trend solide
  if (
    priceTrend === 'up' &&
    oiTrend === 'up' &&
    volTrend === 'up' &&
    isFundingPositive &&
    !isFundingVeryPositive &&
    isVolModerate
  ) {
    return {
      label: 'Bullish trend',
      color: 'green',
      strengthScore: 80,
      interpretation: 'Tendance haussière construite avec participation en hausse.',
    };
  }

  // 2. Crowded longs
  if (
    priceTrend === 'up' &&
    oiTrend === 'up' &&
    volTrend === 'up' &&
    isFundingVeryPositive &&
    isVolHigh
  ) {
    return {
      label: 'Crowded longs',
      color: 'amber',
      strengthScore: 65,
      interpretation: 'Hausse active mais surchargée en longs, risque de flush.',
    };
  }

  // 3. Short squeeze
  if (
    priceTrend === 'up' &&
    oiTrend === 'down' &&
    volTrend === 'up' &&
    (isFundingNegative || (!isFundingPositive && isVolElevated))
  ) {
    return {
      label: 'Short squeeze',
      color: 'green',
      strengthScore: 70,
      interpretation: 'Hausse portée surtout par du short covering.',
    };
  }

  // 4. Bearish build
  if (
    priceTrend === 'down' &&
    oiTrend === 'up' &&
    volTrend === 'up' &&
    isFundingNegative &&
    isVolModerate
  ) {
    return {
      label: 'Bearish build',
      color: 'red',
      strengthScore: 80,
      interpretation: 'Construction baissière avec engagement vendeur croissant.',
    };
  }

  // 5. Crowded shorts
  if (
    priceTrend === 'down' &&
    oiTrend === 'up' &&
    volTrend === 'up' &&
    isFundingVeryNegative &&
    isVolHigh
  ) {
    return {
      label: 'Crowded shorts',
      color: 'amber',
      strengthScore: 65,
      interpretation: 'Baisse chargée en shorts, risque de squeeze si rebond.',
    };
  }

  // 6. Long liquidation
  if (
    priceTrend === 'down' &&
    oiTrend === 'down' &&
    volTrend === 'up' &&
    isVolHigh
  ) {
    return {
      label: 'Long liquidation',
      color: 'red',
      strengthScore: 75,
      interpretation: 'Liquidation des longs / déleveraging agressif.',
    };
  }

  // 7. Unwind
  if (
    oiTrend === 'down' &&
    volTrend === 'up' &&
    isVolVeryHigh
  ) {
    return {
      label: 'Unwind',
      color: 'gray',
      strengthScore: 60,
      interpretation: 'Nettoyage de levier, mouvement violent mais moins durable.',
    };
  }

  // 8. Neutral
  if (
    priceTrend === 'stable' &&
    oiTrend === 'stable' &&
    Math.abs(funding) < THRESHOLDS.fundingModerate &&
    !isVolElevated
  ) {
    return {
      label: 'Neutral',
      color: 'gray',
      strengthScore: 55,
      interpretation: 'Marché neutre, peu de conviction directionnelle.',
    };
  }

  // Interprétations de fallback

  if (priceTrend === 'up' && oiTrend === 'up' && isFundingPositive) {
    return {
      label: 'Bullish',
      color: 'green',
      strengthScore: 70,
      interpretation: 'Pression acheteuse avec accumulation de positions.',
    };
  }

  if (priceTrend === 'down' && oiTrend === 'up' && isFundingNegative) {
    return {
      label: 'Bearish',
      color: 'red',
      strengthScore: 70,
      interpretation: 'Pression vendeuse avec accumulation de shorts.',
    };
  }

  if (priceTrend === 'up' && oiTrend === 'down') {
    return {
      label: 'Short covering',
      color: 'green',
      strengthScore: 60,
      interpretation: 'Hausse technique par fermeture de shorts.',
    };
  }

  if (priceTrend === 'down' && oiTrend === 'down') {
    return {
      label: 'Long unwinding',
      color: 'red',
      strengthScore: 60,
      interpretation: 'Baisse technique par fermeture de longs.',
    };
  }

  if (priceTrend === 'up' && isFundingVeryPositive) {
    return {
      label: 'Overheated longs',
      color: 'amber',
      strengthScore: 60,
      interpretation: 'Hausse mais longs très payants, attention retournement.',
    };
  }

  if (priceTrend === 'down' && isFundingVeryNegative) {
    return {
      label: 'Overheated shorts',
      color: 'amber',
      strengthScore: 60,
      interpretation: 'Baisse mais shorts très payants, attention squeeze.',
    };
  }

  if (isVolVeryHigh) {
    return {
      label: 'High volatility',
      color: 'amber',
      strengthScore: 50,
      interpretation: 'Volatilité extrême, conditions de marché anormales.',
    };
  }

  if (priceTrend === 'stable') {
    return {
      label: 'Consolidation',
      color: 'gray',
      strengthScore: 50,
      interpretation: 'Marché en consolidation, attendre une direction.',
    };
  }

  return {
    label: 'Neutral',
    color: 'gray',
    strengthScore: 50,
    interpretation: 'Conditions mixtes, pas de signal clair.',
  };
}
