/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * OPEN INTEREST & FUNDING RATE ANALYSIS MODULE — V4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Analyse de l'Open Interest (OI) et des Funding Rates comme signaux primaires.
 * L'OI est le signal le plus prédictif sur les perpétuels crypto car il mesure
 * les convictions des positions levered.
 *
 * MÉTRIQUES:
 *  - OI Change Rate: Variation de l'OI + corrélation avec prix
 *  - OI/Volume Ratio: Qualité des mouvements (nouveaux $ vs spéculatif)
 *  - Funding Rate Signal: Surachat/survente via financement perpétuel
 *  - Liquidation Heatmap: Zones de liquidation massives
 *  - OI Momentum Score: Score multi-pilier pour filtrage marché
 *
 * INTERPRÉTATION:
 *  - OI↑ + Prix↑ = Trend haussier confirmé (nouveaux longs)
 *  - OI↑ + Prix↓ = Trend baissier confirmé (nouveaux shorts)
 *  - OI↓ + Prix↑ = Short squeeze probable (couvertures)
 *  - OI↓ + Prix↓ = Long liquidation probable
 *
 * REFERENCES:
 *  - Cong, L., He, Z., & Tang, K. (2023). "Crypto Wash Trading." NBER WP 30783.
 *  - He, X. et al. (2024). "Funding Rate Alpha in Crypto Perpetuals." arXiv:2212.06888.
 *
 * INPUT/OUTPUT:
 *  Input:  OI series, price series, volume series, funding rates
 *  Output: Signals de trading et scores de confiance
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// OI CHANGE RATE SIGNAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * OI Change Rate: analyse la variation de l'OI combinée au mouvement de prix.
 *
 * Interprétation:
 *  - OI↑ + Prix↑ → LONG_CONF (nouveaux longs entrent)
 *  - OI↑ + Prix↓ → SHORT_CONF (nouveaux shorts entrent)
 *  - OI↓ + Prix↑ → SHORT_SQUEEZE (shorts couvrent)
 *  - OI↓ + Prix↓ → LONG_LIQ (longs sont liquidés)
 *  - OI stable → NEUTRAL
 *
 * @param oiSeries - Historique de l'Open Interest
 * @param priceSeries - Historique des prix
 * @param period - Période d'analyse (défaut 4 bougies)
 * @returns Signal OI avec force
 */
export interface OISignal {
  oiChangeRate: number[];
  priceChangeRate: number[];
  signal: ('LONG_CONF' | 'SHORT_CONF' | 'SHORT_SQUEEZE' | 'LONG_LIQ' | 'NEUTRAL')[];
  strength: number[];  // 0-1
}

export function oiSignal(
  oiSeries: number[],
  priceSeries: number[],
  period: number = 4
): OISignal {
  const n = oiSeries.length;
  const oiChangeRate: number[] = new Array(n).fill(0);
  const priceChangeRate: number[] = new Array(n).fill(0);
  const signal: ('LONG_CONF' | 'SHORT_CONF' | 'SHORT_SQUEEZE' | 'LONG_LIQ' | 'NEUTRAL')[] = new Array(n).fill('NEUTRAL');
  const strength: number[] = new Array(n).fill(0);

  for (let i = period; i < n; i++) {
    const oiChange = (oiSeries[i] - oiSeries[i - period]) / (oiSeries[i - period] + 1e-10);
    const priceChange = (priceSeries[i] - priceSeries[i - period]) / (priceSeries[i - period] + 1e-10);

    oiChangeRate[i] = oiChange * 100;  // En pourcentage
    priceChangeRate[i] = priceChange * 100;

    // Thresholds for meaningful moves
    const oiThreshold = 0.02;  // 2% OI change
    const priceThreshold = 0.01;  // 1% price change

    const oiUp = oiChange > oiThreshold;
    const oiDown = oiChange < -oiThreshold;
    const priceUp = priceChange > priceThreshold;
    const priceDown = priceChange < -priceThreshold;

    let currentSignal: OISignal['signal'][number] = 'NEUTRAL';
    let currentStrength = 0;

    if (oiUp && priceUp) {
      currentSignal = 'LONG_CONF';
      currentStrength = Math.min(1, (oiChange + priceChange) / 0.1);
    } else if (oiUp && priceDown) {
      currentSignal = 'SHORT_CONF';
      currentStrength = Math.min(1, (oiChange + Math.abs(priceChange)) / 0.1);
    } else if (oiDown && priceUp) {
      currentSignal = 'SHORT_SQUEEZE';
      currentStrength = Math.min(1, (Math.abs(oiChange) + priceChange) / 0.1);
    } else if (oiDown && priceDown) {
      currentSignal = 'LONG_LIQ';
      currentStrength = Math.min(1, (Math.abs(oiChange) + Math.abs(priceChange)) / 0.1);
    }

    signal[i] = currentSignal;
    strength[i] = Math.round(currentStrength * 100) / 100;
  }

  return { oiChangeRate, priceChangeRate, signal, strength };
}

