import { describe, expect, it } from 'vitest';
import { cotColor, cotTooltip, isCotStale, type CotPayload } from '@/lib/cot';

function payload(overrides: Partial<CotPayload> = {}): CotPayload {
  return {
    as_of: '2026-08-11',
    last_export_success: '2026-08-15T06:00:00Z',
    window_weeks: 156,
    min_obs: 52,
    source: 'CFTC legacy futures-only',
    note: '',
    assets: {},
    errors: [],
    ...overrides,
  };
}

describe('isCotStale', () => {
  it('fresh within 12 days of report Tuesday', () => {
    const now = Date.parse('2026-08-18T12:00:00Z');
    expect(isCotStale(payload(), now)).toBe(false);
  });

  it('stale beyond 12 days (missed weekly release)', () => {
    const now = Date.parse('2026-08-25T12:00:00Z');
    expect(isCotStale(payload(), now)).toBe(true);
  });

  it('stale when payload or as_of missing', () => {
    expect(isCotStale(null)).toBe(true);
    expect(isCotStale(payload({ as_of: null }))).toBe(true);
  });
});

describe('cotColor', () => {
  it('caution at extremes, muted inside ±2 (contrarian, never directional)', () => {
    expect(cotColor(2.5)).toBe('var(--caution)');
    expect(cotColor(-2.1)).toBe('var(--caution)');
    expect(cotColor(1.9)).toBe('var(--muted)');
    expect(cotColor(null)).toBe('var(--dim)');
  });
});

describe('cotTooltip', () => {
  it('includes lag disclaimer and UNTESTED status', () => {
    const t = cotTooltip({
      market: 'GOLD - COMMODITY EXCHANGE INC.',
      code: '088691',
      net_pct: 54.44,
      z: 1.18,
      percentile: 91.0,
      n_obs: 156,
      as_of: '2026-08-11',
    });
    expect(t).toContain('lag ~J-7');
    expect(t).toContain('UNTESTED');
    expect(t).toContain('p91');
  });
});
