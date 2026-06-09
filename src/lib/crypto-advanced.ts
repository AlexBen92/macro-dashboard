/**
 * CRYPTO ADVANCED SIGNALS
 * Stratégies de trading crypto basées sur la littérature académique
 *
 * Basé sur:
 * - Daniel, Moskowitz (2024) - VW-TSMOM (Volatility-Weighted Time Series Momentum)
 * - He, Manela, Ross (2024) - Funding Divergence
 * - Huang, Sangiorgi (2024) - Regime Detection
 * - Mesíček, Vojtko (2025) - Multi-TF MACD
 */

import { calcReturns, calcSharpe, calcVaR95 } from './quant';

// ============================================================
// VW-TSMOM (Volatility-Weighted Time Series Momentum)
// ============================================================

interface VWTSMOMConfig {
  lookback: number;        // Jours de lookback (default: 126)
  volWindow: number;       // Fenêtre de volatilité (default: 20)
  volTarget: number;       // Vol cible (default: 15% annualisé)
  minVol: number;          // Volatilité minimum pour trade
}

interface VWTSMOMSignal {
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  positionSize: number;    // Basé sur vol scaling
  reasons: string[];
  meta: {
    return: number;
    volatility: number;
    scaledReturn: number;
    sharpe: number;
  };
}

/**
 * Calcule le signal VW-TSMOM
 *
 * Stratégie:
 * 1. Calculer return sur lookback period
 * 2. Calculer volatilité réalisée
 * 3. Scaler: position_size = vol_target / vol_realized
 * 4. Long si return > 0, Short si return < 0
 *
 * Avantages vs TSMOM standard:
 * - Normalise la volatilité (évite over-trading en low vol)
 * - Améliore le Sharpe ratio
 */
export function computeVWTSMOM(
  prices: number[],
  config: VWTSMOMConfig = {
    lookback: 126,
    volWindow: 20,
    volTarget: 0.15,
    minVol: 0.01,
  }
): VWTSMOMSignal {
  if (prices.length < config.lookback + config.volWindow) {
    return {
      direction: 'neutral',
      confidence: 0,
      positionSize: 0,
      reasons: ['Pas assez de données'],
      meta: { return: 0, volatility: 0, scaledReturn: 0, sharpe: 0 },
    };
  }

  // Extraire les périodes
  const lookbackPrices = prices.slice(-config.lookback - 1);
  const volPrices = prices.slice(-config.volWindow - 1);

  // Calculer returns
  const lbReturns = calcReturns(
    lookbackPrices.map((p, i) => ({
      o: p, h: p, l: p, c: p, v: 1, t: i,
    }))
  );
  const volReturns = calcReturns(
    volPrices.map((p, i) => ({
      o: p, h: p, l: p, c: p, v: 1, t: i,
    }))
  );

  // Return total sur lookback
  const totalReturn = lbReturns.reduce((a, r) => a + r, 0);

  // Volatilité réalisée (annualisée)
  const volDaily = volReturns.reduce((a, r) => a + r * r, 0) / volReturns.length;
  const volatility = Math.sqrt(volDaily) * Math.sqrt(252);

  // Sharpe ratio
  const avgReturn = lbReturns.reduce((a, r) => a + r, 0) / lbReturns.length;
  const sharpe = avgReturn / Math.sqrt(volDaily);

  // Vol scaling
  const volScale = volatility > config.minVol
    ? config.volTarget / volatility
    : 0;

  const scaledReturn = totalReturn * volScale;

  // Déterminer direction
  let direction: VWTSMOMSignal['direction'] = 'neutral';
  let confidence = 0;
  const reasons: string[] = [];

  if (volatility < config.minVol) {
    direction = 'neutral';
    reasons.push(`Volatilité trop faible: ${(volatility * 100).toFixed(1)}%`);
  } else if (totalReturn > 0.01) {
    direction = 'long';
    confidence = Math.min(95, 50 + scaledReturn * 100);
    reasons.push(`Momentum positif: ${(totalReturn * 100).toFixed(1)}%`);
    reasons.push(`Sharpe: ${sharpe.toFixed(2)}`);
  } else if (totalReturn < -0.01) {
    direction = 'short';
    confidence = Math.min(95, 50 + Math.abs(scaledReturn) * 100);
    reasons.push(`Momentum négatif: ${(totalReturn * 100).toFixed(1)}%`);
    reasons.push(`Sharpe: ${sharpe.toFixed(2)}`);
  } else {
    direction = 'neutral';
    reasons.push(`Momentum faible: ${(totalReturn * 100).toFixed(1)}%`);
  }

  return {
    direction,
    confidence: Math.round(confidence),
    positionSize: Math.max(0, Math.min(2, volScale)),
    reasons,
    meta: {
      return: totalReturn,
      volatility,
      scaledReturn,
      sharpe,
    },
  };
}

