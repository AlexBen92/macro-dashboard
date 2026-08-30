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
