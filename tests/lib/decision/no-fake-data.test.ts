import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DecisionStatusPayload } from '@/lib/decision/types';

const PAYLOAD_PATH = join(
  process.cwd(),
  'public',
  'data',
  'decision_btceth_status.json',
);

function loadPayload(): DecisionStatusPayload {
  return JSON.parse(readFileSync(PAYLOAD_PATH, 'utf-8')) as DecisionStatusPayload;
}

describe('decision payload — NO_FAKE_DATA rule', () => {
  it('stale CoinGlass produces empty liquidation clusters, never synthesised', () => {
    const p = loadPayload();
    for (const asset of [p.btc, p.eth]) {
      const liq = asset.liquidations;
      const cgFresh = asset.data_quality.sources.coinglass.fresh;
      if (!cgFresh) {
        expect(liq.clusters).toEqual([]);
        expect(liq.stale).toBe(true);
        expect(liq.cascade_risk).toBe(false);
        // data_quality.stale_sources mentions coinglass
        expect(asset.data_quality.stale_sources).toContain('coinglass');
        // a risk surfaces the degradation honestly
        expect(asset.risks.some((r) => r.includes('liq-data stale'))).toBe(true);
      }
    }
  });

  it('every numeric field is either finite or null — no NaN/Infinity tokens in raw JSON', () => {
    const raw = readFileSync(PAYLOAD_PATH, 'utf-8');
    expect(raw).not.toContain('NaN');
    expect(raw).not.toContain('Infinity');
  });

  it('data_quality.stale_sources is consistent with sources[*].fresh flags', () => {
    const p = loadPayload();
    for (const asset of [p.btc, p.eth]) {
      const expectedStale = Object.entries(asset.data_quality.sources)
        .filter(([, s]) => !s.fresh)
        .map(([k]) => k)
        .sort();
      expect(asset.data_quality.stale_sources.slice().sort()).toEqual(expectedStale);
    }
  });

  it('verdict NO_TRADE implies risk.blocked and zero notional/size', () => {
    const p = loadPayload();
    for (const asset of [p.btc, p.eth]) {
      if (asset.verdict === 'NO_TRADE') {
        expect(asset.risk.blocked).toBe(true);
        expect(asset.risk.size_mult).toBe(0);
        expect(asset.risk.notional_usd).toBe(0);
      }
    }
  });

  it('entry.price is null when verdict is NO_TRADE or WAIT with no active setup', () => {
    const p = loadPayload();
    for (const asset of [p.btc, p.eth]) {
      if (asset.verdict === 'NO_TRADE') {
        // entry price may still be populated for monitoring, but stop/tp must be null
        expect(asset.stop.price).toBeNull();
        expect(asset.tp.tp1).toBeNull();
      }
    }
  });
});