// ============================================================
// FUNDING DIVERGENCE (He, Manela, Ross 2024)
// ============================================================

interface FundingDivergenceSignal {
  signal: 'long' | 'short' | 'neutral';
  strength: 'weak' | 'moderate' | 'strong';
  confidence: number;
  reasons: string[];
  meta: {
    hlFunding: number;
    binanceFunding: number;
    divergence: number;
    fundingTrend: 'increasing' | 'decreasing' | 'stable';
  };
}

/**
 * Détecte les divergences de funding entre exchanges
 *
 * Théorie:
 * - Funding négatif → Long squeeze imminent → Short
 * - Funding positif → Short squeeze imminent → Long
 * - Divergence HL/Binance → Arb opportunity
 */
export function detectFundingDivergence(
  hlFunding: number,
  binanceFunding: number,
  fundingHistory: number[] = []
): FundingDivergenceSignal {
  const divergence = Math.abs(hlFunding - binanceFunding);
  const avgFunding = (hlFunding + binanceFunding) / 2;

  // Trend du funding
  let fundingTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (fundingHistory.length >= 3) {
    const recent = fundingHistory.slice(-3);
    if (recent[2] > recent[0] + 0.0001) fundingTrend = 'increasing';
    else if (recent[2] < recent[0] - 0.0001) fundingTrend = 'decreasing';
  }

  let signal: FundingDivergenceSignal['signal'] = 'neutral';
  let strength: FundingDivergenceSignal['strength'] = 'weak';
  let confidence = 0;
  const reasons: string[] = [];

  // Funding très négatif → signal LONG (contrarian)
  if (avgFunding < -0.0005) {
    signal = 'long';
    strength = avgFunding < -0.001 ? 'strong' : 'moderate';
    confidence = Math.min(90, 50 + Math.abs(avgFunding) * 50000);
    reasons.push(`Funding négatif extrême: ${(avgFunding * 100).toFixed(3)}%`);
    reasons.push('Long squeeze probable → Contrarian LONG');
  }
  // Funding très positif → signal SHORT
  else if (avgFunding > 0.0005) {
    signal = 'short';
    strength = avgFunding > 0.001 ? 'strong' : 'moderate';
    confidence = Math.min(90, 50 + avgFunding * 50000);
    reasons.push(`Funding positif extrême: ${(avgFunding * 100).toFixed(3)}%`);
    reasons.push('Short squeeze probable → Contrarian SHORT');
  }
  // Divergence significative → opportunité d'arb
  else if (divergence > 0.0002) {
    signal = 'neutral';
    strength = 'moderate';
    confidence = 40;
    reasons.push(`Divergence funding: ${(divergence * 100).toFixed(3)}%`);
    reasons.push('Opportunité d\'arbitrage détectée');
  }

  return {
    signal,
    strength,
    confidence: Math.round(confidence),
    reasons,
    meta: {
      hlFunding,
      binanceFunding,
      divergence,
      fundingTrend,
    },
  };
}

// ============================================================
// REGIME DETECTION (HMM-style)
// ============================================================

interface MarketRegime {
  regime: 'trend_up' | 'trend_down' | 'range' | 'volatile';
  confidence: number;
  expectedReturn: number;
  expectedVol: number;
  description: string;
}

/**
 * Détecte le régime de marché actuel
 *
 * Méthode:
 * 1. Calculer returns
 * 2. Calculer volatilité rolling
 * 3. Classifier selon critères quantitatifs
 */
