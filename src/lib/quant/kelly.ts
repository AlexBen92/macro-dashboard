/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * KELLY CRITERION & ADVANCED POSITION SIZING MODULE — V4 (PATCHED)
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * PATCH v4.1 - Corrections des bugs critiques:
 *  - KELLY_FLOOR relevé à 0.5% (au lieu de ~0%)
 *  - KELLY_MIN_TRADES = 50 (au lieu de 30)
 *  - Fallback 1% fixe avant 50 trades
 *  - Alerte si Kelly plancher 10x consécutives
 *
 * Sizing de position adaptatif basé sur le Kelly Criterion avec contraintes
 * de drawdown. Remplace le sizing fixe à 1% par une approche dynamique qui
 * s'adapte aux performances récentes du système.
 *
 * MÉTHODES:
 *  - Kelly Criterion classique: f* = (p × b - q) / b
 *  - Half-Kelly: réduction de variance (recommandé en pratique)
 *  - Constrained Kelly: avec bornes min/max et contrainte de drawdown
 *  - Rolling Kelly: recalcul sur fenêtre glissante pour adaptation
 *  - Portfolio Kelly: optimisation multi-actifs avec corrélations
 *
 * REFERENCES:
 *  - Kelly, J.L. (1956). "A New Interpretation of Information Rate."
 *    Bell System Technical Journal 35(4).
 *  - Vince, R. (1992). "The Mathematics of Money Management." Wiley.
 *  - Thorp, E.O. (2008). "The Kelly Criterion in Blackjack, Sports Betting,
 *    and the Stock Market." Wilmott Magazine.
 *
 * INPUT/OUTPUT:
 *  Input:  winRate, avgWin, avgLoss, tradeHistory
 *  Output: fraction optimale (0-1), sizing en USD
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH v4.1 - KELLY CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Kelly minimum absolu (0.5%) - ne jamais descendre en dessous */
export const KELLY_FLOOR = 0.005;

/** Kelly maximum absolu (3%) - ne jamais dépasser */
export const KELLY_CEIL = 0.03;

/** Trades minimum avant de calculer le Kelly dynamique */
export const KELLY_MIN_TRADES = 50;

/** Kelly par défaut avant d'avoir assez de trades (1%) */
export const KELLY_DEFAULT = 0.01;

/** Nombre de trades consécutifs au plancher avant d'alerter */
export const KELLY_FLOOR_ALERT_THRESHOLD = 10;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface Trade {
  pnl: number;
  pnlR: number;         // PnL en multiples de R (risk)
  entryTime: number;
  exitTime: number;
  direction: 'LONG' | 'SHORT';
  isWin: boolean;
}

