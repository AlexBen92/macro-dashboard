/**
 * MACRO ADVANCED INDICATORS
 * Indicateurs macroéconomiques avancés pour trading crypto
 *
 * Basé sur la littérature académique:
 * - Estrella & Mishkin (1998) - Yield Curve as Predictor
 * - Liu et al. (2024) - Macro Regime Detection
 * - Benigno & Rosa (2023) - Macro Event Filter
 */

// ============================================================
// YIELD CURVE ANALYSIS
// ============================================================

interface YieldCurveData {
  yield10y: number;      // US 10Y Treasury Yield
  yield2y: number;       // US 2Y Treasury Yield
  yield3m: number;       // US 3M Treasury Yield
  spread10y2y: number;   // 10Y-2Y Spread
  spread10y3m: number;   // 10Y-3M Spread (classic)
  inversion: boolean;    // True si 10Y-3M < 0
  recessionRisk: 'low' | 'moderate' | 'high' | 'severe';
}

/**
 * Calcule l'analyse de la Yield Curve
 * Un spread 10Y-3M négatif est un signal fort de récession (12-18 mois)
 */
export function analyzeYieldCurve(data: {
  yield10y?: number;
  yield2y?: number;
  yield3m?: number;
}): YieldCurveData {
  const y10 = data.yield10y ?? 4.0;
  const y2 = data.yield2y ?? 4.2;
  const y3m = data.yield3m ?? 5.2;

  const spread10y2y = y10 - y2;
  const spread10y3m = y10 - y3m;
  const inversion = spread10y3m < -0.1;

  // Classification du risque de récession
  let recessionRisk: YieldCurveData['recessionRisk'] = 'low';
  if (spread10y3m < -0.5) {
    recessionRisk = 'severe';
  } else if (spread10y3m < -0.25) {
    recessionRisk = 'high';
  } else if (spread10y3m < 0) {
    recessionRisk = 'moderate';
  }

  return {
    yield10y: y10,
    yield2y: y2,
    yield3m: y3m,
    spread10y2y,
    spread10y3m,
    inversion,
    recessionRisk,
  };
}

// ============================================================
// DXY MOMENTUM & TREND
// ============================================================

interface DXYAnalysis {
  value: number;
  sma20: number;
  sma50: number;
  momentum: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  cryptoImpact: 'positive' | 'negative' | 'neutral';
}

/**
 * Analyse le DXY et son impact sur crypto
 * DXY ↑ → Crypto ↓ (correlation négative)
 */
export function analyzeDXY(history: number[]): DXYAnalysis {
  if (history.length < 50) {
    const current = history[0] ?? 105;
    return { value: current, sma20: current, sma50: current, momentum: 0, trend: 'neutral', cryptoImpact: 'neutral' };
  }

  const current = history[history.length - 1];
  const sma20 = history.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const sma50 = history.slice(-50).reduce((a, b) => a + b, 0) / 50;

  const momentum = ((current - sma20) / sma20) * 100;

  let trend: DXYAnalysis['trend'] = 'neutral';
  if (current > sma20 && sma20 > sma50) trend = 'bullish';
  else if (current < sma20 && sma20 < sma50) trend = 'bearish';

  // DDX bullish → crypto bearish (inverse)
  let cryptoImpact: DXYAnalysis['cryptoImpact'] = 'neutral';
  if (trend === 'bullish') cryptoImpact = 'negative';
  else if (trend === 'bearish') cryptoImpact = 'positive';

  return {
    value: current,
    sma20,
    sma50,
    momentum,
    trend,
    cryptoImpact,
  };
}

// ============================================================
// MACRO REGIME DETECTION (HMM-style)
// ============================================================

interface MacroRegime {
  regime: 'bull_market' | 'bear_market' | 'transitional' | 'ranging';
  confidence: number;
  factors: {
    vix: number;
    trend: number;
    momentum: number;
    breadth: number;
  };
  description: string;
}

/**
 * Détecte le régime macro actuel
 * Combine VIX, trend, momentum et market breadth
 */
