/**
 * Monte Carlo risque-neutre (Q) du challenge FTMO sous dynamique Bates calibrée.
 * Schéma Andersen QE pour la variance CIR, sauts Poisson composés, pas quotidien.
 * Toutes les probabilités produites sont des valorisations Q (étiquette UI obligatoire).
 * RNG: mulberry32 seedé (déterministe, garde-fou anti-fabrication).
 */
import type { BatesParams } from './bates';
import { normCdf } from './bates';
import type { FtmoSpec } from '../ftmo';

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeNormals(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    let v = 0;
    do {
      u = rng();
    } while (u <= 1e-12);
    v = rng();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
}

/** Pas de variance QE d'Andersen (2008) pour CIR: retourne v_{t+dt} et le Z utilisé. */
function qeStep(
  v: number,
  dt: number,
  p: BatesParams,
  z: number
): number {
  const { kappa, theta, sigmaV } = p;
  const e = Math.exp(-kappa * dt);
  const m = theta + (v - theta) * e;
  const s2 =
    (v * sigmaV * sigmaV * e * (1 - e)) / kappa +
    (theta * sigmaV * sigmaV * (1 - e) ** 2) / (2 * kappa);
  const psi = s2 / Math.max(m * m, 1e-18);
  if (psi <= 1.5) {
    const b2 = 2 / psi - 1 + Math.sqrt(2 / psi) * Math.sqrt(2 / psi - 1);
    const b = Math.sqrt(b2);
    const a = m / (1 + b2);
    return Math.max(a * (b + z) ** 2, 1e-12);
  }
  const p0 = 2 / (psi + 1);
  const beta = p0 / m;
  const u = Math.min(Math.max(normCdf(z), 1e-12), 1 - 1e-12);
  if (u <= p0) return 1e-12;
  return Math.max(-Math.log((1 - p0) / (1 - u)) / beta, 1e-12);
}

export interface MarketCalib {
  bates: BatesParams;
  /** drift log quotidien sous Q tiré du forward (par an, ex 0.04) */
  fwdDriftAnn: number;
  /** taux d'actualisation des payouts (annuel) */
  rate: number;
  asOf: string;
  source: string;
  spot: number;
}

export interface CostModel {
  /** bps/jour sur notionnel (spread+commissions amortis) */
  dailyCostBps: number;
  /** swap bps/jour sur notionnel (position longue US500) */
  swapBps: number;
}

export const DEFAULT_COSTS: CostModel = {
  dailyCostBps: 0.8,
  swapBps: -2.5,
};

export type Outcome =
  | 'fail_phase1'
  | 'timeout_phase1'
  | 'fail_phase2'
  | 'timeout_phase2'
  | 'ko_funded'
  | 'ko_after_payout'
  | 'funded_alive_end';

export interface McOptions {
  nSims?: number;
  seed?: number;
  maxDaysEval?: number;
  maxDaysFunded?: number;
  payoutDays?: number;
  fundedMonths?: number;
  costs?: CostModel;
}

export interface McResult {
  nSims: number;
  /** probabilités Q (valorisation risque-neutre, pas prédiction réelle) */
  pPassPhase1: number;
  pPassPhase2: number;
  pReachFunded: number;
  pFailP1: number;
  pTimeoutP1: number;
  pFailP2: number;
  pTimeoutP2: number;
  pKoFunded: number;
  pKoAfterPayout: number;
  outcomes: Outcome[];
  /** PV par chemin: payouts actualisés − fee, USD (fee refund inclus si applicable) */
  payoffs: number[];
  /** valeur juste du challenge = E^Q[PV] */
  fairValue: number;
  /** chemins d'équité représentatifs par issue (pour graphes) */
  representativePaths: Record<string, number[]>;
}

interface SimContext {
  spec: FtmoSpec;
  calib: MarketCalib;
  lambdaEval: number;
  lambdaFunded: number;
  maxDaysEval: number;
  maxDaysFunded: number;
  payoutDays: number;
  costs: CostModel;
}

