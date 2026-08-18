import { describe, expect, it } from 'vitest';
import {
  dayLabel,
  eventTooltip,
  isEventImpactStale,
  ratioColor,
  type EventImpactPayload,
} from '@/lib/eventImpact';

function payload(overrides: Partial<EventImpactPayload> = {}): EventImpactPayload {
  return {
    as_of: '2026-08-18',
    last_export_success: '2026-08-18T05:53:00Z',
    price_source: 'ES=F daily',
    upcoming_days: 7,
    stats: {},
    upcoming: [],
    sources: {},
    note: '',
    errors: [],
    ...overrides,
  };
}

describe('isEventImpactStale', () => {
  it('fresh same day, stale after 26h', () => {
    const now = Date.parse('2026-08-18T12:00:00Z');
    expect(isEventImpactStale(payload(), now)).toBe(false);
    expect(isEventImpactStale(payload({ as_of: '2026-08-17' }), now)).toBe(true);
  });

  it('stale when payload missing', () => {
    expect(isEventImpactStale(null)).toBe(true);
  });
});

describe('ratioColor', () => {
  it('caution ≥1.3, muted ≥1.1, dim below', () => {
    expect(ratioColor(1.35)).toBe('var(--caution)');
    expect(ratioColor(1.26)).toBe('var(--muted)');
    expect(ratioColor(0.98)).toBe('var(--dim)');
    expect(ratioColor(null)).toBe('var(--dim)');
  });
});

describe('eventTooltip', () => {
  it('includes reaction, ratio and UNTESTED disclaimer', () => {
    const t = eventTooltip({
      date: '2026-09-11',
      type: 'cpi',
      label: 'US CPI',
      ratio_vs_baseline: 1.26,
      hit_rate_vs_median: 52.7,
      mean_abs_move_pct: 0.96,
      n_events: 55,
    });
    expect(t).toContain('±0.96%');
    expect(t).toContain('×1.26');
    expect(t).toContain('55 occurrences');
    expect(t).toContain('UNTESTED');
  });
});

describe('dayLabel', () => {
  it('formats french weekday', () => {
    expect(dayLabel('2026-09-11')).toBe('ven 11/09');
    expect(dayLabel('2026-08-19')).toBe('mer 19/08');
  });
});
