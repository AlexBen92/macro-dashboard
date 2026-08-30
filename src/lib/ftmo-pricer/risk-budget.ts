/**
 * Budget de risque FTMO: floors explicites en $ + dimensionnement par trade.
 * Règles: Max Daily Loss = 5% (2-step) / 3% (1-step) du solde INITIAL, ancré
 * balance 00:00 CE(S)T. Max Loss = 10% statique (2-step) ou trailing EOD
 * (1-step, floor initial identique puis remonte avec le plus haut solde minuit).
 */
import type { FtmoSpec } from '../ftmo';

export interface RiskBudget {
  riskPerTrade: number;
  riskUsd: number;
  dailyAllowanceUsd: number;
  totalAllowanceUsd: number;
  dailyFloorUsd: number;
  totalFloorUsd: number;
  softStopShare: number;
  softDailyAllowanceUsd: number;
  softDailyFloorUsd: number;
  maxConsecLosses: number;
  lossesToSoftStop: number;
}

export const DEFAULT_SOFT_STOP_SHARE = 0.75;

export function computeRiskBudget(
  spec: FtmoSpec,
  riskPerTrade: number,
  softStopShare: number = DEFAULT_SOFT_STOP_SHARE
): RiskBudget {
  const dailyAllowanceUsd = spec.maxDailyLoss * spec.accountSize;
  const totalAllowanceUsd = spec.maxTotalLoss * spec.accountSize;
  const softDailyAllowanceUsd = softStopShare * dailyAllowanceUsd;
  const riskUsd = riskPerTrade * spec.accountSize;
  return {
    riskPerTrade,
    riskUsd,
    dailyAllowanceUsd,
    totalAllowanceUsd,
    dailyFloorUsd: spec.accountSize - dailyAllowanceUsd,
    totalFloorUsd: spec.accountSize - totalAllowanceUsd,
    softStopShare,
    softDailyAllowanceUsd,
    softDailyFloorUsd: spec.accountSize - softDailyAllowanceUsd,
    maxConsecLosses: riskUsd > 0 ? Math.max(1, Math.floor(dailyAllowanceUsd / riskUsd)) : Number.POSITIVE_INFINITY,
    lossesToSoftStop: riskUsd > 0 ? Math.max(1, Math.floor(softDailyAllowanceUsd / riskUsd)) : Number.POSITIVE_INFINITY,
  };
}

export interface RiskGateInput {
  /** equity live (floating inclus), USD */
  equity: number;
  /** balance/equity à 00:00 CE(S)T (ancre du daily loss) */
  dayStartEquity: number;
  /** plus haut solde minuit atteint (1-step trailing), défaut = solde initial */
  peakEodBalance?: number;
  /** risk par trade en fraction du compte (défaut 0.005) */
  riskPerTrade?: number;
  softStopShare?: number;
}

export interface RiskGate {
  equity: number;
  dayStartEquity: number;
  peakEodBalance: number;
  riskPerTrade: number;
  floors: {
    daily: { floorUsd: number; distanceUsd: number; usagePct: number };
    total: { floorUsd: number; distanceUsd: number; usagePct: number };
    softDaily: { floorUsd: number; distanceUsd: number; usagePct: number; hit: boolean };
  };
  /** pertes consécutives (au risk/trade) avant chaque seuil */
  lossesToSoftStop: number;
  lossesToDailyFloor: number;
  /** circuit-breaker pour bots */
  canOpenNewTrade: boolean;
  reduceOnly: boolean;
  killNow: boolean;
  verdict: 'GREEN' | 'ORANGE' | 'RED';
}

/** Gate live: floors, usage, soft-stop, décision circuit-breaker.
 *  Bots: killNow → couper tout; reduceOnly → aucune nouvelle position;
 *  canOpenNewTrade=false → attendre. GREEN <50% usage, ORANGE <75%/soft hit, RED = breach. */
export function computeRiskGate(spec: FtmoSpec, input: RiskGateInput): RiskGate {
  const accountSize = spec.accountSize;
  const peak = input.peakEodBalance ?? accountSize;
  const riskPerTrade = input.riskPerTrade ?? 0.005;
  const softShare = input.softStopShare ?? DEFAULT_SOFT_STOP_SHARE;
  const dailyAllowance = spec.maxDailyLoss * accountSize;
  const totalAllowance = spec.maxTotalLoss * accountSize;

  const dailyFloor = input.dayStartEquity - dailyAllowance;
  const totalFloor =
    spec.maxLossMode === 'trailing_eod'
      ? Math.max(accountSize, peak) * (1 - spec.maxTotalLoss)
      : accountSize - totalAllowance;
  const softFloor = input.dayStartEquity - softShare * dailyAllowance;

  const dayLoss = Math.max(0, input.dayStartEquity - input.equity);
  const dailyUsage = dayLoss / dailyAllowance;
  const totalUsage = Math.max(0, accountSize - input.equity) / totalAllowance;
  const softBudget = softShare * dailyAllowance;
  const softUsagePct = Math.min(1, dayLoss / Math.max(softBudget, 1e-9));
  const softHit = input.equity <= softFloor;

  const killNow = input.equity <= dailyFloor || input.equity <= totalFloor;
  const riskUsd = riskPerTrade * accountSize;
  // marge de sécurité: 2× risk/trade de distance aux floors pour ouvrir
  const marginOk = input.equity - dailyFloor > 2 * riskUsd && input.equity - totalFloor > 2 * riskUsd;
  const canOpenNewTrade = !killNow && !softHit && marginOk;

  const verdict: RiskGate['verdict'] = killNow
    ? 'RED'
    : softHit || dailyUsage >= 0.5 || totalUsage >= 0.5
      ? 'ORANGE'
      : 'GREEN';

  return {
    equity: input.equity,
    dayStartEquity: input.dayStartEquity,
    peakEodBalance: peak,
    riskPerTrade,
    floors: {
      daily: { floorUsd: dailyFloor, distanceUsd: input.equity - dailyFloor, usagePct: dailyUsage },
      total: { floorUsd: totalFloor, distanceUsd: input.equity - totalFloor, usagePct: totalUsage },
      softDaily: { floorUsd: softFloor, distanceUsd: input.equity - softFloor, usagePct: softUsagePct, hit: softHit },
    },
    lossesToSoftStop: riskUsd > 0 ? Math.floor(softBudget / riskUsd) : 0,
    lossesToDailyFloor: riskUsd > 0 ? Math.floor(dailyAllowance / riskUsd) : 0,
    canOpenNewTrade,
    reduceOnly: !killNow && (softHit || !marginOk),
    killNow,
    verdict,
  };
}
