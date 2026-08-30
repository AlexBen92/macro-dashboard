/**
 * Optimisation du levier. Grille coarse + section dorée (raffinement
 * type Brent) sur λ. Objectifs: P(pass éval), E[PV funded], Sharpe de l'edge.
 * optimizeLeverages: recherche coordonnée (λ_éval, λ_funded) — grille 2D
 * grossière puis sections dorées alternées sur chaque axe.
 */
import { simulateChallenge, type McOptions, type MarketCalib, type McResult, type CostModel } from './monte-carlo';
import type { FtmoSpec } from '../ftmo';

export type LeverageObjective = 'pass_prob' | 'pv_funded' | 'edge_sharpe';

export interface LeverageOptOptions extends McOptions {
  objective?: LeverageObjective;
  lambdaMin?: number;
  lambdaMax?: number;
  lambdaCap?: number;
}

function objectiveValue(res: McResult, objective: LeverageObjective): number {
  if (objective === 'pass_prob') return res.pReachFunded;
  if (objective === 'pv_funded') return res.fairValue;
  // edge sharpe: E[net]/std[net] — les payoffs sont déjà nets du fee
  const mean = res.fairValue;
  const varr = res.payoffs.reduce((s, x) => s + (x - mean) ** 2, 0) / res.payoffs.length;
  return varr > 0 ? mean / Math.sqrt(varr) : 0;
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
    intradayBarrier: opts.intradayBarrier,
  };
  const evalAt = (lambda: number): number => {
    const res = simulateChallenge(spec, calib, lambda, lambdaFunded, evalOpts);
    return objectiveValue(res, objective);
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
    objectiveValue: objectiveValue(finalMc, objective),
    curve,
    mc: finalMc,
  };
}

export interface LeveragesOptResult {
  lambdaEvalStar: number;
  lambdaFundedStar: number;
  objectiveValue: number;
  /** courbe objectif × λ_éval à λ_funded* fixé (pour le graphe) */
  curve: { lambda: number; value: number }[];
  mc: McResult;
}

/** Recherche coordonnée (λ_éval, λ_funded): grille 2D grossière puis sections dorées alternées. */
export function optimizeLeverages(
  spec: FtmoSpec,
  calib: MarketCalib,
  opts: LeverageOptOptions = {}
): LeveragesOptResult {
  const objective = opts.objective ?? 'pv_funded';
  const lambdaMin = opts.lambdaMin ?? 0.5;
  const lambdaMax = Math.min(opts.lambdaMax ?? 8, opts.lambdaCap ?? 8);
  const gridOpts: McOptions = {
    nSims: Math.min(opts.nSims ?? 800, 400),
    seed: opts.seed ?? 42,
    maxDaysEval: opts.maxDaysEval,
    maxDaysFunded: opts.maxDaysFunded,
    payoutDays: opts.payoutDays,
    costs: opts.costs,
    intradayBarrier: opts.intradayBarrier,
  };
  const evalAt = (le: number, lf: number): number => {
    const res = simulateChallenge(spec, calib, le, lf, gridOpts);
    return objectiveValue(res, objective);
  };
  // grille 2D grossière
  let bestLe = lambdaMin;
  let bestLf = lambdaMin;
  let bestVal = -Infinity;
  for (let i = 0; i <= 4; i++) {
    const le = lambdaMin + ((lambdaMax - lambdaMin) * i) / 4;
    for (let j = 0; j <= 4; j++) {
      const lf = lambdaMin + ((lambdaMax - lambdaMin) * j) / 4;
      const v = evalAt(le, lf);
      if (v > bestVal) {
        bestVal = v;
        bestLe = le;
        bestLf = lf;
      }
    }
  }
  // sections dorées alternées: λ_éval à λ_funded fixé, puis l'inverse (2 rounds)
  const gr = 0.6180339887;
  const golden = (f: (x: number) => number, x0: number) => {
    let a = Math.max(lambdaMin, x0 - 0.8);
    let b = Math.min(lambdaMax, x0 + 0.8);
    let c = b - gr * (b - a);
    let d = a + gr * (b - a);
    for (let i = 0; i < 10; i++) {
      if (f(c) > f(d)) b = d;
      else a = c;
      c = b - gr * (b - a);
      d = a + gr * (b - a);
      if (b - a < 0.05) break;
    }
    return (a + b) / 2;
  };
  for (let round = 0; round < 2; round++) {
    bestLe = golden((le) => evalAt(le, bestLf), bestLe);
    bestLf = golden((lf) => evalAt(bestLe, lf), bestLf);
  }
  // courbe × λ_éval à λ_funded* + MC final haute précision
  const curve: { lambda: number; value: number }[] = [];
  for (let l = lambdaMin; l <= lambdaMax + 1e-9; l += 0.5) {
    const res = simulateChallenge(spec, calib, l, bestLf, gridOpts);
    curve.push({ lambda: +l.toFixed(2), value: objectiveValue(res, objective) });
  }
  const finalMc = simulateChallenge(spec, calib, bestLe, bestLf, {
    ...gridOpts,
    nSims: opts.nSims ? Math.max(opts.nSims, 1500) : 1500,
  });
  return {
    lambdaEvalStar: +bestLe.toFixed(2),
    lambdaFundedStar: +bestLf.toFixed(2),
    objectiveValue: objectiveValue(finalMc, objective),
    curve,
    mc: finalMc,
  };
}

/** Grille de sensibilité de l'edge: coûts totaux (bps/j) × ERP. */
export function sensitivityGrid(
  spec: FtmoSpec,
  calib: MarketCalib,
  lambdaEval: number,
  lambdaFunded: number,
  opts: {
    nSims?: number;
    costBpsList?: number[];
    erpList?: number[];
    maxDaysEval?: number;
    maxDaysFunded?: number;
    intradayBarrier?: boolean;
  } = {}
): { costBps: number; erp: number; edge: number }[] {
  const nSims = opts.nSims ?? 800;
  const costList = opts.costBpsList ?? [1.5, 2.3, 3.3];
  const erpList = opts.erpList ?? [0, 0.035];
  const out: { costBps: number; erp: number; edge: number }[] = [];
  for (const erp of erpList) {
    for (const costBps of costList) {
      const swapBps = Math.max(0, costBps - 0.8);
      const res = simulateChallenge(spec, { ...calib, equityRiskPremium: erp }, lambdaEval, lambdaFunded, {
        nSims,
        seed: 42,
        costs: { dailyCostBps: 0.8, swapBps } as CostModel,
        maxDaysEval: opts.maxDaysEval,
        maxDaysFunded: opts.maxDaysFunded,
        intradayBarrier: opts.intradayBarrier ?? true,
      });
      out.push({ costBps, erp, edge: res.fairValue - spec.feeUsd });
    }
  }
  return out;
}

/** Surface 2D edge net × (λ_éval, λ_funded) pour le graphe de la référence. */
export function edgeSurface(
  spec: FtmoSpec,
  calib: MarketCalib,
  opts: { nSims?: number; nLambda?: number; lambdaMax?: number; costs?: CostModel; intradayBarrier?: boolean } = {}
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
        costs: opts.costs,
        intradayBarrier: opts.intradayBarrier ?? true,
      });
      out.push({
        lambdaEval: +le.toFixed(1),
        lambdaFunded: +Math.max(lf, 0.1).toFixed(1),
        edge: res.fairValue - spec.feeUsd,
      });
    }
  }
  return out;
}
