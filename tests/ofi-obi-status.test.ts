import { describe, expect, it } from 'vitest';

import type { OfiObiStatusPayload } from '@/hooks/api/useOfiObiStatus';
import {
  formatBps,
  formatIc,
  isPayloadStale,
  statusStyleFor,
} from '@/lib/ofiobi/status';

export function fixturePayload(overrides: Partial<OfiObiStatusPayload> = {}): OfiObiStatusPayload {
  return {
    as_of: '2026-09-21T12:00:00+00:00',
    last_export_success: '2026-09-21T12:00:00+00:00',
    stale_threshold_min: 1500,
    data_window_days: 30,
    symbols: ['BTC', 'ETH'],
    verdict: { usage_a: 'NULL', usage_b: '108/108 NULL net coûts' },
    usage_a: { n_entries: 12, verdicts: { NULL: 6 }, gain_bps_abs_range: [0.077, 0.158], taker_cost_bps: 4.5 },
    usage_b: {
      n_cells: 108,
      status_counts: { NULL: 108 },
      ic_abs_range: [0.018, 0.145],
      perm_p_max: 0.001,
    },
    best_by_signal: [
      {
        coin: 'BTC',
        signal: 'obi_10',
        n: 50,
        h: 5,
        ic_cal: 0.1436,
        ic_perm_p: 0.001,
        val_bps_day: -1566.5,
        holdout_bps_day: -999.2,
        status: 'NULL',
      },
    ],
    incremental_ic: {},
    pbo_lot: { BTC: { PBO: 0.2 }, ETH: { PBO: 0.514 } },
    protocol: ['sign-mirror', 'WF 3-blocs'],
    costs: '10 bps RT',
    config_hash: 'abc123',
    ...overrides,
  };
}

describe('ofi_obi status helpers', () => {
  it('styles every registry status + fallback', () => {
    expect(statusStyleFor('NULL').label).toBe('NULL');
    expect(statusStyleFor('IN_VALIDATION').label).toBe('IN VAL');
    expect(statusStyleFor('CONFIRMED').text).toBe('var(--bull)');
    expect(statusStyleFor(null).label).toBe('NULL');
  });

  it('formats IC and bps with em-dash fallback', () => {
    expect(formatIc(0.14359)).toBe('0.1436');
    expect(formatIc(null)).toBe('—');
    expect(formatBps(-1566.52)).toBe('-1566.5');
    expect(formatBps(undefined)).toBe('—');
  });

  it('stale boundary: fresh under 25h, stale past 25h, never without ts', () => {
    const now = Date.parse('2026-09-22T12:00:00Z');
    const threshold = 25 * 60 * 60 * 1000;
    expect(isPayloadStale('2026-09-21T12:01:00Z', now, threshold)).toBe(false);
    expect(isPayloadStale('2026-09-21T10:00:00Z', now, threshold)).toBe(true);
    expect(isPayloadStale(null, now, threshold)).toBe(false);
    expect(isPayloadStale('not-a-date', now, threshold)).toBe(false);
  });

  it('fixture payload is internally consistent (NULL verdict matches counts)', () => {
    const p = fixturePayload();
    expect(p.verdict.usage_b).toBe('108/108 NULL net coûts');
    expect(p.usage_b.status_counts?.NULL).toBe(108);
    expect(p.best_by_signal[0].status).toBe('NULL');
  });
});
