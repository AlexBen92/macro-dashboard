import { describe, expect, it } from 'vitest';

import {
  BADGE_UNVALIDATED,
  aggBars,
  breakLabel,
  breakMarker,
  chartLevels,
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
  vwapSeries,
  etShiftSec,
  weekdayLabel,
  type NasdaqBars,
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

describe('graphique V3 (§5)', () => {
  // M1 synthétique : 5 barres, 10:00-10:04 UTC ≈ 06:00 ET (EDT)
  const ts0 = Math.floor(Date.parse('2026-07-15T14:00:00Z') / 1000);
  const barsData: NasdaqBars = {
    as_of: '2026-07-15T14:05:00',
    bars: {
      today_ts: [ts0, ts0 + 60, ts0 + 120, ts0 + 180, ts0 + 240],
      today_o: [100, 101, 102, 103, 104],
      today_h: [101, 102, 103, 104, 105],
      today_l: [99, 100, 101, 102, 103],
      today_c: [100.5, 101.5, 102.5, 103.5, 104.5],
      today_v: [10, 10, 10, 10, 10],
      prev_ts: [ts0 - 86400, ts0 - 86400 + 60],
      prev_o: [90, 91],
      prev_h: [91, 92],
      prev_l: [89, 90],
      prev_c: [90.5, 91.5],
      prev_v: [1, 1],
    },
    today_vwap: [100.2, 100.9, 101.9, 102.9, 103.9],
    prev_day: { date: '2026-07-14', h: 92, l: 89, c: 91.5 },
    premarket: { h: 99.5, l: 98.5, n_bars: 330 },
  };

  it('aggBars M5 : 5 M1 → 1 bougie OHLC agrégée', () => {
    const m5 = aggBars(barsData, 'M5', 'today');
    expect(m5).toHaveLength(1);
    expect(m5[0]).toMatchObject({ open: 100, high: 105, low: 99, close: 104.5 });
    const m15 = aggBars(barsData, 'M15', 'today');
    expect(m15).toHaveLength(1);
    expect(aggBars(barsData, 'M1', 'today')).toHaveLength(5);
    expect(aggBars(barsData, 'M5', 'prev')).toHaveLength(1);
    expect(aggBars(undefined, 'M5', 'today')).toEqual([]);
  });

  it('vwapSeries alignée M1', () => {
    const v = vwapSeries(barsData);
    expect(v).toHaveLength(5);
    expect(v[0].value).toBe(100.2);
  });

  it('chartLevels : EM ±0,5/±1, range, veille, pré-marché, theo', () => {
    const status = {
      as_of: '', as_of_et: '', phase: '', badge: '', edge_valide: false,
      range: { hi: 110, lo: 105, mid: 107.5, pts: 5, classe: 'normal', pct_em: 0.3 },
      break: null, theo: { dir: 'haute', entry: 110.5, stop: 106, pnl_pts: 1, pnl_R: 0.2, mfe_pts: 2, mae_pts: 1, regle_stop: '' },
      em_pts: 10, vxn: null,
    } as never;
    const levels = chartLevels({ bars: barsData, status, emPts: 10 });
    const titles = levels.map((l) => l.title);
    // open today = 100 → EM ±5 et ±10
    expect(titles).toEqual(expect.arrayContaining(['EM +0.5', 'EM −1', 'Open', 'Range H', 'Range L', 'Mid', 'Clôture V', 'H V', 'B V', 'PM H', 'PM B', 'Entrée haute', 'Stop']));
    const em05 = levels.find((l) => l.title === 'EM +0.5');
    expect(em05?.price).toBe(105);
    expect(levels.find((l) => l.title === 'Stop')?.price).toBe(106);
  });

  it('breakMarker : flèche à l\'heure ET de la cassure, null si aucune', () => {
    const up = breakMarker({ state: 'haute', time_et: '09:52', px: 111 }, '2026-07-15');
    expect(up?.shape).toBe('arrowUp');
    expect(up?.position).toBe('belowBar');
    expect(breakMarker({ state: 'aucune', time_et: null, px: null }, '2026-07-15')).toBeNull();
    expect(breakMarker(null, '2026-07-15')).toBeNull();
  });

  it('etShiftSec : epoch 14:45Z affiché 10:45 en été comme en hiver (EDT puis EST)', () => {
    const jul = etShiftSec(Math.floor(Date.parse('2026-07-15T14:45:00Z') / 1000));
    expect(new Date(jul * 1000).toISOString().slice(11, 16)).toBe('10:45'); // EDT = UTC-4
    const dec = etShiftSec(Math.floor(Date.parse('2026-12-15T14:45:00Z') / 1000));
    expect(new Date(dec * 1000).toISOString().slice(11, 16)).toBe('09:45'); // EST = UTC-5
  });
});
