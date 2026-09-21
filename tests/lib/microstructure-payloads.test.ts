import { describe, expect, it } from 'vitest';

import {
  clampDisplayScore,
  displayState,
  isPayloadStale,
  payloadAgeMs,
  regimeColor,
  type MicrostructurePayload,
} from '@/lib/microstructure/payloads';

const NOW = Date.now();

function makePayload(overrides: Partial<MicrostructurePayload> = {}): MicrostructurePayload {
  return {
    generated_at: new Date(NOW - 1000).toISOString(),
    status: 'CONNECTED',
    threshold: 1.5,
    threshold_note: 'Seuil configuré — non universel',
    config: {
      short_window_s: 30,
      long_window_s: 300,
      depth_levels: 10,
      impact_horizon_ms: 5000,
      slippage_notional_usd: 50000,
    },
    health: {
      connected: true,
      last_message_at: '2026-09-21T06:59:59Z',
      subscriptions: ['l2Book:BTC', 'trades:BTC'],
      messages_received: { l2: 81, trades: 655, invalid: 0 },
      reconnect_count: 0,
      stale: false,
      error: null,
    },
    symbols: {
      BTC: {
        available: true,
        mid: 81695.5,
        spread_bps: 0.122,
        depth_imbalance: 0.1,
        slippage_bps: 0.5,
        kappa: 1.81,
        epsilon: 1.05,
        toxicity: 1.9,
        display_score: 22.5,
        regime: 'ÉLEVÉ',
        components: {
          trade_imbalance: 0.5,
          intensity_norm: 0.1,
          concentration: 0.3,
          impact_norm: 0.1,
          spread_norm: 0.2,
          slippage_norm: 0.1,
          obi: 0.1,
          depth_stress: 0.0,
        },
        series: [
          [1789970000000, 1.8],
          [1789970005000, 1.9],
        ],
        book_last_update: 1789970005000,
      },
    },
    disclaimer: 'κ × ε est une mesure relative.',
    ...overrides,
  };
}

const FRESH = 5 * 60 * 1000;

describe('payloadAgeMs', () => {
  it('calcule l’âge du dernier export', () => {
    expect(payloadAgeMs(makePayload(), NOW)).toBe(1000);
  });
  it('null si generated_at absent ou invalide', () => {
    expect(payloadAgeMs(null, NOW)).toBeNull();
    expect(payloadAgeMs(makePayload({ generated_at: '' }), NOW)).toBeNull();
    expect(payloadAgeMs(makePayload({ generated_at: 'x' }), NOW)).toBeNull();
  });
});

describe('isPayloadStale', () => {
  it('frais sous le seuil', () => {
    expect(isPayloadStale(makePayload(), FRESH, NOW)).toBe(false);
  });
  it('stale au-delà du seuil', () => {
    const old = makePayload({ generated_at: '2026-09-21T06:50:00Z' });
    expect(isPayloadStale(old, FRESH, NOW)).toBe(true);
  });
  it('stale si timestamp illisible (fail-closed)', () => {
    expect(isPayloadStale(makePayload({ generated_at: '' }), FRESH, NOW)).toBe(true);
  });
});

describe('displayState', () => {
  it('LIVE si connecté + frais + symbole dispo', () => {
    expect(displayState(makePayload(), FRESH, 'BTC')).toBe('LIVE');
  });
  it('UNAVAILABLE si payload null', () => {
    expect(displayState(null, FRESH)).toBe('UNAVAILABLE');
  });
  it('UNAVAILABLE si status DISCONNECTED', () => {
    const p = makePayload({
      status: 'DISCONNECTED',
      health: {
        connected: false,
        last_message_at: null,
        subscriptions: [],
        messages_received: { l2: 0, trades: 0, invalid: 0 },
        reconnect_count: 3,
        stale: true,
        error: 'boom',
      },
    });
    expect(displayState(p, FRESH, 'BTC')).toBe('UNAVAILABLE');
  });
  it('UNAVAILABLE si payload stale — exporteur mort', () => {
    const p = makePayload({ generated_at: '2026-09-21T06:00:00Z' });
    expect(displayState(p, FRESH, 'BTC')).toBe('UNAVAILABLE');
  });
  it('UNAVAILABLE si symbole en warmup (available=false)', () => {
    const p = makePayload();
    p.symbols.BTC.available = false;
    p.symbols.BTC.regime = 'INSUFFISANT';
    expect(displayState(p, FRESH, 'BTC')).toBe('UNAVAILABLE');
  });
  it('UNAVAILABLE si symbole absent', () => {
    expect(displayState(makePayload(), FRESH, 'DOGE')).toBe('UNAVAILABLE');
  });
  it('UNAVAILABLE si status STALE', () => {
    expect(displayState(makePayload({ status: 'STALE' }), FRESH, 'BTC')).toBe('UNAVAILABLE');
  });
});

describe('clampDisplayScore', () => {
  it('borne 0–100', () => {
    expect(clampDisplayScore(-5)).toBe(0);
    expect(clampDisplayScore(150)).toBe(100);
    expect(clampDisplayScore(42.5)).toBe(42.5);
  });
  it('défensif sur non-numérique', () => {
    expect(clampDisplayScore(null)).toBe(0);
    expect(clampDisplayScore(NaN)).toBe(0);
    expect(clampDisplayScore(undefined)).toBe(0);
  });
});

describe('regimeColor', () => {
  it('couleur par régime, muted par défaut', () => {
    expect(regimeColor('FAIBLE')).toBe('var(--bull)');
    expect(regimeColor('EXTRÊME')).toBe('var(--bear)');
    expect(regimeColor('INSUFFISANT')).toBe('var(--muted)');
  });
});
