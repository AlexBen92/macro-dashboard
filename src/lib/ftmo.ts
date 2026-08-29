/**
 * Bloc FTMO — règles, coûts, risque prop-firm, hedge US500 ↔ SPX/XSP/Nano.
 * Sources: config/ftmo/*.json (specs statiques, pas de data marché).
 * RNG Monte Carlo: mulberry32 seedé (déterministe, conforme au garde-fou
 * anti-fabrication tests/no-fabricated-data.test.ts).
 */
import specsJson from '../../config/ftmo/specs.json';
import costsJson from '../../config/ftmo/trading_costs.json';
import us500Json from '../../config/ftmo/us500_specs.json';
import spxJson from '../../config/ftmo/spx_options_specs.json';

export type FtmoModel = 'two_step' | 'one_step';
export type FtmoAccountType = 'standard' | 'swing';
export type AccountKey = '10k' | '25k' | '50k' | '100k' | '200k';

export interface FtmoSpec {
  accountKey: AccountKey;
  accountSize: number;
  currency: string;
  model: FtmoModel;
  accountType: FtmoAccountType;
  fee: number;
  feeRefundable: boolean;
  phases: string[];
  profitTargetPhase1: number;
  profitTargetPhase2: number;
  profitTarget: number;
  maxDailyLoss: number;
  maxTotalLoss: number;
  minTradingDaysPhase: number;
  profitSplitInitial: number;
  profitSplitMax: number;
  newsRestrictions: string;
  leverageByAsset: Record<string, number>;
}

export interface FtmoSymbolCost {
  class: string;
  is_symbol?: string;
  contract_size: number;
  min_lot: number;
  swap_long: number;
  swap_short: number;
  trading_hours: string;
}

export interface FtmoCosts {
  commissions: {
    forex_lot_round: number;
    indices: number;
    crypto_pct: number;
  };
  spreads: Record<string, number>;
  swaps: { rule: string; notes: string };
  symbols: Record<string, FtmoSymbolCost>;
}

export interface Us500Spec {
  symbol: string;
  alternative_symbol: string;
  contract_size: number;
  min_volume: number;
  volume_step: number;
  leverage_standard: number;
  leverage_swing: number;
  swap_model: {
    charged_at: string;
    unit: string;
    swap_long: number;
    swap_short: number;
    triple_day: string;
    holidays: string;
  };
  trading_hours: string;
  limits_reference: {
    account_size: number;
    account_key: string;
    max_daily_loss: number;
    max_total_loss: number;
  };
}

export interface SpxOptionSpec {
  multiplier: number;
  scale: number;
  exchange: string;
  settlement: string;
  note: string;
}

const ACCOUNT_SIZES: Record<AccountKey, number> = {
  '10k': 10000,
  '25k': 25000,
  '50k': 50000,
  '100k': 100000,
  '200k': 200000,
};

interface FtmoModelSpec {
  phases: string[];
  fee_refundable: boolean;
  profit_target_phase1?: number;
  profit_target_phase2?: number;
  profit_target_one_step?: number;
  max_daily_loss: number;
  max_total_loss: number;
  min_trading_days_phase: number;
  profit_split_initial: number;
  profit_split_max: number;
}

interface FtmoSpecsFile {
  provider: string;
  currency: string;
  accounts: Record<string, { size: number }>;
  models: Record<FtmoModel, FtmoModelSpec>;
  account_types: Record<
    FtmoAccountType,
    { news_restrictions: string; leverage_by_asset: Record<string, number> }
  >;
  fees: Record<string, Record<FtmoModel, number>>;
}

const SPECS = specsJson as FtmoSpecsFile;

export const FTMO_ACCOUNT_KEYS = Object.keys(ACCOUNT_SIZES) as AccountKey[];

export function getFtmoSpec(
  accountSize: number,
  model: FtmoModel = 'two_step',
  type: FtmoAccountType = 'standard'
): FtmoSpec {
  const key = (Object.keys(ACCOUNT_SIZES) as AccountKey[]).find(
    (k) => ACCOUNT_SIZES[k] === accountSize
  );
  if (!key) {
    throw new Error(`Taille de compte FTMO inconnue: ${accountSize}. Valides: ${FTMO_ACCOUNT_KEYS.join(', ')}`);
  }
  const m = SPECS.models[model];
  const t = SPECS.account_types[type];
  const profitTarget =
    model === 'two_step'
      ? m.profit_target_phase1 ?? 0.1
      : m.profit_target_one_step ?? 0.1;
  return {
    accountKey: key,
    accountSize,
    currency: SPECS.currency,
    model,
    accountType: type,
    fee: SPECS.fees[key][model],
    feeRefundable: m.fee_refundable,
    phases: m.phases,
    profitTargetPhase1: m.profit_target_phase1 ?? profitTarget,
    profitTargetPhase2: m.profit_target_phase2 ?? profitTarget,
    profitTarget,
    maxDailyLoss: m.max_daily_loss,
    maxTotalLoss: m.max_total_loss,
    minTradingDaysPhase: m.min_trading_days_phase,
    profitSplitInitial: m.profit_split_initial,
    profitSplitMax: m.profit_split_max,
    newsRestrictions: t.news_restrictions,
    leverageByAsset: t.leverage_by_asset,
  };
}

