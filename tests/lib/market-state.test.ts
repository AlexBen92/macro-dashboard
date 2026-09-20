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
  it('HAUSSIER quand perf 30j > +2% et rho risque 30j >= 0.30', () => {
    const s = computeMarketState(
      risque30(0.5),
      [],
      ROWS,
      { perf: { '30d': { BTC: 0.06, ETH: 0.04, ALTS_INDEX: 0.08 } } },
    );
    expect(s.verdict).toBe('HAUSSIER');
    expect(s.perfMean30d).toBeCloseTo(0.06, 5);
  });

  it('BAISSIER quand perf 30j < -2% et rho risque 30j >= 0.30', () => {
    const s = computeMarketState(
      risque30(0.4),
      [],
      ROWS,
      { perf: { '30d': { BTC: -0.05, ETH: -0.07, ALTS_INDEX: -0.03 } } },
    );
    expect(s.verdict).toBe('BAISSIER');
  });

  it('expose les 3 horizons perf (1j, 7j, 30j)', () => {
    const s = computeMarketState(
      risque30(0.5),
      [],
      ROWS,
      {
        perf: {
          '1d': { BTC: 0.01, ETH: -0.005, ALTS_INDEX: 0.02 },
          '7d': { BTC: 0.03, ETH: 0.025, ALTS_INDEX: 0.05 },
          '30d': { BTC: 0.06, ETH: 0.05, ALTS_INDEX: 0.07 },
        },
      },
    );
    expect(s.perfHorizons.map((h) => h.id)).toEqual(['1d', '7d', '30d']);
    expect(s.perfHorizons[0].mean).toBeCloseTo(0.0083, 4);
    expect(s.perfHorizons[1].mean).toBeCloseTo(0.035, 5);
    expect(s.perfHorizons[2].mean).toBeCloseTo(0.06, 5);
    expect(s.verdict).toBe('HAUSSIER');
  });

  it('verdict basé sur 30j même si 1j/7j forts', () => {
    const s = computeMarketState(
      risque30(0.6),
      [],
      ROWS,
      {
        perf: {
          '1d': { BTC: 0.05, ETH: 0.06, ALTS_INDEX: 0.04 },
          '30d': { BTC: 0.01, ETH: 0.005, ALTS_INDEX: -0.005 },
        },
      },
    );
    expect(s.verdict).toBe('NEUTRE');
  });

  it('NEUTRE en découplage (rho < 0.30) même sur forte perf', () => {
    const s = computeMarketState(
      risque30(0.1),
      [],
      ROWS,
      { perf: { '30d': { BTC: 0.10, ETH: 0.08, ALTS_INDEX: 0.06 } } },
    );
    expect(s.verdict).toBe('NEUTRE');
  });

  it('fallback payload ancien perf_30d', () => {
    const s = computeMarketState(risque30(0.5), [], ROWS, { perf_30d: { BTC: 0.06, ETH: 0.05 } });
    expect(s.verdict).toBe('HAUSSIER');
    expect(s.perfHorizons[0].mean).toBeNull();
  });

  it('INDISPONIBLE sans perf', () => {
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
    const s = computeMarketState(cells, monthlyCells, ROWS, { perf: { '30d': { BTC: 0.05 } } });
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
