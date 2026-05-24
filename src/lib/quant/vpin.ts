/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * VPIN (VOLUME-SYNCHRONIZED PROBABILITY OF INFORMED TRADING) MODULE — V4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * VPIN mesure la "toxicité" du flux d'ordres — la probabilité que les traders
 * informés (informed traders) soient actifs. Un VPIN élevé indique que les
 * market makers se retirent, ce qui élargit les spreads et augmente les coûts.
 *
 * CONCEPT:
 *  - VPIN élevé (> 0.65) → marché toxique, ÉVITER d'entrer
 *  - VPIN faible (< 0.35) → liquidité élevée, conditions idéales
 *  - VPIN moyen (0.35-0.65) → conditions normales
 *
 * MÉTHODOLOGIE:
 *  1. Classer le volume en buy-initiated vs sell-initiated (BVC method)
 *  2. Agréger en buckets de volume égal
 *  3. Calculer la divergence absolue entre buy/sell volume
 *  4. Moyenner sur fenêtre glissante de buckets
 *
 * REFERENCES:
 *  - Easley, D., López de Prado, M., & O'Hara, M. (2012). "Flow Toxicity and
 *    Liquidity in a High-Frequency World." Review of Financial Studies 25(5).
 *  - Easley, D., López de Prado, M., & O'Hara, M. (2016). "The Value of
 *    Volume-Weighted VPIN." Journal of Trading 11(3).
 *
 * INPUT/OUTPUT:
 *  Input:  closes[], volumes[]
 *  Output: vpin[], isHighToxicity[], tradeFilter
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface VolumeClassification {
  buyVolume: number[];
  sellVolume: number[];
  buyRatio: number[];  // buyVolume / totalVolume
}

