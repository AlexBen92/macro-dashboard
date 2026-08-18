import { describe, expect, it } from 'vitest';
import { computeGlobalRotation } from '@/lib/marketRotation';
import { trendVerdict, type RegimeMatrixAsset } from '@/lib/regimeMatrix';

function asset(overrides: Partial<RegimeMatrixAsset> = {}): RegimeMatrixAsset {
  return {
    id: 'TEST',
    source: 'yahoo',
    name: 'Test',
    sector: null,
    last_close: null,
    volume_24h: null,
    bars: 300,
    status: 'ok',
    hurst_regime: 'trend',
    supertrend_dir: 'bull',
    st_flips_30d: 1,
    atr_pct: 2,
    adx_14: 30,
    adf_p: null,
    kpss_p: null,
    stationarity: 'uncertain',
    trend_score: 75,
    ...overrides,
  };
}

describe('computeGlobalRotation', () => {
  it('returns null when no sector has data', () => {
    expect(computeGlobalRotation([{ sector: 'equity', daily: null }])).toBeNull();
  });

  it('labels RISK-ON when avg >= 10 and positives dominate', () => {
    const g = computeGlobalRotation([
      { sector: 'a', daily: 100 },
      { sector: 'b', daily: 20 },
      { sector: 'c', daily: -50 },
    ]);
    expect(g?.label).toBe('RISK-ON');
    expect(g?.avg).toBeCloseTo(23.3, 1);
    expect(g?.nPos).toBe(2);
    expect(g?.nNeg).toBe(1);
    expect(g?.nNeutral).toBe(0);
  });

  it('labels RISK-OFF when avg <= -10 and negatives dominate', () => {
    const g = computeGlobalRotation([
      { sector: 'a', daily: -100 },
      { sector: 'b', daily: -40 },
      { sector: 'c', daily: 50 },
    ]);
    expect(g?.label).toBe('RISK-OFF');
  });

  it('labels ÉQUILIBRÉ when avg high but sectors split', () => {
    const g = computeGlobalRotation([
      { sector: 'a', daily: 100 },
      { sector: 'b', daily: 100 },
      { sector: 'c', daily: -100 },
      { sector: 'd', daily: -100 },
    ]);
    expect(g?.label).toBe('ÉQUILIBRÉ');
  });

  it('excludes null-daily sectors from average and counts', () => {
    const g = computeGlobalRotation([
      { sector: 'a', daily: 20 },
      { sector: 'b', daily: null },
    ]);
    expect(g?.avg).toBe(20);
    expect(g?.scored).toHaveLength(1);
  });
});

describe('trendVerdict', () => {
  it('derives direction from SuperTrend gated by score >= 60', () => {
    expect(trendVerdict(asset())).toBe('BULLISH');
    expect(trendVerdict(asset({ supertrend_dir: 'bear' }))).toBe('BEARISH');
    expect(trendVerdict(asset({ trend_score: 59.9 }))).toBe('NEUTRAL');
    expect(trendVerdict(asset({ trend_score: null }))).toBeNull();
    expect(trendVerdict(asset({ status: 'insufficient_history' }))).toBeNull();
  });
});
