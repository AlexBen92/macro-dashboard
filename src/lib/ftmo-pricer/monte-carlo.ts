/**
 * Monte Carlo risque-neutre (Q) du challenge FTMO sous dynamique Bates calibrée.
 * Schéma Andersen QE pour la variance CIR, sauts Poisson composés, pas quotidien.
 * Toutes les probabilités produites sont des valorisations Q (étiquette UI obligatoire),
 * sauf si equityRiskPremium > 0 (mesure P approximée par shift de drift).
 *
 * Règles FTMO 2026 modélisées:
 *   - Max Daily Loss = 5% (2-step) / 3% (1-step) du solde INITIAL, ancré sur la
 *     balance 00:00 CE(S)T. Hypothèse: positions clôturées chaque jour ⇒
 *     balance 00:00 = equity close veille (dayStart). Floating inclus dans le check.
 *   - Max Loss 2-step: STATIQUE 10% du solde initial (toutes phases, funded inclus).
 *   - Max Loss 1-step: TRAILING EOD (floor = max(solde initial, plus haut solde
 *     minuit) × 0.90), reset à 90% du solde initial après chaque payout.
 *   - Aucune limite de temps sur les phases (maxDaysEval = garde-fou technique).
 *   - Best Day (1-step): le meilleur jour ne doit pas dépasser 50% du profit total
 *     au moment du pass ⇒ pass différé sinon.
 *   - Barrière intraday: pont brownien P(toucher le floor avant close) —
 *     P = exp(−2·(o−b)(c−b)/(v·dt)) avec v = variance instantanée de début de jour.
 *
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
  /** prime de risque actions (mesure P), par an. 0 = Q pur. */
  equityRiskPremium?: number;
  /** taux d'actualisation des payouts (annuel) */
  rate: number;
  asOf: string;
  source: string;
  spot: number;
}

export interface CostModel {
  /** bps/jour sur notionnel (spread+commissions amortis) — COÛT POSITIF */
  dailyCostBps: number;
  /** bps/jour sur notionnel (swap/financement long US500) — COÛT POSITIF,
   *  ≈ fwdDriftAnn/252 en bps (carry forward) + markup */
  swapBps: number;
}

/** Coûts totaux = 2.8 bps/j ≈ 0.8 spread + 2.0 swap long.
 * Swap réel FTMO US500.cash (API wp-json/ftmo/symbols, 2026-08-30):
 * swapLong −156.44 points/j à digits=2 → −1.5644 unités d'index/j sur
 * spot ~7711 → 2.03 bps/j. Arrondi 2.0 (US100 croisé: −2.5 bps/j). */
export const DEFAULT_COSTS: CostModel = {
  dailyCostBps: 0.8,
  swapBps: 2.0,
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
  /** garde-fou technique, PAS une règle FTMO (aucune limite officielle). Défaut 600. */
  maxDaysEval?: number;
  maxDaysFunded?: number;
  payoutDays?: number;
  fundedMonths?: number;
  costs?: CostModel;
  /** correction barrière intraday (pont brownien). Défaut true. */
  intradayBarrier?: boolean;
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
  pFundedAliveEnd: number;
  pFailDailyP1: number;
  pFailTotalP1: number;
  pFailDailyP2: number;
  pFailTotalP2: number;
  outcomes: Outcome[];
  /** PV par chemin: payouts actualisés − feeUsd, USD (fee refund inclus si applicable) */
  payoffs: number[];
  /** somme des payouts NON actualisés par chemin (cash, pour la bankroll) */
  payoutsCash: number[];
  /** jours de trading consommés par chemin (éval + funded) */
  simDays: number[];
  /** valeur juste du challenge = E^Q[PV] */
  fairValue: number;
  /** erreur standard MC du fairValue */
  fairValueSe: number;
  /** IC 95% du fairValue */
  fairValueCI95: [number, number];
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
  intradayBarrier: boolean;
}

/** Un jour d'équité: PnL = λ·(r_S&P) − coûts. Retourne nouveau log-return équité. */
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
  // log-return sous-jacent: drift forward (+ERP si P) + −v/2 − λE[J] + diffusion corrélée + sauts
  const mJump = Math.exp(p.nuJ + 0.5 * p.deltaJ * p.deltaJ) - 1;
  const erp = ctx.calib.equityRiskPremium ?? 0;
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
    (ctx.calib.fwdDriftAnn + erp - 0.5 * v - p.lambdaJ * mJump) * dt + diffCorr + jumps;
  // équité: λ × return sous-jacent − coûts (bps du notionnel λ, coûts positifs)
  const costBps = ctx.costs.dailyCostBps + ctx.costs.swapBps;
  const eqLogRet = Math.log(1 + lambda * (Math.exp(sLogRet) - 1) - (costBps / 10000) * lambda);
  return { vNext, eqLogRet };
}

interface PhaseOutcome {
  outcome: 'pass' | 'fail_daily' | 'fail_total' | 'timeout';
  days: number;
  equityPath: number[];
}

