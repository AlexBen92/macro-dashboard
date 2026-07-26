import { describe, it, expect } from 'vitest';
import {
  aggregateExposure,
  inBucket,
  parseInstrumentName,
  type DeribitBookRow,
} from '../../src/lib/options/deribit';

const NOW = Date.UTC(2026, 6, 26, 12, 0, 0);
const asOf = new Date(NOW).toISOString();

describe('parseInstrumentName', () => {
  it('parses BTC put', () => {
    const r = parseInstrumentName('BTC-28AUG26-59000-P');
    expect(r).not.toBeNull();
    expect(r!.ccy).toBe('BTC');
    expect(r!.strike).toBe(59000);
    expect(r!.isCall).toBe(false);
    expect(r!.expiryISO).toBe('2026-08-28');
  });
  it('parses ETH call', () => {
    const r = parseInstrumentName('ETH-26DEC26-4000-C');
    expect(r).not.toBeNull();
    expect(r!.ccy).toBe('ETH');
    expect(r!.strike).toBe(4000);
    expect(r!.isCall).toBe(true);
    expect(r!.expiryISO).toBe('2026-12-26');
  });
  it('rejects malformed', () => {
    expect(parseInstrumentName('garbage')).toBeNull();
    expect(parseInstrumentName('BTC-XX-XXX-XXX-C')).toBeNull();
    expect(parseInstrumentName('BTC-28AUG26-59000-X')).toBeNull();
    expect(parseInstrumentName('BTC-28XXX26-59000-P')).toBeNull();
    expect(parseInstrumentName('')).toBeNull();
  });
});

describe('inBucket', () => {
  it('all always true', () => {
    expect(inBucket(0, 'all')).toBe(true);
    expect(inBucket(1000, 'all')).toBe(true);
  });
  it('0-7d inclusive', () => {
    expect(inBucket(0, '0-7d')).toBe(true);
    expect(inBucket(7, '0-7d')).toBe(true);
    expect(inBucket(8, '0-7d')).toBe(false);
  });
  it('8-30d', () => {
    expect(inBucket(8, '8-30d')).toBe(true);
    expect(inBucket(30, '8-30d')).toBe(true);
    expect(inBucket(31, '8-30d')).toBe(false);
  });
  it('31-90d', () => {
    expect(inBucket(31, '31-90d')).toBe(true);
    expect(inBucket(90, '31-90d')).toBe(true);
    expect(inBucket(91, '31-90d')).toBe(false);
  });
});

describe('aggregateExposure', () => {
  function row(
    name: string,
    iv: number | null,
    oi: number | null,
    base: string,
  ): DeribitBookRow {
    return {
      instrument_name: name,
      mark_iv: iv,
      open_interest: oi,
      bid_price: 0.001,
      ask_price: 0.002,
      mark_price: 0.0015,
      underlying_price: 100,
      volume_usd: 1000,
      base_currency: base,
    };
  }

  it('returns empty snapshot when rows empty', () => {
    const s = aggregateExposure([], null, { asOf, expiryBucket: 'all', now: NOW });
    expect(s.strikes.length).toBe(0);
    expect(s.levels.callWall).toBeNull();
    expect(s.aggregate.totalOi).toBe(0);
    expect(s.warnings).toContain('no parseable strikes in selected bucket');
    expect(s.warnings).toContain('spot unavailable — greeks computation skipped');
    expect(s.regime.gamma).toBe('unknown');
  });

  it('aggregates calls and puts at same strike', () => {
    const rows = [
      row('BTC-26SEP26-100-C', 50, 10, 'BTC'),
      row('BTC-26SEP26-100-P', 50, 20, 'BTC'),
    ];
    const s = aggregateExposure(rows, 100, { asOf, expiryBucket: 'all', now: NOW });
    expect(s.strikes.length).toBe(1);
    const k = s.strikes[0];
    expect(k.callOi).toBe(10);
    expect(k.putOi).toBe(20);
    expect(k.callGex).toBeGreaterThan(0);
    expect(k.putGex).toBeLessThan(0);
    expect(k.expiries).toContain('2026-09-26');
  });

  it('filters out rows with iv<=0 or oi<=0', () => {
    const rows = [
      row('BTC-26SEP26-100-C', 0, 10, 'BTC'),
      row('BTC-26SEP26-110-C', 50, 0, 'BTC'),
      row('BTC-26SEP26-120-C', 50, 5, 'BTC'),
    ];
    const s = aggregateExposure(rows, 100, { asOf, expiryBucket: 'all', now: NOW });
    expect(s.strikes.length).toBe(1);
    expect(s.strikes[0].strike).toBe(120);
  });

  it('expiry bucket filters out far expiries', () => {
    const rows = [
      row('BTC-26SEP26-100-C', 50, 10, 'BTC'),
      row('BTC-26DEC26-100-C', 50, 10, 'BTC'),
    ];
    const s = aggregateExposure(rows, 100, {
      asOf,
      expiryBucket: '31-90d',
      now: NOW,
    });
    expect(s.strikes.length).toBe(1);
  });

  it('snapshot source/flags set', () => {
    const rows = [row('BTC-26SEP26-100-C', 50, 10, 'BTC')];
    const s = aggregateExposure(rows, 100, { asOf, expiryBucket: 'all', now: NOW });
    expect(s.source).toBe('deribit_public');
    expect(s.spot).toBe(100);
    expect(s.freshness.status).toBe('live');
    expect(s.regime.ruleVersion).toBe('v1');
    expect(s.includedExpiries).toContain('2026-09-26');
  });

  it('handles ETH currency', () => {
    const rows = [row('ETH-26SEP26-3000-C', 60, 20, 'ETH')];
    const s = aggregateExposure(rows, 3000, { asOf, expiryBucket: 'all', now: NOW });
    expect(s.currency).toBe('ETH');
    expect(s.strikes[0].strike).toBe(3000);
  });
});
