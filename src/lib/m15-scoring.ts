/**
 * M15 SCORING ENGINE v2.0
 * 3-Layer scoring system for scalping:
 * - Layer 1: Hard Filters (news, spread, liquidity, session, chop)
 * - Layer 2: Setup Score (VWAP, funding, OI, volatility, order flow, trend)
 * - Layer 3: Confirmation Score (M5 momentum, reclaim, CVD, structure break)
 *
 * Score approximates P(TP1 before SL) × expected value
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
  // Momentum
  cvd5m?: number;
  cvd15m?: number;
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

// ─── LAYER 2: SETUP SCORE ───

export function computeSetupScore(token: M15TokenData): SetupScore {
  const breakdown = {
    vwap: 0,
    funding: 0,
    oi: 0,
    volatility: 0,
    orderFlow: 0,
    trend: 0,
  };
  const reasons: string[] = [];

  // 1. VWAP score (20%)
  if (token.vwapDist !== undefined) {
    const dist = Math.abs(token.vwapDist);
    if (dist < 0.002) {
      breakdown.vwap = 100;
      reasons.push('✅ Prix proche VWAP');
    } else if (dist < 0.005) {
      breakdown.vwap = 70;
      reasons.push('⚠️ Prix modérément VWAP');
    } else if (dist < 0.01) {
      breakdown.vwap = 40;
      reasons.push('⬜ Prix éloigné VWAP');
    } else {
      breakdown.vwap = 10;
      reasons.push('❌ Prix loin VWAP');
    }
  }

  // 2. Funding edge (25%)
  const fundingEdge = Math.abs(token.fundingRate) * 100 - HL_TAKER_FEE * 100;
  if (fundingEdge >= 0.10) {
    breakdown.funding = 100;
    reasons.push(`✅ Funding edge ${fundingEdge.toFixed(3)}%`);
  } else if (fundingEdge >= 0.05) {
    breakdown.funding = 70;
    reasons.push(`⚠️ Funding edge ${fundingEdge.toFixed(3)}%`);
  } else {
    breakdown.funding = 30;
    reasons.push(`⬜ Funding edge ${fundingEdge.toFixed(3)}%`);
  }

  // 3. OI momentum (15%)
  const oiMomentum = token.oiChange;
  if (Math.abs(oiMomentum) > 0.10) {
    breakdown.oi = 100;
    reasons.push(`✅ OI momentum ${oiMomentum > 0 ? '+' : ''}${(oiMomentum * 100).toFixed(1)}%`);
  } else if (Math.abs(oiMomentum) > 0.05) {
    breakdown.oi = 60;
    reasons.push(`⚠️ OI momentum modéré`);
  } else {
    breakdown.oi = 30;
    reasons.push('⬜ OI stable');
  }

  // 4. Volatility edge (15%)
  const volScore = computeVolatilityScore(token);
  breakdown.volatility = volScore.score;
  reasons.push(...volScore.reasons);

  // 5. Order flow (15%)
  const flowScore = computeOrderFlowScore(token);
  breakdown.orderFlow = flowScore.score;
  reasons.push(...flowScore.reasons);

  // 6. Trend alignment (10%)
  const trendScore = computeTrendScore(token);
  breakdown.trend = trendScore.score;
  reasons.push(...trendScore.reasons);

  // Weighted total
  const total = Math.round(
    breakdown.vwap * SETUP_WEIGHTS.vwap +
    breakdown.funding * SETUP_WEIGHTS.funding +
    breakdown.oi * SETUP_WEIGHTS.oi +
    breakdown.volatility * SETUP_WEIGHTS.volatility +
    breakdown.orderFlow * SETUP_WEIGHTS.orderFlow +
    breakdown.trend * SETUP_WEIGHTS.trend
  );

  return { total, breakdown, reasons };
}

// ─── LAYER 3: CONFIRMATION SCORE ───

export function computeConfirmationScore(token: M15TokenData): ConfirmationScore {
  const breakdown = {
    momentum5m: 0,
    reclaim: 0,
    cvd: 0,
    structureBreak: 0,
    retest: 0,
  };
  const reasons: string[] = [];

  // 1. M5 momentum (30%)
  const mom5m = computeM5Momentum(token);
  breakdown.momentum5m = mom5m.score;
  reasons.push(...mom5m.reasons);

  // 2. Reclaim signal (25%)
  const reclaim = computeReclaimSignal(token);
  breakdown.reclaim = reclaim.score;
  reasons.push(...reclaim.reasons);

  // 3. CVD confirmation (25%)
  const cvd = computeCVDSignal(token);
  breakdown.cvd = cvd.score;
  reasons.push(...cvd.reasons);

  // 4. Structure break (10%)
  const struct = computeStructureBreak(token);
  breakdown.structureBreak = struct.score;
  reasons.push(...struct.reasons);

  // 5. Retest confirmation (10%)
  const retest = computeRetestSignal(token);
  breakdown.retest = retest.score;
  reasons.push(...retest.reasons);

  // Weighted total
  const total = Math.round(
    breakdown.momentum5m * CONFIRMATION_WEIGHTS.momentum5m +
    breakdown.reclaim * CONFIRMATION_WEIGHTS.reclaim +
    breakdown.cvd * CONFIRMATION_WEIGHTS.cvd +
    breakdown.structureBreak * CONFIRMATION_WEIGHTS.structureBreak +
    breakdown.retest * CONFIRMATION_WEIGHTS.retest
  );

  return { total, breakdown, reasons };
}

// ─── HELPER FUNCTIONS ───

function computeChopIndex(token: M15TokenData): number {
  // Proxy: vol24h / (abs(funding) * price * 100)
  const volProxy = token.vol24h / (Math.abs(token.fundingRate) * token.price * 100 + 1);
  return Math.min(100, volProxy / 100000 * 100);
}

function computeVolatilityScore(token: M15TokenData): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // ATR percentile proxy
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

  // Squeeze detection
  if (token.squeezeProb !== undefined) {
    if (token.squeezeProb > 0.7) {
      score += 50;
      reasons.push('✅ Squeeze probable → expansion');
    } else if (token.squeezeProb > 0.4) {
      score += 25;
      reasons.push('⚠️ Compression possible');
    }
  }

  return { score: Math.min(100, score), reasons };
}

function computeOrderFlowScore(token: M15TokenData): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // CVD imbalance
  if (token.cvd15m !== undefined) {
    const cvdPct = token.cvd15m;
    if (Math.abs(cvdPct) > 65) {
      score += 60;
      reasons.push(`✅ CVD ${cvdPct > 50 ? 'bull' : 'bear'} ${Math.abs(cvdPct).toFixed(0)}%`);
    } else if (Math.abs(cvdPct - 50) > 10) {
      score += 30;
      reasons.push('⚠️ CVD modéré');
    } else {
      reasons.push('⬜ CVD neutre');
    }
  }

  // Delta volume
  if (token.deltaVolume !== undefined) {
    if (Math.abs(token.deltaVolume) > 1000000) {
      score += 40;
      reasons.push('✅ Delta volume fort');
    } else if (Math.abs(token.deltaVolume) > 500000) {
      score += 20;
      reasons.push('⚠️ Delta volume moyen');
    }
  }

  return { score: Math.min(100, score), reasons };
}

function computeTrendScore(token: M15TokenData): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // 24h trend + funding alignment
  const trend = token.change24h;
  const funding = token.fundingRate;

  if (trend > 0.5 && funding < -0.0002) {
    score = 100;
    reasons.push('✅ Trend UP + funding LONG alignés');
  } else if (trend < -0.5 && funding > 0.0002) {
    score = 100;
    reasons.push('✅ Trend DOWN + funding SHORT alignés');
  } else if (Math.abs(trend) > 0.3) {
    score = 60;
    reasons.push('⚠️ Trend modéré');
  } else {
    score = 30;
    reasons.push('⬜ Trend faible');
  }

  return { score, reasons };
}

function computeM5Momentum(token: M15TokenData): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Proxy via atr5m and cvd5m
  if (token.atr5m && token.atr5m > 0.002) {
    return {
      score: 70,
      reasons: ['✅ Momentum M5 actif'],
    };
  }

  return {
    score: 40,
    reasons: ['⚠️ Momentum M5 faible'],
  };
}

function computeReclaimSignal(token: M15TokenData): { score: number; reasons: string[] } {
  // Proxy: price crossed VWAP recently and holding
  if (token.vwapDist !== undefined && Math.abs(token.vwapDist) < 0.003) {
    return {
      score: 80,
      reasons: ['✅ Reclaim VWAP probable'],
    };
  }

  return {
    score: 40,
    reasons: ['⬜ Pas de reclaim signal'],
  };
}

function computeCVDSignal(token: M15TokenData): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  if (token.cvd5m !== undefined) {
    const cvd = token.cvd5m;
    if (cvd > 60) {
      return { score: 100, reasons: ['✅ CVD 5m bull fort'] };
    }
    if (cvd < 40) {
      return { score: 100, reasons: ['✅ CVD 5m bear fort'] };
    }
    if (Math.abs(cvd - 50) > 10) {
      return { score: 60, reasons: ['⚠️ CVD 5m modéré'] };
    }
  }

  return { score: 30, reasons: ['⬜ CVD 5m neutre'] };
}

function computeStructureBreak(token: M15TokenData): { score: number; reasons: string[] } {
  // Proxy: 24h change > 1% with volume confirmation
  if (Math.abs(token.change24h) > 1 && token.vol24h > 10_000_000) {
    return {
      score: 80,
      reasons: ['✅ Structure break probable'],
    };
  }

  return {
    score: 40,
    reasons: ['⬜ Pas de structure break'],
  };
}

function computeRetestSignal(token: M15TokenData): { score: number; reasons: string[] } {
  // Proxy: price consolidating near level
  if (token.vwapDist !== undefined && Math.abs(token.vwapDist) < 0.005) {
    return {
      score: 70,
      reasons: ['✅ Retest/VWAP contact'],
    };
  }

  return {
    score: 40,
    reasons: ['⬜ Pas de retest'],
  };
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
