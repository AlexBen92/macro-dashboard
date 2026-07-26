import { describe, it, expect } from 'vitest';
import {
  distancePct,
  findCallWall,
  findHvl,
  findPutWall,
  findZeroGamma,
  sortByStrikeAsc,
} from '../../src/lib/options/levels';
import type { StrikeExposure } from '../../src/lib/options/types';

function mkStrike(strike: number, partial: Partial<StrikeExposure>): StrikeExposure {
  return {
    strike,
    callGex: 0,
    putGex: 0,
    netGex: 0,
    callDex: 0,
    putDex: 0,
    netDex: 0,
    callOi: 0,
    putOi: 0,
    expiries: [],
    ...partial,
  };
}

describe('distancePct', () => {
  it('above spot positive', () => {
    expect(distancePct(105, 100)).toBeCloseTo(5, 6);
  });
  it('below spot negative', () => {
    expect(distancePct(98, 100)).toBeCloseTo(-2, 6);
  });
  it('zero spot guard', () => {
    expect(distancePct(100, 0)).toBe(0);
  });
});

describe('sortByStrikeAsc', () => {
  it('numeric not string', () => {
    const arr = [mkStrike(100, {}), mkStrike(20, {}), mkStrike(1100, {})];
    const sorted = [...arr].sort(sortByStrikeAsc);
    expect(sorted.map((s) => s.strike)).toEqual([20, 100, 1100]);
  });
});

describe('findCallWall', () => {
  it('picks max callGex', () => {
    const arr = [
      mkStrike(100, { callGex: 10 }),
      mkStrike(110, { callGex: 50 }),
      mkStrike(120, { callGex: 30 }),
    ];
    const cw = findCallWall(arr, 105);
    expect(cw?.strike).toBe(110);
    expect(cw?.distancePct).toBeCloseTo(((110 - 105) / 105) * 100, 5);
  });
  it('null when empty', () => {
    expect(findCallWall([], 100)).toBeNull();
  });
  it('null when all callGex <= 0', () => {
    const arr = [mkStrike(100, { callGex: 0 }), mkStrike(110, { callGex: -5 })];
    expect(findCallWall(arr, 100)).toBeNull();
  });
});

describe('findPutWall', () => {
  it('picks min (most negative) putGex', () => {
    const arr = [
      mkStrike(80, { putGex: -10 }),
      mkStrike(90, { putGex: -50 }),
      mkStrike(100, { putGex: -30 }),
    ];
    const pw = findPutWall(arr, 95);
    expect(pw?.strike).toBe(90);
  });
  it('null when empty', () => {
    expect(findPutWall([], 100)).toBeNull();
  });
  it('null when all putGex >= 0', () => {
    const arr = [mkStrike(100, { putGex: 0 }), mkStrike(110, { putGex: 5 })];
    expect(findPutWall(arr, 100)).toBeNull();
  });
});

describe('findHvl', () => {
  it('picks max abs netGex', () => {
    const arr = [
      mkStrike(100, { netGex: 10 }),
      mkStrike(110, { netGex: -80 }),
      mkStrike(120, { netGex: 40 }),
    ];
    const hv = findHvl(arr, 115);
    expect(hv?.strike).toBe(110);
  });
  it('null when empty', () => {
    expect(findHvl([], 100)).toBeNull();
  });
  it('null when all zero', () => {
    const arr = [mkStrike(100, { netGex: 0 }), mkStrike(110, { netGex: 0 })];
    expect(findHvl(arr, 100)).toBeNull();
  });
});

describe('findZeroGamma', () => {
  it('null when fewer than 2 strikes', () => {
    expect(findZeroGamma([mkStrike(100, { netGex: 50 })], 100)).toBeNull();
  });
  it('detects sign change with linear interp', () => {
    const arr = [
      mkStrike(90, { netGex: -40 }),
      mkStrike(100, { netGex: 10 }),
      mkStrike(110, { netGex: 30 }),
    ];
    const zg = findZeroGamma(arr, 100);
    expect(zg).not.toBeNull();
    expect(zg!.strike).toBeGreaterThanOrEqual(90);
    expect(zg!.strike).toBeLessThanOrEqual(110);
  });
  it('null when no crossing', () => {
    const arr = [
      mkStrike(100, { netGex: 10 }),
      mkStrike(110, { netGex: 30 }),
    ];
    expect(findZeroGamma(arr, 100)).toBeNull();
  });
});
