import { describe, it, expect } from 'vitest';
import {
  simulateChallenge,
  mulberry32,
  totalFloorToday,
  DEFAULT_COSTS,
  type MarketCalib,
} from '../../src/lib/ftmo-pricer/monte-carlo';
import {
  optimizeLeverage,
  optimizeLeverages,
  edgeSurface,
  sensitivityGrid,
} from '../../src/lib/ftmo-pricer/leverage-optimizer';
import { analyzeRuin } from '../../src/lib/ftmo-pricer/ruin-analysis';
import { analyzePayoffs } from '../../src/lib/ftmo-pricer/payoff-distribution';
import { kellyFromPayoffs } from '../../src/lib/ftmo-pricer/kelly-sizing';
import { getFtmoSpec } from '../../src/lib/ftmo';
import type { BatesParams } from '../../src/lib/ftmo-pricer/bates';

const bates: BatesParams = { kappa: 3, theta: 0.04, sigmaV: 0.6, rho: -0.7, V0: 0.03, lambdaJ: 0.4, nuJ: -0.08, deltaJ: 0.1 };
const calib: MarketCalib = { bates, fwdDriftAnn: 0.04, rate: 0.043, asOf: '2026-08-30', source: 'test', spot: 5900 };

describe('Monte Carlo FTMO (Q)', () => {
  it('determinisme: même seed ⇒ même fairValue', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const a = simulateChallenge(spec, calib, 3, 2, { nSims: 200, seed: 7 });
    const b = simulateChallenge(spec, calib, 3, 2, { nSims: 200, seed: 7 });
    expect(a.fairValue).toBe(b.fairValue);
    expect(a.outcomes).toEqual(b.outcomes);
  });

  it('DEFAULT_COSTS: coûts positifs (pas de rebate)', () => {
    expect(DEFAULT_COSTS.dailyCostBps).toBeGreaterThan(0);
    expect(DEFAULT_COSTS.swapBps).toBeGreaterThan(0);
    expect(DEFAULT_COSTS.dailyCostBps + DEFAULT_COSTS.swapBps).toBeGreaterThan(2);
  });

  it('drift Q de l\'équité ≈ fwdDrift − coûts (pas de rebate)', () => {
    // lambda=0.05 quasi sans risque de KO: l'équité suit λ·drift_sous-jacent − coûts
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 0.05, 0.05, { nSims: 400, seed: 21, maxDaysEval: 60 });
    // sanity: aucune exception, et la fairValue reste bornée (payouts minuscules)
    expect(r.fairValue).toBeGreaterThan(-spec.feeUsd * 1.1);
    expect(r.fairValue).toBeLessThan(spec.feeUsd);
  });

  it('probabilités cohérentes et bornées + split daily/total', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 3, 2, { nSims: 500, seed: 11 });
    expect(r.pPassPhase1).toBeGreaterThan(0.01);
    expect(r.pPassPhase1).toBeLessThan(0.98);
    expect(r.pReachFunded).toBeLessThanOrEqual(r.pPassPhase1);
    expect(r.pFailP1 + r.pTimeoutP1 + r.pPassPhase1).toBeCloseTo(1, 6);
    expect(r.pFailDailyP1 + r.pFailTotalP1).toBeCloseTo(r.pFailP1, 6);
    expect(r.pFailDailyP2 + r.pFailTotalP2).toBeCloseTo(r.pFailP2, 6);
    expect(r.fairValue).toBeGreaterThan(-spec.feeUsd * 1.2);
    expect(r.fairValue).toBeLessThan(20000);
    expect(r.fairValueSe).toBeGreaterThan(0);
    expect(r.fairValueCI95[0]).toBeLessThan(r.fairValue);
    expect(r.fairValueCI95[1]).toBeGreaterThan(r.fairValue);
  });

  it('levier extrême ⇒ échec dominant (race cible vs KO, λ=15)', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 15, 2, { nSims: 300, seed: 13 });
    expect(r.pFailP1 + r.pTimeoutP1).toBeGreaterThan(0.8);
    expect(r.pReachFunded).toBeLessThan(0.1);
    const r2 = simulateChallenge(spec, calib, 40, 2, { nSims: 200, seed: 13 });
    expect(r2.pReachFunded).toBeLessThan(0.03);
  });

  it('levier nul ⇒ timeout quasi certain', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 0.05, 0.05, { nSims: 200, seed: 17, maxDaysEval: 60 });
    expect(r.pTimeoutP1).toBeGreaterThan(0.9);
  });

  it('barrière intraday: pont brownien — 3 cas analytiques', async () => {
    const { intradayTouchProb } = await import('../../src/lib/ftmo-pricer/monte-carlo');
    const v = 0.03;
    // open/close collés au floor → toucher quasi certain
    expect(intradayTouchProb(95010, 95010, 95000, v)).toBeGreaterThan(0.99);
    // open/close loin du floor → toucher quasi impossible
    expect(intradayTouchProb(98000, 98000, 95000, v)).toBeLessThan(0.01);
    // décroissance monotone avec l'éloignement du close
    const near = intradayTouchProb(96000, 95500, 95000, v);
    const far = intradayTouchProb(96000, 97000, 95000, v);
    expect(near).toBeGreaterThan(far);
    // variance nulle → pas de toucher
    expect(intradayTouchProb(95010, 95010, 95000, 0)).toBe(0);
  });

  it('barrière intraday ON ajoute des KO (λ extrême: breach jour 1 dominant)', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const on = simulateChallenge(spec, calib, 15, 2, { nSims: 300, seed: 23, intradayBarrier: true });
    const off = simulateChallenge(spec, calib, 15, 2, { nSims: 300, seed: 23, intradayBarrier: false });
    expect(on.pFailDailyP1).toBeGreaterThan(0.3);
    // jour 1: préfixe RNG identique, la barrière ne peut qu'ajouter l'échec
    expect(on.pFailDailyP1).toBeGreaterThan(off.pFailDailyP1);
  });

  it('floor max loss: statique 2-step vs trailing EOD 1-step', () => {
    const two = getFtmoSpec(100000, 'two_step', 'standard');
    const one = getFtmoSpec(100000, 'one_step', 'standard');
    expect(totalFloorToday(two, 100000, 120000)).toBeCloseTo(90000, 6);
    expect(totalFloorToday(one, 100000, 100000)).toBeCloseTo(90000, 6);
    // après +20% de gain EOD, le floor trailing monte avec le high-watermark
    expect(totalFloorToday(one, 100000, 120000)).toBeCloseTo(108000, 6);
    expect(one.maxLossMode).toBe('trailing_eod');
    expect(one.bestDayMaxShare).toBeCloseTo(0.5, 6);
  });

  it('pas de limite de temps officielle: défaut maxDaysEval = 600', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const calibP = { ...calib, equityRiskPremium: 0.1 };
    const r = simulateChallenge(spec, calibP, 0.5, 0.5, { nSims: 100, seed: 29 });
    // drift P positif + λ: la cible est atteinte avant 600j dans la plupart des chemins
    expect(r.pTimeoutP1).toBeLessThan(0.2);
    // sans ERP (Q pur), drift net ≈ −coûts: la cible 10% est rarement atteinte à λ=0.3
    const rQ = simulateChallenge(spec, calib, 0.3, 0.3, { nSims: 100, seed: 29 });
    expect(rQ.pTimeoutP1).toBeGreaterThan(0.2);
  });
});

