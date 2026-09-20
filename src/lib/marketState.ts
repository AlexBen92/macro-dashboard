import type { CorrMacroDailyCell, CorrMacroMonthlyCell } from '@/hooks/api/useCorrMacro';

export type MarketVerdict = 'HAUSSIER' | 'BAISSIER' | 'NEUTRE' | 'INDISPONIBLE';

export interface MarketStateFamily {
  id: string;
  label: string;
  rho30: number | null;
  rho90: number | null;
  rho36m: number | null;
}

export interface MarketPerfHorizon {
  id: '1d' | '7d' | '30d';
  label: string;
  mean: number | null;
}

export interface MarketState {
  verdict: MarketVerdict;
  perfMean30d: number | null;
  perfHorizons: MarketPerfHorizon[];
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

export type MarketPerfPayload = {
  perf?: Partial<Record<'1d' | '7d' | '30d', Record<string, number>>>;
  perf_30d?: Record<string, number | null>;
};

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

function horizonMean(
  rows: string[],
  perf: MarketPerfPayload,
  horizon: '1d' | '7d' | '30d',
): number | null {
  const values = rows
    .map((r) => perf.perf?.[horizon]?.[r])
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) {
    if (horizon !== '30d') return null;
    const legacy = rows
      .map((r) => perf.perf_30d?.[r])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (legacy.length === 0) return null;
    return legacy.reduce((a, b) => a + b, 0) / legacy.length;
  }
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeMarketState(
  dailyCells: CorrMacroDailyCell[],
  monthlyCells: CorrMacroMonthlyCell[],
  rows: string[],
  perf: MarketPerfPayload | undefined,
): MarketState {
  const perfHorizons: MarketPerfHorizon[] = [
    { id: '1d', label: '1j', mean: horizonMean(rows, perf ?? {}, '1d') },
    { id: '7d', label: '7j', mean: horizonMean(rows, perf ?? {}, '7d') },
    { id: '30d', label: '30j', mean: horizonMean(rows, perf ?? {}, '30d') },
  ];
  const perfMean30d = perfHorizons.find((h) => h.id === '30d')?.mean ?? null;

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

  return { verdict, perfMean30d, perfHorizons, families, rule: MARKET_STATE_RULE };
}
