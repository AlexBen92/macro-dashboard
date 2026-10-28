import { describe, expect, it } from 'vitest';

import {
  BADGE_UNVALIDATED,
  breakLabel,
  isStale,
  sampleBadge,
  strategyTone,
  upcomingEvents,
  type NasdaqEvent,
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

  it('panneaux quotidiens : seuil 26 h (kind panels)', () => {
    const now = Date.now();
    expect(isStale(new Date(now - 25 * 3600_000).toISOString(), 'panels')).toBe(false);
    expect(isStale(new Date(now - 27 * 3600_000).toISOString(), 'panels')).toBe(true);
  });

  it('upcomingEvents : filtre le passé, trie déjà fait côté export, limite', () => {
    const today = new Date().toISOString().slice(0, 10);
    const past = new Date(Date.now() - 5 * 86400_000).toISOString().slice(0, 10);
    const ev = (date: string, label: string): NasdaqEvent => ({
      date, type: 'opex', label, heure_ny: '16:00', heure_paris: '22:00', source: 'calculé',
    });
    const out = upcomingEvents([ev(past, 'old'), ev(today, 'today'), ev('2099-01-01', 'far')], 1);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('today');
    expect(upcomingEvents(undefined, 8)).toEqual([]);
  });

  it('strategyTone : no-go / non testée / autre', () => {
    expect(strategyTone('NO-GO')).toBe('no-go');
    expect(strategyTone('non testée')).toBe('untested');
    expect(strategyTone('en validation')).toBe('other');
  });
});
