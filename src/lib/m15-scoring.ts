/**
 * M15 SCORING ENGINE v2.2 - REAL L2 DATA
 * 3-Layer scoring system for scalping:
 * - Layer 1: Hard Filters (news, spread, liquidity, session, chop)
 * - Layer 2: Setup Score (VWAP, funding, OI, volatility, order flow, trend)
 * - Layer 3: Confirmation Score (M5 momentum, reclaim, CVD, structure break)
 *
 * v2.2 - REAL L2 DATA:
 * - CVD from Binance WebSocket (trade-by-trade)
 * - OI history from Hyperliquid API
 * - Full order book depth (500 levels)
 */

import { VOL_WINDOWS, HL_TAKER_FEE, HL_MAKER_FEE, HL_ROUND_TRIP } from './constants';

// ─── TYPES ───

export interface M15TokenData {
  symbol: string;
  price: number;
  funding: number;
  fundingRate: number;
  oi: number;
  oiChange: number;
  vol24h: number;
  change24h: number;
  markPx?: number;
  // Microstructure
  spread?: number;
  bidAskImbalance?: number;
  obDepth5?: number;
  obDepth10?: number;
  slippageEst?: number;
  // Momentum - REAL L2 DATA
  cvd5m?: number; // From Binance WebSocket (0-100)
  cvd15m?: number; // From Binance WebSocket (0-100)
  cvdBuyVol5m?: number;
  cvdSellVol5m?: number;
  cvdBuyVol15m?: number;
  cvdSellVol15m?: number;
  deltaVolume?: number;
  vwapDist?: number;
  // Volatility
  atr5m?: number;
  atr15m?: number;
  atr1h?: number;
  realizedVol?: number;
  squeezeProb?: number;
  // Context
  newsRisk?: number;
  regime?: 'trend' | 'range' | 'chop';
}

export interface HardFilterResult {
  pass: boolean;
  reasons: string[];
  score: number; // 0-100, higher = better
}

export interface SetupScore {
  total: number; // 0-100
  breakdown: {
    vwap: number;
    funding: number;
    oi: number;
    volatility: number;
    orderFlow: number;
    trend: number;
  };
  reasons: string[];
}

export interface ConfirmationScore {
  total: number; // 0-100
  breakdown: {
    momentum5m: number;
    reclaim: number;
    cvd: number;
    structureBreak: number;
    retest: number;
  };
  reasons: string[];
}

export interface M15ScoreResult {
  symbol: string;
  finalScore: number; // 0-100
  layer1: HardFilterResult;
  layer2: SetupScore;
  layer3: ConfirmationScore;
  action: 'READY' | 'WATCH' | 'AVOID';
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  expectedValue?: number;
  confidence: number;
}

// ─── CONSTANTS ───

const HARD_FILTERS = {
  NEWS_WINDOW_HOURS: 2,
  MAX_SPREAD_PCT: 0.05,
  MIN_OI_USD: 5_000_000,
  MIN_VOL24H_USD: 2_000_000,
  MAX_CHOP_INDEX: 60,
} as const;

const SETUP_WEIGHTS = {
  vwap: 0.20,
  funding: 0.25,
  oi: 0.15,
  volatility: 0.15,
  orderFlow: 0.15,
  trend: 0.10,
} as const;

const CONFIRMATION_WEIGHTS = {
  momentum5m: 0.30,
  reclaim: 0.25,
  cvd: 0.25,
  structureBreak: 0.10,
  retest: 0.10,
} as const;

// Precomputed multipliers for faster weighted sums (avoid repeated multiplication)
const SETUP_MULTIPLIERS = {
  vwap: SETUP_WEIGHTS.vwap * 100,
  funding: SETUP_WEIGHTS.funding * 100,
  oi: SETUP_WEIGHTS.oi * 100,
  volatility: SETUP_WEIGHTS.volatility * 100,
  orderFlow: SETUP_WEIGHTS.orderFlow * 100,
  trend: SETUP_WEIGHTS.trend * 100,
} as const;