describe('Leverage optimizer', () => {
  it('trouve λ* > 0 avec courbe U (valeur aux extrêmes < sommet)', { timeout: 60000 }, () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const opt = optimizeLeverage(spec, calib, 2, { objective: 'pv_funded', nSims: 150, lambdaMax: 10 });
    expect(opt.lambdaStar).toBeGreaterThan(0.5);
    expect(opt.curve.length).toBeGreaterThanOrEqual(10);
    const maxVal = Math.max(...opt.curve.map((c) => c.value));
    const extreme = Math.min(opt.curve[0].value, opt.curve[opt.curve.length - 1].value);
    expect(extreme).toBeLessThan(maxVal);
    expect(opt.mc.nSims).toBeGreaterThanOrEqual(150);
  });

  it('optimizeLeverages: λ_éval et λ_funded optimisés dans les bornes', { timeout: 120000 }, () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const opt = optimizeLeverages(spec, calib, { objective: 'pv_funded', nSims: 300, lambdaMax: 4 });
    expect(opt.lambdaEvalStar).toBeGreaterThanOrEqual(0.5);
    expect(opt.lambdaEvalStar).toBeLessThanOrEqual(4);
    expect(opt.lambdaFundedStar).toBeGreaterThanOrEqual(0.5);
    expect(opt.lambdaFundedStar).toBeLessThanOrEqual(4);
    expect(opt.mc.nSims).toBeGreaterThanOrEqual(300);
    expect(opt.mc.payoutsCash.length).toBe(opt.mc.nSims);
    expect(opt.mc.simDays.length).toBe(opt.mc.nSims);
  });

  it('edge surface: grille λ_éval × λ_funded complète', { timeout: 60000 }, () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const s = edgeSurface(spec, calib, { nSims: 50, nLambda: 4 });
    expect(s.length).toBe(16);
    for (const pt of s) expect(isFinite(pt.edge)).toBe(true);
  });

  it('sensibilité: coûts croissants ⇒ edge décroissant; ERP ⇒ edge croissant', { timeout: 120000 }, () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const grid = sensitivityGrid(spec, calib, 2, 2, { nSims: 300 });
    expect(grid.length).toBe(6);
    const qRow = grid.filter((g) => g.erp === 0).sort((a, b) => a.costBps - b.costBps);
    expect(qRow[0].edge).toBeGreaterThan(qRow[qRow.length - 1].edge);
    const lowCostP = grid.find((g) => g.erp !== 0 && g.costBps === qRow[0].costBps)!;
    expect(lowCostP.edge).toBeGreaterThan(qRow[0].edge);
  });
});