/** Floor max loss du jour: statique (2-step) ou trailing EOD (1-step). */
export function totalFloorToday(spec: FtmoSpec, initBalance: number, peakEodBalance: number): number {
  if (spec.maxLossMode === 'trailing_eod') {
    return Math.max(initBalance, peakEodBalance) * (1 - spec.maxTotalLoss);
  }
  return initBalance * (1 - spec.maxTotalLoss);
}

/** P(toucher le floor daily avant la clôture) par pont brownien, connaissant
 *  open (start du jour) et close (fin du jour), tous deux > floor.
 *  Distances en LOG (ln(o/b)·ln(c/b)), sinon l'exposant explose en unités $:
 *  P = exp(−2·ln(o/b)·ln(c/b)/(v·dt)), v = variance instantanée, dt = 1/252. */
export function intradayTouchProb(open: number, close: number, floor: number, v: number): number {
  if (v <= 0 || open <= floor || close <= floor) return 0;
  const dt = 1 / 252;
  const lo = Math.log(open / floor);
  const lc = Math.log(close / floor);
  return Math.exp((-2 * lo * lc) / (v * dt));
}

function runPhaseQ(
  rng: () => number,
  znorm: () => number,
  ctx: SimContext,
  lambda: number,
  target: number,
  initBalance: number
): PhaseOutcome {
  const { spec } = ctx;
  const dt = 1 / 252;
  const dailyLimit = spec.maxDailyLoss * initBalance;
  let v = ctx.calib.bates.V0;
  let eq = initBalance;
  let peakEod = initBalance;
  let bestDayPnl = 0;
  const equityPath: number[] = [];
  for (let d = 0; d < ctx.maxDaysEval; d++) {
    const dayStart = eq;
    const vDay = v;
    const { vNext, eqLogRet } = simDay(v, rng, znorm, ctx, lambda);
    v = vNext;
    eq = eq * Math.exp(eqLogRet);
    equityPath.push(eq);
    const floorTotal = totalFloorToday(spec, initBalance, peakEod);
    const floorDaily = dayStart - dailyLimit;
    if (eq <= floorTotal) {
      return { outcome: 'fail_total', days: d + 1, equityPath };
    }
    if (eq <= floorDaily) {
      return { outcome: 'fail_daily', days: d + 1, equityPath };
    }
    // barrière intraday (pont brownien): toucher le floor daily avant la clôture
    if (ctx.intradayBarrier && vDay > 0) {
      const pTouch = intradayTouchProb(dayStart, eq, floorDaily, vDay);
      if (rng() < pTouch) {
        return { outcome: 'fail_daily', days: d + 1, equityPath };
      }
    }
    const dayPnl = eq - dayStart;
    if (dayPnl > bestDayPnl) bestDayPnl = dayPnl;
    peakEod = Math.max(peakEod, eq);
    const cumProfit = eq - initBalance;
    if (
      eq >= initBalance * (1 + target) &&
      d + 1 >= spec.minTradingDaysPhase &&
      // Best Day (1-step): meilleur jour ≤ share du profit total au pass
      (spec.bestDayMaxShare === undefined || cumProfit <= 0 || bestDayPnl <= spec.bestDayMaxShare * cumProfit)
    ) {
      return { outcome: 'pass', days: d + 1, equityPath };
    }
  }
  return { outcome: 'timeout', days: ctx.maxDaysEval, equityPath };
}

interface FundedOutcome {
  outcome: 'ko_funded' | 'ko_after_payout' | 'funded_alive_end';
  days: number;
  payouts: { day: number; amount: number }[];
  equityPath: number[];
}