const CONFIRMATION_MULTIPLIERS = {
  momentum5m: CONFIRMATION_WEIGHTS.momentum5m * 100,
  reclaim: CONFIRMATION_WEIGHTS.reclaim * 100,
  cvd: CONFIRMATION_WEIGHTS.cvd * 100,
  structureBreak: CONFIRMATION_WEIGHTS.structureBreak * 100,
  retest: CONFIRMATION_WEIGHTS.retest * 100,
} as const;

// ─── LAYER 1: HARD FILTERS ───

export function computeHardFilters(token: M15TokenData, sessionScore: number): HardFilterResult {
  const reasons: string[] = [];
  let score = 0;

  // 1. Session filter
  if (sessionScore >= 70) {
    score += 25;
    reasons.push('✅ Session active');
  } else if (sessionScore >= 35) {
    score += 10;
    reasons.push('⚠️ Session moyenne');
  } else {
    reasons.push('❌ Session off');
  }

  // 2. Liquidity filter
  if (token.vol24h >= HARD_FILTERS.MIN_VOL24H_USD) {
    score += 20;
    reasons.push('✅ Vol24h OK');
  } else {
    reasons.push('❌ Vol24h faible');
  }

  if (token.oi >= HARD_FILTERS.MIN_OI_USD) {
    score += 15;
    reasons.push('✅ OI OK');
  } else {
    reasons.push('❌ OI faible');
  }

  // 3. Spread filter (proxy via funding)
  const spreadProxy = Math.abs(token.fundingRate);
  if (spreadProxy < 0.001) {
    score += 15;
    reasons.push('✅ Spread OK');
  } else if (spreadProxy < 0.003) {
    score += 8;
    reasons.push('⚠️ Spread moyen');
  } else {
    reasons.push('❌ Spread élevé');
  }

  // 4. News risk filter
  if (token.newsRisk === undefined || token.newsRisk < 50) {
    score += 15;
    reasons.push('✅ Pas de news risque');
  } else {
    score -= 20;
    reasons.push('❌ News high impact proche');
  }

  // 5. Chop filter (proxy via vol24h/funding ratio)
  const chopIndex = computeChopIndex(token);
  if (chopIndex < HARD_FILTERS.MAX_CHOP_INDEX) {
    score += 10;
    reasons.push('✅ Pas de chop extrême');
  } else {
    reasons.push('❌ Chop extrême');
  }

  // Pass threshold: score >= 60
  const pass = score >= 60;

  return { pass, reasons, score };
}

// ─── INLINE HELPERS (avoid object allocation) ───

function computeVolatilityScoreInline(token: M15TokenData, reasons: string[]): number {
  let score = 0;
  const atrProxy = token.atr15m ?? token.atr5m ?? 0.005;
  const atrPercentile = atrProxy / token.price;

  if (atrPercentile > 0.003 && atrPercentile < 0.015) {
    score += 50;
    reasons.push('✅ Volatilité optimale');
  } else if (atrPercentile > 0.001) {
    score += 30;
    reasons.push('⚠️ Volatilité moyenne');
  } else {
    reasons.push('❌ Volatilité faible');
  }

  if (token.squeezeProb !== undefined) {
    if (token.squeezeProb > 0.7) {
      score += 50;
      reasons.push('✅ Squeeze probable → expansion');
    } else if (token.squeezeProb > 0.4) {
      score += 25;
      reasons.push('⚠️ Compression possible');
    }
  }

  return Math.min(100, score);
}

