import { describe, it, expect } from 'vitest';
import { computeFreshness, DEFAULT_THRESHOLDS } from '../../src/lib/options/freshness';

const NOW = Date.UTC(2026, 6, 26, 12, 0, 0);
const iso = (offsetMs: number) => new Date(NOW - offsetMs).toISOString();

describe('computeFreshness', () => {
  it('null sourceTs → unavailable', () => {
    expect(computeFreshness(null, NOW).status).toBe('unavailable');
  });
  it('invalid date → unavailable', () => {
    expect(computeFreshness('not-a-date', NOW).status).toBe('unavailable');
  });
  it('14s old → live', () => {
    expect(computeFreshness(iso(14_000), NOW).status).toBe('live');
  });
  it('15s exactly → delayed (boundary)', () => {
    expect(computeFreshness(iso(DEFAULT_THRESHOLDS.liveMs), NOW).status).toBe('delayed');
  });
  it('59s old → delayed', () => {
    expect(computeFreshness(iso(59_000), NOW).status).toBe('delayed');
  });
  it('60s exactly → stale (boundary)', () => {
    expect(computeFreshness(iso(DEFAULT_THRESHOLDS.delayedMs), NOW).status).toBe('stale');
  });
  it('299s old → stale', () => {
    expect(computeFreshness(iso(299_000), NOW).status).toBe('stale');
  });
  it('301s old → stale', () => {
    expect(computeFreshness(iso(301_000), NOW).status).toBe('stale');
  });
  it('ageMs computed correctly', () => {
    expect(computeFreshness(iso(30_000), NOW).ageMs).toBeCloseTo(30_000, -2);
  });
  it('future sourceTs clamps to 0 age', () => {
    const future = new Date(NOW + 5000).toISOString();
    const r = computeFreshness(future, NOW);
    expect(r.status).toBe('live');
    expect(r.ageMs).toBe(0);
  });
});
