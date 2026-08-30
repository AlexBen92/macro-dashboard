/**
 * Optimisation du levier par phase. Grille coarse + section dorée (raffinement
 * type Brent) sur λ. Objectifs: P(pass éval), E[PV funded], Sharpe de l'edge,
 * vol cible. Courbes en U/W: trop peu ET trop de levier détruisent l'objectif.
 */
import { simulateChallenge, type McOptions, type MarketCalib, type McResult } from './monte-carlo';
import type { FtmoSpec } from '../ftmo';

export type LeverageObjective = 'pass_prob' | 'pv_funded' | 'edge_sharpe';

export interface LeverageOptOptions extends McOptions {
  objective?: LeverageObjective;
  lambdaMin?: number;
  lambdaMax?: number;
  lambdaCap?: number;
}

function objectiveValue(res: McResult, objective: LeverageObjective, fee: number): number {
  if (objective === 'pass_prob') return res.pReachFunded;
  if (objective === 'pv_funded') return res.fairValue;
  // edge sharpe: E[net]/std[net] sur les payoffs
  const mean = res.fairValue;
  const varr = res.payoffs.reduce((s, x) => s + (x - mean) ** 2, 0) / res.payoffs.length;
  return varr > 0 ? (mean - -fee) / Math.sqrt(varr) : 0;
}

export interface LeverageOptResult {
  lambdaStar: number;
  objectiveValue: number;
  curve: { lambda: number; value: number }[];
  mc: McResult;
}

export function optimizeLeverage(
  spec: FtmoSpec,
  calib: MarketCalib,
  lambdaFunded: number,
  opts: LeverageOptOptions = {}
): LeverageOptResult {
  const objective = opts.objective ?? 'pv_funded';
  const lambdaMin = opts.lambdaMin ?? 0.5;
  const lambdaMax = Math.min(opts.lambdaMax ?? 12, opts.lambdaCap ?? 12);
  const evalOpts: McOptions = {
    nSims: opts.nSims ?? 800,
    seed: opts.seed ?? 42,
    maxDaysEval: opts.maxDaysEval,
    maxDaysFunded: opts.maxDaysFunded,
    payoutDays: opts.payoutDays,
    costs: opts.costs,
  };
  const evalAt = (lambda: number): number => {
    const res = simulateChallenge(spec, calib, lambda, lambdaFunded, evalOpts);
    return objectiveValue(res, objective, spec.fee);
  };
  // grille coarse
  const curve: { lambda: number; value: number }[] = [];
  let bestLambda = lambdaMin;
  let bestVal = -Infinity;
  for (let l = lambdaMin; l <= lambdaMax + 1e-9; l += 0.5) {
    const v = evalAt(l);
    curve.push({ lambda: +l.toFixed(2), value: v });
    if (v > bestVal) {
      bestVal = v;
      bestLambda = l;
    }
  }
  // section dorée autour du meilleur point de grille
  let a = Math.max(lambdaMin, bestLambda - 0.75);
  let b = Math.min(lambdaMax, bestLambda + 0.75);
  const gr = 0.6180339887;
  let c = b - gr * (b - a);
  let d = a + gr * (b - a);
  for (let i = 0; i < 12; i++) {
    if (evalAt(c) > evalAt(d)) {
      b = d;
    } else {
      a = c;
    }
    c = b - gr * (b - a);
    d = a + gr * (b - a);
    if (b - a < 0.05) break;
  }
  const lambdaStar = (a + b) / 2;
  const finalMc = simulateChallenge(spec, calib, lambdaStar, lambdaFunded, {
    ...evalOpts,
    nSims: opts.nSims ? Math.max(opts.nSims, 1500) : 1500,
  });
  return {
    lambdaStar: +lambdaStar.toFixed(2),
    objectiveValue: objectiveValue(finalMc, objective, spec.fee),
    curve,
    mc: finalMc,
  };
}

/** Surface 2D edge net × (λ_éval, λ_funded) pour le graphe de la référence. */
export function edgeSurface(
  spec: FtmoSpec,
  calib: MarketCalib,
  opts: { nSims?: number; nLambda?: number; lambdaMax?: number } = {}
): { lambdaEval: number; lambdaFunded: number; edge: number }[] {
  const n = opts.nLambda ?? 9;
  const lambdaMax = opts.lambdaMax ?? 12;
  const step = lambdaMax / (n - 1);
  const out: { lambdaEval: number; lambdaFunded: number; edge: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const le = i * step;
    for (let j = 0; j < n; j++) {
      const lf = j * step;
      const res = simulateChallenge(spec, calib, le, Math.max(lf, 0.1), {
        nSims: opts.nSims ?? 300,
        seed: 77,
      });
      out.push({
        lambdaEval: +le.toFixed(1),
        lambdaFunded: +Math.max(lf, 0.1).toFixed(1),
        edge: res.fairValue - spec.fee,
      });
    }
  }
  return out;
}