export function detectMarketRegime(
  prices: number[],
  window: number = 30
): MarketRegime {
  if (prices.length < window * 2) {
    return {
      regime: 'range',
      confidence: 0,
      expectedReturn: 0,
      expectedVol: 0.02,
      description: 'Pas assez de données',
    };
  }

  const candles = prices.map((p, i) => ({
    o: p, h: p, l: p, c: p, v: 1, t: i,
  }));

  const returns = calcReturns(candles.slice(-window));
  const avgReturn = returns.reduce((a, r) => a + r, 0) / returns.length;
  const vol = Math.sqrt(returns.reduce((a, r) => a + r * r, 0) / returns.length);

  // Trend analysis
  const firstPrice = prices[prices.length - window];
  const lastPrice = prices[prices.length - 1];
  const trendReturn = (lastPrice - firstPrice) / firstPrice;

  // Classification
  let regime: MarketRegime['regime'] = 'range';
  let confidence = 0.5;
  let description = '';

  // Trend UP
  if (trendReturn > 0.05 && vol < 0.03) {
    regime = 'trend_up';
    confidence = Math.min(0.9, 0.5 + trendReturn * 5);
    description = `Trend haussier confirmé: +${(trendReturn * 100).toFixed(1)}%`;
  }
  // Trend DOWN
  else if (trendReturn < -0.05 && vol < 0.03) {
    regime = 'trend_down';
    confidence = Math.min(0.9, 0.5 + Math.abs(trendReturn) * 5);
    description = `Trend baissier confirmé: ${(trendReturn * 100).toFixed(1)}%`;
  }
  // Volatile
  else if (vol > 0.04) {
    regime = 'volatile';
    confidence = Math.min(0.8, 0.4 + vol * 10);
    description = `Marché volatile: ±${(vol * 100).toFixed(1)}% daily`;
  }
  // Range
  else {
    regime = 'range';
    confidence = 0.6;
    description = 'Marché en range: attendre breakout';
  }

  return {
    regime,
    confidence: Math.round(confidence * 100),
    expectedReturn: avgReturn,
    expectedVol: vol,
    description,
  };
}

// ============================================================
// MULTI-TIMEFRAME MACD (Mesíček, Vojtko 2025)
// ============================================================

interface MultiTFMACDSignal {
  d1: { value: number; histogram: number; signal: 'bullish' | 'bearish' | 'neutral' };
  h4: { value: number; histogram: number; signal: 'bullish' | 'bearish' | 'neutral' };
  h1: { value: number; histogram: number; signal: 'bullish' | 'bearish' | 'neutral' };
  consensus: 'long' | 'short' | 'neutral' | 'divergent';
  confidence: number;
}

/**
 * Calcule MACD multi-timeframe et le consensus
 *
 * Logique:
 * - D1 = direction principale
 * - H4 = confirmation
 * - H1 = timing entrée
 */
export function computeMultiTFMACD(
  d1Prices: number[],
  h4Prices: number[],
  h1Prices: number[]
): MultiTFMACDSignal {
  const computeMACD = (prices: number[]) => {
    if (prices.length < 26) return { value: 0, histogram: 0, signal: 'neutral' as const };

    const ema12 = ema(prices, 12);
    const ema26 = ema(prices, 26);
    const macdLine = ema12 - ema26;
    const signalLine = ema(prices.slice(-9), 9);
    const histogram = macdLine - signalLine;

    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (histogram > 0.001) signal = 'bullish';
    else if (histogram < -0.001) signal = 'bearish';

    return { value: macdLine, histogram, signal };
  };

  const d1 = computeMACD(d1Prices);
  const h4 = computeMACD(h4Prices);
  const h1 = computeMACD(h1Prices);

  // Consensus logic
  let consensus: MultiTFMACDSignal['consensus'] = 'neutral';
  let confidence = 0;

  const bullish = [d1.signal, h4.signal, h1.signal].filter(s => s === 'bullish').length;
  const bearish = [d1.signal, h4.signal, h1.signal].filter(s => s === 'bearish').length;

  if (bullish === 3) {
    consensus = 'long';
    confidence = 90;
  } else if (bearish === 3) {
    consensus = 'short';
    confidence = 90;
  } else if (bullish === 2 && d1.signal === 'bullish') {
    consensus = 'long';
    confidence = 70;
  } else if (bearish === 2 && d1.signal === 'bearish') {
    consensus = 'short';
    confidence = 70;
  } else if (bullish === 1 && bearish === 1) {
    consensus = 'divergent';
    confidence = 30;
  }

  return { d1, h4, h1, consensus, confidence };
}

