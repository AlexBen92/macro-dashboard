import { describe, expect, it } from 'vitest';

import {
  attributionBars,
  complianceColor,
  filterJournal,
  formatBps,
  gateStateBadge,
  isDeltaDominated,
  journalKindColor,
  journalKindLabel,
  lightColor,
  lightLabel,
  worstLight,
} from '@/lib/cockpit/display';
import type {
  AttributionBreakdown,
  CockpitState,
  CarryHealthState,
  JournalEvent,
  VolSurfaceState,
} from '@/lib/cockpit/payloads';

function freshGate(): CockpitState['gate'] {
  return {
    as_of: new Date().toISOString(),
    light: 'GREEN',
    reasons_red: [],
    reasons_orange: [],
    m15_permission: 'ALLOWED',
    agent_status: { hl_agent: 'SHADOW', hl_mode: 'shadow', m15_agent: 'RUNNING_PAPER' },
    regime: { current: 'CALM', days_in_regime: 123 },
    vol_regime: { label: 'MIXED', H_btc: 0.2, rough_extreme: false, stale: false },
    carry_universe: { BTC: 'ACTIF', ETH: 'ACTIF', SOL: 'ACTIF' },
    counters: {
      trades_today: 1,
      max_trades: 5,
      daily_pnl_pct: 0,
      daily_stop_pct: 0.005,
      stop_hit: false,
      trades_remaining: 4,
    },
    m15_gating: {
      Carry_D1: { state: 'ALLOWED', reasons: [] },
      M15_MeanReversion: { state: 'ALLOWED', reasons: [] },
      M15_Breakout: { state: 'SHADOW_ONLY', reasons: ['STRESS'] },
      MicroMM_Stoikov: { state: 'EN_TEST', reasons: ['gates zero-fee'] },
    },
  };
}

describe('cockpit gate display', () => {
  it('worst light gagne', () => {
    expect(worstLight('GREEN', 'ORANGE')).toBe('ORANGE');
    expect(worstLight('RED', 'ORANGE')).toBe('RED');
    expect(worstLight('GREEN', 'GREEN')).toBe('GREEN');
  });

  it('couleurs feux', () => {
    expect(lightColor('GREEN')).toBe('var(--bull)');
    expect(lightColor('ORANGE')).toBe('var(--caution)');
    expect(lightColor('RED')).toBe('var(--bear)');
    expect(lightColor(null)).toBe('var(--dim)');
  });

  it('libellés permission', () => {
    expect(lightLabel('RED')).toBe('BLOCAGE TOTAL');
    expect(lightLabel('ORANGE')).toBe('SHADOW SEULEMENT');
    expect(lightLabel('GREEN')).toBe('M15 AUTORISÉ');
  });

  it('badges gate state', () => {
    expect(gateStateBadge('ALLOWED').text).toBe('OK');
    expect(gateStateBadge('BLOCKED').text).toBe('REJETÉ');
    expect(gateStateBadge('EN_TEST').text).toBe('EN_TEST');
    expect(complianceColor('REJETÉ')).toBe('var(--bear)');
  });
});

describe('attribution display', () => {
  const attr: AttributionBreakdown = {
    total_pct: 0.049,
    delta_pct: 0.05,
    funding_pct: 0.0001,
    basis_pct: 0.0,
    fees_pct: 0.001,
  };

  it('barres normalisées à ~100%', () => {
    const bars = attributionBars(attr);
    const sum = bars.reduce((s, b) => s + b.widthPct, 0);
    expect(sum).toBeCloseTo(100, 0);
    expect(bars.map((b) => b.label)).toEqual(['delta', 'funding', 'basis', 'fees']);
  });

  it('delta dominant détecté', () => {
    expect(isDeltaDominated(attr)).toBe(true);
    const balanced: AttributionBreakdown = {
      total_pct: 0.02, delta_pct: 0.005, funding_pct: 0.01,
      basis_pct: 0.006, fees_pct: 0.001,
    };
    expect(isDeltaDominated(balanced)).toBe(false);
  });

  it('format bps et pct', () => {
    expect(formatBps(3.66)).toBe('+3.7bps');
    expect(formatBps(null)).toBe('—');
    expect(formatBps(-2.5)).toBe('-2.5bps');
  });
});

