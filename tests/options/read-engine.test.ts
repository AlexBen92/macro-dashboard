import { describe, it, expect } from 'vitest';
import { buildOptionsRead } from '../../src/lib/options/read-engine';
import type { OptionsExposureSnapshot } from '../../src/lib/options/types';

function snap(
  overrides: Partial<OptionsExposureSnapshot>,
): OptionsExposureSnapshot {
  return {
    schemaVersion: 1,
    source: 'deribit_public',
    currency: 'BTC',
    spot: 100,
    asOf: '2026-07-26T12:00:00Z',
    expiryBucket: 'all',
    includedExpiries: ['2026-09-26'],
    strikes: [],
    levels: { callWall: null, putWall: null, zeroGamma: null, hvl: null },
    aggregate: { netGex: 0, netDex: 0, totalOi: 0 },
    regime: { gamma: 'neutral', dealerDelta: 'flat', ruleVersion: 'v1' },
    freshness: {
      status: 'live',
      sourceTs: '2026-07-26T12:00:00Z',
      computedTs: '2026-07-26T12:00:00Z',
      ageMs: 0,
    },
    warnings: [],
    ...overrides,
  };
}

describe('buildOptionsRead', () => {
  it('returns exactly 3 lines', () => {
    const r = buildOptionsRead(snap({}));
    expect(r.lines.length).toBe(3);
    expect(r.ruleVersion).toBe('v1');
  });

  it('line 1 contains regime + net GEX', () => {
    const r = buildOptionsRead(
      snap({
        regime: { gamma: 'positive', dealerDelta: 'long', ruleVersion: 'v1' },
        aggregate: { netGex: 5_000_000, netDex: 0, totalOi: 0 },
      }),
    );
    expect(r.lines[0]).toContain('positive');
    expect(r.lines[0]).toContain('5.00M');
  });

  it('line 2 contains call/put walls with distance', () => {
    const r = buildOptionsRead(
      snap({
        spot: 100,
        levels: {
          callWall: { kind: 'call_wall', strike: 110, distancePct: 10, source: 'computed' },
          putWall: { kind: 'put_wall', strike: 90, distancePct: -10, source: 'computed' },
          zeroGamma: null,
          hvl: null,
        },
      }),
    );
    expect(r.lines[1]).toContain('110');
    expect(r.lines[1]).toContain('10.0%');
    expect(r.lines[1]).toContain('90');
    expect(r.lines[1]).toContain('-10.0%');
  });

  it('n/a when no levels', () => {
    const r = buildOptionsRead(snap({}));
    expect(r.lines[1]).toContain('n/a');
  });

  it('line 3 includes DEX + HVL + OI', () => {
    const r = buildOptionsRead(
      snap({
        levels: {
          callWall: null,
          putWall: null,
          zeroGamma: null,
          hvl: { kind: 'hvl', strike: 100, distancePct: 0, source: 'computed' },
        },
        aggregate: { netGex: 0, netDex: 2_500_000, totalOi: 12_500 },
      }),
    );
    expect(r.lines[2]).toContain('2.50M');
    expect(r.lines[2]).toContain('100');
    expect(r.lines[2]).toContain('12.5K');
  });
});
