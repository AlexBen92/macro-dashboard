import type { DealerDeltaBias, GammaRegime } from './types';

export const REGIME_RULE_VERSION = 'v1';

export function gammaRegimeThreshold(spot: number): number {
  if (!Number.isFinite(spot) || spot <= 0) return 0;
  return spot * spot * 0.01;
}

export function gammaRegime(netGex: number, spot: number | null): GammaRegime {
  if (spot == null || spot <= 0 || !Number.isFinite(netGex)) return 'unknown';
  const thr = gammaRegimeThreshold(spot);
  if (Math.abs(netGex) < Math.max(1, thr)) return 'neutral';
  return netGex > 0 ? 'positive' : 'negative';
}

export function dealerDeltaBias(netDex: number, spot: number | null): DealerDeltaBias {
  if (spot == null || spot <= 0 || !Number.isFinite(netDex)) return 'unknown';
  const thr = spot * 1000;
  if (Math.abs(netDex) < thr) return 'flat';
  return netDex > 0 ? 'long' : 'short';
}