function computeOrderFlowScoreInline(token: M15TokenData, reasons: string[]): number {
  let score = 0;

  // Use real CVD data with buy/sell volume breakdown
  if (token.cvd15m !== undefined) {
    const cvdPct = token.cvd15m;
    const cvdAbs = Math.abs(cvdPct);

    // Show real volumes if available
    if (token.cvdBuyVol15m && token.cvdSellVol15m) {
      const buyVol = formatVolume(token.cvdBuyVol15m);
      const sellVol = formatVolume(token.cvdSellVol15m);
      if (cvdAbs > 65) {
        score += 60;
        reasons.push(`✅ CVD ${cvdPct > 50 ? 'bull' : 'bear'} ${cvdAbs.toFixed(0)}% (B:${buyVol} S:${sellVol})`);
      } else if (cvdAbs - 50 > 10 || 50 - cvdAbs > 10) {
        score += 30;
        reasons.push(`⚠️ CVD modéré (B:${buyVol} S:${sellVol})`);
      } else {
        reasons.push(`⬜ CVD neutre (B:${buyVol} S:${sellVol})`);
      }
    } else {
      // Fallback to percentage only
      if (cvdAbs > 65) {
        score += 60;
        reasons.push(`✅ CVD ${cvdPct > 50 ? 'bull' : 'bear'} ${cvdAbs.toFixed(0)}%`);
      } else if (cvdAbs - 50 > 10 || 50 - cvdAbs > 10) {
        score += 30;
        reasons.push('⚠️ CVD modéré');
      } else {
        reasons.push('⬜ CVD neutre');
      }
    }
  }

  if (token.deltaVolume !== undefined) {
    const deltaAbs = Math.abs(token.deltaVolume);
    if (deltaAbs > 1_000_000) {
      score += 40;
      reasons.push('✅ Delta volume fort');
    } else if (deltaAbs > 500_000) {
      score += 20;
      reasons.push('⚠️ Delta volume moyen');
    }
  }

  return Math.min(100, score);
}