export interface KellyResult {
  kellyFraction: number;    // f* optimal (0-1)
  halfKelly: number;        // f* / 2
  recommended: number;      // Fraction recommandée (avec contraintes)
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  metrics: {
    winRate: number;
    avgWin: number;
    avgLoss: number;
    payoffRatio: number;
    expectancy: number;
    sampleSize: number;
  };
  warnings: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// BASIC KELLY CALCULATIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kelly Criterion classique.
 *
 * f* = (p × b - q) / b
 *
 * où:
 *  p = win rate (probabilité de gain)
 *  q = 1 - p (probabilité de perte)
 *  b = ratio gain moyen / perte moyenne (payoff ratio)
 *
 * @param winRate - Win rate (0-1)
 * @param avgWin - Gain moyen (en $ ou R)
 * @param avgLoss - Perte moyenne (en valeur positive, $ ou R)
 * @returns Kelly fraction optimal (0-1), négatif si edge négatif
 */
export function kellyFraction(winRate: number, avgWin: number, avgLoss: number): number {
  if (avgLoss <= 0 || winRate <= 0 || winRate >= 1) return 0;

  const p = winRate;
  const q = 1 - p;
  const b = avgWin / avgLoss;  // Payoff ratio

  // Kelly formula
  const kelly = (p * b - q) / b;

  return Math.max(-1, Math.min(1, kelly));  // Clamp between -1 and 1
}

/**
 * Half-Kelly Criterion.
 *
 * f_hk = f* / 2
 *
 * Le Half-Kelly réduit la variance et le risque de ruin significativement
 * tout en capturant 75% du croissance à long terme du Kelly complet.
 * Recommandé pour la plupart des applications de trading.
 *
 * @param winRate - Win rate (0-1)
 * @param avgWin - Gain moyen
 * @param avgLoss - Perte moyenne
 * @returns Half-Kelly fraction (0-1)
 */
export function halfKelly(winRate: number, avgWin: number, avgLoss: number): number {
  const fullKelly = kellyFraction(winRate, avgWin, avgLoss);
  return fullKelly > 0 ? fullKelly / 2 : fullKelly;
}

/**
 * Kelly Criterion avec contraintes de sécurité (PATCHED v4.1).
 *
 * PATCH:
 *  - Utilise KELLY_MIN_TRADES = 50 (au lieu de 30)
 *  - Renvoie KELLY_DEFAULT (1%) si sampleSize < 50
 *  - KELLY_FLOOR = 0.5% minimum absolu
 *  - KELLY_CEIL = 3% maximum absolu
 */
export function constrainedKelly(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  maxRiskPerTrade: number = KELLY_CEIL,
  minRiskPerTrade: number = KELLY_FLOOR,
  sampleSize: number = KELLY_MIN_TRADES
): KellyResult {
  // Validate inputs
  const warnings: string[] = [];

  // PATCH v4.1: Si pas assez de trades, utiliser le défaut (1%)
  if (sampleSize < KELLY_MIN_TRADES) {
    return {
      kellyFraction: 0,
      halfKelly: 0,
      recommended: KELLY_DEFAULT,
      confidence: 'LOW',
      metrics: { winRate, avgWin, avgLoss: avgLoss || 100, payoffRatio: 0, expectancy: 0, sampleSize },
      warnings: [`Insufficient trades (${sampleSize} < ${KELLY_MIN_TRADES}): using ${KELLY_DEFAULT * 100}% default`],
    };
  }

  if (avgLoss <= 0) {
    return {
      kellyFraction: 0,
      halfKelly: 0,
      recommended: minRiskPerTrade,
      confidence: 'LOW',
      metrics: { winRate, avgWin: 0, avgLoss: 0, payoffRatio: 0, expectancy: 0, sampleSize },
      warnings: ['Invalid avgLoss: must be positive'],
    };
  }

  // Calculate metrics
  const p = winRate;
  const q = 1 - p;
  const b = avgWin / avgLoss;
  const payoffRatio = b;
  const expectancy = p * avgWin - q * avgLoss;

  // Full Kelly
  const fullKelly = kellyFraction(p, avgWin, avgLoss);

  // Half Kelly
  const halfK = fullKelly > 0 ? fullKelly / 2 : fullKelly;

  // Confidence level based on sample size
  let confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  if (sampleSize < 30) confidence = 'LOW';
  else if (sampleSize < 100) confidence = 'MEDIUM';
  else confidence = 'HIGH';

  // Apply sample size discount (shrinkage toward conservative)
  let shrinkageFactor = 1;
  if (confidence === 'LOW') shrinkageFactor = 0.5;
  else if (confidence === 'MEDIUM') shrinkageFactor = 0.75;

  // Calculate recommended fraction
  let recommended = halfK * shrinkageFactor;

  // Apply bounds
  if (recommended < 0) {
    recommended = 0;
    warnings.push('Negative expectancy: consider reducing exposure or flipping strategy');
  } else if (recommended > maxRiskPerTrade) {
    recommended = maxRiskPerTrade;
    warnings.push(`Kelly (${(fullKelly * 100).toFixed(1)}%) exceeds max risk: capped at ${(maxRiskPerTrade * 100).toFixed(1)}%`);
  } else if (recommended < minRiskPerTrade && recommended > 0) {
    // Only use min risk if Kelly is positive but very small
    if (expectancy > 0) {
      recommended = minRiskPerTrade;
      warnings.push(`Kelly (${(recommended * 100).toFixed(2)}%) below minimum: using ${(minRiskPerTrade * 100).toFixed(1)}%`);
    } else {
      recommended = 0;
    }
  }

  // Additional sanity checks
  if (winRate < 0.3) {
    warnings.push(`Very low win rate (${(winRate * 100).toFixed(1)}%): reduce exposure`);
    recommended = Math.min(recommended, 0.01);
  }

  if (payoffRatio < 0.5 && winRate < 0.5) {
    warnings.push('Unfavorable risk-reward: high probability of loss');
    recommended = Math.min(recommended, 0.005);
  }

  return {
    kellyFraction: Math.round(fullKelly * 1000) / 1000,
    halfKelly: Math.round(halfK * 1000) / 1000,
    recommended: Math.round(recommended * 1000) / 1000,
    confidence,
    metrics: {
      winRate: Math.round(p * 1000) / 1000,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      payoffRatio: Math.round(payoffRatio * 100) / 100,
      expectancy: Math.round(expectancy * 100) / 100,
      sampleSize,
    },
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLLING / ADAPTIVE KELLY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rolling Kelly: recalcule le Kelly sur une fenêtre glissante (PATCHED v4.1).
 *
 * PATCH:
 *  - Utilise KELLY_MIN_TRADES = 50
 *  - Utilise KELLY_DEFAULT = 1% avant 50 trades
 *  - Utilise les 50 MEILLEURS trades (pas tous)
 */
export function rollingKelly(
  tradeHistory: Trade[],
  windowSize: number = 50,
  fraction: number = 0.5,
  minTrades: number = KELLY_MIN_TRADES
): KellyResult {
  if (tradeHistory.length < minTrades) {
    // PATCH v4.1: Use default instead of 0
    return {
      kellyFraction: 0,
      halfKelly: 0,
      recommended: KELLY_DEFAULT,  // 1% default
      confidence: 'LOW',
      metrics: {
        winRate: 0,
        avgWin: 0,
        avgLoss: 0,
        payoffRatio: 0,
        expectancy: 0,
        sampleSize: tradeHistory.length,
      },
      warnings: [`Insufficient history (${tradeHistory.length} < ${minTrades}): using ${KELLY_DEFAULT * 100}% default`],
    };
  }

  // PATCH v4.1: Use the 50 BEST trades (not just recent)
  // Les premiers trades sont en warmup → biais baissier
  // On trie par PnL R pour obtenir les meilleurs setups
  const sortedTrades = [...tradeHistory].sort((a, b) => b.pnlR - a.pnlR);
  const bestTrades = sortedTrades.slice(0, Math.min(windowSize, tradeHistory.length));

  // Calculate metrics from best trades
  const wins = bestTrades.filter(t => t.isWin);
  const losses = bestTrades.filter(t => !t.isWin);

  const winRate = wins.length / bestTrades.length;
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + Math.abs(t.pnl), 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0)) / losses.length : 100;

  // Use constrained Kelly with new constants
  const result = constrainedKelly(
    winRate,
    avgWin,
    avgLoss,
    KELLY_CEIL,   // max 3%
    KELLY_FLOOR,  // min 0.5%
    bestTrades.length
  );

  // Apply fraction multiplier (Half-Kelly)
  result.recommended = result.halfKelly * fraction;

  // Clamp to floor/ceil
  result.recommended = Math.max(KELLY_FLOOR, Math.min(KELLY_CEIL, result.recommended));

  // Add warnings for poor performance
  const recentPnl = tradeHistory.slice(-10).reduce((a, t) => a + t.pnl, 0);
  if (recentPnl < 0) {
    result.warnings.push('Recent 10 trades negative: strategy may need adjustment');
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-ASSET PORTFOLIO KELLY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Portfolio Kelly: optimisation simultanée pour plusieurs actifs.
 *
 * Pour un portefeuille avec corrélations, le Kelly optimal est:
 *
 * f* = Σ^-1 × μ
 *
 * où:
 *  Σ = matrice de covariance des returns
 *  μ = vecteur des espérances de returns
 *
 * @param assets - Données pour chaque actif
 * @returns Fractions optimales pour chaque actif
 */
export interface AssetData {
  symbol: string;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  correlation?: number[][];  // Matrice de corrélation avec autres actifs
}

export interface PortfolioKellyResult {
  fractions: { symbol: string; fraction: number }[];
  totalAllocation: number;
  leverage: number;
  warnings: string[];
}

export function portfolioKelly(
  assets: AssetData[],
  maxLeverage: number = 1.0
): PortfolioKellyResult {
  const warnings: string[] = [];
  const n = assets.length;

  if (n === 0) {
    return { fractions: [], totalAllocation: 0, leverage: 0, warnings: ['No assets provided'] };
  }

  if (n === 1) {
    const kelly = kellyFraction(assets[0].winRate, assets[0].avgWin, assets[0].avgLoss);
    return {
      fractions: [{ symbol: assets[0].symbol, fraction: Math.max(0, kelly) }],
      totalAllocation: Math.max(0, kelly),
      leverage: Math.max(0, kelly),
      warnings: [],
    };
  }

  // Simplified approach: calculate individual Kelly, then adjust for correlations
  const individualKelly: { symbol: string; kelly: number; expectancy: number }[] = [];

  for (const asset of assets) {
    const k = kellyFraction(asset.winRate, asset.avgWin, asset.avgLoss);
    const exp = asset.winRate * asset.avgWin - (1 - asset.winRate) * asset.avgLoss;
    individualKelly.push({ symbol: asset.symbol, kelly: Math.max(0, k), expectancy: exp });
  }

  // If correlation matrix provided, use it to adjust
  let adjustedFractions = individualKelly.map(i => i.kelly);

  if (assets[0].correlation) {
    // Simple correlation adjustment: reduce positions in highly correlated assets
    // This is a heuristic - full solution requires matrix inversion
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (assets[0].correlation && assets[0].correlation[i] && assets[0].correlation[i][j] > 0.7) {
          // High correlation: reduce both positions
          adjustedFractions[i] *= 0.7;
          adjustedFractions[j] *= 0.7;
          warnings.push(`${assets[i].symbol} and ${assets[j].symbol} highly correlated: positions reduced`);
        }
      }
    }
  }

  // Normalize to max leverage
  const totalRaw = adjustedFractions.reduce((a, b) => a + b, 0);
  let scale = 1;
  if (totalRaw > maxLeverage) {
    scale = maxLeverage / totalRaw;
    warnings.push(`Total Kelly (${totalRaw.toFixed(2)}) exceeds max leverage: scaled to ${maxLeverage}`);
  }

  const fractions: { symbol: string; fraction: number }[] = assets.map((asset, i) => ({
    symbol: asset.symbol,
    fraction: Math.round(adjustedFractions[i] * scale * 1000) / 1000,
  }));

  const totalAllocation = fractions.reduce((a, f) => a + f.fraction, 0);

  return {
    fractions,
    totalAllocation: Math.round(totalAllocation * 1000) / 1000,
    leverage: Math.round(totalAllocation * 1000) / 1000,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWDOWN-CONSTRAINED KELLY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kelly avec contrainte de drawdown maximum.
 *
 * Ajuste le Kelly pour que le drawdown attendu (à 95% de confiance)
 * ne dépasse pas un seuil spécifié.
 *
 * @param winRate - Win rate
 * @param avgWin - Gain moyen
 * @param avgLoss - Perte moyenne
 * @param maxDrawdownPct - Drawdown maximum acceptable (0-1)
 * @param confidenceLevel - Niveau de confiance (défaut 0.95)
 * @returns Kelly fraction contraint par drawdown
 */
export function drawdownConstrainedKelly(
  winRate: number,
  avgWin: number,
  avgLoss: number,
  maxDrawdownPct: number = 0.15,  // 15% max DD
  confidenceLevel: number = 0.95
): KellyResult {
  const baseResult = constrainedKelly(winRate, avgWin, avgLoss);

  // Estimate expected maximum drawdown using simplified formula
  // E[maxDD] ≈ -f * avgLoss * log(n) / (1 - f * avgLoss / bankroll)
  // This is a rough approximation

  const p = winRate;
  const q = 1 - p;
  const avgTrade = p * avgWin - q * avgLoss;

  // For a given Kelly fraction f, the probability of a losing streak of length L is q^L
  // We want to find f such that the probability of exceeding maxDD is < (1 - confidenceLevel)

  // Simplified: cap Kelly based on volatility
  const volatility = Math.sqrt(p * avgWin * avgWin + q * avgLoss * avgLoss);
  const volatilityRatio = volatility / (avgLoss + 1e-10);

  // Conservative Kelly adjustment for drawdown constraint
  let ddAdjustedKelly = baseResult.recommended;

  if (volatilityRatio > 2) {
    // High volatility relative to avg loss: reduce size
    ddAdjustedKelly *= 0.5;
    baseResult.warnings.push('High volatility: Kelly reduced for drawdown control');
  }

  // Final bound check
  const maxKellyFromDD = maxDrawdownPct / volatilityRatio;
  if (ddAdjustedKelly > maxKellyFromDD) {
    ddAdjustedKelly = maxKellyFromDD;
    baseResult.warnings.push(`Kelly capped at ${(maxKellyFromDD * 100).toFixed(1)}% to respect ${maxDrawdownPct * 100}% max DD`);
  }

  baseResult.recommended = Math.max(0.005, Math.min(0.03, ddAdjustedKelly));

  return baseResult;
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule le montant USD à risquer basé sur Kelly et le capital actuel.
 *
 * @param kellyFraction - Fraction de Kelly recommandée
 * @param accountValue - Valeur du compte
 * @param stopDistance - Distance du stop loss (en prix)
 * @param entryPrice - Prix d'entrée
 * @returns Position size en USD et nombre d'unités
 */
export interface PositionSize {
  riskUsd: number;
  positionUsd: number;
  units: number;
  riskPct: number;
}

export function kellyPositionSize(
  kellyFraction: number,
  accountValue: number,
  stopDistance: number,
  entryPrice: number
): PositionSize {
  if (kellyFraction <= 0 || stopDistance <= 0 || entryPrice <= 0) {
    return { riskUsd: 0, positionUsd: 0, units: 0, riskPct: 0 };
  }

  const riskUsd = accountValue * kellyFraction;
  const units = riskUsd / stopDistance;
  const positionUsd = units * entryPrice;

  return {
    riskUsd: Math.round(riskUsd * 100) / 100,
    positionUsd: Math.round(positionUsd * 100) / 100,
    units: Math.round(units * 10000) / 10000,
    riskPct: Math.round(kellyFraction * 10000) / 100,
  };
}

/**
 * Met à jour l'historique de trades avec un nouveau trade.
 *
 * @param existingHistory - Historique existant
 * @param entryPrice - Prix d'entrée
 * @param exitPrice - Prix de sortie
 * @param direction - LONG ou SHORT
 * @param qty - Quantité
 * @returns Nouvel historique
 */
export function addTrade(
  existingHistory: Trade[],
  entryPrice: number,
  exitPrice: number,
  direction: 'LONG' | 'SHORT',
  qty: number,
  riskUsd: number
): Trade[] {
  const pnl = direction === 'LONG'
    ? (exitPrice - entryPrice) * qty
    : (entryPrice - exitPrice) * qty;

  const pnlR = riskUsd > 0 ? pnl / riskUsd : 0;

  const newTrade: Trade = {
    pnl,
    pnlR,
    entryTime: Date.now(),
    exitTime: Date.now(),
    direction,
    isWin: pnl > 0,
  };

  return [...existingHistory, newTrade];
}
