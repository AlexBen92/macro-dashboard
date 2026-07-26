import type { OptionLevel, StrikeExposure } from './types';

export function distancePct(strike: number, spot: number): number {
  if (!Number.isFinite(strike) || !Number.isFinite(spot) || spot === 0) return 0;
  return ((strike - spot) / spot) * 100;
}

export function sortByStrikeAsc(
  a: StrikeExposure,
  b: StrikeExposure,
): number {
  return a.strike - b.strike;
}

function buildLevel(
  kind: OptionLevel['kind'],
  strike: number,
  spot: number | null,
  note?: string,
): OptionLevel {
  return {
    kind,
    strike,
    distancePct: spot == null ? 0 : distancePct(strike, spot),
    source: 'computed',
    note,
  };
}

export function findCallWall(
  strikes: StrikeExposure[],
  spot: number | null,
): OptionLevel | null {
  if (strikes.length === 0) return null;
  let best = strikes[0];
  for (const s of strikes) {
    if (s.callGex > best.callGex) best = s;
  }
  if (best.callGex <= 0) return null;
  return buildLevel('call_wall', best.strike, spot);
}

export function findPutWall(
  strikes: StrikeExposure[],
  spot: number | null,
): OptionLevel | null {
  if (strikes.length === 0) return null;
  let best = strikes[0];
  for (const s of strikes) {
    if (s.putGex < best.putGex) best = s;
  }
  if (best.putGex >= 0) return null;
  return buildLevel('put_wall', best.strike, spot);
}

export function findHvl(
  strikes: StrikeExposure[],
  spot: number | null,
): OptionLevel | null {
  if (strikes.length === 0) return null;
  let best = strikes[0];
  let bestAbs = Math.abs(best.netGex);
  for (const s of strikes) {
    const a = Math.abs(s.netGex);
    if (a > bestAbs) {
      best = s;
      bestAbs = a;
    }
  }
  if (bestAbs === 0) return null;
  return buildLevel('hvl', best.strike, spot, 'max |netGex|');
}

export function findZeroGamma(
  strikes: StrikeExposure[],
  spot: number | null,
): OptionLevel | null {
  if (strikes.length < 2) return null;
  const sorted = [...strikes].sort(sortByStrikeAsc);
  let cumulative = 0;
  const cumPoints: Array<{ strike: number; cum: number }> = [];
  for (const s of sorted) {
    cumulative += s.netGex;
    cumPoints.push({ strike: s.strike, cum: cumulative });
  }
  for (let i = 1; i < cumPoints.length; i++) {
    const prev = cumPoints[i - 1];
    const cur = cumPoints[i];
    if (
      (prev.cum < 0 && cur.cum >= 0) ||
      (prev.cum > 0 && cur.cum <= 0)
    ) {
      const slope = cur.cum - prev.cum;
      const frac = slope === 0 ? 0 : -prev.cum / slope;
      const k = prev.strike + frac * (cur.strike - prev.strike);
      return buildLevel('zero_gamma', k, spot, 'cumulative GEX sign change');
    }
  }
  return null;
}
