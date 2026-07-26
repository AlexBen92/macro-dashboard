import { describe, it, expect } from 'vitest';
import {
  dealerDeltaBias,
  gammaRegime,
  gammaRegimeThreshold,
} from '../../src/lib/options/regime';

describe('gammaRegimeThreshold', () => {
  it('returns S²·0.01', () => {
    expect(gammaRegimeThreshold(100)).toBeCloseTo(100, 5);
    expect(gammaRegimeThreshold(50_000)).toBeCloseTo(25_000_000, 0);
  });
  it('zero when spot invalid', () => {
    expect(gammaRegimeThreshold(0)).toBe(0);
    expect(gammaRegimeThreshold(-1)).toBe(0);
  });
});

describe('gammaRegime', () => {
  it('unknown when spot null', () => {
    expect(gammaRegime(100, null)).toBe('unknown');
  });
  it('neutral when |netGex| < threshold', () => {
    expect(gammaRegime(50, 100)).toBe('neutral');
    expect(gammaRegime(-50, 100)).toBe('neutral');
  });
  it('positive when netGex > threshold', () => {
    expect(gammaRegime(200, 100)).toBe('positive');
  });
  it('negative when netGex < -threshold', () => {
    expect(gammaRegime(-200, 100)).toBe('negative');
  });
  it('unknown when netGex NaN', () => {
    expect(gammaRegime(Number.NaN, 100)).toBe('unknown');
  });
});

describe('dealerDeltaBias', () => {
  it('unknown when spot null', () => {
    expect(dealerDeltaBias(1e6, null)).toBe('unknown');
  });
  it('flat when |netDex| < spot·1000', () => {
    expect(dealerDeltaBias(50_000, 100)).toBe('flat');
  });
  it('long when netDex > spot·1000', () => {
    expect(dealerDeltaBias(500_000, 100)).toBe('long');
  });
  it('short when netDex < -spot·1000', () => {
    expect(dealerDeltaBias(-500_000, 100)).toBe('short');
  });
});
