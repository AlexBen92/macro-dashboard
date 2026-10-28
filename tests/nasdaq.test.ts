import { describe, expect, it } from 'vitest';

import {
  BADGE_UNVALIDATED,
  breakLabel,
  isStale,
  sampleBadge,
} from '@/lib/nasdaq';

describe('nasdaq staleness (loi L10)', () => {
  it('status : périmé au-delà de 15 min', () => {
    const now = Date.now();
    expect(isStale(new Date(now - 5 * 60_000).toISOString(), 'status')).toBe(false);
    expect(isStale(new Date(now - 20 * 60_000).toISOString(), 'status')).toBe(true);
  });

  it('context/stats quotidiens : seuil 26 h', () => {
    const now = Date.now();
    expect(isStale(new Date(now - 25 * 3600_000).toISOString(), 'context')).toBe(false);
    expect(isStale(new Date(now - 27 * 3600_000).toISOString(), 'stats')).toBe(true);
  });

  it('absent / invalide = périmé', () => {
    expect(isStale(undefined, 'status')).toBe(true);
    expect(isStale('not-a-date', 'status')).toBe(true);
  });

  it('as_of sans suffixe Z interprété UTC', () => {
    const iso = new Date(Date.now() - 60_000).toISOString();
    expect(isStale(iso.replace('Z', ''), 'status')).toBe(false);
  });
});

describe('nasdaq labels + badges honnêteté', () => {
  it('breakLabel', () => {
    expect(breakLabel(null)).toBe('—');
    expect(breakLabel({ state: 'aucune', time_et: null, px: null })).toBe('Aucune');
    expect(breakLabel({ state: 'haute', time_et: '10:05', px: 29688 })).toBe(
      'Cassure haute · 10:05 ET'
    );
  });

  it('badge permanent = hypothèse ORB rejetée (NO-GO)', () => {
    expect(BADGE_UNVALIDATED).toContain('rejetée');
    expect(BADGE_UNVALIDATED).toContain('NO-GO');
  });

  it('badge échantillon faible < 30 j', () => {
    expect(sampleBadge(28)).toContain('échantillon faible');
    expect(sampleBadge(undefined)).toContain('échantillon faible');
    expect(sampleBadge(45)).toBeNull();
  });
});
