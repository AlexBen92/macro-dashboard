// lib/scalp-decision.ts
// Final decision engine: combines Direction + Execution + GARCH Regime
// ScalpScore = w1·DirectionScore + w2·ExecutionScore + w3·RegimeScore

import type { GARCHOutput, ScalpStyle } from './garch-engine';
import type { ExecutionScore } from './execution-score';
import type { ACFResult } from './ofi-autocorr';

export interface DirectionInput {
  ofiScore:       number;   // 0..100 from OFI engine
  autoCorr:       number;   // 0..100 from ACF
  pContinuation:  number;   // 0..1
  vwapDeviation:  number;   // % distance from VWAP (negative = below)
  fundingSignal:  number;   // 0..100 (existing L1 signal)
  oiSignal:       number;   // 0..100 (existing L1 signal)
  acfDirection:   'BUY' | 'SELL' | 'NEUTRAL';
}

export interface DecisionOutput {
  // Scores 0..100
  directionScore:  number;
  executionScore:  number;
  regimeScore:     number;
  scalpScore:      number;   // final composite

  // Risk management (from GARCH)
  size_mult:       number;   // 0.0..1.0 — multiply base size by this
  stop_bps:        number;   // dynamic stop
  timeout_ms:      number;   // max hold time
  allowed_style:   ScalpStyle;

  // Verdicts
  verdict:         'READY' | 'WATCH' | 'AVOID';
  verdictEmoji:    string;
  direction:       'LONG' | 'SHORT' | 'FLAT';
  reasons:         string[];  // human-readable reasons
  blockers:        string[];  // what's preventing READY
}

// Weights
const W_DIRECTION  = 0.40;
const W_EXECUTION  = 0.25;
const W_REGIME     = 0.35;

export function computeDecision(
  dir:   DirectionInput,
  exec:  ExecutionScore,
  garch: GARCHOutput,
): DecisionOutput {

  // ── Direction Score (0..100) ─────────────────────────────────────
  const directionScore = Math.round(
    dir.ofiScore       * 0.35 +
    dir.autoCorr       * 0.20 +
    dir.pContinuation  * 100 * 0.20 +
    dir.fundingSignal  * 0.10 +
    dir.oiSignal       * 0.10 +
    (50 + dir.vwapDeviation * 5) * 0.05   // proximity to VWAP
  );

  // ── Execution Score (0..100) — already computed ──────────────────
  const executionScore = Math.round(exec.raw);

  // ── Regime Score (0..100) from GARCH ────────────────────────────
  // Perfect regime: vol_ratio ≈ 1.0, phi moderate, nu > 4
  const volRatioScore = (() => {
    const vr = garch.vol_ratio;
    if (vr > 2.0)  return 0;
    if (vr > 1.5)  return 20;
    if (vr > 1.3)  return 40;
    if (vr < 0.5)  return 50;  // compressed — uncertain
    if (vr < 0.7)  return 65;  // compressed but ok
    return 100 - Math.abs(vr - 1.0) * 40; // peak at vr=1.0
  })();

  const phiScore = garch.phi > 0.98 ? 40 : garch.phi > 0.95 ? 70 : 100;
  const nuScore  = garch.nu < 3 ? 20 : garch.nu < 5 ? 60 : 100;

  const regimeScore = Math.round(
    volRatioScore * 0.60 + phiScore * 0.25 + nuScore * 0.15
  );

  // ── Composite ScalpScore ─────────────────────────────────────────
  const scalpScore = Math.round(
    directionScore * W_DIRECTION +
    executionScore * W_EXECUTION +
    regimeScore    * W_REGIME
  );

  // ── Risk outputs from GARCH ──────────────────────────────────────
  const { size_mult, stop_bps, timeout_ms, allowed_style } = garch;

  // Override: if exec is AVOID, always no-trade
  const effectiveSizeMult = exec.label === 'AVOID' ? 0 : size_mult;

  // ── Verdict ──────────────────────────────────────────────────────
  const blockers: string[] = [];
  if (garch.regime === 'EXPLOSIVE')  blockers.push('VOL EXPLOSIVE — no trade');
  if (exec.spoofy)                   blockers.push('Spoofing détecté (flicker)');
  if (!exec.spreadOk)                blockers.push(`Spread trop large (${exec.raw.toFixed(1)}bps)`);
  if (garch.phi > 0.98)              blockers.push('φ > 0.98 — vol persistante');
  if (dir.acfDirection === 'NEUTRAL' && directionScore < 50)
                                     blockers.push('OFI neutre — pas de flux clair');

  const verdict: DecisionOutput['verdict'] =
    blockers.length > 0 || scalpScore < 55  ? 'AVOID' :
    scalpScore >= 75 && effectiveSizeMult > 0 ? 'READY' : 'WATCH';

  const verdictEmoji = verdict === 'READY' ? '🎯' : verdict === 'WATCH' ? '👁️' : '🚫';

  // ── Direction ────────────────────────────────────────────────────
  const direction: DecisionOutput['direction'] =
    dir.acfDirection === 'BUY'  && dir.pContinuation > 0.55 ? 'LONG'  :
    dir.acfDirection === 'SELL' && dir.pContinuation > 0.55 ? 'SHORT' : 'FLAT';

  // ── Reasons ──────────────────────────────────────────────────────
  const reasons: string[] = [];
  if (directionScore >= 70) reasons.push(`OFI fort (${dir.ofiScore}/100)`);
  if (dir.pContinuation > 0.6) reasons.push(`p(continuation) ${Math.round(dir.pContinuation*100)}%`);
  if (exec.label === 'CLEAN') reasons.push('Carnet propre');
  if (garch.regime === 'NORMAL') reasons.push('Vol normale');
  if (garch.regime === 'COMPRESSED') reasons.push('Vol comprimée — breakout watch');

  return {
    directionScore,
    executionScore,
    regimeScore,
    scalpScore,
    size_mult: effectiveSizeMult,
    stop_bps,
    timeout_ms,
    allowed_style,
    verdict,
    verdictEmoji,
    direction,
    reasons,
    blockers,
  };
}

// Helper to get ACF result from OFI engine
export function extractDirectionFromACF(acf: ACFResult, ofiScore: number): DirectionInput {
  return {
    ofiScore,
    autoCorr: acf.strength === 'STRONG' ? 80 : acf.strength === 'MODERATE' ? 60 : 40,
    pContinuation: acf.pContinuation,
    vwapDeviation: 0, // computed separately
    fundingSignal: 50, // computed separately
    oiSignal: 50, // computed separately
    acfDirection: acf.direction,
  };
}
