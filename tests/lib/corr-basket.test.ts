import { describe, expect, it } from 'vitest';
import { isCorrBasketStale, type CorrBasketPayload } from '@/hooks/api/useCorrBasket';
import { flatClusters } from '@/lib/engines/clustering';
import type { CorrCell } from '@/lib/engines/correlation';

function payload(overrides: Partial<CorrBasketPayload> = {}): CorrBasketPayload {
  return {
    as_of: '2026-08-17',
    last_export_success: '2026-08-18T05:57:00Z',
    windows: ['60d', '120d', '252d'],
    universe: ['ES=F', 'ZN=F'],
    cells: [],
    note: '',
    errors: [],
    ...overrides,
  };
}

describe('isCorrBasketStale', () => {
  it('fresh within 26h of export, stale beyond (as_of = date du dernier bar, J-1)', () => {
    const now = Date.parse('2026-08-18T12:00:00Z');
    expect(isCorrBasketStale(payload(), now)).toBe(false);
    expect(
      isCorrBasketStale(
        payload({ as_of: '2026-08-16', last_export_success: '2026-08-16T05:57:00Z' }),
        now,
      ),
    ).toBe(true);
    // as_of J-1 mais export récent → frais (données daily, pas pipeline hs)
    expect(
      isCorrBasketStale(payload({ as_of: '2026-08-16', last_export_success: '2026-08-18T05:57:00Z' }), now),
      ).toBe(false);
  });

  it('stale when payload missing', () => {
    expect(isCorrBasketStale(null)).toBe(true);
  });
});

describe('backend corr cells feed clustering', () => {
  it('cells filtered by window drive flatClusters as before', () => {
    const cells: CorrCell[] = [
      { a: 'ES=F', b: 'ZN=F', r: 0.9, window: '252d', n: 252 },
      { a: 'ES=F', b: 'GC=F', r: -0.1, window: '252d', n: 252 },
      { a: 'ZN=F', b: 'GC=F', r: -0.2, window: '252d', n: 252 },
      { a: 'ES=F', b: 'ZN=F', r: 0.5, window: '60d', n: 60 },
    ];
    const w252 = cells.filter((c) => c.window === '252d');
    expect(w252).toHaveLength(3);
    const clusters = flatClusters(w252, ['ES=F', 'ZN=F', 'GC=F'], 0.4);
    expect(clusters['ES=F']).toBe(clusters['ZN=F']);
    expect(clusters['ES=F']).not.toBe(clusters['GC=F']);
  });
});