export function getFtmoCosts(): FtmoCosts {
  return costsJson as FtmoCosts;
}

export function getUs500Spec(): Us500Spec {
  return us500Json as Us500Spec;
}

export function getSpxOptionSpecs(): Record<string, SpxOptionSpec> {
  return spxJson as unknown as Record<string, SpxOptionSpec>;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface FtmoRiskParams {
  spec: FtmoSpec;
  /** Vol quotidienne de la stratégie en fraction du compte (0.02 = 2%) */
  strategyVol: number;
  /** Gain moyen par trade gagnant, fraction du compte */
  avgWin: number;
  /** Perte moyenne par trade perdant, fraction du compte (positif) */
  avgLoss: number;
  winRate: number;
  tradesPerDay: number;
  daysPlanned: number;
  nSims?: number;
  seed?: number;
}

export interface FtmoRiskResult {
  /** Trajectoire PnL cumulée représentative (médiane des sims), fraction du compte */
  pnlPath: number[];
  /** Usage quotidien de la limite de perte journalière (0-1+), trajectoire médiane */
  dailyLossUsage: number[];
  /** Usage cumulé de la limite de perte totale (0-1+), trajectoire médiane */
  maxDrawdownUsage: number[];
  probPassChallenge: number;
  probPassVerification: number;
  probReachFunded: number;
  probBreachDaily: number;
  probBreachTotal: number;
}

/** Monte Carlo seedé: un run = phase unique (target + breach avant timeout). */
function runPhase(
  rng: () => number,
  p: FtmoRiskParams,
  target: number,
  dailyLimit: number,
  totalLimit: number
): { outcome: 'pass' | 'breach_daily' | 'breach_total' | 'timeout'; path: number[]; dailyUsage: number[]; ddUsage: number[] } {
  const { avgWin, avgLoss, winRate, tradesPerDay, daysPlanned } = p;
  let cum = 0;
  let peak = 0;
  const path: number[] = [];
  const dailyUsage: number[] = [];
  const ddUsage: number[] = [];
  let outcome: 'pass' | 'breach_daily' | 'breach_total' | 'timeout' = 'timeout';
  for (let d = 0; d < daysPlanned; d++) {
    let dayPnl = 0;
    for (let t = 0; t < Math.max(1, Math.round(tradesPerDay)); t++) {
      dayPnl += rng() < winRate ? avgWin : -avgLoss;
    }
    cum += dayPnl;
    peak = Math.max(peak, cum);
    const dd = peak - cum;
    path.push(cum);
    dailyUsage.push(Math.max(0, -dayPnl) / dailyLimit);
    ddUsage.push(dd / totalLimit);
    if (-cum >= totalLimit || dd >= totalLimit) {
      outcome = 'breach_total';
      break;
    }
    if (-dayPnl >= dailyLimit) {
      outcome = 'breach_daily';
      break;
    }
    if (cum >= target) {
      outcome = 'pass';
      break;
    }
  }
  return { outcome, path, dailyUsage, ddUsage };
}

function percentileSorted(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(q * (sorted.length - 1))));
  return sorted[idx];
}

