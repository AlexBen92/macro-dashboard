/**
 * M15 CONFIDENCE SCORE - v1.0
 * Calculation logic for L1, L2, L3 confidence scores and global confidence
 *
 * PRINCIPLES:
 * 1. Confidence ≠ Score - Score measures quality, Confidence measures reliability
 * 2. High confidence = consistent signals across all components
 * 3. Low confidence = mixed signals or weak data
 */

import type { HardFilterResult, SetupScore, ConfirmationScore, M15TokenData } from './m15-scoring';

// ─── TYPES ───

export interface ConfidenceScores {
  l1: number; // 0-100
  l2: number;
  l3: number;
  global: number;
  breakdown: {
    l1: { passRate: number; safetyMargin: number };
    l2: { coherence: number; componentVariance: number };
    l3: { signalAlignment: number; confirmationStrength: number };
    global: { layerAlignment: number; weakestLink: number };
  };
  explanation: string[];
}

// ─── L1 CONFIDENCE (Hard Filters) ───

/**
 * L1 Confidence = How safely filters are passed
 *
 * CALCULATION:
 * - passRate: (score / max possible) × 100
 * - safetyMargin: distance from failure threshold
 * - Critical filters (session, liquidity) have double weight
 *
 * Formula:
 *   confidence = passRate × 0.6 + safetyMargin × 0.4
 *
 * Example:
 *   Score 85/100 → passRate = 85%
 *   Threshold 60 → safetyMargin = (85-60)/(100-60) = 62.5%
 *   Confidence = 85×0.6 + 62.5×0.4 = 76.25%
 */
export function computeL1Confidence(
  layer1: HardFilterResult,
  token: M15TokenData
): { confidence: number; passRate: number; safetyMargin: number } {
  // Max score is 100 (25+20+15+15+15+10)
  const maxScore = 100;
  const passThreshold = 60;

  // 1. Pass Rate: score % of maximum
  const passRate = (layer1.score / maxScore) * 100;

  // 2. Safety Margin: how far from failure?
  // If score = 100, margin = 100%. If score = 60, margin = 0%.
  const safetyMargin = passThreshold > 0
    ? ((layer1.score - passThreshold) / (maxScore - passThreshold)) * 100
    : 0;

  // 3. Critical filter check
  // If session or vol24h failed, confidence drops significantly
  const hasCriticalFailure = layer1.reasons.some(r =>
    r.includes('Session off') || r.includes('Vol24h faible')
  );
  const criticalPenalty = hasCriticalFailure ? 20 : 0;

  // Final confidence
  const confidence = Math.max(0, Math.min(100,
    passRate * 0.6 +
    Math.max(0, safetyMargin) * 0.4 -
    criticalPenalty
  ));

  return {
    confidence: Math.round(confidence),
    passRate: Math.round(passRate),
    safetyMargin: Math.round(Math.max(0, safetyMargin)),
  };
}

// ─── L2 CONFIDENCE (Setup) ───

/**
 * L2 Confidence = How coherent are the setup components?
 *
 * CALCULATION:
 * - coherence: if all components agree, confidence is high
 * - componentVariance: lower variance = higher confidence
 *
 * Formula:
 *   coherence = 100 - (standard_deviation / mean) × 100
 *   confidence = mean_score × 0.5 + coherence × 0.5
 *
 * Example:
 *   VWAP: 100, Funding: 100, OI: 90, Vol: 80, Flow: 85, Trend: 95
 *   Mean = 91.7, StdDev = 7.4
 *   Coherence = 100 - (7.4/91.7)×100 = 92%
 *   Confidence = 91.7×0.5 + 92×0.5 = 91.85%
 */