export interface VPINResult {
  vpin: number[];
  isHighToxicity: boolean[];
  avgToxicity: number;  // Moyenne sur la période
  currentToxicity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export type VPINFilter = 'AVOID' | 'NEUTRAL' | 'IDEAL';

// ─────────────────────────────────────────────────────────────────────────────
// VOLUME CLASSIFICATION (Bulk Volume Classification)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classifie le volume en buy-initiated vs sell-initiated.
 *
 * Méthode BVC (Bulk Volume Classification): Le signe du return de la
 * bougie indique la direction du flux d'ordres dominant.
 *
 * Si return > 0: plus d'acheteurs agressifs → buy-initiated
 * Si return < 0: plus de vendeurs agressifs → sell-initiated
 *
 * @param closes - Prix de clôture
 * @param volumes - Volumes correspondants
 * @returns Classification du volume par bougie
 */
export function classifyVolume(
  closes: number[],
  volumes: number[]
): VolumeClassification {
  const n = Math.min(closes.length, volumes.length);
  const buyVolume: number[] = new Array(n).fill(0);
  const sellVolume: number[] = new Array(n).fill(0);
  const buyRatio: number[] = new Array(n).fill(0.5);

  for (let i = 1; i < n; i++) {
    const priceChange = closes[i] - closes[i - 1];
    const totalVolume = volumes[i];

    if (priceChange > 0) {
      // Price up: majority buy-initiated
      buyVolume[i] = totalVolume;
      sellVolume[i] = 0;
      buyRatio[i] = 1;
    } else if (priceChange < 0) {
      // Price down: majority sell-initiated
      buyVolume[i] = 0;
      sellVolume[i] = totalVolume;
      buyRatio[i] = 0;
    } else {
      // No change: split evenly
      buyVolume[i] = totalVolume / 2;
      sellVolume[i] = totalVolume / 2;
      buyRatio[i] = 0.5;
    }
  }

  return { buyVolume, sellVolume, buyRatio };
}

/**
 * Classifie le volume avec une méthode plus nuancée.
 *
 * Utilise la magnitude du prix change pour estimer la proportion
 * buy/sell au lieu d'une classification binaire.
 *
 * @param closes - Prix de clôture
 * @param volumes - Volumes
 * @returns Classification nuancée du volume
 */
export function classifyVolumeProportional(
  closes: number[],
  volumes: number[]
): VolumeClassification {
  const n = Math.min(closes.length, volumes.length);
  const buyVolume: number[] = new Array(n).fill(0);
  const sellVolume: number[] = new Array(n).fill(0);
  const buyRatio: number[] = new Array(n).fill(0.5);

  // Calculate average absolute price change for normalization
  const absChanges: number[] = [];
  for (let i = 1; i < Math.min(n, 101); i++) {
    absChanges.push(Math.abs(closes[i] - closes[i - 1]));
  }
  const avgAbsChange = absChanges.reduce((a, b) => a + b, 0) / absChanges.length;

  for (let i = 1; i < n; i++) {
    const priceChange = closes[i] - closes[i - 1];
    const totalVolume = volumes[i];

    if (avgAbsChange > 0) {
      // Normalize price change to get buy/sell proportion
      const buyProportion = 0.5 + (priceChange / avgAbsChange) * 0.4;  // Clamp to [0.1, 0.9]
      const clampedBuy = Math.max(0.1, Math.min(0.9, buyProportion));

      buyVolume[i] = totalVolume * clampedBuy;
      sellVolume[i] = totalVolume * (1 - clampedBuy);
      buyRatio[i] = clampedBuy;
    } else {
      buyVolume[i] = totalVolume * 0.5;
      sellVolume[i] = totalVolume * 0.5;
      buyRatio[i] = 0.5;
    }
  }

  return { buyVolume, sellVolume, buyRatio };
}

// ─────────────────────────────────────────────────────────────────────────────
// VPIN CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le VPIN (Volume-Synchronized Probability of Informed Trading).
 *
 * Le VPIN est calculé sur une fenêtre glissante de buckets de volume:
 *
 * VPIN = Σ|V_buy - V_sell| / (ΣV_buy + ΣV_sell)
 *
 * Où la somme est sur les n buckets les plus récents.
 *
 * @param closes - Prix de clôture
 * @param volumes - Volumes
 * @param bucketSize - Volume par bucket (en unités de base)
 * @param nBuckets - Nombre de buckets dans la fenêtre (défaut 50)
 * @returns Résultat VPIN complet
 */
export function calculateVPIN(
  closes: number[],
  volumes: number[],
  bucketSize: number = 50,
  nBuckets: number = 50
): VPINResult {
  const n = closes.length;
  const vpin: number[] = new Array(n).fill(0);
  const isHighToxicity: boolean[] = new Array(n).fill(false);

  // Classify volume
  const { buyVolume, sellVolume } = classifyVolumeProportional(closes, volumes);

  // Determine bucket size dynamically if not specified
  let actualBucketSize = bucketSize;
  if (bucketSize <= 0) {
    // Use average volume per bucket as reference
    const avgVolume = volumes.reduce((a, b) => a + b, 0) / volumes.length;
    actualBucketSize = Math.max(avgVolume * 10, 1000);  // ~10 bars per bucket
  }

  // Create volume buckets
  const buckets: { buyVolume: number; sellVolume: number }[] = [];
  let currentBuy = 0;
  let currentSell = 0;
  let currentVolume = 0;

  for (let i = 1; i < n; i++) {
    currentBuy += buyVolume[i];
    currentSell += sellVolume[i];
    currentVolume += volumes[i];

    if (currentVolume >= actualBucketSize) {
      buckets.push({
        buyVolume: currentBuy,
        sellVolume: currentSell,
      });
      currentBuy = 0;
      currentSell = 0;
      currentVolume = 0;
    }

    // Calculate VPIN for recent window
    if (buckets.length >= nBuckets) {
      const recentBuckets = buckets.slice(-nBuckets);

      const totalBuy = recentBuckets.reduce((a, b) => a + b.buyVolume, 0);
      const totalSell = recentBuckets.reduce((a, b) => a + b.sellVolume, 0);
      const totalVolume = totalBuy + totalSell;

      const vpinValue = totalVolume > 0 ? Math.abs(totalBuy - totalSell) / totalVolume : 0;
      vpin[i] = vpinValue;

      // High toxicity threshold
      isHighToxicity[i] = vpinValue > 0.65;
    }
  }

  // Calculate aggregate statistics
  const validVPIN = vpin.filter(v => v > 0);
  const avgToxicity = validVPIN.length > 0
    ? validVPIN.reduce((a, b) => a + b, 0) / validVPIN.length
    : 0;

  const latestVPIN = vpin[n - 1];
  let currentToxicity: VPINResult['currentToxicity'] = 'MEDIUM';
  if (latestVPIN > 0.65) {
    currentToxicity = 'HIGH';
  } else if (latestVPIN < 0.35) {
    currentToxicity = 'LOW';
  }

  return {
    vpin,
    isHighToxicity,
    avgToxicity,
    currentToxicity,
  };
}

/**
 * Calcule le VPIN avec une fenêtre temporelle au lieu de buckets de volume.
 *
 * Plus simple mais moins précis que la méthode volume-synchronisée.
 *
 * @param closes - Prix de clôture
 * @param volumes - Volumes
 * @param windowSize - Taille de fenêtre en bougies (défaut 100)
 * @returns Résultat VPIN
 */
export function calculateVPINTimeBased(
  closes: number[],
  volumes: number[],
  windowSize: number = 100
): VPINResult {
  const n = closes.length;
  const vpin: number[] = new Array(n).fill(0);
  const isHighToxicity: boolean[] = new Array(n).fill(false);

  const { buyVolume, sellVolume } = classifyVolumeProportional(closes, volumes);

  for (let i = windowSize; i < n; i++) {
    // Sum over window
    let totalBuy = 0;
    let totalSell = 0;

    for (let j = i - windowSize + 1; j <= i; j++) {
      totalBuy += buyVolume[j];
      totalSell += sellVolume[j];
    }

    const totalVolume = totalBuy + totalSell;
    const vpinValue = totalVolume > 0 ? Math.abs(totalBuy - totalSell) / totalVolume : 0;

    vpin[i] = vpinValue;
    isHighToxicity[i] = vpinValue > 0.65;
  }

  const validVPIN = vpin.filter(v => v > 0);
  const avgToxicity = validVPIN.length > 0
    ? validVPIN.reduce((a, b) => a + b, 0) / validVPIN.length
    : 0;

  const latestVPIN = vpin[n - 1];
  let currentToxicity: VPINResult['currentToxicity'] = 'MEDIUM';
  if (latestVPIN > 0.65) {
    currentToxicity = 'HIGH';
  } else if (latestVPIN < 0.35) {
    currentToxicity = 'LOW';
  }

  return {
    vpin,
    isHighToxicity,
    avgToxicity,
    currentToxicity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VPIN-BASED TRADE FILTER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtre de trading basé sur VPIN.
 *
 * Retourne une recommandation d'action basée sur le niveau de VPIN:
 *  - AVOID: VPIN > 0.65 → flux toxique, ne PAS entrer
 *  - NEUTRAL: 0.35 ≤ VPIN ≤ 0.65 → conditions normales
 *  - IDEAL: VPIN < 0.35 → liquidité élevée, conditions idéales
 *
 * @param vpinValue - Valeur VPIN actuelle
 * @param highThreshold - Seuil de toxicité élevée (défaut 0.65)
 * @param lowThreshold - Seuil de conditions idéales (défaut 0.35)
 * @returns Recommandation de filtrage
 */
export function vpinTradeFilter(
  vpinValue: number,
  highThreshold: number = 0.65,
  lowThreshold: number = 0.35
): VPINFilter {
  if (vpinValue > highThreshold) {
    return 'AVOID';
  } else if (vpinValue < lowThreshold) {
    return 'IDEAL';
  } else {
    return 'NEUTRAL';
  }
}

/**
 * Filtre de trading avec sizing ajusté selon VPIN.
 *
 * Au lieu de bloquer complètement, ajuste la taille de position:
 *  - VPIN > 0.65: taille réduite à 25%
 *  - 0.50 < VPIN ≤ 0.65: taille réduite à 50%
 *  - 0.35 ≤ VPIN ≤ 0.50: taille normale (100%)
 *  - VPIN < 0.35: taille augmentée à 125% (conditions favorables)
 *
 * @param vpinValue - Valeur VPIN actuelle
 * @returns Multiplicateur de taille (0-1.5)
 */
export function vpinSizingMultiplier(vpinValue: number): number {
  if (vpinValue > 0.65) {
    return 0.25;  // Réduire fortement
  } else if (vpinValue > 0.50) {
    return 0.50;  // Réduire modérément
  } else if (vpinValue > 0.35) {
    return 1.00;  // Normal
  } else {
    return 1.25;  // Augmenter légèrement
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// VPIN ANALYSIS & DIAGNOSTICS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analyse complète de la toxicité du marché via VPIN.
 *
 * @param closes - Prix de clôture
 * @param volumes - Volumes
 * @returns Analyse détaillée
 */
export interface VPINAnalysis {
  current: {
    value: number;
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    filter: VPINFilter;
    sizingMultiplier: number;
  };
  historical: {
    avg: number;
    std: number;
    min: number;
    max: number;
    percentiles: {
      p25: number;
      p50: number;
      p75: number;
    };
  };
  recommendations: {
    action: string;
    reason: string;
    urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  }[];
}

export function analyzeVPIN(closes: number[], volumes: number[]): VPINAnalysis {
  const vpinResult = calculateVPIN(closes, volumes);

  // Historical statistics
  const validVPIN = vpinResult.vpin.filter(v => v > 0);
  const avg = validVPIN.reduce((a, b) => a + b, 0) / validVPIN.length;
  const variance = validVPIN.reduce((a, v) => a + (v - avg) ** 2, 0) / validVPIN.length;
  const std = Math.sqrt(variance);

  const sorted = [...validVPIN].sort((a, b) => a - b);
  const n = sorted.length;

  const current = vpinResult.vpin[vpinResult.vpin.length - 1];
  const currentLevel = vpinResult.currentToxicity;

  const recommendations: VPINAnalysis['recommendations'] = [];

  if (currentLevel === 'HIGH') {
    recommendations.push({
      action: 'RÉDUIRE EXPOSITION',
      reason: `VPIN ${current.toFixed(3)} > 0.65: flux d'ordres toxique détecté`,
      urgency: 'HIGH',
    });
    recommendations.push({
      action: 'ÉLAGER POSITIONS',
      reason: 'Les market makers se retirent: spreads élargis, slippage élevé',
      urgency: 'MEDIUM',
    });
  } else if (currentLevel === 'LOW') {
    recommendations.push({
      action: 'AUGMENTER EXPOSITION',
      reason: `VPIN ${current.toFixed(3)} < 0.35: liquidité abondante`,
      urgency: 'LOW',
    });
  }

  // Check if VPIN is rising
  if (validVPIN.length >= 10) {
    const recent = validVPIN.slice(-5);
    const earlier = validVPIN.slice(-10, -5);
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    if (recentAvg > earlierAvg * 1.2) {
      recommendations.push({
        action: 'SURVEILLANCE RENFORCÉE',
        reason: 'VPIN en hausse de 20%+: détérioration des conditions',
        urgency: 'MEDIUM',
      });
    }
  }

  return {
    current: {
      value: current,
      level: currentLevel,
      filter: vpinTradeFilter(current),
      sizingMultiplier: vpinSizingMultiplier(current),
    },
    historical: {
      avg,
      std,
      min: sorted[0],
      max: sorted[n - 1],
      percentiles: {
        p25: sorted[Math.floor(0.25 * n)],
        p50: sorted[Math.floor(0.50 * n)],
        p75: sorted[Math.floor(0.75 * n)],
      },
    },
    recommendations,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formate la valeur VPIN pour affichage.
 */
export function formatVPIN(vpin: number): string {
  const pct = vpin * 100;
  return `${pct.toFixed(1)}%`;
}

/**
 * Retourne une description textuelle du niveau de VPIN.
 */
export function describeVPINLevel(vpin: number): string {
  if (vpin > 0.70) {
    return 'TOXICITÉ EXTRÊME - Market makers ont fui';
  } else if (vpin > 0.65) {
    return 'TOXICITÉ ÉLEVÉE - Conditions défavorables';
  } else if (vpin > 0.50) {
    return 'Toxicité modérée - Surveillance recommandée';
  } else if (vpin > 0.35) {
    return 'Conditions normales';
  } else if (vpin > 0.25) {
    return 'Conditions favorables - Liquidité saine';
  } else {
    return 'Conditions idéales - Liquidité abondante';
  }
}

/**
 * Calcule le VPIN moyen sur plusieurs périodes pour comparaison.
 */
export function compareVPINPeriods(
  closes: number[],
  volumes: number[],
  period1: { start: number; end: number },
  period2: { start: number; end: number }
): {
  period1VPIN: number;
  period2VPIN: number;
  changePct: number;
  interpretation: string;
} {
  const slice1 = {
    closes: closes.slice(period1.start, period1.end),
    volumes: volumes.slice(period1.start, period1.end),
  };
  const slice2 = {
    closes: closes.slice(period2.start, period2.end),
    volumes: volumes.slice(period2.start, period2.end),
  };

  const vpin1 = calculateVPINTimeBased(slice1.closes, slice1.volumes);
  const vpin2 = calculateVPINTimeBased(slice2.closes, slice2.volumes);

  const avg1 = vpin1.avgToxicity;
  const avg2 = vpin2.avgToxicity;
  const change = ((avg2 - avg1) / avg1) * 100;

  let interpretation = '';
  if (change > 20) {
    interpretation = 'Détérioration significative de la liquidité';
  } else if (change > 10) {
    interpretation = 'Légère détérioration des conditions';
  } else if (change < -20) {
    interpretation = 'Amélioration significative de la liquidité';
  } else if (change < -10) {
    interpretation = 'Légère amélioration des conditions';
  } else {
    interpretation = 'Conditions stables';
  }

  return {
    period1VPIN: avg1,
    period2VPIN: avg2,
    changePct: change,
    interpretation,
  };
}
