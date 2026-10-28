import { describe, expect, it } from 'vitest';

import {
  BADGE_UNVALIDATED,
  breakLabel,
  feedSlow,
  horloges,
  isStale,
  lookupBucket,
  sampleBadge,
  sessionPhaseLocal,
  similarKeys,
  staleSinceMin,
  strategyTone,
  upcomingEvents,
  vxnTercile,
  weekdayLabel,
  type NasdaqEvent,
  type NasdaqSessionCal,
  type NasdaqStats,
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

describe('session bar V3 (§4)', () => {
  const cal: NasdaqSessionCal = {
    as_of: '2026-10-28T20:30:00',
    note: 'test',
    next_sessions: [
      {
        date: '2026-10-29',
        open_utc: '2026-10-29T13:30:00Z',
        close_utc: '2026-10-29T20:00:00Z',
        half_day: false,
      },
      {
        date: '2026-10-30',
        open_utc: '2026-10-30T13:30:00Z',
        close_utc: '2026-10-30T20:00:00Z',
        half_day: false,
      },
    ],
  };

  it('fermé la nuit → prochaine ouverture', () => {
    const r = sessionPhaseLocal(new Date('2026-10-28T22:00:00Z'), cal);
    expect(r.phase).toBe('closed');
    expect(r.nextOpen).toBe('2026-10-29T13:30:00Z');
  });

  it('phases intraday', () => {
    expect(
      sessionPhaseLocal(new Date('2026-10-29T13:20:00Z'), cal).phase
    ).toBe('pre_open');
    expect(
      sessionPhaseLocal(new Date('2026-10-29T13:27:00Z'), cal).phase
    ).toBe('premarket');
    expect(
      sessionPhaseLocal(new Date('2026-10-29T13:40:00Z'), cal).phase
    ).toBe('range_forming');
    expect(
      sessionPhaseLocal(new Date('2026-10-29T15:00:00Z'), cal).phase
    ).toBe('surveillance');
    expect(
      sessionPhaseLocal(new Date('2026-10-29T19:57:00Z'), cal).phase
    ).toBe('session_end');
  });

  it('horloges : écart 6 h hors décalage', () => {
    const h = horloges(new Date('2026-11-10T15:00:00Z')); // les deux en heure d'hiver
    expect(h.ecartH).toBe(6);
    expect(h.ny).toMatch(/^\d{2}:\d{2}$/);
    expect(h.paris).toMatch(/^\d{2}:\d{2}$/);
  });

  it('feedSlow : >30 s seulement en fenêtre 09:30-10:30 ET', () => {
    expect(feedSlow(60, '09:35')).toBe(true);
    expect(feedSlow(60, '11:00')).toBe(false);
    expect(feedSlow(10, '09:35')).toBe(false);
    expect(feedSlow(null, '09:35')).toBe(false);
  });

  it('staleSinceMin', () => {
    const iso = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(staleSinceMin(iso)).toBeGreaterThanOrEqual(4);
    expect(staleSinceMin(undefined)).toBeNull();
    expect(staleSinceMin('not-a-date')).toBeNull();
  });
});

describe('jours semblables V3 (§9)', () => {
  const ag: NasdaqStats['aggregats'] = {
    n_days: 4106,
    break_pct: 99.7,
    double_break_pct: 40.5,
    par_classe: {},
    semblables: {
      'T2|normal|haussiere|mer': {
        n: 210, n_trades: 96, continuation_pct: 55.4,
        mfe_median_pts: 23, mae_median_pts: 21.5, exp_net_R: -0.12,
      },
    },
    semblables_st: {
      'T2|haussiere|mer': { n: 300, n_trades: 140, continuation_pct: 54, mfe_median_pts: 24, mae_median_pts: 22 },
    },
    vxn_tercile_cuts: { p33: 16.5, p66: 22.1 },
    random_ref_R: -0.150425,
  };

  const keys = similarKeys({
    vxnLevel: 20,
    cuts: { p33: 16.5, p66: 22.1 },
    classe: 'normal',
    trend: 1,
    now: new Date('2026-10-28T14:00:00Z'), // mercredi
  });

  it('tercile + weekday', () => {
    expect(vxnTercile(10, { p33: 16.5, p66: 22.1 })).toBe('T1');
    expect(vxnTercile(20, { p33: 16.5, p66: 22.1 })).toBe('T2');
    expect(vxnTercile(30, { p33: 16.5, p66: 22.1 })).toBe('T3');
    expect(weekdayLabel(new Date('2026-10-28T14:00:00Z'))).toBe('mer');
  });

  it('classe dispo → bucket complet, espérance affichée même négative', () => {
    const r = lookupBucket(ag, keys);
    expect(r?.granularite).toBe('complete');
    expect(r?.bucket.exp_net_R).toBe(-0.12);
  });

  it('bucket complet absent → repli sans classe', () => {
    const r = lookupBucket({ ...ag, semblables: {} }, keys);
    expect(r?.granularite).toBe('sans_classe');
    expect(r?.bucket.n).toBe(300);
  });

  it('données manquantes → null (jamais de bucket improvisé)', () => {
    expect(lookupBucket(undefined, keys)).toBeNull();
    expect(lookupBucket(ag, null)).toBeNull();
    expect(
      similarKeys({ vxnLevel: undefined, cuts: undefined, classe: undefined, trend: undefined, now: new Date() })
    ).toBeNull();
  });
});