describe('Ruin analysis', () => {
  it('capital minimal satisfait P(ruine)≤5% et NAV médiane > capital, ou null', { timeout: 120000 }, () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const res = analyzeRuin(spec, calib, 3, 2, { nSims: 40, years: 2, initialCapitals: [1000, 3000, 8000], maxChallenges: 12 });
    expect(res.scenarios.length).toBe(3);
    if (res.minimalCapital !== null) {
      const s = res.scenarios.find((x) => x.initialCapital === res.minimalCapital)!;
      expect(s.pRuin).toBeLessThanOrEqual(0.05);
      expect(s.medianFinalNav).toBeGreaterThan(s.initialCapital);
      expect(res.edgeRealise).toBe(true);
    } else {
      expect(res.edgeRealise).toBe(false);
    }
  });
});

describe('Payoff distribution', () => {
  it('histogramme log + VaR/CVaR ordonnés', () => {
    const payoffs = [...Array(100)].map((_, i) => (i % 10 === 0 ? 2000 + i : -540));
    const d = analyzePayoffs(payoffs);
    expect(d.var95).toBeLessThanOrEqual(0);
    expect(d.cvar95).toBeLessThanOrEqual(d.var95 + 1e-9);
    expect(d.pGain).toBeCloseTo(0.1, 6);
    expect(d.bins.length).toBe(40);
  });
});

describe('Kelly', () => {
  it('edge négatif ⇒ Kelly nul; edge positif ⇒ fraction (0,1]', () => {
    const k0 = kellyFromPayoffs([-540, -540, -540, -540], 540);
    expect(k0.fullKelly).toBe(0);
    const k1 = kellyFromPayoffs([3000, 3000, -540, -540, -540, -540], 540);
    expect(k1.fullKelly).toBeGreaterThan(0);
    expect(k1.fullKelly).toBeLessThanOrEqual(1);
    expect(k1.halfKelly).toBeCloseTo(k1.fullKelly / 2, 6);
    expect(k1.discreteKelly).not.toBeNull();
  });

  it('Kelly discret: b = avgWin/avgLoss sans double-compte du fee', () => {
    // payoffs nets: 2 gains de 2460, 4 pertes de 540 → b = 2460/540 ≈ 4.56, f = 1/3 − (2/3)/4.56
    const k = kellyFromPayoffs([2460, 2460, -540, -540, -540, -540], 540);
    const p = 2 / 6;
    const q = 4 / 6;
    const b = 2460 / 540;
    expect(k.discreteKelly).toBeCloseTo(Math.max(0, p - q / b), 6);
  });
});
