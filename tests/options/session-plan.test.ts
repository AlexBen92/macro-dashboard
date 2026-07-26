import { describe, it, expect } from 'vitest';
import { buildSessionPlan } from '../../src/lib/options/session-plan';
import type {
  ContextState,
  OptionsExposureSnapshot,
} from '../../src/lib/options/types';

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

const CTX_MIXED: ContextState = {
  badge: 'mixed',
  ruleVersion: 'v1',
  evidence: [],
};

const CTX_RISK_OFF: ContextState = {
  badge: 'risk-off',
  ruleVersion: 'v1',
  evidence: ['rule fired'],
};

describe('buildSessionPlan', () => {
  it('returns single default item when no rule fires', () => {
    const p = buildSessionPlan(snap({}), CTX_MIXED);
    expect(p.items.length).toBe(1);
    expect(p.items[0].id).toBe('no-rule');
    expect(p.ruleVersion).toBe('v1');
  });

  it('negative gamma fires alert', () => {
    const p = buildSessionPlan(
      snap({
        regime: { gamma: 'negative', dealerDelta: 'flat', ruleVersion: 'v1' },
        aggregate: { netGex: -1_000_000, netDex: 0, totalOi: 0 },
      }),
      CTX_MIXED,
    );
    expect(p.items.find((i) => i.id === 'neg-gamma')?.severity).toBe('alert');
  });

  it('positive gamma fires info', () => {
    const p = buildSessionPlan(
      snap({
        regime: { gamma: 'positive', dealerDelta: 'flat', ruleVersion: 'v1' },
        aggregate: { netGex: 1_000_000, netDex: 0, totalOi: 0 },
      }),
      CTX_MIXED,
    );
    expect(p.items.find((i) => i.id === 'pos-gamma')?.severity).toBe('info');
  });

  it('stale freshness fires alert', () => {
    const p = buildSessionPlan(
      snap({
        freshness: {
          status: 'stale',
          sourceTs: '2026-07-26T10:00:00Z',
          computedTs: '2026-07-26T12:00:00Z',
          ageMs: 7_200_000,
        },
      }),
      CTX_MIXED,
    );
    expect(p.items.find((i) => i.id === 'stale')).toBeTruthy();
  });

  it('near Put Wall fires caution', () => {
    const p = buildSessionPlan(
      snap({
        spot: 100,
        levels: {
          callWall: null,
          putWall: { kind: 'put_wall', strike: 99, distancePct: -1, source: 'computed' },
          zeroGamma: null,
          hvl: null,
        },
      }),
      CTX_MIXED,
    );
    expect(p.items.find((i) => i.id === 'near-putwall')?.severity).toBe('caution');
  });

  it('caps to 5 items', () => {
    const p = buildSessionPlan(
      snap({
        spot: 100,
        regime: { gamma: 'negative', dealerDelta: 'short', ruleVersion: 'v1' },
        aggregate: { netGex: -10_000_000, netDex: -10_000_000, totalOi: 0 },
        levels: {
          callWall: { kind: 'call_wall', strike: 101, distancePct: 1, source: 'computed' },
          putWall: { kind: 'put_wall', strike: 99, distancePct: -1, source: 'computed' },
          zeroGamma: null,
          hvl: null,
        },
        freshness: {
          status: 'stale',
          sourceTs: '2026-07-26T10:00:00Z',
          computedTs: '2026-07-26T12:00:00Z',
          ageMs: 7_200_000,
        },
      }),
      CTX_RISK_OFF,
    );
    expect(p.items.length).toBeLessThanOrEqual(5);
  });

  it('non-imperative wording (no "buy/sell/must")', () => {
    const p = buildSessionPlan(
      snap({
        regime: { gamma: 'negative', dealerDelta: 'short', ruleVersion: 'v1' },
        aggregate: { netGex: -1_000_000, netDex: -1_000_000, totalOi: 0 },
      }),
      CTX_RISK_OFF,
    );
    for (const item of p.items) {
      expect(item.text.toLowerCase()).not.toMatch(/\b(buy|sell|must|always|never)\b/);
    }
  });
});
