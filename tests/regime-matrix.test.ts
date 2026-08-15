import { describe, expect, it } from 'vitest';
import {
  assetsBySource,
  isStale,
  stationarityColor,
  trendScoreColor,
  type RegimeMatrixPayload,
} from '@/lib/regimeMatrix';

function payload(overrides: Partial<RegimeMatrixPayload> = {}): RegimeMatrixPayload {
  return {
    as_of: '2026-08-15T05:43:00Z',
    rule_version: 'regime_matrix_v1',
    universe: { macro_n: 0, hl_n: 0, hl_selected_at: null, stable_excluded: [] },
    assets: [],
    errors: [],
    last_export_success: null,
    ...overrides,
  };
}

describe('isStale', () => {
  it('stale when last_export_success missing', () => {
    expect(isStale(payload())).toBe(true);
  });

  it('fresh under 26h', () => {
    const now = Date.parse('2026-08-15T12:00:00Z');
    const p = payload({ last_export_success: '2026-08-15T05:43:00Z' });
    expect(isStale(p, now)).toBe(false);
  });

  it('stale over 26h', () => {
    const now = Date.parse('2026-08-16T12:00:00Z');
    const p = payload({ last_export_success: '2026-08-15T05:43:00Z' });
    expect(isStale(p, now)).toBe(true);
  });

  it('stale on unparseable timestamp', () => {
    const p = payload({ last_export_success: 'garbage' });
    expect(isStale(p)).toBe(true);
  });

  it('stale on null payload', () => {
    expect(isStale(null)).toBe(true);
  });
});

describe('assetsBySource', () => {
  it('filters by source and sorts by trend_score desc, nulls last', () => {
    const p = payload({
      assets: [
        { id: 'A', source: 'yahoo', trend_score: 10 } as never,
        { id: 'B', source: 'hyperliquid', trend_score: 90 } as never,
        { id: 'C', source: 'yahoo', trend_score: 70 } as never,
        { id: 'D', source: 'yahoo', trend_score: null } as never,
      ],
    });
    expect(assetsBySource(p, 'yahoo').map((a) => a.id)).toEqual(['C', 'A', 'D']);
    expect(assetsBySource(p, 'hyperliquid').map((a) => a.id)).toEqual(['B']);
    expect(assetsBySource(null, 'yahoo')).toEqual([]);
  });
});

describe('color mappers null-safe', () => {
  it('returns dim for nulls', () => {
    expect(stationarityColor(null)).toBe('var(--dim)');
    expect(trendScoreColor(null)).toBe('var(--dim)');
  });
});