// Helper: EMA calculation
function ema(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1];

  const k = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }

  return ema;
}

// ============================================================
// ATR-BASED POSITION SIZING
// ============================================================

interface ATRSizing {
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskAmount: number;
  riskPercent: number;
}

/**
 * Calcule SL/TP et taille de position basés sur ATR
 *
 * Règles:
 * - SL = 2×ATR
 * - TP = 3×ATR
 * - Risk per trade = 1% du capital
 */
export function computeATRSizing(
  entryPrice: number,
  atr: number,
  capital: number = 10000,
  riskPercent: number = 0.01
): ATRSizing {
  const stopLoss = atr * 2;
  const takeProfit = atr * 3;

  const riskAmount = capital * riskPercent;
  const positionSize = riskAmount / stopLoss;
  const riskPercentOfPrice = (stopLoss / entryPrice) * 100;

  return {
    stopLoss: entryPrice - stopLoss, // For long
    takeProfit: entryPrice + takeProfit, // For long
    positionSize,
    riskAmount,
    riskPercent: riskPercentOfPrice,
  };
}

// ============================================================
// COMPOSITE CRYPTO SIGNAL
// ============================================================

interface CompositeCryptoSignal {
  overall: 'long' | 'short' | 'neutral';
  confidence: number;
  breakdown: {
    vwtsmom: number;
    funding: number;
    regime: number;
    macd: number;
  };
  reasons: string[];
}

/**
 * Signal composite combinant toutes les stratégies
 */
export function computeCompositeCryptoSignal(data: {
  vwtsmom: VWTSMOMSignal;
  funding: FundingDivergenceSignal;
  regime: MarketRegime;
  macd: MultiTFMACDSignal;
}): CompositeCryptoSignal {
  let score = 0;
  const breakdown = {
    vwtsmom: 0,
    funding: 0,
    regime: 0,
    macd: 0,
  };
  const reasons: string[] = [];

  // VW-TSMOM: 35% weight
  const vwtsmomScore = data.vwtsmom.direction === 'long' ? 35 :
                      data.vwtsmom.direction === 'short' ? -35 : 0;
  breakdown.vwtsmom = vwtsmomScore;
  score += vwtsmomScore * (data.vwtsmom.confidence / 100);
  reasons.push(...data.vwtsmom.reasons);

  // Funding: 25% weight
  const fundingScore = data.funding.signal === 'long' ? 25 :
                      data.funding.signal === 'short' ? -25 : 0;
  breakdown.funding = fundingScore;
  score += fundingScore * (data.funding.confidence / 100);
  if (data.funding.strength === 'strong') {
    reasons.push(`Funding divergence ${data.funding.signal}`);
  }

  // Regime: 25% weight
  const regimeScore = data.regime.regime === 'trend_up' ? 25 :
                     data.regime.regime === 'trend_down' ? -25 :
                     data.regime.regime === 'volatile' ? -10 : 0;
  breakdown.regime = regimeScore;
  score += regimeScore * (data.regime.confidence / 100);
  reasons.push(data.regime.description);

  // MACD: 15% weight
  const macdScore = data.macd.consensus === 'long' ? 15 :
                   data.macd.consensus === 'short' ? -15 : 0;
  breakdown.macd = macdScore;
  score += macdScore * (data.macd.confidence / 100);

  const confidence = Math.round(Math.min(100, Math.max(0, Math.abs(score))));

  let overall: CompositeCryptoSignal['overall'] = 'neutral';
  if (score > 30) overall = 'long';
  else if (score < -30) overall = 'short';

  return {
    overall,
    confidence,
    breakdown,
    reasons: reasons.slice(0, 5),
  };
}