function runFundedQ(
  rng: () => number,
  znorm: () => number,
  ctx: SimContext,
  split: number
): FundedOutcome {
  const { spec } = ctx;
  const dt = 1 / 252;
  const initBalance = spec.accountSize;
  const dailyLimit = spec.maxDailyLoss * initBalance;
  let v = ctx.calib.bates.V0;
  let eq = initBalance;
  let peakEod = initBalance;
  const payouts: { day: number; amount: number }[] = [];
  const equityPath: number[] = [];
  for (let d = 1; d <= ctx.maxDaysFunded; d++) {
    const dayStart = eq;
    const vDay = v;
    const { vNext, eqLogRet } = simDay(v, rng, znorm, ctx, ctx.lambdaFunded);
    v = vNext;
    eq = eq * Math.exp(eqLogRet);
    equityPath.push(eq);
    const floorTotal = totalFloorToday(spec, initBalance, peakEod);
    const floorDaily = dayStart - dailyLimit;
    if (eq <= floorTotal || eq <= floorDaily) {
      return { outcome: payouts.length > 0 ? 'ko_after_payout' : 'ko_funded', days: d, payouts, equityPath };
    }
    if (ctx.intradayBarrier && vDay > 0) {
      const pTouch = intradayTouchProb(dayStart, eq, floorDaily, vDay);
      if (rng() < pTouch) {
        return { outcome: payouts.length > 0 ? 'ko_after_payout' : 'ko_funded', days: d, payouts, equityPath };
      }
    }
    peakEod = Math.max(peakEod, eq);
    if (d % ctx.payoutDays === 0) {
      const profit = eq - initBalance;
      if (profit > 0) {
        const pay = profit * split;
        payouts.push({ day: d, amount: pay });
        eq -= pay;
        equityPath[equityPath.length - 1] = eq;
        // 1-step: le floor trailing reset à 90% du solde initial après payout
        if (spec.maxLossMode === 'trailing_eod') peakEod = initBalance;
      }
    }
  }
  // vivant à l'horizon: payer le profit résiduel au split (plus de biais conservateur)
  const residual = eq - initBalance;
  if (residual > 0) {
    payouts.push({ day: ctx.maxDaysFunded, amount: residual * split });
  }
  return { outcome: 'funded_alive_end', days: ctx.maxDaysFunded, payouts, equityPath };
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
    maxDaysEval: opts.maxDaysEval ?? 600,
    maxDaysFunded: opts.maxDaysFunded ?? 252,
    payoutDays: opts.payoutDays ?? 14,
    costs: opts.costs ?? DEFAULT_COSTS,
    intradayBarrier: opts.intradayBarrier ?? true,
  };
  const feeUsd = spec.feeUsd;
  const rng = mulberry32(seed);
  const znorm = makeNormals(rng);
  const outcomes: Outcome[] = [];
  const payoffs: number[] = [];
  const payoutsCash: number[] = [];
  const simDays: number[] = [];
  let pass1 = 0, pass2 = 0, koF = 0, koAP = 0, aliveEnd = 0, t1 = 0, t2 = 0;
  let f1 = 0, f2 = 0, f1d = 0, f1t = 0, f2d = 0, f2t = 0;
  const pathsByOutcome = new Map<Outcome, number[]>();

  for (let i = 0; i < nSims; i++) {
    const target1 = spec.model === 'two_step' ? spec.profitTargetPhase1 : spec.profitTarget;
    const p1 = runPhaseQ(rng, znorm, ctx, ctx.lambdaEval, target1, spec.accountSize);
    let pv = 0;
    let cash = 0;
    let days = p1.days;
    let outcome!: Outcome;
    let path = p1.equityPath;
    if (p1.outcome === 'fail_daily' || p1.outcome === 'fail_total') {
      outcome = 'fail_phase1';
      f1++;
      if (p1.outcome === 'fail_daily') f1d++;
      else f1t++;
    } else if (p1.outcome === 'timeout') {
      outcome = 'timeout_phase1';
      t1++;
    } else {
      pass1++;
      let p2: PhaseOutcome | null = null;
      if (spec.model === 'two_step') {
        p2 = runPhaseQ(rng, znorm, ctx, ctx.lambdaEval, spec.profitTargetPhase2, spec.accountSize);
        days += p2.days;
        if (p2.outcome === 'fail_daily' || p2.outcome === 'fail_total') {
          outcome = 'fail_phase2';
          f2++;
          if (p2.outcome === 'fail_daily') f2d++;
          else f2t++;
        } else if (p2.outcome === 'timeout') {
          outcome = 'timeout_phase2';
          t2++;
        }
      }
      if (p2 === null || p2.outcome === 'pass') {
        pass2++;
        const f = runFundedQ(rng, znorm, ctx, spec.profitSplitInitial);
        days += f.days;
        for (const pay of f.payouts) {
          pv += pay.amount * Math.exp(-calib.rate * (pay.day / 252));
          cash += pay.amount;
        }
        outcome = f.outcome;
        if (f.outcome === 'ko_funded') koF++;
        else if (f.outcome === 'ko_after_payout') koAP++;
        else aliveEnd++;
        path = f.equityPath;
      }
    }
    // net du fee: payouts − fee, avec refund du premier fee au 1er payout
    const refund = spec.feeRefundable && pv > 0 ? feeUsd : 0;
    const net = pv - feeUsd + refund;
    payoffs.push(net);
    payoutsCash.push(cash);
    simDays.push(days);
    outcomes.push(outcome);
    if (!pathsByOutcome.has(outcome) && path.length > 0) {
      pathsByOutcome.set(outcome, path.slice(0, 120));
    }
  }

  const fairValue = payoffs.reduce((s, x) => s + x, 0) / nSims;
  const varr = payoffs.reduce((s, x) => s + (x - fairValue) ** 2, 0) / Math.max(1, nSims - 1);
  const se = Math.sqrt(varr / nSims);

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
    pFundedAliveEnd: aliveEnd / nSims,
    pFailDailyP1: f1d / nSims,
    pFailTotalP1: f1t / nSims,
    pFailDailyP2: f2d / nSims,
    pFailTotalP2: f2t / nSims,
    outcomes,
    payoffs,
    payoutsCash,
    simDays,
    fairValue,
    fairValueSe: se,
    fairValueCI95: [fairValue - 1.96 * se, fairValue + 1.96 * se],
    representativePaths: Object.fromEntries(pathsByOutcome),
  };
}
