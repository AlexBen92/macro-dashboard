export type StrategyFamily =
  | 'trend-continuation-long'
  | 'trend-continuation-short'
  | 'short-squeeze-long'
  | 'long-liquidation-reversal'
  | 'crowded-long-fragile'
  | 'neutral';

export type Direction = 'long' | 'short' | 'watch' | 'neutral';

export type ConfidenceLabel = 'high' | 'good' | 'watch';

export interface MarketRow {
  symbol: string;
  price: number | null;
  change24h: number | null;
  volume24h: number | null;
  openInterest: number | null;
  fundingRate: number | null;
  volatility24h: number | null;
  source: string;
  updatedAt: string;
  biasLabel: string | null;
  biasColor: 'green' | 'gray' | 'red' | 'amber' | null;
  strengthScore: number | null;
  interpretation: string | null;
  prevOpenInterest?: number | null;
  prevVolume?: number | null;
}

export interface OpportunityMetrics {
  priceChange: number | null;
  openInterestChange: number | null;
  volume24h: number | null;
  fundingRate: number | null;
  volatility24h: number | null;
  openInterest: number | null;
  price: number | null;
}

export interface TradeOpportunity {
  rank: number;
  symbol: string;
  direction: Direction;
  strategyFamily: StrategyFamily;
  regime: string;
  opportunityScore: number;
  scoreType: 'heuristic' | 'calibrated';
  confidenceLabel: ConfidenceLabel;
  entryHorizon: string;
  explanation: string;
  invalidation: string;
  metrics: OpportunityMetrics;
  source: string;
  updatedAt: string;
}

export interface MarketRegime {
  trend: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  strength: 'strong' | 'moderate' | 'weak';
  quality: 'high' | 'medium' | 'low';
}

export interface ScoringWeights {
  trendAlignment: number;
  oiConfirmation: number;
  volumeConfirmation: number;
  fundingQuality: number;
  volatilitySuitability: number;
  liquidityTradability: number;
  setupCleanliness: number;
}
