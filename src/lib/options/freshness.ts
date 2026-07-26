import type { DataFreshness } from './types';

export interface FreshnessThresholds {
  liveMs: number;
  delayedMs: number;
  staleMs: number;
}

export const DEFAULT_THRESHOLDS: FreshnessThresholds = {
  liveMs: 15_000,
  delayedMs: 60_000,
  staleMs: 300_000,
};

export function computeFreshness(
  sourceTs: string | null,
  now: number,
  thresholds: FreshnessThresholds = DEFAULT_THRESHOLDS,
): { status: DataFreshness; ageMs: number } {
  if (sourceTs == null) return { status: 'unavailable', ageMs: Number.POSITIVE_INFINITY };
  const t = Date.parse(sourceTs);
  if (!Number.isFinite(t)) return { status: 'unavailable', ageMs: Number.POSITIVE_INFINITY };
  const ageMs = Math.max(0, now - t);
  if (ageMs < thresholds.liveMs) return { status: 'live', ageMs };
  if (ageMs < thresholds.delayedMs) return { status: 'delayed', ageMs };
  if (ageMs < thresholds.staleMs) return { status: 'stale', ageMs };
  return { status: 'stale', ageMs };
}