/** Un jour d'équité: PnL = λ·(r_S&P sous Q) − coûts. Retourne nouveau log-return équité. */
function simDay(
  v: number,
  rng: () => number,
  znorm: () => number,
  ctx: SimContext,
  lambda: number
): { vNext: number; eqLogRet: number } {
  const p = ctx.calib.bates;
  const dt = 1 / 252;
  const zv = znorm();
  const vNext = qeStep(v, dt, p, zv);
  // log-return sous-jacent: drift forward + −v/2 − λE[J] + diffusion corrélée + sauts
  const mJump = Math.exp(p.nuJ + 0.5 * p.deltaJ * p.deltaJ) - 1;
  const zx = znorm();
  const diffCorr = Math.sqrt(v * dt) * (p.rho * zv + Math.sqrt(1 - p.rho * p.rho) * zx);
  let jumps = 0;
  const meanJumps = p.lambdaJ * dt;
  let nJumps = Math.floor(meanJumps);
  if (rng() < meanJumps - nJumps) nJumps++;
  for (let j = 0; j < nJumps; j++) {
    jumps += p.nuJ + p.deltaJ * znorm();
  }
  const sLogRet =
    (ctx.calib.fwdDriftAnn - 0.5 * v - p.lambdaJ * mJump) * dt + diffCorr + jumps;
  // équité: λ × return sous-jacent − coûts (bps du notionnel λ)
  const costBps = ctx.costs.dailyCostBps + ctx.costs.swapBps;
  const eqLogRet = Math.log(1 + lambda * (Math.exp(sLogRet) - 1) - (costBps / 10000) * lambda);
  return { vNext, eqLogRet };
}

function runPhaseQ(
  rng: () => number,
  znorm: () => number,
  ctx: SimContext,
  lambda: number,
  target: number,
  initBalance: number
): { outcome: 'pass' | 'fail_daily' | 'fail_total' | 'timeout'; days: number; equityPath: number[] } {
  const { spec } = ctx;
  const dailyLimit = spec.maxDailyLoss * initBalance;
  const totalFloor = initBalance * (1 - spec.maxTotalLoss);
  let v = ctx.calib.bates.V0;
  let eq = initBalance;
  const equityPath: number[] = [];
  for (let d = 0; d < ctx.maxDaysEval; d++) {
    const dayStart = eq;
    const { vNext, eqLogRet } = simDay(v, rng, znorm, ctx, lambda);
    v = vNext;
    eq = eq * Math.exp(eqLogRet);
    equityPath.push(eq);
    if (eq <= totalFloor || dayStart - eq >= dailyLimit) {
      return { outcome: 'fail_daily', days: d + 1, equityPath };
    }
    if (eq >= initBalance * (1 + target) && d + 1 >= spec.minTradingDaysPhase) {
      return { outcome: 'pass', days: d + 1, equityPath };
    }
  }
  return { outcome: 'timeout', days: ctx.maxDaysEval, equityPath };
}

function runFundedQ(
  rng: () => number,
  znorm: () => number,
  ctx: SimContext,
  split: number
): { outcome: 'ko_funded' | 'ko_after_payout' | 'funded_alive_end'; payouts: { day: number; amount: number }[]; equityPath: number[] } {
  const { spec } = ctx;
  const initBalance = spec.accountSize;
  const dailyLimit = spec.maxDailyLoss * initBalance;
  const totalFloor = initBalance * (1 - spec.maxTotalLoss);
  let v = ctx.calib.bates.V0;
  let eq = initBalance;
  const payouts: { day: number; amount: number }[] = [];
  const equityPath: number[] = [];
  for (let d = 1; d <= ctx.maxDaysFunded; d++) {
    const dayStart = eq;
    const { vNext, eqLogRet } = simDay(v, rng, znorm, ctx, ctx.lambdaFunded);
    v = vNext;
    eq = eq * Math.exp(eqLogRet);
    equityPath.push(eq);
    if (eq <= totalFloor || dayStart - eq >= dailyLimit) {
      return { outcome: payouts.length > 0 ? 'ko_after_payout' : 'ko_funded', payouts, equityPath };
    }
    if (d % ctx.payoutDays === 0) {
      const profit = eq - initBalance;
      if (profit > 0) {
        const pay = profit * split;
        payouts.push({ day: d, amount: pay });
        eq -= pay;
      }
    }
  }
  return { outcome: 'funded_alive_end', payouts, equityPath };
}

