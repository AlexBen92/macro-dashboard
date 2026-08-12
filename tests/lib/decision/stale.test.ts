import { describe, it, expect } from 'vitest';
import type { DecisionStatusPayload } from '@/lib/decision/types';

const STALE_THRESHOLD_MS = 20 * 60 * 1000;

function isStale(payload: Pick<DecisionStatusPayload, 'last_export_success'>): boolean {
  if (!payload.last_export_success) return true;
  const age = Date.now() - Date.parse(payload.last_export_success);
  return age > STALE_THRESHOLD_MS;
}

describe('decision staleness rule', () => {
  it('returns stale when last_export_success is null', () => {
    expect(isStale({ last_export_success: null })).toBe(true);
  });

  it('returns stale when last_export_success older than 20min', () => {
    const old = new Date(Date.now() - 25 * 60 * 1000).toISOString();
    expect(isStale({ last_export_success: old })).toBe(true);
  });

  it('returns fresh when last_export_success within 20min', () => {
    const fresh = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    expect(isStale({ last_export_success: fresh })).toBe(false);
  });
});