export function computeL2Confidence(
  layer2: SetupScore
): { confidence: number; coherence: number; componentVariance: number } {
  const components = [
    layer2.breakdown.vwap,
    layer2.breakdown.funding,
    layer2.breakdown.oi,
    layer2.breakdown.volatility,
    layer2.breakdown.orderFlow,
    layer2.breakdown.trend,
  ];

  // 1. Mean score
  const mean = components.reduce((a, b) => a + b, 0) / components.length;

  // 2. Standard deviation
  const variance = components.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / components.length;
  const stdDev = Math.sqrt(variance);

  // 3. Coherence: low variance = high coherence
  // Coefficient of variation: stdDev / mean (normalized)
  const cv = mean > 0 ? (stdDev / mean) * 100 : 100;
  const coherence = Math.max(0, 100 - cv);

  // 4. Component variance (inverse of coherence)
  const componentVariance = Math.round(cv);

  // 5. Final confidence: high mean AND high coherence
  const confidence = (mean * 0.5) + (coherence * 0.5);

  return {
    confidence: Math.round(confidence),
    coherence: Math.round(coherence),
    componentVariance,
  };
}

// ─── L3 CONFIDENCE (Confirmation) ───

/**
 * L3 Confidence = How aligned are the confirmation signals?
 *
 * CALCULATION:
 * - signalAlignment: do all confirmations point same direction?
 * - confirmationStrength: how strong is the collective signal?
 *
 * Formula:
 *   signalAlignment = 100 - (direction_disagreements × 20)
 *   confidence = alignment × 0.6 + strength × 0.4
 *
 * Example:
 *   Momentum: BULL(80), CVD: BULL(90), Structure: BULL(70)
 *   All aligned → signalAlignment = 100%
 *   Mean strength = 80%
 *   Confidence = 100×0.6 + 80×0.4 = 92%
 */
export function computeL3Confidence(
  layer3: ConfirmationScore,
  token: M15TokenData
): { confidence: number; signalAlignment: number; confirmationStrength: number } {
  const components = [
    { name: 'momentum', score: layer3.breakdown.momentum5m },
    { name: 'reclaim', score: layer3.breakdown.reclaim },
    { name: 'cvd', score: layer3.breakdown.cvd },
    { name: 'structure', score: layer3.breakdown.structureBreak },
    { name: 'retest', score: layer3.breakdown.retest },
  ];

  // 1. Mean strength
  const strength = components.reduce((a, b) => a + b.score, 0) / components.length;

  // 2. Signal alignment detection
  // High scores (>60) are bullish, low scores (<40) are bearish, middle is neutral
  const bullish = components.filter(c => c.score > 60).length;
  const bearish = components.filter(c => c.score < 40).length;
  const neutral = components.length - bullish - bearish;

  // Alignment score: all pointing same direction = 100%
  const maxDirection = Math.max(bullish, bearish);
  const signalAlignment = (maxDirection / components.length) * 100;

  // 3. Penalty for mixed signals
  const mixedSignalPenalty = (bullish > 0 && bearish > 0) ? 15 : 0;

  // 4. Final confidence
  const confidence = Math.max(0, Math.min(100,
    (signalAlignment * 0.6) +
    (strength * 0.4) -
    mixedSignalPenalty
  ));

  return {
    confidence: Math.round(confidence),
    signalAlignment: Math.round(signalAlignment),
    confirmationStrength: Math.round(strength),
  };
}

// ─── GLOBAL CONFIDENCE ───

/**
 * Global Confidence = Overall reliability of the score
 *
 * CALCULATION:
 * - layerAlignment: do L1, L2, L3 agree?
 * - weakestLink: the weakest layer limits overall confidence
 * - weightedAverage: standard weighted combination
 *
 * Formula:
 *   layerAlignment = 100 - (|L1 - L2| + |L2 - L3| + |L1 - L3|) / 3
 *   weakestLink = min(L1, L2, L3)
 *   confidence = weighted × 0.5 + weakestLink × 0.3 + alignment × 0.2
 *
 * Example:
 *   L1: 85, L2: 80, L3: 75
 *   Weighted = 85×0.3 + 80×0.4 + 75×0.3 = 80
 *   WeakestLink = 75
 *   Alignment = 100 - (5+5+10)/3 = 93.3
 *   Confidence = 80×0.5 + 75×0.3 + 93.3×0.2 = 82.2
 */