export function detectMacroRegime(data: {
  vix?: number;
  btcTrend?: number;  // -100 to +100
  btcMomentum?: number;
  marketBreadth?: number;  // % of coins above SMA200
}): MacroRegime {
  const vix = data.vix ?? 20;
  const trend = data.btcTrend ?? 0;
  const momentum = data.btcMomentum ?? 0;
  const breadth = data.marketBreadth ?? 50;

  const factors = { vix, trend, momentum, breadth };
  let regime: MacroRegime['regime'] = 'ranging';
  let confidence = 0.5;
  let description = 'Marché sans direction claire';

  // Bear Market Detection
  if (vix > 30 && trend < -30 && breadth < 20) {
    regime = 'bear_market';
    confidence = Math.min(0.9, 0.5 + (vix - 30) / 40 + Math.abs(trend) / 100);
    description = 'Marché baissier confirmé: VIX élevé, trend négatif, breadth faible';
  }
  // Bull Market Detection
  else if (vix < 20 && trend > 30 && breadth > 70) {
    regime = 'bull_market';
    confidence = Math.min(0.9, 0.5 + (25 - vix) / 50 + trend / 100);
    description = 'Marché haussier confirmé: VIX faible, trend positif, breadth fort';
  }
  // Transitional (high VIX, unclear trend)
  else if (vix > 25 && Math.abs(trend) < 20) {
    regime = 'transitional';
    confidence = 0.6;
    description = 'Transition de régime: VIX élevé, trend incertain';
  }
  // Ranging
  else {
    regime = 'ranging';
    confidence = 0.5;
    description = 'Marché en range: attendre direction';
  }

  return { regime, confidence, factors, description };
}

// ============================================================
// REAL INTEREST RATES
// ============================================================

interface RealRateAnalysis {
  nominalRate: number;    // US 10Y Yield
  inflation: number;      // CPI YoY
  realRate: number;       // nominal - inflation
  cryptoImplication: 'positive' | 'negative' | 'neutral';
  description: string;
}

/**
 * Calcule le taux d'intérêt réel et son implication pour crypto
 * Real Rate ↓ → Crypto ↑ (search for yield)
 */
export function analyzeRealRates(data: {
  yield10y?: number;
  cpi?: number;
}): RealRateAnalysis {
  const nominal = data.yield10y ?? 4.0;
  const inflation = data.cpi ?? 3.0;
  const realRate = nominal - inflation;

  let cryptoImplication: RealRateAnalysis['cryptoImplication'] = 'neutral';
  let description = '';

  if (realRate < 0) {
    cryptoImplication = 'positive';
    description = 'Taux réels négatifs: favorable pour crypto (search for yield)';
  } else if (realRate < 1) {
    cryptoImplication = 'positive';
    description = 'Taux réels faibles: modérément favorable pour crypto';
  } else if (realRate < 2.5) {
    cryptoImplication = 'neutral';
    description = 'Taux réels modérés: impact neutre sur crypto';
  } else {
    cryptoImplication = 'negative';
    description = 'Taux réels élevés: défavorable pour crypto (opportunity cost)';
  }

  return {
    nominalRate: nominal,
    inflation,
    realRate,
    cryptoImplication,
    description,
  };
}

// ============================================================
// MACRO EVENT FILTER
// ============================================================

interface MacroEvent {
  name: string;
  date: Date;
  hoursUntil: number;
  impact: 'high' | 'medium' | 'low';
  category: 'fomc' | 'cpi' | 'nfp' | 'earnings' | 'other';
}

interface EventFilterResult {
  tradeStatus: 'TRADE_NORMAL' | 'TRADE_REDUCED' | 'NO_TRADE';
  nextEvent: MacroEvent | null;
  reason: string;
}

/**
 * Filtre de trading basé sur les événements macro
 * Basé sur Benigno & Rosa (2023)
 */
