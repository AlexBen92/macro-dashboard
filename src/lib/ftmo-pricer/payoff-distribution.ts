/**
 * Distribution des payoffs nets de fee par chemin simulé.
 * Histogramme en échelle log (sinon la queue de gains rares est écrasée par
 * le pic des chemins perdants). Métriques VaR95, CVaR95, P(gain).
 */

export interface PayoffHistogramBin {
  /** centre du bin en $ */
  x: number;
  count: number;
  density: number;
}

export interface PayoffDistribution {
  bins: PayoffHistogramBin[];
  var95: number;
  cvar95: number;
  pGain: number;
  mean: number;
  std: number;
  min: number;
  max: number;
  medianGain: number | null;
}

export function analyzePayoffs(payoffs: number[], nBins = 40): PayoffDistribution {
  if (payoffs.length === 0) {
    return { bins: [], var95: 0, cvar95: 0, pGain: 0, mean: 0, std: 0, min: 0, max: 0, medianGain: null };
  }
  const sorted = [...payoffs].sort((a, b) => a - b);
  const n = sorted.length;
  const var95 = sorted[Math.floor(0.05 * (n - 1))];
  const tail = sorted.slice(0, Math.max(1, Math.floor(0.05 * n)));
  const cvar95 = tail.reduce((s, x) => s + x, 0) / tail.length;
  const mean = payoffs.reduce((s, x) => s + x, 0) / n;
  const std = Math.sqrt(payoffs.reduce((s, x) => s + (x - mean) ** 2, 0) / n);
  const gains = payoffs.filter((x) => x > 0).sort((a, b) => a - b);
  const medianGain = gains.length ? gains[Math.floor(gains.length / 2)] : null;

  // bins en échelle log sur signe(x)·log10(|x|+1): préserve zéro et les deux queues
  const lo = sorted[0];
  const hi = sorted[n - 1];
  const t = (x: number) => Math.sign(x) * Math.log10(Math.abs(x) + 1);
  const tLo = t(lo);
  const tHi = t(hi);
  const bins: PayoffHistogramBin[] = Array.from({ length: nBins }, (_, i) => ({
    x: 0,
    count: 0,
    density: 0,
  }));
  if (tHi > tLo) {
    const w = (tHi - tLo) / nBins;
    for (const p of payoffs) {
      const idx = Math.min(nBins - 1, Math.max(0, Math.floor((t(p) - tLo) / w)));
      bins[idx].count++;
    }
    for (let i = 0; i < nBins; i++) {
      const tc = tLo + (i + 0.5) * w;
      bins[i].x = Math.sign(tc) * (10 ** Math.abs(tc) - 1);
      bins[i].density = bins[i].count / n;
    }
  }
  return { bins, var95, cvar95, pGain: payoffs.filter((x) => x > 0).length / n, mean, std, min: lo, max: hi, medianGain };
}