export function computeGlobalConfidence(
  l1Confidence: number,
  l2Confidence: number,
  l3Confidence: number,
  layer1Score: number,
  layer2Score: number,
  layer3Score: number
): { confidence: number; layerAlignment: number; weakestLink: number } {
  // 1. Weighted average of layer confidences (same weights as final score)
  const weightedConfidence =
    l1Confidence * 0.30 +
    l2Confidence * 0.40 +
    l3Confidence * 0.30;

  // 2. Layer alignment: how close are the layer scores?
  const diffs = [
    Math.abs(layer1Score - layer2Score),
    Math.abs(layer2Score - layer3Score),
    Math.abs(layer1Score - layer3Score),
  ];
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  const layerAlignment = Math.max(0, 100 - avgDiff * 2); // Scale: 10pt diff = 20% penalty

  // 3. Weakest link: lowest confidence caps overall
  const weakestLink = Math.min(l1Confidence, l2Confidence, l3Confidence);

  // 4. Final confidence
  const confidence = Math.round(
    weightedConfidence * 0.5 +
    weakestLink * 0.3 +
    layerAlignment * 0.2
  );

  return {
    confidence,
    layerAlignment: Math.round(layerAlignment),
    weakestLink,
  };
}

// ─── MAIN FUNCTION ───

/**
 * Compute all confidence scores with explanations
 */
export function computeConfidenceScores(
  layer1: HardFilterResult,
  layer2: SetupScore,
  layer3: ConfirmationScore,
  token: M15TokenData
): ConfidenceScores {
  const explanation: string[] = [];

  // Compute individual confidences
  const l1Result = computeL1Confidence(layer1, token);
  const l2Result = computeL2Confidence(layer2);
  const l3Result = computeL3Confidence(layer3, token);
  const globalResult = computeGlobalConfidence(
    l1Result.confidence,
    l2Result.confidence,
    l3Result.confidence,
    layer1.score,
    layer2.total,
    layer3.total
  );

  // Build explanations
  explanation.push(`L1 Confidence: ${l1Result.confidence}%`);
  explanation.push(`  ├─ Pass Rate: ${l1Result.passRate}% (${layer1.score}/100)`);
  explanation.push(`  └─ Safety Margin: ${l1Result.safetyMargin}% from threshold`);

  explanation.push(`L2 Confidence: ${l2Result.confidence}%`);
  explanation.push(`  ├─ Coherence: ${l2Result.coherence}%`);
  explanation.push(`  └─ Component Variance: ${l2Result.componentVariance}`);

  explanation.push(`L3 Confidence: ${l3Result.confidence}%`);
  explanation.push(`  ├─ Signal Alignment: ${l3Result.signalAlignment}%`);
  explanation.push(`  └─ Confirmation Strength: ${l3Result.confirmationStrength}%`);

  explanation.push(`Global Confidence: ${globalResult.confidence}%`);
  explanation.push(`  ├─ Layer Alignment: ${globalResult.layerAlignment}%`);
  explanation.push(`  ├─ Weakest Link: ${globalResult.weakestLink}%`);
  explanation.push(`  └─ Weighted: ${(l1Result.confidence * 0.3 + l2Result.confidence * 0.4 + l3Result.confidence * 0.3).toFixed(1)}%`);

  return {
    l1: l1Result.confidence,
    l2: l2Result.confidence,
    l3: l3Result.confidence,
    global: globalResult.confidence,
    breakdown: {
      l1: { passRate: l1Result.passRate, safetyMargin: l1Result.safetyMargin },
      l2: { coherence: l2Result.coherence, componentVariance: l2Result.componentVariance },
      l3: { signalAlignment: l3Result.signalAlignment, confirmationStrength: l3Result.confirmationStrength },
      global: { layerAlignment: globalResult.layerAlignment, weakestLink: globalResult.weakestLink },
    },
    explanation,
  };
}
