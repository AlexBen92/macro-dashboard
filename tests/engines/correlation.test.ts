import { describe, it, expect } from 'vitest';
import {
  pearsonLogReturns,
  pricesToLogReturns,
  crisisCorrelation,
} from '../../src/lib/engines/correlation';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pearsonLogReturns', () => {
  it('returns ~1 for perfectly correlated series', () => {
    const a = [0.01, 0.02, -0.01, 0.03, 0.005, -0.02, 0.015, 0.025];
    const b = a.map((v) => 2 * v);
    const r = pearsonLogReturns(a, b);
    expect(r).toBeCloseTo(1.0, 5);
  });

  it('returns ~-1 for anticorrelated series', () => {
    const a = [0.01, 0.02, -0.01, 0.03, 0.005, -0.02, 0.015, 0.025];
    const b = a.map((v) => -3 * v);
    const r = pearsonLogReturns(a, b);
    expect(r).toBeCloseTo(-1.0, 5);
  });

  it('returns |r|<0.1 for independent series with fixed seed', () => {
    const rng = mulberry32(42);
    const a: number[] = [];
    const b: number[] = [];
    for (let i = 0; i < 1000; i++) {
      a.push(rng() - 0.5);
      b.push(rng() - 0.5);
    }
    const r = pearsonLogReturns(a, b);
    expect(Math.abs(r)).toBeLessThan(0.1);
  });
});

describe('pricesToLogReturns', () => {
  it('length is input - 1', () => {
    const prices = [100, 101, 102, 99, 105, 110, 108, 107];
    const r = pricesToLogReturns(prices);
    expect(r.length).toBe(prices.length - 1);
  });
});

describe('crisisCorrelation', () => {
  it('returns ~1 on synchronous crisis series', () => {
    const rng = mulberry32(7);
    const ref: number[] = [];
    for (let i = 0; i < 100; i++) {
      ref.push((rng() - 0.5) * 0.02);
    }
    const other = ref.map((v) => v + (rng() - 0.5) * 0.0001);
    const r = crisisCorrelation(ref, other, 0.1);
    expect(r).toBeGreaterThan(0.9);
  });
});
