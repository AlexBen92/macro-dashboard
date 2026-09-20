import type { CorrMacroDailyCell, CorrMacroMonthlyCell } from '@/hooks/api/useCorrMacro';

export type MarketVerdict = 'HAUSSIER' | 'BAISSIER' | 'NEUTRE' | 'INDISPONIBLE';

export interface MarketStateFamily {
  id: string;
  label: string;
  rho30: number | null;
  rho90: number | null;
  rho36m: number | null;
}

export interface MarketState {
  verdict: MarketVerdict;
  perfMean30d: number | null;
  families: MarketStateFamily[];
  rule: string;
}

export const MARKET_STATE_RULE =
  'perf 30j > +2% et ρ risque 30j ≥ +0.30 → HAUSSIER · < −2% et ρ ≥ +0.30 → BAISSIER · sinon NEUTRE (découplage ou tendance plate)';

const FAMILIES: Array<{ id: string; label: string; cols: string[] }> = [
  { id: 'risque', label: 'Risque/équités', cols: ['NVDA', 'MSTR', 'MARA', 'CLSK', 'COIN', 'RIOT', '^NDX', '^GSPC'] },
  { id: 'taux', label: 'Taux long', cols: ['^TYX'] },
  { id: 'vol', label: 'Vol', cols: ['^VIX'] },
  { id: 'dollar', label: 'Dollar', cols: ['DX-Y.NYB'] },
];

const LIQUIDITE_COLS = ['M2SL', 'UNRATE'];
const PERF_THRESHOLD = 0.02;
const RHO_THRESHOLD = 0.3;

function meanRho(
  cells: CorrMacroDailyCell[],
  rows: string[],
  cols: string[],
  window: string,
): number | null {
  const vals = cells
    .filter((c) => window === c.window && cols.includes(c.col) && rows.includes(c.row))
    .map((c) => c.r);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function meanRhoMonthly(
  cells: CorrMacroMonthlyCell[],
  rows: string[],
  cols: string[],
): number | null {
  const vals = cells
    .filter((c) => cols.includes(c.col) && rows.includes(c.row))
    .map((c) => c.r);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function computeMarketState(
  dailyCells: CorrMacroDailyCell[],
  monthlyCells: CorrMacroMonthlyCell[],
  rows: string[],
  perf30d: Record<string, number | null> | undefined,
): MarketState {
  const perfs = rows
    .map((r) => perf30d?.[r])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  const perfMean30d = perfs.length > 0 ? perfs.reduce((a, b) => a + b, 0) / perfs.length : null;

  const families: MarketStateFamily[] = FAMILIES.map((f) => ({
    id: f.id,
    label: f.label,
    rho30: meanRho(dailyCells, rows, f.cols, '30d'),
    rho90: meanRho(dailyCells, rows, f.cols, '90d'),
    rho36m: null,
  }));
  families.push({
    id: 'liquidite',
    label: 'Liquidité (lent)',
    rho30: null,
    rho90: null,
    rho36m: meanRhoMonthly(monthlyCells, rows, LIQUIDITE_COLS),
  });

  const rhoRisque30 = families.find((f) => f.id === 'risque')?.rho30 ?? null;

  let verdict: MarketVerdict = 'INDISPONIBLE';
  if (perfMean30d !== null && rhoRisque30 !== null) {
    if (perfMean30d > PERF_THRESHOLD && rhoRisque30 >= RHO_THRESHOLD) verdict = 'HAUSSIER';
    else if (perfMean30d < -PERF_THRESHOLD && rhoRisque30 >= RHO_THRESHOLD) verdict = 'BAISSIER';
    else verdict = 'NEUTRE';
  }

  return { verdict, perfMean30d, families, rule: MARKET_STATE_RULE };
}