export function simulateFtmoRisk(params: FtmoRiskParams): FtmoRiskResult {
  const { spec } = params;
  const nSims = params.nSims ?? 2000;
  const rng = mulberry32(params.seed ?? 42);
  const dailyLimit = spec.maxDailyLoss;
  const totalLimit = spec.maxTotalLoss;

  // Calibrage: la taille des trades est scalée pour que la vol quotidienne
  // réalisée de l'équité ≈ strategyVol (fraction du compte).
  const rmsTrade = Math.sqrt(
    params.winRate * params.avgWin ** 2 + (1 - params.winRate) * params.avgLoss ** 2
  );
  const volScale =
    params.strategyVol > 0 && rmsTrade > 0
      ? params.strategyVol / (rmsTrade * Math.sqrt(Math.max(1, params.tradesPerDay)))
      : 1;
  const scaled: FtmoRiskParams = {
    ...params,
    avgWin: params.avgWin * volScale,
    avgLoss: params.avgLoss * volScale,
  };

  const targetChallenge = spec.model === 'two_step' ? spec.profitTargetPhase1 : spec.profitTarget;
  const targetVerification = spec.model === 'two_step' ? spec.profitTargetPhase2 : spec.profitTarget;

  let passC = 0, passV = 0, breachDaily = 0, breachTotal = 0;
  const finalPnls: number[] = [];
  const paths: number[][] = [];
  const dailyPaths: number[][] = [];
  const ddPaths: number[][] = [];

  for (let i = 0; i < nSims; i++) {
    const c = runPhase(rng, scaled, targetChallenge, dailyLimit, totalLimit);
    if (c.outcome === 'breach_daily') breachDaily++;
    if (c.outcome === 'breach_total') breachTotal++;
    if (c.outcome === 'pass') {
      passC++;
      const v = runPhase(rng, scaled, targetVerification, dailyLimit, totalLimit);
      if (v.outcome === 'pass') passV++;
    }
    finalPnls.push(c.path[c.path.length - 1] ?? 0);
    paths.push(c.path);
    dailyPaths.push(c.dailyUsage);
    ddPaths.push(c.ddUsage);
  }

  // trajectoire médiane = sim dont le PnL final est le plus proche de la médiane
  const med = percentileSorted(finalPnls, 0.5);
  let bestIdx = 0, bestDist = Infinity;
  for (let i = 0; i < nSims; i++) {
    const dist = Math.abs(finalPnls[i] - med);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = i;
    }
  }

  const probPassChallenge = passC / nSims;
  const probPassVerification = passC > 0 ? passV / passC : 0;

  return {
    pnlPath: paths[bestIdx],
    dailyLossUsage: dailyPaths[bestIdx],
    maxDrawdownUsage: ddPaths[bestIdx],
    probPassChallenge,
    probPassVerification,
    probReachFunded: probPassChallenge * probPassVerification,
    probBreachDaily: breachDaily / nSims,
    probBreachTotal: breachTotal / nSims,
  };
}

export interface FtmoCostParams {
  spec: FtmoSpec;
  resets: number;
  /** Volume total tradé en lots pendant la phase, pour coûts de trading */
  tradedVolume: number;
  costs?: FtmoCosts;
}

export interface FtmoCostResult {
  challengeFeesGross: number;
  challengeFeesNetIfSuccess: number;
  tradingCosts: number;
  expectedCost: number;
  breakEvenProfitBeforePayout: number;
}

export function computeFtmoCost(params: FtmoCostParams): FtmoCostResult {
  const { spec, resets, tradedVolume } = params;
  const costs = params.costs ?? getFtmoCosts();
  const challengeFeesGross = spec.fee * (1 + resets);
  // remboursement du premier fee seulement, uniquement si succès + funded
  const challengeFeesNetIfSuccess = spec.feeRefundable
    ? spec.fee * (1 + resets) - spec.fee
    : spec.fee * (1 + resets);
  // volume en lots forex round-turn + commission indices nulle
  const tradingCosts = tradedVolume * costs.commissions.forex_lot_round;
  const expectedCost = challengeFeesGross + tradingCosts;
  const breakEvenProfitBeforePayout = expectedCost / spec.profitSplitInitial;
  return {
    challengeFeesGross,
    challengeFeesNetIfSuccess,
    tradingCosts,
    expectedCost,
    breakEvenProfitBeforePayout,
  };
}

export interface Us500ExposureParams {
  price: number;
  lots: number;
  us500Spec?: Us500Spec;
}

export interface Us500ExposureResult {
  notional: number;
  dailyLossLimitValue: number;
  maxLossLimitValue: number;
}

export function computeUs500Exposure(params: Us500ExposureParams): Us500ExposureResult {
  const spec = params.us500Spec ?? getUs500Spec();
  const notional = params.price * params.lots * spec.contract_size;
  const ref = spec.limits_reference;
  return {
    notional,
    dailyLossLimitValue: ref.account_size * ref.max_daily_loss,
    maxLossLimitValue: ref.account_size * ref.max_total_loss,
  };
}

export interface SpxHedgeParams {
  notionalUs500: number;
  optionType: 'SPX' | 'XSP' | 'NANO';
  spxLevel: number;
  hedgeDeltaTarget: number;
  spxSpecs?: Record<string, SpxOptionSpec>;
}

export interface SpxHedgeResult {
  contractsNeeded: number;
  singleContractNotional: number;
}

export function computeSpxHedge(params: SpxHedgeParams): SpxHedgeResult {
  const specs = params.spxSpecs ?? getSpxOptionSpecs();
  const s = specs[params.optionType];
  if (!s) throw new Error(`Type d'option inconnu: ${params.optionType}`);
  // notional d'un contrat exprimé en équivalent SPX: level × multiplier × scale
  const singleContractNotional = params.spxLevel * s.multiplier * s.scale;
  const contractsNeeded =
    singleContractNotional > 0
      ? (params.notionalUs500 * params.hedgeDeltaTarget) / singleContractNotional
      : 0;
  return { contractsNeeded, singleContractNotional };
}
