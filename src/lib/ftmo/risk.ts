import { PIP_VALUES, FTMO_ACCOUNT, DEFAULT_RISK_PCT } from './constants';

export function calculateLotSize(
  instrument: string,
  stopLossPips: number,
  accountBalance = FTMO_ACCOUNT,
  riskPercent = DEFAULT_RISK_PCT,
): { lots: number; riskUsd: number; riskPct: number } {
  const riskUsd = accountBalance * (riskPercent / 100);
  const pipValue = PIP_VALUES[instrument] || 10;
  const lots = Math.floor((riskUsd / (stopLossPips * pipValue)) * 100) / 100;
  return { lots: Math.max(0.01, lots), riskUsd: Math.round(riskUsd), riskPct: riskPercent };
}