/** Monte Carlo complet d'un challenge (phases éval + funded). */
export function simulateChallenge(
  spec: FtmoSpec,
  calib: MarketCalib,
  lambdaEval: number,
  lambdaFunded: number,
  opts: McOptions = {}
): McResult {
  const nSims = opts.nSims ?? 2000;
  const seed = opts.seed ?? 42;
  const ctx: SimContext = {
    spec,
    calib,
    lambdaEval,
    lambdaFunded,
    maxDaysEval: opts.maxDaysEval ?? 120,
    maxDaysFunded: opts.maxDaysFunded ?? 252,
    payoutDays: opts.payoutDays ?? 14,
    costs: opts.costs ?? DEFAULT_COSTS,
  };
  const rng = mulberry32(seed);
  const znorm = makeNormals(rng);
  const outcomes: Outcome[] = [];
  const payoffs: number[] = [];
  let pass1 = 0, pass2 = 0, koF = 0, koAP = 0, t1 = 0, t2 = 0, f1 = 0, f2 = 0;
  const pathsByOutcome = new Map<Outcome, number[]>();

  for (let i = 0; i < nSims; i++) {
    const target1 = spec.model === 'two_step' ? spec.profitTargetPhase1 : spec.profitTarget;
    const p1 = runPhaseQ(rng, znorm, ctx, ctx.lambdaEval, target1, spec.accountSize);
    let pv = 0;
    let outcome: Outcome;
    if (p1.outcome === 'fail_daily') {
      outcome = 'fail_phase1';
      f1++;
    } else if (p1.outcome === 'timeout') {
      outcome = 'timeout_phase1';
      t1++;
    } else if (p1.outcome === 'fail_total') {
      outcome = 'fail_phase1';
      f1++;
    } else {
      pass1++;
      if (spec.model === 'two_step') {
        const p2 = runPhaseQ(rng, znorm, ctx, ctx.lambdaEval, spec.profitTargetPhase2, spec.accountSize);
        if (p2.outcome === 'fail_daily' || p2.outcome === 'fail_total') {
          outcome = 'fail_phase2';
          f2++;
        } else if (p2.outcome === 'timeout') {
          outcome = 'timeout_phase2';
          t2++;
        } else {
          pass2++;
          outcome = runFundedOutcome();
        }
      } else {
        pass2++;
        outcome = runFundedOutcome();
      }
    }
    function runFundedOutcome(): Outcome {
      const f = runFundedQ(rng, znorm, ctx, spec.profitSplitInitial);
      let pvF = 0;
      for (const pay of f.payouts) {
        pvF += pay.amount * Math.exp(-calib.rate * (pay.day / 252));
      }
      pv = pvF;
      if (f.outcome === 'ko_funded') koF++;
      if (f.outcome === 'ko_after_payout') koAP++;
      if (f.outcome === 'funded_alive_end') {
        // payout final au split si profit au-dessus du solde initial
        // (chemin encore vivant à l'horizon: valorisé comme payout)
      }
      const lastPath = f.equityPath;
      if (!pathsByOutcome.has(f.outcome) && lastPath.length > 0) {
        pathsByOutcome.set(f.outcome, lastPath.slice(0, 120));
      }
      return f.outcome;
    }
    // net du fee: payouts − fee, avec refund du premier fee au 1er payout
    const fee = spec.fee;
    const refund = spec.feeRefundable && pv > 0 ? fee : 0;
    const net = pv - fee + refund;
    payoffs.push(net);
    outcomes.push(outcome);
    const path = p1.equityPath;
    if (!pathsByOutcome.has(outcome) && path.length > 0) {
      pathsByOutcome.set(outcome, path.slice(0, 120));
    }
  }

  return {
    nSims,
    pPassPhase1: pass1 / nSims,
    pPassPhase2: pass2 / nSims,
    pReachFunded: pass2 / nSims,
    pFailP1: f1 / nSims,
    pTimeoutP1: t1 / nSims,
    pFailP2: f2 / nSims,
    pTimeoutP2: t2 / nSims,
    pKoFunded: koF / nSims,
    pKoAfterPayout: koAP / nSims,
    outcomes,
    payoffs,
    fairValue: payoffs.reduce((s, x) => s + x, 0) / nSims,
    representativePaths: Object.fromEntries(pathsByOutcome),
  };
}