describe('journal display', () => {
  const events: JournalEvent[] = [
    { ts: '2026-08-25T10:00:00Z', kind: 'CONTRACT_REJECT', source: 'hl-agent', context: null },
    { ts: '2026-08-25T11:00:00Z', kind: 'M15_SIGNAL', source: 'm15-agent', context: null },
    { ts: '2026-08-25T12:00:00Z', kind: 'CARRY_ENTER', source: 'carry-d1', context: null },
    { ts: '2026-08-25T13:00:00Z', kind: 'ALERT_BASIS_DRIFT', source: 'cockpit', context: null },
  ];

  it('filtres par source', () => {
    expect(filterJournal(events, 'all')).toHaveLength(4);
    expect(filterJournal(events, 'm15-agent')).toHaveLength(1);
    expect(filterJournal(events, 'alerts')).toHaveLength(2);
  });

  it('couleurs et libellés kinds', () => {
    expect(journalKindColor('CONTRACT_REJECT')).toBe('var(--bear)');
    expect(journalKindColor('CARRY_ENTER')).toBe('var(--bull)');
    expect(journalKindLabel('M15_TRADE_CLOSE')).toBe('Trade M15 fermé');
    expect(journalKindLabel('UNKNOWN_KIND')).toBe('UNKNOWN_KIND');
  });
});

describe('payload shapes (contract exporteur VPS)', () => {
  it('gate shape complet', () => {
    const gate = freshGate();
    expect(Object.keys(gate.m15_gating)).toEqual(
      expect.arrayContaining(['Carry_D1', 'M15_MeanReversion', 'M15_Breakout', 'MicroMM_Stoikov']),
    );
    expect(gate.counters.trades_remaining).toBe(4);
    expect(gate.vol_regime.rough_extreme).toBe(false);
  });

  it('vol surface shape minimal', () => {
    const vol: VolSurfaceState = {
      as_of: new Date().toISOString(),
      method: 'skew_scaling_H',
      basis_path_btc: [1.0, 1.5],
      assets: [
        {
          asset: 'BTC',
          iv: { atm_short: 49, atm_mid: 42, atm_long: 41, skew_1d: 9.9, skew_7d: null, n_expiries: 10 },
          hurst: {
            H_iv_skew_scaling: { H: 0.02, r2: 0.93, n_pts: 10 },
            H_realized_vol: 0.212,
          },
          fits: {
            markov_1f: { rmse_var: 0.011, kappa: 181 },
            rough_powerlaw: { rmse_var: 0.019, p: 0.074 },
          },
          regime_label: 'MIXED',
          realized: { H: 0.212, vol_of_vol: 0.72, rho_proxy: -0.04, rv_pct_m15: 0.31 },
          iv_source: 'deribit_public',
          as_of: new Date().toISOString(),
        },
      ],
      path_features: [
        {
          asset: 'BTC',
          signature: { x_sum: -0.006, y_sum: -1.39, xx: 0.0007, xy: 0.011, yy: 5.67, trend: -0.75, xy_sign: 0.18, n_bars: 87 },
          realized_vol_pct_bar: 0.31,
          jumps_4sigma: 1,
          chaos_score: 0.42,
          rv_ratio_24h: 1.01,
          path_label: 'NEUTRAL',
          description: 'Chemin sans signature marquée',
        },
      ],
    };
    expect(vol.assets[0].hurst.H_iv_skew_scaling?.H).toBeLessThan(0.5);
    expect(vol.path_features[0].chaos_score).toBeGreaterThanOrEqual(0);
    expect(vol.path_features[0].chaos_score).toBeLessThanOrEqual(1);
  });

  it('carry health shape', () => {
    const carry: CarryHealthState = {
      as_of: new Date().toISOString(),
      strategy: 'Funding_Carry_Systematic_D1',
      universe_status: { BTC: 'ACTIF', ETH: 'ACTIF', SOL: 'ACTIF' },
      rows: [
        {
          asset: 'SOL',
          basis_bps: 10.09,
          funding_rate_hourly: 1.2e-5,
          funding_sign: 1,
          carry_position: 'ACTIF',
          accrued_funding_bps: 12.3,
          divergence_zscore: -0.54,
          basis_drift_bps: 11.33,
          contract: { status: 'DELTA_NEUTRE_OK', reason: 'ok', legs_expected: ['perp short', 'spot long'] },
          drift_alert: true,
        },
      ],
      health: 'DEGRADED',
      alerts: [],
    };
    expect(carry.rows[0].drift_alert).toBe(true);
    expect(Math.abs(carry.rows[0].basis_drift_bps!)).toBeGreaterThan(3);
    expect(carry.health).toBe('DEGRADED');
  });
});
