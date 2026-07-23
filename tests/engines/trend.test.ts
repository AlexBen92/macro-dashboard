import { describe, it, expect } from 'vitest';
import {
  calcADX,
  classifyTrend,
  type Candle,
} from '../../src/lib/engines/trend';

function makeBull(n: number): Candle[] {
  const out: Candle[] = [];
  let base = 100;
  for (let i = 0; i < n; i++) {
    base *= 1 + 0.01 + Math.sin(i / 3) * 0.002;
    out.push({
      time: i * 86400000,
      open: base * 0.995,
      high: base * 1.01,
      low: base * 0.99,
      close: base,
      volume: 1000,
    });
  }
  return out;
}

function makeBear(n: number): Candle[] {
  const out: Candle[] = [];
  let base = 100;
  for (let i = 0; i < n; i++) {
    base *= 1 - 0.01 + Math.sin(i / 3) * 0.002;
    out.push({
      time: i * 86400000,
      open: base * 1.005,
      high: base * 1.01,
      low: base * 0.99,
      close: base,
      volume: 1000,
    });
  }
  return out;
}

function makeRange(n: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const base = 100 + Math.sin(i / 2) * 0.5;
    out.push({
      time: i * 86400000,
      open: base,
      high: base + 0.5,
      low: base - 0.5,
      close: base + (Math.sin(i) * 0.3),
      volume: 1000,
    });
  }
  return out;
}

describe('classifyTrend', () => {
  it('bull trend returns direction=bull with adx>25', () => {
    const res = classifyTrend(makeBull(60), 'D');
    expect(res.direction).toBe('bull');
    expect(res.adx).toBeGreaterThan(25);
  });

  it('bear trend returns direction=bear', () => {
    const res = classifyTrend(makeBear(60), 'D');
    expect(res.direction).toBe('bear');
  });

  it('range returns direction=range with adx<20', () => {
    const res = classifyTrend(makeRange(60), 'D');
    expect(res.direction).toBe('range');
    expect(res.adx).toBeLessThan(20);
  });
});

describe('calcADX', () => {
  it('flat data returns 0 or near 0', () => {
    const flat: Candle[] = Array.from({ length: 30 }, (_, i) => ({
      time: i * 86400000,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1,
    }));
    expect(calcADX(flat)).toBeCloseTo(0, 5);
  });
});
