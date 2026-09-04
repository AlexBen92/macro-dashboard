import { describe, expect, it } from 'vitest';
import {
  buildPaperDsrView,
  computePaperDsrAgeMs,
  dsrTone,
  type PaperDsrPayload,
} from '@/lib/paper-dsr';

const NOW = Date.parse('2026-09-04T08:00:00Z');

function payload(overrides: Partial<PaperDsrPayload> = {}): PaperDsrPayload {
  return {
    generated_utc: '2026-09-04T06:37:00Z',
    sr_star_lot39_daily: 0.085,
    window_days: 60,
    strats: {
      ICHI_COMBO: {
        strategy: 'ICHI_COMBO',
        open_trades: 0,
        total_trades: 0,
        closed_trades: 0,
        status: 'INSUFFICIENT',
        reason: 'no closed trades yet',
      },
      SRSI_COMBO: {
        strategy: 'SRSI_COMBO',
        open_trades: 3,
        total_trades: 12,
        closed_trades: 9,
        status: 'OK',
        sr_daily_all: 0.06,
        sr_ann_all: 1.147,
        psr_vs0: 0.995,
        psr_vs_lot: 0.42,
        days: 80,
        window: 60,
        rolling_sr_daily: 0.05,
        dsr_vs_lot: 0.72,
        pnl_abs: 18.4,
        win_pct: 40.0,
        first_close: '2026-09-09',
        last_close: '2026-11-05',
      },
    },
    ...overrides,
  };
}

describe('paper-dsr', () => {
  it('calcule l\'âge depuis generated_utc', () => {
    const p = payload();
    expect(computePaperDsrAgeMs(p, NOW)).toBe(NOW - Date.parse(p.generated_utc));
  });

  it('âge infini si generated_utc absent/invalide', () => {
    expect(computePaperDsrAgeMs(payload({ generated_utc: '' }), NOW)).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it('stale au-delà de 26h', () => {
    const fresh = buildPaperDsrView(payload(), NOW);
    expect(fresh.isStale).toBe(false);
    const old = payload({ generated_utc: '2026-09-02T06:00:00Z' });
    expect(buildPaperDsrView(old, NOW).isStale).toBe(true);
  });

  it('annualise SR roulant via sqrt(365) et propage sr_star', () => {
    const v = buildPaperDsrView(payload(), NOW);
    expect(v.srStar).toBeCloseTo(0.085);
    expect(v.srStarAnn).toBeCloseTo(0.085 * Math.sqrt(365));
    const srsi = v.rows.find((r) => r.name === 'SRSI_COMBO');
    expect(srsi?.rollingSrAnn).toBeCloseTo(0.05 * Math.sqrt(365));
  });

  it('tone DSR: ok ≥0.7, warn ≥0.5, bad <0.5, muted si null/INSUFFICIENT', () => {
    expect(dsrTone(0.85)).toBe('ok');
    expect(dsrTone(0.6)).toBe('warn');
    expect(dsrTone(0.2)).toBe('bad');
    expect(dsrTone(null)).toBe('muted');
    const v = buildPaperDsrView(payload(), NOW);
    expect(v.rows.find((r) => r.name === 'ICHI_COMBO')?.dsrTone).toBe('muted');
    expect(v.rows.find((r) => r.name === 'SRSI_COMBO')?.dsrTone).toBe('ok');
  });

  it('strat INSUFFICIENT garde trades/pnl et tone muted', () => {
    const v = buildPaperDsrView(payload(), NOW);
    const ichi = v.rows.find((r) => r.name === 'ICHI_COMBO');
    expect(ichi?.status).toBe('INSUFFICIENT');
    expect(ichi?.closedTrades).toBe(0);
    expect(ichi?.dsr).toBeNull();
  });

  it('résiste aux strats manquantes', () => {
    const v = buildPaperDsrView(payload({ strats: {} }), NOW);
    expect(v.rows).toHaveLength(0);
  });
});
