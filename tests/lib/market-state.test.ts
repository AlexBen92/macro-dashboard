import { describe, expect, it } from 'vitest';

import { computeMarketState, MARKET_STATE_RULE } from '@/lib/marketState';
import type { CorrMacroDailyCell, CorrMacroMonthlyCell } from '@/hooks/api/useCorrMacro';

const ROWS = ['BTC', 'ETH', 'ALTS_INDEX'];

function cell(row: string, col: string, window: string, r: number): CorrMacroDailyCell {
  return { row, col, window, r, n: 25 };
}

function monthly(row: string, col: string, r: number): CorrMacroMonthlyCell {
  return { row, col, r, n_obs: 36 };
}

const RISQUE_COLS = ['NVDA', 'MSTR', '^NDX', '^GSPC'];

function risque30(r: number): CorrMacroDailyCell[] {
  return ROWS.flatMap((row) => RISQUE_COLS.map((col) => cell(row, col, '30d', r)));
}

describe('computeMarketState', () => {
  it('HAUSSIER quand perf > +2% et rho risque 30j >= 0.30', () => {
    const s = computeMarketState(
      risque30(0.5),
      [],
      ROWS,
      { BTC: 0.06, ETH: 0.04, ALTS_INDEX: 0.08 },
    );
    expect(s.verdict).toBe('HAUSSIER');
    expect(s.perfMean30d).toBeCloseTo(0.06, 5);
  });

  it('BAISSIER quand perf < -2% et rho risque 30j >= 0.30', () => {
    const s = computeMarketState(
      risque30(0.4),
      [],
      ROWS,
      { BTC: -0.05, ETH: -0.07, ALTS_INDEX: -0.03 },
    );
    expect(s.verdict).toBe('BAISSIER');
  });

  it('NEUTRE en découplage (rho < 0.30) même sur forte perf', () => {
    const s = computeMarketState(
      risque30(0.1),
      [],
      ROWS,
      { BTC: 0.10, ETH: 0.08, ALTS_INDEX: 0.06 },
    );
    expect(s.verdict).toBe('NEUTRE');
  });

  it('NEUTRE quand perf plate même avec rho élevé', () => {
    const s = computeMarketState(
      risque30(0.6),
      [],
      ROWS,
      { BTC: 0.01, ETH: 0.005, ALTS_INDEX: -0.005 },
    );
    expect(s.verdict).toBe('NEUTRE');
  });

  it('INDISPONIBLE sans perf_30d (payload ancien)', () => {
    const s = computeMarketState(risque30(0.5), [], ROWS, undefined);
    expect(s.verdict).toBe('INDISPONIBLE');
  });

  it('famille liquidité = corr mensuelle 36m, familles daily = ρ30 et ρ90', () => {
    const cells = [
      ...risque30(0.5),
      cell('BTC', '^TYX', '90d', -0.4),
      cell('ETH', '^TYX', '90d', -0.3),
    ];
    const monthlyCells = [monthly('BTC', 'M2SL', 0.35), monthly('ETH', 'M2SL', 0.25)];
    const s = computeMarketState(cells, monthlyCells, ROWS, { BTC: 0.05 });
    const taux = s.families.find((f) => f.id === 'taux');
    expect(taux?.rho30).toBeNull();
    expect(taux?.rho90).toBeCloseTo(-0.35, 5);
    const liq = s.families.find((f) => f.id === 'liquidite');
    expect(liq?.rho36m).toBeCloseTo(0.3, 5);
  });

  it('rule exposée = libellé descriptif', () => {
    expect(MARKET_STATE_RULE).toContain('HAUSSIER');
    expect(MARKET_STATE_RULE).toContain('BAISSIER');
    expect(MARKET_STATE_RULE).toContain('NEUTRE');
  });
});