export function applyEventFilter(
  events: MacroEvent[],
  currentHours: number = 0
): EventFilterResult {
  const upcomingEvents = events
    .filter(e => e.hoursUntil > 0 && e.hoursUntil < 168) // 7 days
    .sort((a, b) => a.hoursUntil - b.hoursUntil);

  const nextEvent = upcomingEvents[0] ?? null;

  if (!nextEvent) {
    return {
      tradeStatus: 'TRADE_NORMAL',
      nextEvent: null,
      reason: 'Aucun événement macro imminent',
    };
  }

  const hoursUntil = nextEvent.hoursUntil;
  const impact = nextEvent.impact;

  // High impact event < 24h: NO TRADE
  if (impact === 'high' && hoursUntil < 24) {
    return {
      tradeStatus: 'NO_TRADE',
      nextEvent,
      reason: `Événement high impact dans ${Math.floor(hoursUntil)}h: ${nextEvent.name}`,
    };
  }

  // High impact event < 48h: REDUCE
  if (impact === 'high' && hoursUntil < 48) {
    return {
      tradeStatus: 'TRADE_REDUCED',
      nextEvent,
      reason: `Événement high impact dans ${Math.floor(hoursUntil)}h: taille ÷2`,
    };
  }

  // Medium impact < 12h: REDUCE
  if (impact === 'medium' && hoursUntil < 12) {
    return {
      tradeStatus: 'TRADE_REDUCED',
      nextEvent,
      reason: `Événement medium impact dans ${Math.floor(hoursUntil)}h`,
    };
  }

  return {
    tradeStatus: 'TRADE_NORMAL',
    nextEvent,
    reason: `Prochain: ${nextEvent.name} dans ${Math.floor(hoursUntil)}h`,
  };
}

// ============================================================
// COMPOSITE MACRO SCORE
// ============================================================

interface MacroCompositeScore {
  score: number;           // -100 to +100
  signal: 'long' | 'short' | 'neutral';
  confidence: number;
  breakdown: {
    yieldCurve: number;    // -20 to +20
    dxy: number;           // -20 to +20
    regime: number;        // -30 to +30
    realRates: number;     // -20 to +20
    eventFilter: number;   // -10 to +10
  };
}

/**
 * Score composite macro pour trading crypto
 */
export function computeMacroComposite(data: {
  yieldCurve: YieldCurveData;
  dxy: DXYAnalysis;
  regime: MacroRegime;
  realRates: RealRateAnalysis;
  eventFilter: EventFilterResult;
}): MacroCompositeScore {
  let score = 0;

  // Yield Curve: inversion positive for crypto (liquidity)
  const yieldScore = data.yieldCurve.inversion ? 15 : -5;
  score += yieldScore;

  // DXY: bearish DXY positive for crypto
  const dxyScore = data.dxy.trend === 'bearish' ? 15 :
                   data.dxy.trend === 'bullish' ? -15 : 0;
  score += dxyScore;

  // Regime: bull market positive, bear negative
  const regimeScore = data.regime.regime === 'bull_market' ? 25 :
                      data.regime.regime === 'bear_market' ? -25 : 0;
  score += regimeScore * data.regime.confidence;

  // Real Rates: negative rates positive for crypto
  const realRateScore = data.realRates.cryptoImplication === 'positive' ? 15 :
                       data.realRates.cryptoImplication === 'negative' ? -15 : 0;
  score += realRateScore;

  // Event Filter: reduce score if caution
  const eventScore = data.eventFilter.tradeStatus === 'NO_TRADE' ? -50 :
                    data.eventFilter.tradeStatus === 'TRADE_REDUCED' ? -20 : 0;
  score += eventScore;

  const breakdown = {
    yieldCurve: yieldScore,
    dxy: dxyScore,
    regime: regimeScore * data.regime.confidence,
    realRates: realRateScore,
    eventFilter: eventScore,
  };

  const confidence = data.regime.confidence;

  let signal: MacroCompositeScore['signal'] = 'neutral';
  if (score > 25) signal = 'long';
  else if (score < -25) signal = 'short';

  return {
    score: Math.max(-100, Math.min(100, score)),
    signal,
    confidence,
    breakdown,
  };
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Crée un événement macro depuis données API
 */
export function createMacroEvent(raw: any): MacroEvent {
  const now = Date.now();
  const eventDate = new Date(raw.date || raw.time);

  return {
    name: raw.name || 'Unknown Event',
    date: eventDate,
    hoursUntil: (eventDate.getTime() - now) / 3600000,
    impact: raw.impact || 'medium',
    category: raw.category || 'other',
  };
}

/**
 * Formate le score pour affichage
 */
export function formatMacroScore(score: MacroCompositeScore): {
  label: string;
  color: string;
  icon: string;
} {
  if (score.signal === 'long') {
    return {
      label: 'BULLISH',
      color: 'text-green-400',
      icon: '📈',
    };
  } else if (score.signal === 'short') {
    return {
      label: 'BEARISH',
      color: 'text-red-400',
      icon: '📉',
    };
  }
  return {
    label: 'NEUTRAL',
    color: 'text-yellow-400',
    icon: '➡️',
  };
}
