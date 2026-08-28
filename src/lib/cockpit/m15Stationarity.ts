import { adfTest, kpssTest } from '@/lib/quant/stationarity';

export interface CandleM15Like {
  c: number;
}

export type M15StationarityConclusion = 'STATIONARY' | 'NON_STATIONARY' | 'MIXED' | 'INSUFFICIENT';

export interface M15StationarityVerdict {
  conclusion: M15StationarityConclusion;
  n: number;
  adf: { statistic: number; pValue: number; isStationary: boolean; usedLags: number } | null;
  kpss: { statistic: number; pValue: number; isStationary: boolean } | null;
}

export interface StationarityGuidance {
  label: string;
  color: string;
  detail: string;
}

/**
 * Stationnarité des closes M15 (fenêtre glissante ~24h = 96 barres).
 * ADF (H0: racine unitaire) × KPSS (H0: stationnaire) en confirmation croisée.
 * n≈96 = puissance faible: verdict indicatif, pas un gate.
 */
export function m15StationarityVerdict(candles: CandleM15Like[]): M15StationarityVerdict {
  const closes = candles.map((c) => c.c).filter((v) => Number.isFinite(v));
  if (closes.length < 30) {
    return { conclusion: 'INSUFFICIENT', n: closes.length, adf: null, kpss: null };
  }
  const adf = adfTest(closes);
  const kpss = kpssTest(closes);
  let conclusion: M15StationarityConclusion;
  if (adf.isStationary && kpss.isStationary) conclusion = 'STATIONARY';
  else if (!adf.isStationary && !kpss.isStationary) conclusion = 'NON_STATIONARY';
  else conclusion = 'MIXED';
  return {
    conclusion,
    n: closes.length,
    adf: { statistic: adf.statistic, pValue: adf.pValue, isStationary: adf.isStationary, usedLags: adf.usedLags },
    kpss: { statistic: kpss.statistic, pValue: kpss.pValue, isStationary: kpss.isStationary },
  };
}

export function stationarityGuidance(v: M15StationarityVerdict): StationarityGuidance {
  switch (v.conclusion) {
    case 'STATIONARY':
      return {
        label: 'RETOUR MOYENNE',
        color: 'var(--bull)',
        detail: 'ADF+KPSS convergent: série M15 mean-revert — setups MR (bandes, z-score) favorisés, momentum risqué.',
      };
    case 'NON_STATIONARY':
      return {
        label: 'MOMENTUM / TENDANCE',
        color: 'var(--caution)',
        detail: 'Racine unitaire non rejetée: persistance directionnelle — breakout/momentum favorisés, MR contre-tendance risqué.',
      };
    case 'MIXED':
      return {
        label: 'TESTS DIVERGENTS',
        color: 'var(--muted)',
        detail: 'ADF et KPSS divergent: régime en transition ou puissance insuffisante (n<100) — pas de biais famille.',
      };
    default:
      return { label: 'DONNÉES INSUFFISANTES', color: 'var(--dim)', detail: '<30 closes M15.' };
  }
}
