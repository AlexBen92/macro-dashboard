import { describe, expect, it } from 'vitest';
import {
  isCorrMacroStale,
  CORR_MACRO_STALE_MS,
  type CorrMacroPayload,
} from '@/hooks/api/useCorrMacro';
import { corrCellColor } from '@/lib/ui/corrColors';

function payload(overrides: Partial<CorrMacroPayload> = {}): CorrMacroPayload {
  return {
    as_of: '2026-09-19',
    last_export_success: '2026-09-20T05:41:00Z',
    rows: ['BTC', 'ETH', 'ALTS_INDEX'],
    cols: ['MSTR', 'M2SL'],
    windows: ['7d', '30d', '90d'],
    daily: { cells: [] },
    monthly: { window_months: 36, cells: [] },
    alt_index: { members: [], excluded: [], min_members_per_day: 20 },
    note: 'Contexte informatif — corrélation ≠ signal de trading validé',
    errors: [],
    ...overrides,
  };
}

describe('isCorrMacroStale', () => {
  it('fresh within 26h of export, stale beyond', () => {
    const now = Date.parse('2026-09-20T12:00:00Z');
    expect(isCorrMacroStale(payload(), now)).toBe(false);
    expect(isCorrMacroStale(
      payload({ as_of: '2026-09-18', last_export_success: '2026-09-18T05:41:00Z' }),
      now,
    )).toBe(true);
    // as_of J-1 mais export récent → frais (données daily, pas pipeline hs)
    expect(isCorrMacroStale(
      payload({ as_of: '2026-09-19', last_export_success: '2026-09-20T05:41:00Z' }),
      now,
    )).toBe(false);
  });

  it('stale when payload missing or dates unparseable', () => {
    expect(isCorrMacroStale(null)).toBe(true);
    expect(isCorrMacroStale(payload({ as_of: null, last_export_success: null }))).toBe(true);
  });

  it('threshold is 26h like the other dash-data fluxes', () => {
    expect(CORR_MACRO_STALE_MS).toBe(26 * 60 * 60 * 1000);
  });
});

describe('corrCellColor bands (seuils cockpit établis)', () => {
  it('diversifying below 0.20, cluster above 0.60, to-weight in between', () => {
    expect(corrCellColor(0.15).text).toBe('var(--bull)');
    expect(corrCellColor(-0.19).text).toBe('var(--bull)');
    expect(corrCellColor(0.35).text).toBe('var(--muted)');
    expect(corrCellColor(0.61).text).toBe('var(--caution)');
    expect(corrCellColor(-0.9).text).toBe('var(--caution)');
  });
});

describe('payload shape from exporter', () => {
  it('daily cells carry n (NYSE dates) and monthly cells carry n_obs (36m)', () => {
    const p = payload({
      daily: { cells: [{ row: 'BTC', col: 'MSTR', window: '30d', r: -0.089, n: 30 }] },
      monthly: { window_months: 36, cells: [{ row: 'BTC', col: 'M2SL', r: -0.02, n_obs: 36 }] },
    });
    expect(p.daily.cells[0].n).toBe(30);
    expect(p.monthly.cells[0].n_obs).toBe(36);
    expect(p.monthly.window_months).toBe(36);
    expect(p.note).toContain('Contexte informatif');
  });
});
