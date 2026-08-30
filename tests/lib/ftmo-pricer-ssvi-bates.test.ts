import { describe, it, expect } from 'vitest';
import {
  fitSviSlice,
  fitSsvi,
  makeSsviSurface,
  ssviDensity,
  sviRawW,
  sviG,
  type ChainSlice,
} from '../../src/lib/ftmo-pricer/ssvi';
import { batesCallF, batesCf, batesIv, calibrateBates, fellerStatus, type BatesParams } from '../../src/lib/ftmo-pricer/bates';

function makeSyntheticSlice(T: number, baseIv: number, skewPerK: number, F = 6000): ChainSlice {
  const strikes: number[] = [];
  const k: number[] = [];
  const iv: number[] = [];
  const weight: number[] = [];
  for (let kk = -0.3; kk <= 0.3 + 1e-9; kk += 0.03) {
    strikes.push(F * Math.exp(kk));
    k.push(kk);
    // smile quadratique léger + skew: IV(k) = base + skew·k + conv·k²
    iv.push(baseIv + skewPerK * kk + 0.15 * kk * kk);
    weight.push(1 / Math.sqrt(Math.max(baseIv * baseIv * T, 0.001)));
  }
  return { T, expiryDays: Math.round(T * 365), expiryLabel: '2026-10-16', forward: F, strikes, k, iv, weight, nRaw: k.length * 2, nKept: k.length };
}

describe('SSVI', () => {
  it('SVI slice retrouve un smile synthétique (RMSE IV < 2 vols pts)', () => {
    const s = makeSyntheticSlice(0.25, 0.16, -0.06);
    const { p, rmseIv } = fitSviSlice(s);
    expect(rmseIv).toBeLessThan(0.02);
    expect(p.b).toBeGreaterThan(0);
    expect(p.sigma).toBeGreaterThan(0);
    expect(Math.abs(p.rho)).toBeLessThan(1);
    // pas de butterfly arbitrage sur le domaine
    for (let kk = -0.4; kk <= 0.4; kk += 0.05) {
      expect(sviG(kk, p)).toBeGreaterThan(0);
    }
  });

  it('SSVI global: contraintes respectées et surface positive', () => {
    const slices = [makeSyntheticSlice(0.08, 0.14, -0.07), makeSyntheticSlice(0.25, 0.16, -0.06), makeSyntheticSlice(0.5, 0.175, -0.05), makeSyntheticSlice(0.75, 0.185, -0.045)];
    const fit = fitSsvi(slices);
    expect(fit.rmseIv).toBeLessThan(0.03);
    expect(fit.butterflyOk).toBe(true);
    expect(fit.calendarOk).toBe(true);
    const surf = makeSsviSurface(fit.params);
    for (let T = 0.05; T < 1.2; T += 0.1) {
      for (let kk = -0.5; kk <= 0.5; kk += 0.1) {
        expect(surf.w(kk, T)).toBeGreaterThan(0);
      }
    }
    // θ monotone en T
    const tc = fit.params.thetaCurve;
    for (let i = 1; i < tc.length; i++) expect(tc[i].theta).toBeGreaterThanOrEqual(tc[i - 1].theta);
  });

  it('densité RN: pdf positive, cdf croissante, intégrale ~1', () => {
    const slices = [makeSyntheticSlice(0.08, 0.14, -0.07), makeSyntheticSlice(0.25, 0.16, -0.06), makeSyntheticSlice(0.75, 0.185, -0.045)];
    const fit = fitSsvi(slices);
    const surf = makeSsviSurface(fit.params);
    const dens = ssviDensity(surf, 0.25, -0.6, 0.6, 121);
    expect(dens.length).toBeGreaterThan(50);
    let prevCdf = -1;
    for (const d of dens) {
      expect(d.pdf).toBeGreaterThanOrEqual(0);
      expect(d.cdf).toBeGreaterThanOrEqual(prevCdf);
      expect(d.cdf).toBeLessThanOrEqual(1.0001);
      prevCdf = d.cdf;
    }
    // ~50% de masse sous k=0 approx (ATM forward)
    const atm = dens.find((d) => d.k >= 0);
    expect(atm ? atm.cdf : 0).toBeGreaterThan(0.35);
    expect(atm ? atm.cdf : 1).toBeLessThan(0.65);
  });
});

describe('Bates', () => {
  it('CF martingale: |φ(1)| = 1 (E[S_T/F] = 1)', () => {
    const p: BatesParams = { kappa: 2.2, theta: 0.04, sigmaV: 0.55, rho: -0.72, V0: 0.03, lambdaJ: 0.35, nuJ: -0.08, deltaJ: 0.1 };
    for (const T of [0.1, 0.5, 1.0]) {
      const cf = batesCf(0, 1, T, p); // c = 1 + 0i
      expect(Math.hypot(cf.re - 1, cf.im)).toBeLessThan(1e-6);
    }
  });

  it('réduction BS: σv petit, λ→0, V0=θ ⇒ IV plate ≈ √V0', () => {
    const v = 0.0256; // IV 16%
    const p: BatesParams = { kappa: 3, theta: v, sigmaV: 0.01, rho: -0.5, V0: v, lambdaJ: 1e-12, nuJ: 0, deltaJ: 1e-9 };
    for (const k of [-0.2, -0.1, 0, 0.1, 0.2]) {
      expect(Math.abs(batesIv(k, 0.25, p) - Math.sqrt(v))).toBeLessThan(0.015);
    }
  });

  it('payoff cohérent: deep ITM ~ 1−e^k, far OTM ~ 0', () => {
    const p: BatesParams = { kappa: 2.2, theta: 0.04, sigmaV: 0.5, rho: -0.7, V0: 0.03, lambdaJ: 0.3, nuJ: -0.08, deltaJ: 0.12 };
    const cDeep = batesCallF(-0.5, 0.25, p);
    const cFar = batesCallF(0.5, 0.25, p);
    // k=−0.5, vol ~16-20%: C/F ∈ [1−e^{−0.5}, 0.5] bornes physiques
    expect(cDeep).toBeGreaterThan(0.3);
    expect(cDeep).toBeLessThan(1 - Math.exp(-0.5) + 0.05);
    expect(cFar).toBeLessThan(0.1);
  });

  it('calibration Bates sur surface SSVI synthétique: RMSE raisonnable + Feller rapporté', { timeout: 40000 }, () => {
    const slices = [makeSyntheticSlice(0.08, 0.14, -0.07), makeSyntheticSlice(0.25, 0.16, -0.06), makeSyntheticSlice(0.5, 0.175, -0.05), makeSyntheticSlice(0.75, 0.185, -0.045)];
    const fit = fitSsvi(slices);
    const b = calibrateBates(fit.params);
    expect(b.rmseIv).toBeLessThan(0.025); // < 2.5 vols pts
    expect(b.params.kappa).toBeGreaterThan(0.01);
    expect(b.params.theta).toBeGreaterThan(0.0005);
    expect(typeof b.fellerOk).toBe('boolean');
    expect(b.fellerRatio).toBeGreaterThan(0);
  });
});
