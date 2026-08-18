import { describe, expect, it } from 'vitest';
import { buildAgentState } from '@/lib/agentState';
import { lookupM15Status } from '@/lib/m15SetupStatus';

const NOW = Date.parse('2026-08-17T20:45:00Z');

function freshEdgeM15(overrides: Record<string, unknown> = {}) {
  return {
    as_of: '2026-08-17T20:30:03Z',
    last_export_success: '2026-08-17T20:30:03Z',
    regime: 'CALM',
    edge_global: 'NO_EDGE',
    setups_actifs: [
      {
        strategy: 'S1_V16_thr5',
        regime: 'CALM',
        n_obs: 214,
        mean_bps: 475.4,
        sharpe: 7.14,
        dsr: 1.0,
        tag: 'STRONG',
        validation_status: 'BACKTEST',
      },
    ],
    verdict_btc: { label: 'NO TRADE — ATTENDRE' },
    ...overrides,
  };
}

function freshRegime() {
  return {
    as_of: '2026-08-17T00:00:00Z',
    current_regime: 'CALM',
    days_in_regime: 95,
    regime_distribution: { CALM: 0.5, BUILDING: 0.34, STRESS: 0.11, CRISIS: 0.05 },
  };
}

function freshDecision(overrides: Record<string, unknown> = {}) {
  return {
    as_of: '2026-08-17T20:30:11Z',
    last_export_success: '2026-08-17T20:30:11Z',
    btc: {
      symbol: 'BTC',
      verdict: 'LONG',
      score: 66,
      confidence: 56,
      regime: { label: 'BUILDING' },
      setup: { kind: 'TREND_CONTINUATION' },
    },
    eth: {
      symbol: 'ETH',
      verdict: 'NONE',
      score: 20,
      confidence: 30,
      regime: { label: 'BUILDING' },
      setup: { kind: null },
    },
    ...overrides,
  };
}

const freshOrderflow = { as_of: '2026-08-17T20:30:00Z', ofi_btc_m15: 0.1 };

describe('buildAgentState', () => {
  it('un setup kind NULL du registre est exposé non-tradable avec statut NULL', () => {
    const s = buildAgentState(freshEdgeM15(), freshRegime(), freshDecision(), freshOrderflow, null, undefined, NOW);
    const btc = s.m15.decision.find((d) => d.asset === 'BTC');
    expect(btc?.setup_kind).toBe('TREND_CONTINUATION');
    expect(btc?.status).toBe('NULL');
    expect(btc?.tradable).toBe(false);
  });

  it('seul VALIDATED+tradable du registre serait tradable (NO_TRADE ne l\'est pas)', () => {
    const noTrade = lookupM15Status('NO_TRADE');
    expect(noTrade.status).toBe('VALIDATED');
    expect(noTrade.tradable).toBe(false);
  });

  it('setup kind inconnu → UNTESTED non-tradable', () => {
    expect(lookupM15Status('SOMETHING_NEW').status).toBe('UNTESTED');
    expect(lookupM15Status('SOMETHING_NEW').tradable).toBe(false);
    expect(lookupM15Status(null).status).toBe('UNTESTED');
  });

  it('setups_actifs (M15 strategies) tous non-tradables, statut UNTESTED', () => {
    const s = buildAgentState(freshEdgeM15(), freshRegime(), freshDecision(), freshOrderflow, null, undefined, NOW);
    expect(s.m15.setups).toHaveLength(1);
    expect(s.m15.setups[0].name).toBe('S1_V16_thr5');
    expect(s.m15.setups[0].status).toBe('UNTESTED');
    expect(s.m15.setups[0].tradable).toBe(false);
    expect(s.m15.setups[0].pipeline_status).toBe('BACKTEST');
  });

  it('h4d1: seul funding_carry_d1 tradable', () => {
    const s = buildAgentState(freshEdgeM15(), freshRegime(), freshDecision(), freshOrderflow, null, undefined, NOW);
    const tradables = s.h4d1.filter((e) => e.tradable);
    expect(tradables.map((e) => e.id)).toEqual(['funding_carry_d1']);
    expect(s.h4d1.find((e) => e.id === 'directional_d1_h4')?.status).toBe('NO_EDGE');
  });

  it('funding null et orderflow null → data_complete false, stale reflete sources rapides', () => {
    const s = buildAgentState(freshEdgeM15(), freshRegime(), freshDecision(), null, null, undefined, NOW);
    expect(s.funding).toBeNull();
    expect(s.data_complete).toBe(false);
    expect(s.stale).toBe(false);
    expect(s.sources.orderflow.ok).toBe(false);
    expect(s.sources.orderflow.stale).toBe(true);
    expect(s.sources.funding.stale).toBe(true);
  });

  it('funding HL propagé → sources.funding ok, data_complete true', () => {
    const funding = {
      as_of: '2026-08-17T20:44:00Z',
      source: 'hyperliquid:metaAndAssetCtxs',
      assets: {
        BTC: { funding_hourly: 0.0000115, funding_apr_pct: 10.07, mark_px: 64259 },
        ETH: { funding_hourly: 0.000009, funding_apr_pct: 7.88, mark_px: 1911 },
      },
    };
    const s = buildAgentState(freshEdgeM15(), freshRegime(), freshDecision(), freshOrderflow, funding, undefined, NOW);
    expect(s.funding?.assets.BTC.funding_apr_pct).toBeCloseTo(10.07);
    expect(s.sources.funding.ok).toBe(true);
    expect(s.sources.funding.stale).toBe(false);
    expect(s.data_complete).toBe(true);
  });

  it('regime as_of > 26h → sources.regime stale, data_complete false', () => {
    const oldRegime = { ...freshRegime(), as_of: '2026-08-15T00:00:00Z' };
    const s = buildAgentState(freshEdgeM15(), oldRegime, freshDecision(), freshOrderflow, null, undefined, NOW);
    expect(s.sources.regime.stale).toBe(true);
    expect(s.data_complete).toBe(false);
  });

  it('stale si M15 export > 20 min', () => {
    const old = freshEdgeM15({
      as_of: '2026-08-17T18:00:00Z',
      last_export_success: '2026-08-17T18:00:00Z',
    });
    const s = buildAgentState(old, freshRegime(), freshDecision(), freshOrderflow, null, undefined, NOW);
    expect(s.stale).toBe(true);
  });

  it('source absente → stale true (pas de décision sur données dégradées)', () => {
    const s = buildAgentState(null, freshRegime(), null, freshOrderflow, null, undefined, NOW);
    expect(s.stale).toBe(true);
    expect(s.m15.decision).toEqual([]);
    expect(s.m15.setups).toEqual([]);
  });

  it('regime wf + distribution propagés', () => {
    const s = buildAgentState(freshEdgeM15(), freshRegime(), freshDecision(), freshOrderflow, null, undefined, NOW);
    expect(s.regime.wf_regime).toBe('CALM');
    expect(s.regime.distribution?.CRISIS).toBeCloseTo(0.05);
    expect(s.regime.days_in_regime).toBe(95);
  });
});