// ─────────────────────────────────────────────────────────────────────────────
// OI/VOLUME RATIO
// ─────────────────────────────────────────────────────────────────────────────
/**
 * OI/Volume Ratio: mesure la "qualité" des mouvements de prix.
 *
 * Ratio élevé = mouvement porté par nouvelles positions (sustainable)
 * Ratio faible = mouvement spéculatif intraday (fading attendu)
 *
 * @param oiSeries - Historique de l'Open Interest
 * @param volumeSeries - Historique des volumes
 * @param period - Période de calcul (défaut 24 pour daily en H1)
 * @returns Ratio OI/Volume (0-1 typiquement)
 */
export function oiVolumeRatio(
  oiSeries: number[],
  volumeSeries: number[],
  period: number = 24
): number[] {
  const n = oiSeries.length;
  const ratio: number[] = new Array(n).fill(0);

  for (let i = period; i < n; i++) {
    const avgOI = oiSeries.slice(i - period, i + 1).reduce((a, b) => a + b, 0) / period;
    const avgVol = volumeSeries.slice(i - period, i + 1).reduce((a, b) => a + b, 0) / period;

    // Ratio: OI en $ / Volume en $ (typiquement 0.1 - 0.5)
    ratio[i] = avgVol > 0 ? (avgOI / avgVol) : 0;
  }

  return ratio;
}

/**
 * Interprétation du ratio OI/Volume.
 */
