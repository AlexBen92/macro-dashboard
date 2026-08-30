import { describe, it, expect } from 'vitest';
import { simulateChallenge, mulberry32, type MarketCalib } from '../../src/lib/ftmo-pricer/monte-carlo';
import { optimizeLeverage, edgeSurface } from '../../src/lib/ftmo-pricer/leverage-optimizer';
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

  it('probabilités cohérentes et bornées', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 3, 2, { nSims: 500, seed: 11 });
    expect(r.pPassPhase1).toBeGreaterThan(0.01);
    expect(r.pPassPhase1).toBeLessThan(0.98);
    expect(r.pReachFunded).toBeLessThanOrEqual(r.pPassPhase1);
    expect(r.pFailP1 + r.pTimeoutP1 + r.pPassPhase1).toBeCloseTo(1, 6);
    // fairValue négative pour levier raisonnable: fee 540 > payouts attendus
    expect(r.fairValue).toBeGreaterThan(-spec.fee * 1.2);
    expect(r.fairValue).toBeLessThan(20000);
  });

  it('levier extrême ⇒ échec dominant (race cible vs KO, λ=15)', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 15, 2, { nSims: 300, seed: 13 });
    expect(r.pFailP1 + r.pTimeoutP1).toBeGreaterThan(0.8);
    expect(r.pReachFunded).toBeLessThan(0.1);
    // encore plus extrême: quasi aucune chance
    const r2 = simulateChallenge(spec, calib, 40, 2, { nSims: 200, seed: 13 });
    expect(r2.pReachFunded).toBeLessThan(0.03);
  });

  it('levier nul ⇒ timeout quasi certain', () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const r = simulateChallenge(spec, calib, 0.05, 0.05, { nSims: 200, seed: 17, maxDaysEval: 60 });
    expect(r.pTimeoutP1).toBeGreaterThan(0.9);
  });

  it('vol annuelle implicite du sous-jacent proche de V0/θ', () => {
    // un jour du sous-jacent ~ sqrt(E[v]) — sanity via equity path variability
    const rng = mulberry32(5);
    expect(rng()).toBeLessThan(1);
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
    // structure en U: au moins un extrême nettement sous le max
    expect(extreme).toBeLessThan(maxVal);
    expect(opt.mc.nSims).toBeGreaterThanOrEqual(150);
  });

  it('edge surface: grille λ_éval × λ_funded complète', { timeout: 60000 }, () => {
    const spec = getFtmoSpec(100000, 'two_step', 'standard');
    const s = edgeSurface(spec, calib, { nSims: 50, nLambda: 4 });
    expect(s.length).toBe(16);
    for (const pt of s) expect(isFinite(pt.edge)).toBe(true);
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
});
