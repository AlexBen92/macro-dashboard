import { describe, expect, it } from 'vitest';

import { m15StationarityVerdict, stationarityGuidance } from '@/lib/cockpit/m15Stationarity';

/** AR(1) mean-reverting: y_t = m + phi*(y_{t-1} - m) + eps, phi<1 → stationary. */
function ar1(n: number, phi: number, seed = 42): number[] {
  let s = 72400;
  let rng = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    const eps = (rng / 2147483648 - 0.5) * 60;
    s = 72400 + phi * (s - 72400) + eps;
    out.push(s);
  }
  return out;
}

/** Random walk → unit root → non-stationary. */
function randomWalk(n: number, seed = 7): number[] {
  let s = 72400;
  let rng = seed;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    const eps = (rng / 2147483648 - 0.5) * 60;
    s = s + eps;
    out.push(s);
  }
  return out;
}

const toCandles = (closes: number[]) => closes.map((c) => ({ c }));

describe('m15StationarityVerdict', () => {
  it('rejette <30 closes', () => {
    const v = m15StationarityVerdict(toCandles([1, 2, 3]));
    expect(v.conclusion).toBe('INSUFFICIENT');
    expect(v.n).toBe(3);
    expect(v.adf).toBeNull();
  });

  it('série AR(1) mean-revert → conclusion STATIONARY ou MIXED (jamais NON_STATIONARY si ADF rejet)', () => {
    const v = m15StationarityVerdict(toCandles(ar1(300, 0.3)));
    expect(v.n).toBe(300);
    expect(['STATIONARY', 'MIXED']).toContain(v.conclusion);
    expect(v.adf!.isStationary).toBe(true);
  });

  it('random walk → NON_STATIONARY ou MIXED, ADF ne rejette pas racine unitaire', () => {
    const v = m15StationarityVerdict(toCandles(randomWalk(300)));
    expect(['NON_STATIONARY', 'MIXED']).toContain(v.conclusion);
    expect(v.adf!.isStationary).toBe(false);
  });

  it('filtre les closes non finies', () => {
    const candles = [...toCandles(ar1(60, 0.4)), { c: Number.NaN }];
    const v = m15StationarityVerdict(candles);
    expect(v.n).toBe(60);
  });
});

describe('stationarityGuidance', () => {
  it('chaque conclusion a label + couleur + détail non vides', () => {
    for (const c of ['STATIONARY', 'NON_STATIONARY', 'MIXED', 'INSUFFICIENT'] as const) {
      const g = stationarityGuidance({ conclusion: c, n: 10, adf: null, kpss: null });
      expect(g.label.length).toBeGreaterThan(0);
      expect(g.color).toMatch(/^var\(--/);
      expect(g.detail.length).toBeGreaterThan(0);
    }
  });

  it('STATIONARY guide MR, NON_STATIONARY guide momentum', () => {
    expect(stationarityGuidance({ conclusion: 'STATIONARY', n: 96, adf: null, kpss: null }).label).toBe(
      'RETOUR MOYENNE',
    );
    expect(
      stationarityGuidance({ conclusion: 'NON_STATIONARY', n: 96, adf: null, kpss: null }).label,
    ).toBe('MOMENTUM / TENDANCE');
  });
});
