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
  fundingVeryHigh: 0.0015,     // 0.15%+
  fundingHigh: 0.0008,         // 0.08%+
  fundingModerate: 0.0002,     // 0.02%+
  fundingLow: -0.0002,         // -0.02%-
  fundingNegative: -0.0008,    // -0.08%-
  fundingVeryNegative: -0.0015, // -0.15%-
  priceChangeStrong: 3,        // ±3%
  priceChangeModerate: 1,      // ±1%
  volElevated: 0.05,
  volHigh: 0.08,
  volVeryHigh: 0.12,
  oiChangeThreshold: 0.05,
  volChangeThreshold: 0.10,
} as const;

function getTrend(value: number | null, prev: number | null): 'up' | 'down' | 'stable' | null {
  if (value === null || prev === null || prev === 0) return null;
  const change = (value - prev) / Math.abs(prev);
  if (Math.abs(change) < THRESHOLDS.oiChangeThreshold) return 'stable';
  return change > 0 ? 'up' : 'down';
}

function hasTrendData(prevOpenInterest: number | null, prevVolume: number | null): boolean {
  return prevOpenInterest !== null && prevVolume !== null;
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

  if (change24h === null) {
    return {
      label: 'Insufficient data',
      color: 'gray',
      strengthScore: null,
      interpretation: 'Données insuffisantes pour une lecture fiable.',
    };
  }

  const priceTrend = change24h > 0 ? 'up' : change24h < 0 ? 'down' : 'stable';
  const priceStrength = Math.abs(change24h);
  const oiTrend = getTrend(openInterest, prevOpenInterest);
  const volTrend = getTrend(volume24h, prevVolume);
  const funding = fundingRate ?? 0;
  const hasPrevData = hasTrendData(prevOpenInterest, prevVolume);

  const isFundingVeryPositive = funding > THRESHOLDS.fundingVeryHigh;
  const isFundingPositive = funding > THRESHOLDS.fundingModerate;
  const isFundingNegative = funding < THRESHOLDS.fundingLow;
  const isFundingVeryNegative = funding < THRESHOLDS.fundingVeryNegative;
  const isPriceStrong = priceStrength > THRESHOLDS.priceChangeStrong;
  const isPriceModerate = priceStrength > THRESHOLDS.priceChangeModerate;

  // === PRIORITÉ 1: SIGNAUX AVEC TENDANCES (si données historiques) ===

  if (hasPrevData) {
    // Bullish trend solide
    if (
      priceTrend === 'up' &&
      oiTrend === 'up' &&
      volTrend === 'up' &&
      isFundingPositive &&
      !isFundingVeryPositive
    ) {
      return {
        label: 'Bullish trend',
        color: 'green',
        strengthScore: 85,
        interpretation: 'Tendance haussière construite avec participation en hausse.',
      };
    }

    // Crowded longs
    if (
      priceTrend === 'up' &&
      oiTrend === 'up' &&
      volTrend === 'up' &&
      isFundingVeryPositive
    ) {
      return {
        label: 'Crowded longs',
        color: 'amber',
        strengthScore: 60,
        interpretation: 'Hausse surchargée en longs, risque de flush.',
      };
    }

    // Short squeeze
    if (
      priceTrend === 'up' &&
      oiTrend === 'down' &&
      volTrend === 'up'
    ) {
      return {
        label: 'Short squeeze',
        color: 'green',
        strengthScore: 75,
        interpretation: 'Hausse portée par du short covering.',
      };
    }

    // Bearish build
    if (
      priceTrend === 'down' &&
      oiTrend === 'up' &&
      volTrend === 'up' &&
      isFundingNegative
    ) {
      return {
        label: 'Bearish build',
        color: 'red',
        strengthScore: 80,
        interpretation: 'Construction baissière avec shorts croissants.',
      };
    }

    // Crowded shorts
    if (
      priceTrend === 'down' &&
      oiTrend === 'up' &&
      volTrend === 'up' &&
      isFundingVeryNegative
    ) {
      return {
        label: 'Crowded shorts',
        color: 'amber',
        strengthScore: 60,
        interpretation: 'Baisse chargée en shorts, risque de squeeze.',
      };
    }

    // Long liquidation
    if (
      priceTrend === 'down' &&
      oiTrend === 'down' &&
      volTrend === 'up'
    ) {
      return {
        label: 'Long liquidation',
        color: 'red',
        strengthScore: 70,
        interpretation: 'Liquidation agressive des longs.',
      };
    }

    // Unwind
    if (oiTrend === 'down' && volTrend === 'up' && isPriceStrong) {
      return {
        label: 'Unwind',
        color: 'gray',
        strengthScore: 55,
        interpretation: 'Nettoyage de levier, mouvement violent.',
      };
    }

    // Bullish accumulation
    if (priceTrend === 'up' && oiTrend === 'up' && isFundingPositive) {
      return {
        label: 'Bullish',
        color: 'green',
        strengthScore: 72,
        interpretation: 'Accumulation haussière de positions.',
      };
    }

    // Bearish accumulation
    if (priceTrend === 'down' && oiTrend === 'up' && isFundingNegative) {
      return {
        label: 'Bearish',
        color: 'red',
        strengthScore: 72,
        interpretation: 'Accumulation baissière de shorts.',
      };
    }
  }

  // === PRIORITÉ 2: SIGNAUX SANS DONNÉES HISTORIQUES (basés sur funding + prix actuels) ===

  // Squeeze imminent (funding extrême + prix monte)
  if (priceTrend === 'up' && isFundingVeryPositive && isPriceStrong) {
    return {
      label: 'Overheated longs',
      color: 'amber',
      strengthScore: 58,
      interpretation: 'Hausse avec funding très élevé, risque de flush.',
    };
  }

  // Short squeeze potentiel (prix monte + funding négatif ou neutre)
  if (priceTrend === 'up' && isFundingNegative && isPriceStrong) {
    return {
      label: 'Short squeeze',
      color: 'green',
      strengthScore: 68,
      interpretation: 'Hausse alors que shorts sont payants, squeeze en cours.',
    };
  }

  // Squeeze shorts potentiel (prix baisse + funding très négatif)
  if (priceTrend === 'down' && isFundingVeryNegative && isPriceStrong) {
    return {
      label: 'Overheated shorts',
      color: 'amber',
      strengthScore: 58,
      interpretation: 'Baisse avec funding très négatif, risque de squeeze.',
    };
  }

  // Long flush potentiel (prix baisse + funding très positif)
  if (priceTrend === 'down' && isFundingVeryPositive && isPriceStrong) {
    return {
      label: 'Long flush',
      color: 'red',
      strengthScore: 65,
      interpretation: 'Baisse alors que longs payent gros, liquidations.',
    };
  }

  // Momentum haussier (prix fort monte + funding modérément positif)
  if (priceTrend === 'up' && isPriceStrong && isFundingPositive && !isFundingVeryPositive) {
    return {
      label: 'Bullish momentum',
      color: 'green',
      strengthScore: 70,
      interpretation: 'Momentum haussier solide avec funding sain.',
    };
  }

  // Momentum baissier (prix fort baisse + funding négatif)
  if (priceTrend === 'down' && isPriceStrong && isFundingNegative) {
    return {
      label: 'Bearish momentum',
      color: 'red',
      strengthScore: 70,
      interpretation: 'Momentum baissier avec shorts dominants.',
    };
  }

  // Hausse modérée + funding positif
  if (priceTrend === 'up' && isPriceModerate && isFundingPositive) {
    return {
      label: 'Bullish',
      color: 'green',
      strengthScore: 62,
      interpretation: 'Tendance haussière modérée.',
    };
  }

  // Baisse modérée + funding négatif
  if (priceTrend === 'down' && isPriceModerate && isFundingNegative) {
    return {
      label: 'Bearish',
      color: 'red',
      strengthScore: 62,
      interpretation: 'Tendance baissière modérée.',
    };
  }

  // Funding très élevé (indication de positionnement extrême)
  if (isFundingVeryPositive) {
    return {
      label: 'Crowded longs',
      color: 'amber',
      strengthScore: 55,
      interpretation: 'Funding très élevé, positionnement long extrême.',
    };
  }

  if (isFundingVeryNegative) {
    return {
      label: 'Crowded shorts',
      color: 'amber',
      strengthScore: 55,
      interpretation: 'Funding très négatif, positionnement short extrême.',
    };
  }

  // Mouvement fort mais funding neutre
  if (isPriceStrong) {
    if (priceTrend === 'up') {
      return {
        label: 'Strong buying',
        color: 'green',
        strengthScore: 58,
        interpretation: 'Pression acheteuse forte.',
      };
    }
    return {
      label: 'Strong selling',
      color: 'red',
      strengthScore: 58,
      interpretation: 'Pression vendeuse forte.',
    };
  }

  // Prix stable + funding neutre
  if (priceTrend === 'stable' && Math.abs(funding) < THRESHOLDS.fundingModerate) {
    return {
      label: 'Neutral',
      color: 'gray',
      strengthScore: 50,
      interpretation: 'Marché neutre, peu de conviction.',
    };
  }

  // Fallback pour mouvements modérés
  if (priceTrend === 'up') {
    return {
      label: 'Slightly bullish',
      color: 'green',
      strengthScore: 54,
      interpretation: 'Léger biais haussier.',
    };
  }

  if (priceTrend === 'down') {
    return {
      label: 'Slightly bearish',
      color: 'red',
      strengthScore: 54,
      interpretation: 'Léger biais baissier.',
    };
  }

  return {
    label: 'Neutral',
    color: 'gray',
    strengthScore: 50,
    interpretation: 'Conditions mixtes, pas de signal clair.',
  };
}
