import { describe, it, expect } from 'vitest';
import { getFtmoSpec } from '../../src/lib/ftmo';
import { computeRiskGate, computeRiskBudget, DEFAULT_SOFT_STOP_SHARE } from '../../src/lib/ftmo-pricer/risk-budget';

describe('computeRiskGate (circuit-breaker FTMO)', () => {
  const spec = getFtmoSpec(100000, 'two_step', 'standard');

  it('GREEN: equity au solde, floors à 5%/10%, marge suffisante', () => {
    const g = computeRiskGate(spec, { equity: 100000, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.floors.daily.floorUsd).toBeCloseTo(95000, 6);
    expect(g.floors.total.floorUsd).toBeCloseTo(90000, 6);
    expect(g.floors.softDaily.floorUsd).toBeCloseTo(96250, 6);
    expect(g.floors.daily.usagePct).toBeCloseTo(0, 6);
    expect(g.verdict).toBe('GREEN');
    expect(g.canOpenNewTrade).toBe(true);
    expect(g.reduceOnly).toBe(false);
    expect(g.killNow).toBe(false);
  });

  it('ORANGE + reduceOnly au soft-stop (perte jour ≥ 75% du daily)', () => {
    const g = computeRiskGate(spec, { equity: 96200, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.floors.softDaily.hit).toBe(true);
    expect(g.verdict).toBe('ORANGE');
    expect(g.canOpenNewTrade).toBe(false);
    expect(g.reduceOnly).toBe(true);
    expect(g.killNow).toBe(false);
  });

  it('RED killNow sous le floor daily (perte jour ≥ 5%)', () => {
    const g = computeRiskGate(spec, { equity: 94900, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.floors.daily.distanceUsd).toBeLessThanOrEqual(0);
    expect(g.killNow).toBe(true);
    expect(g.canOpenNewTrade).toBe(false);
    expect(g.verdict).toBe('RED');
  });

  it('RED killNow sous le floor total statique (10%)', () => {
    const g = computeRiskGate(spec, { equity: 89500, dayStartEquity: 92000, riskPerTrade: 0.005 });
    expect(g.floors.total.floorUsd).toBeCloseTo(90000, 6);
    expect(g.killNow).toBe(true);
    expect(g.verdict).toBe('RED');
  });

  it('floor total TRAILING (1-step): remonte avec le peak', () => {
    const one = getFtmoSpec(100000, 'one_step', 'standard');
    const a = computeRiskGate(one, { equity: 108000, dayStartEquity: 110000, peakEodBalance: 110000 });
    expect(a.floors.total.floorUsd).toBeCloseTo(99000, 6); // 110k × 0.90
    const b = computeRiskGate(one, { equity: 98000, dayStartEquity: 98000, peakEodBalance: 110000 });
    expect(b.killNow).toBe(true); // floor trailing 99k > equity
  });

  it('pertes consécutives avant seuils: daily 5000/risque 500 = 10, soft = 7', () => {
    const g = computeRiskGate(spec, { equity: 100000, dayStartEquity: 100000, riskPerTrade: 0.005 });
    expect(g.lossesToDailyFloor).toBe(10);
    expect(g.lossesToSoftStop).toBe(7);
  });

  it('budget statique cohérent avec le gate', () => {
    const b = computeRiskBudget(spec, 0.005, DEFAULT_SOFT_STOP_SHARE);
    expect(b.dailyFloorUsd).toBeCloseTo(95000, 6);
    expect(b.softDailyFloorUsd).toBeCloseTo(96250, 6);
    expect(b.maxConsecLosses).toBe(10);
  });
});
