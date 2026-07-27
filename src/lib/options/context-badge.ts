import type { ContextBadge, ContextState, CorrCellLike } from './types';

export const CONTEXT_RULE_VERSION = 'v2';

function find(
  cells: CorrCellLike[] | null | undefined,
  a: string,
  b: string,
  window: string,
): number | null {
  if (!cells) return null;
  const c = cells.find(
    (x) =>
      ((x.a === a && x.b === b) || (x.a === b && x.b === a)) && x.window === window,
  );
  if (!c) return null;
  if (!Number.isFinite(c.r)) return null;
  return c.r;
}

export function computeContextBadge(
  corrCells: CorrCellLike[] | null | undefined,
): ContextState {
  const evidence: string[] = [];
  if (!corrCells || corrCells.length === 0) {
    return {
      badge: 'not_configured',
      ruleVersion: CONTEXT_RULE_VERSION,
      evidence: ['no correlation cells supplied'],
    };
  }

  const btcDxy7 = find(corrCells, 'BTC', 'DXY', '7d');
  const btcSpx7 = find(corrCells, 'BTC', 'SPX', '7d');
  const btcDxy30 = find(corrCells, 'BTC', 'DXY', '30d');
  const btcSpx30 = find(corrCells, 'BTC', 'SPX', '30d');

  const points: number[] = [btcDxy7, btcSpx7, btcDxy30, btcSpx30].filter(
    (x): x is number => x != null,
  );
  if (points.length < 2) {
    return {
      badge: 'insufficient',
      ruleVersion: CONTEXT_RULE_VERSION,
      evidence: [`only ${points.length}/4 correlation points available`],
    };
  }

  let badge: ContextBadge = 'mixed';

  if (btcDxy7 != null && btcSpx7 != null && btcDxy7 > 0.30 && btcSpx7 < 0.10) {
    badge = 'risk-off';
    evidence.push(
      `BTC-DXY 7d r=${btcDxy7.toFixed(2)} > +0.30 AND BTC-SPX 7d r=${btcSpx7.toFixed(2)} < +0.10`,
    );
  } else if (btcSpx7 != null && btcDxy7 != null && btcSpx7 > 0.30 && btcDxy7 < 0.10) {
    badge = 'risk-on';
    evidence.push(
      `BTC-SPX 7d r=${btcSpx7.toFixed(2)} > +0.30 AND BTC-DXY 7d r=${btcDxy7.toFixed(2)} < +0.10`,
    );
  } else {
    badge = 'mixed';
    evidence.push(
      `no risk-on/off trigger (BTC-DXY 7d=${btcDxy7?.toFixed(2) ?? 'n/a'}, BTC-SPX 7d=${btcSpx7?.toFixed(2) ?? 'n/a'})`,
    );
  }

  return { badge, ruleVersion: CONTEXT_RULE_VERSION, evidence };
}
