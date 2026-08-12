import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  DecisionStatusPayload,
  Verdict,
  EntryState,
  SetupKind,
} from '@/lib/decision/types';
import {
  VERDICT_VALUES,
  ENTRY_STATE_VALUES,
  SETUP_KIND_VALUES,
} from '@/lib/decision/types';

const FIXTURE = join(
  process.cwd(),
  'public',
  'data',
  '__test__',
  'decision_sample.json',
);

function loadFixture(): DecisionStatusPayload {
  const raw = readFileSync(FIXTURE, 'utf-8');
  return JSON.parse(raw) as DecisionStatusPayload;
}

describe('decision payload contract', () => {
  it('round-trips fixture into DecisionStatusPayload', () => {
    const p = loadFixture();
    expect(p.as_of).toBe('2026-08-12T12:00:00Z');
    expect(p.btc.symbol).toBe('BTC');
    expect(p.eth.symbol).toBe('ETH');
    expect(p.pipeline_version).toMatch(/^0\.1\.0/);
  });

  it('every verdict value is in the closed enum', () => {
    const p = loadFixture();
    for (const a of [p.btc, p.eth]) {
      expect(VERDICT_VALUES).toContain(a.verdict);
    }
  });

  it('every entry state is in the closed enum', () => {
    const p = loadFixture();
    for (const a of [p.btc, p.eth]) {
      expect(ENTRY_STATE_VALUES).toContain(a.entry.state);
    }
  });

  it('every setup kind is in the closed enum', () => {
    const p = loadFixture();
    for (const a of [p.btc, p.eth]) {
      expect(SETUP_KIND_VALUES).toContain(a.setup.kind);
    }
  });

  it('verdict NO_TRADE implies risk.blocked=true and size_mult=0', () => {
    const p = loadFixture();
    for (const a of [p.btc, p.eth]) {
      if (a.verdict === 'NO_TRADE') {
        expect(a.risk.blocked).toBe(true);
        expect(a.risk.size_mult).toBe(0);
        expect(a.risk.notional_usd).toBe(0);
      }
    }
  });

  it('stale CoinGlass propagates to data_quality.stale_sources and risks', () => {
    const p = loadFixture();
    expect(p.btc.data_quality.stale_sources).toContain('coinglass');
    expect(p.btc.data_quality.sources.coinglass.fresh).toBe(false);
    expect(p.btc.risks.some((r) => r.includes('liq-data stale'))).toBe(true);
    expect(p.btc.liquidations.stale).toBe(true);
    expect(p.btc.liquidations.clusters).toEqual([]);
  });

  it('data_quality.score never falls below 0 nor above 100', () => {
    const p = loadFixture();
    for (const a of [p.btc, p.eth]) {
      expect(a.data_quality.score).toBeGreaterThanOrEqual(0);
      expect(a.data_quality.score).toBeLessThanOrEqual(100);
    }
  });

  it('event_risk.in_window=false when minutes_until > 60', () => {
    const p = loadFixture();
    expect(p.event_risk.in_window).toBe(false);
    expect(p.event_risk.minutes_until).toBeGreaterThan(60);
  });

  it('contributions carry a non-empty reason and integer-ish delta', () => {
    const p = loadFixture();
    for (const a of [p.btc, p.eth]) {
      for (const c of a.setup.contributions) {
        expect(typeof c.source).toBe('string');
        expect(c.source.length).toBeGreaterThan(0);
        expect(typeof c.delta_pts).toBe('number');
        expect(Number.isFinite(c.delta_pts)).toBe(true);
        expect(c.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it('re-serialises to the same JSON (round-trip)', () => {
    const raw = readFileSync(FIXTURE, 'utf-8');
    const parsed = JSON.parse(raw) as DecisionStatusPayload;
    const back = JSON.stringify(parsed);
    expect(JSON.parse(back)).toEqual(parsed);
  });
});

describe('closed enums are stable', () => {
  it('verdict values cover the 4 expected outcomes', () => {
    expect(VERDICT_VALUES).toEqual(['LONG', 'SHORT', 'WAIT', 'NO_TRADE']);
  });
  it('entry state values cover the 6 FSM states', () => {
    expect(ENTRY_STATE_VALUES).toEqual([
      'WATCH',
      'ARMED',
      'TRIGGERED',
      'ACTIVE',
      'INVALIDATED',
      'EXPIRED',
    ]);
  });
  it('setup kind values cover the 7 setups', () => {
    expect(SETUP_KIND_VALUES).toEqual([
      'TREND_CONTINUATION',
      'LIQUIDITY_SWEEP_REVERSAL',
      'BREAKOUT',
      'SHORT_SQUEEZE',
      'LONG_SQUEEZE',
      'MEAN_REVERSION',
      'NO_TRADE',
    ]);
  });
});

describe('type narrowing sanity', () => {
  it('Verdict union rejects unknown strings at compile time', () => {
    const v: Verdict = 'LONG';
    expect(v).toBe('LONG');
  });
  it('EntryState union compiles', () => {
    const s: EntryState = 'ARMED';
    expect(s).toBe('ARMED');
  });
  it('SetupKind union compiles', () => {
    const k: SetupKind = 'BREAKOUT';
    expect(k).toBe('BREAKOUT');
  });
});
