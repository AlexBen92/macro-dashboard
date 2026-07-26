import { describe, it, expect } from 'vitest';
import { bsDelta, bsGamma, normalCdf, normalPdf } from '../../src/lib/options/greeks';

describe('normalPdf / normalCdf', () => {
  it('pdf peaks at 1/sqrt(2π) ≈ 0.3989', () => {
    expect(normalPdf(0)).toBeCloseTo(0.39894, 4);
  });
  it('cdf(0) = 0.5', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 5);
  });
  it('cdf(+∞)→1, cdf(-∞)→0', () => {
    expect(normalCdf(10)).toBeCloseTo(1, 5);
    expect(normalCdf(-10)).toBeCloseTo(0, 5);
  });
});

describe('bsGamma guards', () => {
  it('zero when T<=0', () => {
    expect(bsGamma(100, 100, 0, 0.2)).toBe(0);
    expect(bsGamma(100, 100, -1, 0.2)).toBe(0);
  });
  it('zero when sigma<=0', () => {
    expect(bsGamma(100, 100, 0.25, 0)).toBe(0);
  });
  it('zero when S<=0 or K<=0', () => {
    expect(bsGamma(0, 100, 0.25, 0.2)).toBe(0);
    expect(bsGamma(100, 0, 0.25, 0.2)).toBe(0);
  });
});

describe('bsGamma textbook value', () => {
  it('matches BS gamma for S=K=100, T=0.25, σ=0.2', () => {
    const S = 100, K = 100, T = 0.25, sigma = 0.2;
    const d1 = (Math.log(S / K) + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
    const expected = normalPdf(d1) / (S * sigma * Math.sqrt(T));
    const got = bsGamma(S, K, T, sigma);
    expect(got).toBeCloseTo(expected, 8);
    expect(got).toBeCloseTo(0.0398, 3);
  });
});

describe('bsDelta behaviour', () => {
  it('ATM call delta ≈ 0.5', () => {
    const d = bsDelta(100, 100, 0.25, 0.2, true);
    expect(d).toBeGreaterThan(0.49);
    expect(d).toBeLessThan(0.55);
  });
  it('ATM put delta ≈ -0.5', () => {
    const d = bsDelta(100, 100, 0.25, 0.2, false);
    expect(d).toBeLessThan(-0.45);
    expect(d).toBeGreaterThan(-0.51);
  });
  it('deep ITM call → +1', () => {
    const d = bsDelta(1000, 50, 0.25, 0.3, true);
    expect(d).toBeGreaterThan(0.99);
  });
  it('deep ITM put → -1', () => {
    const d = bsDelta(10, 200, 0.25, 0.3, false);
    expect(d).toBeLessThan(-0.99);
  });
  it('deep OTM call → 0+', () => {
    const d = bsDelta(10, 1000, 0.25, 0.3, true);
    expect(d).toBeGreaterThanOrEqual(0);
    expect(d).toBeLessThan(0.01);
  });
  it('put-call parity on delta (call - put = 1)', () => {
    const c = bsDelta(100, 90, 0.5, 0.4, true);
    const p = bsDelta(100, 90, 0.5, 0.4, false);
    expect(c - p).toBeCloseTo(1, 6);
  });
  it('guards', () => {
    expect(bsDelta(0, 100, 0.25, 0.2, true)).toBe(0);
    expect(bsDelta(100, 100, 0, 0.2, true)).toBe(0);
    expect(bsDelta(100, 100, 0.25, 0, true)).toBe(0);
  });
});
