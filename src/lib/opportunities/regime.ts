import type { MarketRegime, MarketRow } from '@/lib/opportunities/types';

const THRESHOLDS = {
  priceChangeStrong: 2.5,
  priceChangeModerate: 1,
  fundingVeryHigh: 0.0012,
  fundingHigh: 0.0008,
  fundingModerate: 0.0002,
  fundingLow: -0.0002,
  fundingNegative: -0.0008,
  fundingVeryNegative: -0.0012,
} as const;

export function detectMarketRegime(row: MarketRow): MarketRegime {
  const change = row.change24h ?? 0;
  const funding = row.fundingRate ?? 0;
  const oi = row.openInterest ?? 0;
  const vol = row.volume24h ?? 0;
  const absChange = Math.abs(change);

  // Determine trend
  let trend: MarketRegime['trend'] = 'neutral';
  if (absChange > THRESHOLDS.priceChangeModerate) {
    trend = change > 0 ? 'bullish' : 'bearish';
  }

  // Determine strength
  let strength: MarketRegime['strength'] = 'weak';
  if (absChange > THRESHOLDS.priceChangeStrong) {
    strength = 'strong';
  } else if (absChange > THRESHOLDS.priceChangeModerate) {
    strength = 'moderate';
  }

  // Determine quality based on participation
  let quality: MarketRegime['quality'] = 'low';
  const hasHighOI = oi > 10_000_000;
  const hasHighVolume = vol > 1_000_000;

  if (hasHighOI && hasHighVolume) {
    quality = 'high';
  } else if (oi > 1_000_000 && vol > 500_000) {
    quality = 'medium';
  }

  // Fragile regimes with extreme funding
  if (Math.abs(funding) > THRESHOLDS.fundingVeryHigh) {
    quality = 'low';
  }

  return { trend, strength, quality };
}

export function getRegimeLabel(regime: MarketRegime): string {
  const trendLabels = {
    bullish: 'Haussier',
    bearish: 'Baissier',
    neutral: 'Neutre',
    volatile: 'Volatil',
  };

  const strengthLabels = {
    strong: 'Fort',
    moderate: 'Modéré',
    weak: 'Faible',
  };

  return `${trendLabels[regime.trend]} ${strengthLabels[regime.strength]}`;
}
