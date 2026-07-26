import { compactOI, compactUSD, fmtStrike } from './format';
import type { OptionsExposureSnapshot, OptionsRead } from './types';

export const READ_RULE_VERSION = 'v1';

function reg(v: string): string {
  return v.toLowerCase();
}

export function buildOptionsRead(s: OptionsExposureSnapshot): OptionsRead {
  const lv = s.levels;
  const cw = lv.callWall ? `${fmtStrike(lv.callWall.strike)} (${lv.callWall.distancePct.toFixed(1)}%)` : 'n/a';
  const pw = lv.putWall ? `${fmtStrike(lv.putWall.strike)} (${lv.putWall.distancePct.toFixed(1)}%)` : 'n/a';
  const zg = lv.zeroGamma ? fmtStrike(lv.zeroGamma.strike, 0) : 'n/a';
  const hv = lv.hvl ? fmtStrike(lv.hvl.strike) : 'n/a';

  const line1 = `GEX ${reg(s.regime.gamma)} · net ${compactUSD(s.aggregate.netGex)} · Zero Gamma ${zg}`;
  const line2 = `Call Wall ${cw} · Put Wall ${pw}`;
  const line3 = `DEX ${compactUSD(s.aggregate.netDex)} (${reg(s.regime.dealerDelta)}) · HVL ${hv} · OI ${compactOI(s.aggregate.totalOi)}`;

  return {
    lines: [line1, line2, line3],
    ruleVersion: READ_RULE_VERSION,
  };
}
