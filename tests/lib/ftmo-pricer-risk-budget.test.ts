import { describe, expect, it } from 'vitest';

import { getFtmoSpec } from '@/lib/ftmo';
import { computeRiskBudget, computeRiskGate, DEFAULT_SOFT_STOP_SHARE } from '@/lib/ftmo-pricer/risk-budget';

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

describe('computeRiskGate', () => {
  const spec = getFtmoSpec(100000, 'two_step', 'standard');

  it('GREEN: equity stable, marge saine, ouverture autorisée', () => {
    const g = computeRiskGate(spec, { equity: 100000, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.verdict).toBe('GREEN');
    expect(g.canOpenNewTrade).toBe(true);
    expect(g.reduceOnly).toBe(false);
    expect(g.killNow).toBe(false);
    expect(g.floors.daily.floorUsd).toBe(95000);
    expect(g.floors.total.floorUsd).toBe(90000);
    expect(g.lossesToDailyFloor).toBe(10);
  });

  it('ORANGE: usage daily ≥50% → alerte, marge encore saine (reduceOnly false)', () => {
    const g = computeRiskGate(spec, { equity: 97400, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.verdict).toBe('ORANGE');
    expect(g.reduceOnly).toBe(false); // usage 52% = signal, soft/marge intacts
    expect(g.killNow).toBe(false);
  });

  it('RED soft hit: equity sous soft floor 96250 → reduceOnly', () => {
    const g = computeRiskGate(spec, { equity: 96000, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.verdict).toBe('ORANGE'); // soft hit mais au-dessus des floors durs
    expect(g.floors.softDaily.hit).toBe(true);
    expect(g.canOpenNewTrade).toBe(false);
  });

  it('RED kill: equity sous floor daily → killNow', () => {
    const g = computeRiskGate(spec, { equity: 94900, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.verdict).toBe('RED');
    expect(g.killNow).toBe(true);
  });

  it('marge 2× risk/trade: juste au-dessus du floor → canOpenNewTrade false sans kill', () => {
    // equity 95,900: marge daily = 900 < 2×500 → pas d'ouverture, pas de kill
    const g = computeRiskGate(spec, { equity: 95900, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.killNow).toBe(false);
    expect(g.canOpenNewTrade).toBe(false);
    expect(g.reduceOnly).toBe(true);
  });

  it('1-step trailing: peak 105k → total floor 94,500', () => {
    const s1 = getFtmoSpec(100000, 'one_step', 'standard');
    const g = computeRiskGate(s1, { equity: 100000, dayStartEquity: 100000, peakEodBalance: 105000 });
    expect(g.floors.total.floorUsd).toBe(94500);
  });

  it('gain jour+: usage daily 0 même si equity < dayStart impossible — clamp ≥0', () => {
    const g = computeRiskGate(spec, { equity: 101500, dayStartEquity: 100000 });
    expect(g.floors.daily.usagePct).toBe(0);
    expect(g.verdict).toBe('GREEN');
  });
});