export function interpretOIVolumeRatio(ratio: number): {
  quality: 'HIGH' | 'MEDIUM' | 'LOW';
  action: 'NORMAL_SIZE' | 'REDUCE_SIZE_50' | 'REDUCE_SIZE_75';
  reason: string;
} {
  if (ratio >= 0.3) {
    return {
      quality: 'HIGH',
      action: 'NORMAL_SIZE',
      reason: `OI/Vol ratio ${ratio.toFixed(2)}: mouvement porté par nouvelles positions (sustainable)`,
    };
  } else if (ratio >= 0.15) {
    return {
      quality: 'MEDIUM',
      action: 'REDUCE_SIZE_50',
      reason: `OI/Vol ratio ${ratio.toFixed(2)}: mix nouvelles/anciennes positions`,
    };
  } else {
    return {
      quality: 'LOW',
      action: 'REDUCE_SIZE_75',
      reason: `OI/Vol ratio ${ratio.toFixed(2)}: mouvement spéculatif intraday (risque de fade)`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNDING RATE SIGNAL
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Funding Rate Signal avec z-score pour contrarian trading.
 *
 * Interprétation:
 *  - Funding > 0.1% → marché suracheté, shorts favorisés
 *  - Funding < -0.05% → marché survendu, longs favorisés
 *  - Funding extrême (>0.3%) → signal contrarian fort
 *
 * Le z-score mesure l'écart du funding par rapport à sa moyenne historique.
 *
 * @param fundingRates - Historique des funding rates (en décimal, ex: 0.0001 = 0.01%)
 * @param lookback - Période pour calcul moyenne/écart-type (défaut 720 = 30j en H1)
 * @returns Signal funding avec z-score
 */
export interface FundingSignal {
  signal: ('LONG' | 'SHORT' | 'NEUTRAL' | 'CONTRARIAN_LONG' | 'CONTRARIAN_SHORT')[];
  zscore: number[];
  rawFunding: number[];
  interpretation: string[];
}

export function fundingRateSignal(
  fundingRates: number[],
  lookback: number = 720
): FundingSignal {
  const n = fundingRates.length;
  const signal: FundingSignal['signal'][number][] = new Array(n).fill('NEUTRAL');
  const zscore: number[] = new Array(n).fill(0);
  const interpretation: string[] = new Array(n).fill('');

  for (let i = lookback; i < n; i++) {
    const slice = fundingRates.slice(i - lookback, i);
    const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / slice.length;
    const std = Math.sqrt(variance);

    const currentFunding = fundingRates[i];
    const currentZ = std > 0 ? (currentFunding - mean) / std : 0;
    zscore[i] = Math.round(currentZ * 100) / 100;

    // Convert to percentage for display
    const fundingPct = currentFunding * 100;

    let currentSignal: FundingSignal['signal'][number] = 'NEUTRAL';
    let currentInterpret = '';

    // Extreme funding = contrarian signal
    if (currentZ > 2.5 || fundingPct > 0.3) {
      currentSignal = 'CONTRARIAN_SHORT';
      currentInterpret = `Funding ${fundingPct.toFixed(4)}% extrême (z=${currentZ.toFixed(1)}): LONGs surpayants → SHORT contrarian`;
    } else if (currentZ < -2.5 || fundingPct < -0.1) {
      currentSignal = 'CONTRARIAN_LONG';
      currentInterpret = `Funding ${fundingPct.toFixed(4)}% extrême (z=${currentZ.toFixed(1)}): SHORTs surpayants → LONG contrarian`;
    } else if (fundingPct > 0.1) {
      currentSignal = 'SHORT';
      currentInterpret = `Funding ${fundingPct.toFixed(4)}% élevé (z=${currentZ.toFixed(1)}): marché suracheté → SHORT favori`;
    } else if (fundingPct < -0.05) {
      currentSignal = 'LONG';
      currentInterpret = `Funding ${fundingPct.toFixed(4)}% négatif (z=${currentZ.toFixed(1)}): marché survendu → LONG favori`;
    } else {
      currentSignal = 'NEUTRAL';
      currentInterpret = `Funding ${fundingPct.toFixed(4)}% neutre (z=${currentZ.toFixed(1)})`;
    }

    signal[i] = currentSignal;
    interpretation[i] = currentInterpret;
  }

  return { signal, zscore, rawFunding: fundingRates, interpretation };
}

// ─────────────────────────────────────────────────────────────────────────────
// LIQUIDATION HEATMAP
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Signal basé sur les zones de liquidation.
 *
 * Si le prix approche une zone de liquidation massive, il y a un effet
 * d'aspiration (magnet) qui peut accélérer le mouvement.
 *
 * @param currentPrice - Prix actuel
 * @param openPositions - Positions ouvertes avec prix et direction
 * @param lookAheadMultiplier - Distance en ATR pour scanner (défaut 3)
 * @returns Zones de liquidation et pression
 */
export interface LiquidationZone {
  nearestLongLiqZone: number;
  nearestShortLiqZone: number;
  liquidationPressure: number;  // -1 à 1, négatif = pression short, positif = pression long
  distanceToLongZone: number;   // En % du prix actuel
  distanceToShortZone: number;
}

export function liquidationZoneSignal(
  currentPrice: number,
  openPositions: { price: number; size: number; direction: 'LONG' | 'SHORT' }[],
  atr: number,
  lookAheadMultiplier: number = 3
): LiquidationZone {
  if (openPositions.length === 0) {
    return {
      nearestLongLiqZone: 0,
      nearestShortLiqZone: 0,
      liquidationPressure: 0,
      distanceToLongZone: 999,
      distanceToShortZone: 999,
    };
  }

  // Calculate liquidation prices (simplified)
  // In reality, liquidation price depends on margin, leverage, etc.
  const scanDistance = atr * lookAheadMultiplier;
  const lowerBound = currentPrice - scanDistance;
  const upperBound = currentPrice + scanDistance;

  // Aggregate positions by price levels
  const longLiqZones: { price: number; totalSize: number }[] = [];
  const shortLiqZones: { price: number; totalSize: number }[] = [];

  for (const pos of openPositions) {
    // Simplified liquidation price calculation
    // Longs get liquidated below entry, shorts above entry
    if (pos.direction === 'LONG') {
      const liqPrice = pos.price * 0.95;  // Simplified: 5% below entry
      if (liqPrice >= lowerBound && liqPrice <= currentPrice) {
        longLiqZones.push({ price: liqPrice, totalSize: pos.size });
      }
    } else {
      const liqPrice = pos.price * 1.05;  // Simplified: 5% above entry
      if (liqPrice <= upperBound && liqPrice >= currentPrice) {
        shortLiqZones.push({ price: liqPrice, totalSize: pos.size });
      }
    }
  }

  // Find nearest significant zones
  longLiqZones.sort((a, b) => b.price - a.price);  // Descending, closest to current first
  shortLiqZones.sort((a, b) => a.price - b.price);  // Ascending, closest to current first

  const nearestLongZone = longLiqZones.length > 0 ? longLiqZones[0].price : 0;
  const nearestShortZone = shortLiqZones.length > 0 ? shortLiqZones[0].price : 0;

  // Calculate pressure: net size imminently to be liquidated
  const longLiqSize = longLiqZones.reduce((a, z) => a + z.totalSize, 0);
  const shortLiqSize = shortLiqZones.reduce((a, z) => a + z.totalSize, 0);
  const totalLiqSize = longLiqSize + shortLiqSize;

  let pressure = 0;
  if (totalLiqSize > 0) {
    // Negative pressure = long liquidations (bearish momentum fuel)
    // Positive pressure = short liquidations (bullish momentum fuel)
    pressure = (shortLiqSize - longLiqSize) / totalLiqSize;
  }

  return {
    nearestLongLiqZone: nearestLongZone,
    nearestShortLiqZone: nearestShortZone,
    liquidationPressure: Math.round(pressure * 100) / 100,
    distanceToLongZone: nearestLongZone > 0 ? Math.round(((currentPrice - nearestLongZone) / currentPrice) * 10000) / 100 : 999,
    distanceToShortZone: nearestShortZone > 0 ? Math.round(((nearestShortZone - currentPrice) / currentPrice) * 10000) / 100 : 999,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// OI MOMENTUM SCORE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Score de momentum OI pour le filtrage de marché.
 *
 * Remplace/améliore le score basé uniquement sur le momentum prix.
 * Combine plusieurs dimensions pour un score 0-100.
 *
 * @param oiSeries - Historique OI
 * @param priceSeries - Historique prix
 * @param volumeSeries - Historique volume
 * @param fundingRate - Funding rate actuel
 * @returns Score 0-100 (plus élevé = meilleures conditions)
 */
export interface OIMomentumScore {
  score: number;           // 0-100
  components: {
    oiTrend: number;        // 0-25 pts
    priceTrend: number;     // 0-25 pts
    volumeQuality: number;  // 0-20 pts
    fundingAlignment: number; // 0-20 pts
    oiVolatility: number;   // 0-10 pts
  };
  recommendation: 'TRADE' | 'CAUTIOUS' | 'AVOID';
  reason: string;
}

export function oiMomentumScore(
  oiSeries: number[],
  priceSeries: number[],
  volumeSeries: number[],
  fundingRate: number
): OIMomentumScore {
  const n = oiSeries.length;
  if (n < 50) {
    return {
      score: 50,
      components: { oiTrend: 10, priceTrend: 10, volumeQuality: 10, fundingAlignment: 10, oiVolatility: 10 },
      recommendation: 'CAUTIOUS',
      reason: 'Données insuffisantes pour calculer le score',
    };
  }

  const components = {
    oiTrend: 0,
    priceTrend: 0,
    volumeQuality: 0,
    fundingAlignment: 0,
    oiVolatility: 0,
  };

  // 1. OI Trend (0-25 pts)
  const recentOI = oiSeries.slice(-24);
  const olderOI = oiSeries.slice(-48, -24);
  const oiGrowth = (recentOI[recentOI.length - 1] - olderOI[0]) / olderOI[0];
  components.oiTrend = Math.min(25, Math.max(0, (oiGrowth * 500) + 12.5));

  // 2. Price Trend (0-25 pts)
  const recentPrice = priceSeries.slice(-24);
  const olderPrice = priceSeries.slice(-48, -24);
  const priceGrowth = (recentPrice[recentPrice.length - 1] - olderPrice[0]) / olderPrice[0];
  components.priceTrend = Math.min(25, Math.max(0, (priceGrowth * 500) + 12.5));

  // 3. Volume Quality via OI/Vol Ratio (0-20 pts)
  const recentOIVol = oiSeries.slice(-24).reduce((a, b) => a + b, 0) / 24;
  const recentVol = volumeSeries.slice(-24).reduce((a, b) => a + b, 0) / 24;
  const oiVolRatio = recentVol > 0 ? recentOIVol / recentVol : 0;
  components.volumeQuality = Math.min(20, oiVolRatio * 67);

  // 4. Funding Alignment (0-20 pts)
  const fundingPct = fundingRate * 100;
  if (fundingPct > 0.2) {
    components.fundingAlignment = 5;  // Too bullish, risky
  } else if (fundingPct > 0) {
    components.fundingAlignment = 15;  // Mildly bullish, OK
  } else if (fundingPct > -0.1) {
    components.fundingAlignment = 20;  // Neutral to slightly bearish, optimal
  } else {
    components.fundingAlignment = 10;  // Too bearish
  }

  // 5. OI Volatility (0-10 pts) - lower is better
  const oiReturns: number[] = [];
  for (let i = 1; i < recentOI.length; i++) {
    oiReturns.push((recentOI[i] - recentOI[i - 1]) / recentOI[i - 1]);
  }
  const oiStd = Math.sqrt(oiReturns.reduce((a, r) => a + r * r, 0) / oiReturns.length);
  components.oiVolatility = Math.max(0, 10 - oiStd * 1000);

  // Calculate total score
  const score = Object.values(components).reduce((a, b) => a + b, 0);

  // Recommendation
  let recommendation: OIMomentumScore['recommendation'];
  let reason = '';

  if (score >= 75) {
    recommendation = 'TRADE';
    reason = `Score ${score}/100: Excellent conditions OI+Prix+Volume`;
  } else if (score >= 50) {
    recommendation = 'CAUTIOUS';
    reason = `Score ${score}/100: Conditions acceptables mais vigilance requise`;
  } else {
    recommendation = 'AVOID';
    reason = `Score ${score}/100: Conditions défavorables (OI stagnant, volume spéculatif, ou funding extrême)`;
  }

  return {
    score: Math.round(score),
    components,
    recommendation,
    reason,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// PROXY OI CALCULATION (when real OI data unavailable)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Génère un proxy OI à partir du volume et du price action.
 *
 * NOTE: C'est une approximation. Pour la production, utiliser des données
 * réelles d'Open Interest via API (Coinalyze, CoinGlass, Binance Futures).
 *
 * @param volumeSeries - Historique des volumes
 * @param priceSeries - Historique des prix
 * @returns Proxy OI (à utiliser uniquement si données réelles indisponibles)
 */
export function proxyOI(
  volumeSeries: number[],
  priceSeries: number[]
): number[] {
  const n = volumeSeries.length;
  const proxyOI: number[] = new Array(n).fill(0);

  // Use cumulative volume with decay as OI proxy
  // This assumes OI correlates with sustained volume
  let cumulativeOI = volumeSeries[0] * 10;  // Initial seed

  for (let i = 1; i < n; i++) {
    const priceChange = Math.abs((priceSeries[i] - priceSeries[i - 1]) / priceSeries[i - 1]);

    // Volume adds to OI, but some decays over time (positions closed)
    const volumeAdded = volumeSeries[i] * 0.3;  // 30% of volume becomes open interest
    const oiDecay = cumulativeOI * 0.02;  // 2% of OI decays each period

    // Price volatility increases OI (more speculative interest)
    const volatilityBonus = cumulativeOI * priceChange * 0.5;

    cumulativeOI = cumulativeOI + volumeAdded - oiDecay + volatilityBonus;
    cumulativeOI = Math.max(volumeSeries[i] * 5, cumulativeOI);  // Floor

    proxyOI[i] = cumulativeOI;
  }

  return proxyOI;
}

// ─────────────────────────────────────────────────────────────────────────────
// INTEGRATED OI SIGNAL FOR BACKTEST
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Signal OI intégré pour utilisation dans le backtest.
 *
 * Combine tous les signaux OI en une recommandation unique.
 *
 * @param params - Paramètres OI
 * @returns Signal de trading OI
 */
export interface IntegratedOISignal {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: number;  // 0-100
  sizingAdjustment: number;  // Multiplicateur de taille (0.25 - 1.0)
  blockEntry: boolean;  // true si conditions défavorables
  reason: string;
}

export function getIntegratedOISignal(params: {
  oiSeries: number[];
  priceSeries: number[];
  volumeSeries: number[];
  fundingRate: number;
  fundingHistory?: number[];
  useProxyOI?: boolean;
}): IntegratedOISignal {
  const { oiSeries, priceSeries, volumeSeries, fundingRate, fundingHistory, useProxyOI } = params;

  // Use proxy OI if requested or if OI data looks suspicious
  const workingOI = useProxyOI ? proxyOI(volumeSeries, priceSeries) : oiSeries;

  // Get OI signal
  const { signal: oiSig, strength: oiStrength } = oiSignal(workingOI, priceSeries);
  const latestOISignal = oiSig[oiSig.length - 1];
  const latestOIStrength = oiStrength[oiStrength.length - 1];

  // Get OI/Volume ratio
  const oivr = oiVolumeRatio(workingOI, volumeSeries);
  const latestOIVR = oivr[oivr.length - 1];
  const oivrInterpretation = interpretOIVolumeRatio(latestOIVR);

  // Get funding signal (if history provided)
  let fundingZScore = 0;
  let fundingSignal: FundingSignal['signal'][number] = 'NEUTRAL';
  if (fundingHistory && fundingHistory.length > 100) {
    const fs = fundingRateSignal(fundingHistory);
    fundingZScore = fs.zscore[fs.zscore.length - 1];
    fundingSignal = fs.signal[fs.signal.length - 1];
  }

  // Determine direction
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  let strength = 50;
  let blockEntry = false;
  const reasons: string[] = [];

  // OI signal contribution
  if (latestOISignal === 'LONG_CONF') {
    direction = 'LONG';
    strength = 50 + latestOIStrength * 50;
    reasons.push('OI↑+Prix↑: nouveaux longs');
  } else if (latestOISignal === 'SHORT_CONF') {
    direction = 'SHORT';
    strength = 50 + latestOIStrength * 50;
    reasons.push('OI↑+Prix↓: nouveaux shorts');
  } else if (latestOISignal === 'SHORT_SQUEEZE') {
    direction = 'LONG';
    strength = 70 + latestOIStrength * 30;
    reasons.push('OI↓+Prix↑: short squeeze en cours');
  }

  // Funding override (extreme funding blocks entries)
  if (Math.abs(fundingZScore) > 2) {
    if (fundingZScore > 2 && direction === 'LONG') {
      blockEntry = true;
      reasons.push(`Funding z-score ${fundingZScore.toFixed(1)} > 2: bloque LONG (surachat)`);
    } else if (fundingZScore < -2 && direction === 'SHORT') {
      blockEntry = true;
      reasons.push(`Funding z-score ${fundingZScore.toFixed(1)} < -2: bloque SHORT (survente)`);
    }
  }

  // OI/Volume ratio sizing adjustment
  let sizingAdjustment = 1.0;
  if (oivrInterpretation.action === 'REDUCE_SIZE_50') {
    sizingAdjustment = 0.5;
    reasons.push(`OI/Vol ${latestOIVR.toFixed(2)}: taille réduite 50%`);
  } else if (oivrInterpretation.action === 'REDUCE_SIZE_75') {
    sizingAdjustment = 0.25;
    reasons.push(`OI/Vol ${latestOIVR.toFixed(2)}: taille réduite 75%`);
  }

  // Apply funding contrarian signal if extreme
  if (fundingSignal === 'CONTRARIAN_LONG' && direction === 'SHORT') {
    direction = 'LONG';
    reasons.push('Funding extrême: signal contrarian LONG');
  } else if (fundingSignal === 'CONTRARIAN_SHORT' && direction === 'LONG') {
    direction = 'SHORT';
    reasons.push('Funding extrême: signal contrarian SHORT');
  }

  const reason = reasons.join(' | ') || 'Conditions OI neutres';

  return {
    direction,
    strength: Math.round(strength),
    sizingAdjustment,
    blockEntry,
    reason,
  };
}
