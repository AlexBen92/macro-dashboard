import { describe, expect, it } from 'vitest';

import { getFtmoSpec } from '@/lib/ftmo';
import { computeRiskBudget, DEFAULT_SOFT_STOP_SHARE } from '@/lib/ftmo-pricer/risk-budget';

describe('computeRiskBudget', () => {
  it('100k 2-step: floors 95k/90k, pertes consécutives à 0.5%', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const b = computeRiskBudget(spec, 0.005);
    expect(b.dailyAllowanceUsd).toBe(5000);
    expect(b.totalAllowanceUsd).toBe(10000);
    expect(b.dailyFloorUsd).toBe(95000);
    expect(b.totalFloorUsd).toBe(90000);
    expect(b.riskUsd).toBe(500);
    expect(b.maxConsecLosses).toBe(10);
    expect(b.softDailyAllowanceUsd).toBe(3750);
    expect(b.softDailyFloorUsd).toBe(96250);
    expect(b.lossesToSoftStop).toBe(7);
  });

  it('100k 1-step: allowance 3k, floor daily 97k, floor max initial 90k', () => {
    const spec = getFtmoSpec(100000, 'one_step', 'standard');
    const b = computeRiskBudget(spec, 0.005);
    expect(b.dailyAllowanceUsd).toBe(3000);
    expect(b.dailyFloorUsd).toBe(97000);
    expect(b.totalFloorUsd).toBe(90000);
    expect(b.maxConsecLosses).toBe(6);
    expect(b.lossesToSoftStop).toBe(4);
  });

  it('softStopShare custom 0.8', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const b = computeRiskBudget(spec, 0.01, 0.8);
    expect(b.softStopShare).toBe(0.8);
    expect(b.softDailyAllowanceUsd).toBe(4000);
    expect(b.lossesToSoftStop).toBe(4);
  });

  it('risk/trade > allowance: au moins 1 perte = collision', () => {
    const spec = getFtmoSpec(10000, 'two_step', 'standard');
    const b = computeRiskBudget(spec, 0.06);
    expect(b.riskUsd).toBe(600);
    expect(b.maxConsecLosses).toBe(1);
  });

  it('riskPerTrade 0 → Infinity, pas de NaN', () => {
    const spec = getFtmoSpec(25000, 'two_step', 'standard');
    const b = computeRiskBudget(spec, 0);
    expect(b.riskUsd).toBe(0);
    expect(b.maxConsecLosses).toBe(Number.POSITIVE_INFINITY);
    expect(b.lossesToSoftStop).toBe(Number.POSITIVE_INFINITY);
  });

  it('défaut soft stop = 75%', () => {
    expect(DEFAULT_SOFT_STOP_SHARE).toBe(0.75);
  });
});
