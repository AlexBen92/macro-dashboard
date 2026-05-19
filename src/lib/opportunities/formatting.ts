import type { TradeOpportunity } from './types';

export function formatOpportunityScore(score: number): string {
  return score.toFixed(0);
}

export function formatHorizon(horizon: string): string {
  return horizon;
}

export function getConfidenceColor(confidence: string): string {
  const colors = {
    high: '#4ade80',
    good: '#00e5ff',
    watch: '#ffaa00',
  };
  return colors[confidence as keyof typeof colors] ?? '#5a6070';
}

export function getDirectionColor(direction: string): string {
  const colors = {
    long: '#4ade80',
    short: '#ff3355',
    watch: '#ffaa00',
    neutral: '#5a6070',
  };
  return colors[direction as keyof typeof colors] ?? '#5a6070';
}

export function getStrategyColor(strategy: string): string {
  if (strategy.includes('continuation')) return '#00e5ff';
  if (strategy.includes('squeeze')) return '#4ade80';
  if (strategy.includes('reversal')) return '#aa66ff';
  if (strategy.includes('fragile')) return '#ffaa00';
  return '#5a6070';
}

export function formatPriceChange(change: number | null): string {
  if (change === null) return '—';
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(2)}%`;
}

export function formatVolume(volume: number | null): string {
  if (volume === null) return '—';
  if (volume >= 1_000_000_000) return `$${(volume / 1_000_000_000).toFixed(1)}B`;
  if (volume >= 1_000_000) return `$${(volume / 1_000_000).toFixed(1)}M`;
  if (volume >= 1_000) return `$${(volume / 1_000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

export function formatFunding(funding: number | null): string {
  if (funding === null) return '—';
  const sign = funding >= 0 ? '+' : '';
  return `${sign}${(funding * 100).toFixed(3)}%`;
}

export function formatOI(oi: number | null): string {
  if (oi === null) return '—';
  if (oi >= 1_000_000_000) return `$${(oi / 1_000_000_000).toFixed(1)}B`;
  if (oi >= 1_000_000) return `$${(oi / 1_000_000).toFixed(1)}M`;
  return `$${(oi / 1_000).toFixed(0)}K`;
}