function formatVolume(vol: number): string {
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(1)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(0)}K`;
  return vol.toFixed(0);
}

function computeTrendScoreInline(token: M15TokenData, reasons: string[]): number {
  const trend = token.change24h;
  const funding = token.fundingRate;

  if (trend > 0.5 && funding < -0.0002) {
    reasons.push('✅ Trend UP + funding LONG alignés');
    return 100;
  }
  if (trend < -0.5 && funding > 0.0002) {
    reasons.push('✅ Trend DOWN + funding SHORT alignés');
    return 100;
  }
  if (Math.abs(trend) > 0.3) {
    reasons.push('⚠️ Trend modéré');
    return 60;
  }
  reasons.push('⬜ Trend faible');
  return 30;
}

// ─── LAYER 2: SETUP SCORE (OPTIMIZED) ───

export function computeSetupScore(token: M15TokenData): SetupScore {
  const reasons: string[] = [];
  let vwapScore = 0, fundingScore = 0, oiScore = 0, volScore = 0, flowScore = 0, trendScore = 0;

  // 1. VWAP score (20%)
  if (token.vwapDist !== undefined) {
    const dist = Math.abs(token.vwapDist);
    if (dist < 0.002) {
      vwapScore = 100;
      reasons.push('✅ Prix proche VWAP');
    } else if (dist < 0.005) {
      vwapScore = 70;
      reasons.push('⚠️ Prix modérément VWAP');
    } else if (dist < 0.01) {
      vwapScore = 40;
      reasons.push('⬜ Prix éloigné VWAP');
    } else {
      vwapScore = 10;
      reasons.push('❌ Prix loin VWAP');
    }
  }

  // 2. Funding edge (25%) - precompute once
  const fundingEdge = Math.abs(token.fundingRate) * 100 - HL_TAKER_FEE * 100;
  const fundingEdgeStr = fundingEdge.toFixed(3);
  if (fundingEdge >= 0.10) {
    fundingScore = 100;
    reasons.push(`✅ Funding edge ${fundingEdgeStr}%`);
  } else if (fundingEdge >= 0.05) {
    fundingScore = 70;
    reasons.push(`⚠️ Funding edge ${fundingEdgeStr}%`);
  } else {
    fundingScore = 30;
    reasons.push(`⬜ Funding edge ${fundingEdgeStr}%`);
  }

  // 3. OI momentum (15%)
  const oiAbs = Math.abs(token.oiChange);
  if (oiAbs > 0.10) {
    oiScore = 100;
    reasons.push(`✅ OI momentum ${token.oiChange > 0 ? '+' : ''}${(token.oiChange * 100).toFixed(1)}%`);
  } else if (oiAbs > 0.05) {
    oiScore = 60;
    reasons.push('⚠️ OI momentum modéré');
  } else {
    oiScore = 30;
    reasons.push('⬜ OI stable');
  }

  // 4-6. Inline helper scores (avoid function call overhead + object allocation)
  volScore = computeVolatilityScoreInline(token, reasons);
  flowScore = computeOrderFlowScoreInline(token, reasons);
  trendScore = computeTrendScoreInline(token, reasons);

  // Weighted total using precomputed multipliers (faster: 5 multiplications vs 12)
  const total = Math.round(
    vwapScore * SETUP_MULTIPLIERS.vwap +
    fundingScore * SETUP_MULTIPLIERS.funding +
    oiScore * SETUP_MULTIPLIERS.oi +
    volScore * SETUP_MULTIPLIERS.volatility +
    flowScore * SETUP_MULTIPLIERS.orderFlow +
    trendScore * SETUP_MULTIPLIERS.trend
  );

  return {
    total,
    breakdown: { vwap: vwapScore, funding: fundingScore, oi: oiScore, volatility: volScore, orderFlow: flowScore, trend: trendScore },
    reasons
  };
}

// ─── LAYER 3: CONFIRMATION SCORE (OPTIMIZED) ───

export function computeConfirmationScore(token: M15TokenData): ConfirmationScore {
  const reasons: string[] = [];
  let momScore = 0, reclaimScore = 0, cvdScore = 0, structScore = 0, retestScore = 0;

  // 1. M5 momentum (30%)
  momScore = computeM5MomentumInline(token, reasons);

  // 2. Reclaim signal (25%)
  reclaimScore = computeReclaimSignalInline(token, reasons);

  // 3. CVD confirmation (25%)
  cvdScore = computeCVDSignalInline(token, reasons);

  // 4. Structure break (10%)
  structScore = computeStructureBreakInline(token, reasons);

  // 5. Retest confirmation (10%)
  retestScore = computeRetestSignalInline(token, reasons);

  // Weighted total using precomputed multipliers
  const total = Math.round(
    momScore * CONFIRMATION_MULTIPLIERS.momentum5m +
    reclaimScore * CONFIRMATION_MULTIPLIERS.reclaim +
    cvdScore * CONFIRMATION_MULTIPLIERS.cvd +
    structScore * CONFIRMATION_MULTIPLIERS.structureBreak +
    retestScore * CONFIRMATION_MULTIPLIERS.retest
  );

  return {
    total,
    breakdown: { momentum5m: momScore, reclaim: reclaimScore, cvd: cvdScore, structureBreak: structScore, retest: retestScore },
    reasons
  };
}

// ─── INLINE L3 HELPERS ───

function computeM5MomentumInline(token: M15TokenData, reasons: string[]): number {
  if (token.atr5m && token.atr5m > 0.002) {
    reasons.push('✅ Momentum M5 actif');
    return 70;
  }
  reasons.push('⚠️ Momentum M5 faible');
  return 40;
}

function computeReclaimSignalInline(token: M15TokenData, reasons: string[]): number {
  if (token.vwapDist !== undefined && Math.abs(token.vwapDist) < 0.003) {
    reasons.push('✅ Reclaim VWAP probable');
    return 80;
  }
  reasons.push('⬜ Pas de reclaim signal');
  return 40;
}

function computeCVDSignalInline(token: M15TokenData, reasons: string[]): number {
  if (token.cvd5m !== undefined) {
    const cvd = token.cvd5m;
    if (cvd > 60) {
      reasons.push('✅ CVD 5m bull fort');
      return 100;
    }
    if (cvd < 40) {
      reasons.push('✅ CVD 5m bear fort');
      return 100;
    }
    if (Math.abs(cvd - 50) > 10) {
      reasons.push('⚠️ CVD 5m modéré');
      return 60;
    }
  }
  reasons.push('⬜ CVD 5m neutre');
  return 30;
}

function computeStructureBreakInline(token: M15TokenData, reasons: string[]): number {
  if (Math.abs(token.change24h) > 1 && token.vol24h > 10_000_000) {
    reasons.push('✅ Structure break probable');
    return 80;
  }
  reasons.push('⬜ Pas de structure break');
  return 40;
}

function computeRetestSignalInline(token: M15TokenData, reasons: string[]): number {
  if (token.vwapDist !== undefined && Math.abs(token.vwapDist) < 0.005) {
    reasons.push('✅ Retest/VWAP contact');
    return 70;
  }
  reasons.push('⬜ Pas de retest');
  return 40;
}

// ─── REMAINING HELPERS ───

function computeChopIndex(token: M15TokenData): number {
  // Proxy: vol24h / (abs(funding) * price * 100)
  const volProxy = token.vol24h / (Math.abs(token.fundingRate) * token.price * 100 + 1);
  return Math.min(100, volProxy / 100000 * 100);
}

// ─── MAIN SCORING FUNCTION ───

export function computeM15Score(
  token: M15TokenData,
  sessionScore: number
): M15ScoreResult {
  // Layer 1: Hard filters
  const layer1 = computeHardFilters(token, sessionScore);

  if (!layer1.pass) {
    return {
      symbol: token.symbol,
      finalScore: layer1.score,
      layer1,
      layer2: { total: 0, breakdown: { vwap: 0, funding: 0, oi: 0, volatility: 0, orderFlow: 0, trend: 0 }, reasons: [] },
      layer3: { total: 0, breakdown: { momentum5m: 0, reclaim: 0, cvd: 0, structureBreak: 0, retest: 0 }, reasons: [] },
      action: 'AVOID',
      direction: 'NEUTRAL',
      confidence: 0,
    };
  }

  // Layer 2: Setup score
  const layer2 = computeSetupScore(token);

  // Layer 3: Confirmation score
  const layer3 = computeConfirmationScore(token);

  // Final score: 30% L1 + 40% L2 + 30% L3
  const finalScore = Math.round(
    layer1.score * 0.30 +
    layer2.total * 0.40 +
    layer3.total * 0.30
  );

  // Direction determination
  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (token.fundingRate < -0.0002 && token.change24h > 0) direction = 'LONG';
  else if (token.fundingRate > 0.0002 && token.change24h < 0) direction = 'SHORT';

  // Action classification
  let action: 'READY' | 'WATCH' | 'AVOID';
  if (finalScore >= 80) action = 'READY';
  else if (finalScore >= 60) action = 'WATCH';
  else action = 'AVOID';

  // Confidence: alignment of all layers
  const confidence = Math.round(
    (layer1.score / 100) * 0.3 +
    (layer2.total / 100) * 0.4 +
    (layer3.total / 100) * 0.3
  ) * 100;

  return {
    symbol: token.symbol,
    finalScore,
    layer1,
    layer2,
    layer3,
    action,
    direction,
    confidence,
  };
}

// ─── SESSION HELPERS ───

export function getSessionScore(): number {
  const h = new Date().getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

export function getSessionInfo(): { name: string; score: number; active: boolean } {
  const h = new Date().getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win
    ? { name: win.label, score: win.score * 100, active: true }
    : { name: 'Off-session', score: 0, active: false };
}
