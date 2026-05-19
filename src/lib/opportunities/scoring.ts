import type { ScoringWeights, TradeOpportunity, MarketRow } from '@/lib/opportunities/types';
import { detectMarketRegime, getRegimeLabel } from './regime';
import { detectStrategy, getStrategyFamilyLabel, getDirectionLabel } from './strategies';

const DEFAULT_WEIGHTS: ScoringWeights = {
  trendAlignment: 25,
  oiConfirmation: 20,
  volumeConfirmation: 15,
  fundingQuality: 10,
  volatilitySuitability: 10,
  liquidityTradability: 10,
  setupCleanliness: 10,
};

interface OpportunityInput {
  symbol: string;
  change24h: number | null;
  openInterest: number | null;
  volume24h: number | null;
  fundingRate: number | null;
  volatility24h: number | null;
  prevOpenInterest?: number | null;
  prevVolume?: number | null;
  price?: number | null;
}

interface RankedOpportunity {
  symbol: string;
  direction: string;
  strategyFamily: string;
  regime: string;
  opportunityScore: number;
  confidenceLabel: string;
  entryHorizon: string;
  explanation: string;
  invalidation: string;
  metrics: {
    priceChange: number | null;
    openInterestChange: number | null;
    volume24h: number | null;
    fundingRate: number | null;
    volatility24h: number | null;
    openInterest: number | null;
    price: number | null;
  };
}

function calculateOIChange(current: number | null, prev: number | null): number | null {
  if (current === null || prev === null || prev === 0) return null;
  return ((current - prev) / Math.abs(prev)) * 100;
}

export function rankOpportunities(
  markets: MarketRow[],
  prevDataMap?: Map<string, { oi: number; vol: number }>,
  maxCount: number = 10
): TradeOpportunity[] {
  const opportunities: TradeOpportunity[] = [];

  for (const market of markets) {
    // Get previous data for trend calculation
    const prevData = prevDataMap?.get(market.symbol);

    // Create market row with prev data
    const rowWithPrev: MarketRow = {
      ...market,
      prevOpenInterest: prevData?.oi ?? null,
      prevVolume: prevData?.vol ?? null,
    };

    // Detect regime and strategy
    const regime = detectMarketRegime(rowWithPrev);
    const strategy = detectStrategy(rowWithPrev, regime, prevData ? {
      symbol: market.symbol,
      price: null,
      change24h: (market.change24h ?? 0) - 2, // Simulated prev change
      openInterest: prevData.oi,
      volume24h: prevData.vol,
      fundingRate: null,
      volatility24h: null,
      source: 'hyperliquid',
      updatedAt: market.updatedAt,
      biasLabel: null,
      biasColor: null,
      strengthScore: null,
      interpretation: null,
    } : undefined);

    if (!strategy || strategy.family === 'neutral') {
      continue;
    }

    // Calculate score components
    let score = strategy.baseScore;

    // Quality adjustment
    if (regime.quality === 'high') {
      score += 5;
    } else if (regime.quality === 'low') {
      score -= 5;
    }

    // Strength adjustment
    if (regime.strength === 'strong') {
      score += 3;
    }

    // Liquidity bonus
    const oi = market.openInterest ?? 0;
    const vol = market.volume24h ?? 0;
    if (oi > 50_000_000 && vol > 50_000_000) {
      score += 3;
    }

    // Cap score
    score = Math.max(50, Math.min(99, score));

    // Calculate OI change
    const oiChange = calculateOIChange(market.openInterest, prevData?.oi ?? null);

    opportunities.push({
      rank: 0, // Will be set after sorting
      symbol: market.symbol,
      direction: strategy.direction,
      strategyFamily: strategy.family,
      regime: getRegimeLabel(regime),
      opportunityScore: score,
      scoreType: 'heuristic',
      confidenceLabel: strategy.confidenceLabel,
      entryHorizon: strategy.entryHorizon,
      explanation: strategy.explanation,
      invalidation: strategy.invalidation,
      metrics: {
        priceChange: market.change24h,
        openInterestChange: oiChange,
        volume24h: market.volume24h,
        fundingRate: market.fundingRate,
        volatility24h: market.volatility24h,
        openInterest: market.openInterest,
        price: market.price,
      },
      source: 'hyperliquid',
      updatedAt: market.updatedAt,
    });
  }

  // Sort by score descending
  opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Assign ranks
  opportunities.forEach((opp, idx) => {
    opp.rank = idx + 1;
  });

  // Filter by minimum score and limit count
  const filtered = opportunities
    .filter(opp => opp.opportunityScore >= 55)
    .slice(0, maxCount);

  return filtered;
}

export function filterByDirection(opportunities: TradeOpportunity[], direction: 'long' | 'short' | 'watch'): TradeOpportunity[] {
  return opportunities.filter(opp => opp.direction === direction);
}

export function filterByStrategy(opportunities: TradeOpportunity[], strategy: string): TradeOpportunity[] {
  return opportunities.filter(opp => opp.strategyFamily.includes(strategy));
}
