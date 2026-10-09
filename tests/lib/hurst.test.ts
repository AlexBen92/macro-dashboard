import { describe, expect, it } from 'vitest';

import {
  HURST_REGIME_COLOR,
  hurstBadgeTitle,
  type HurstTfEntry,
} from '@/lib/hurst';

const entry = (over: Partial<HurstTfEntry> = {}): HurstTfEntry => ({
  h_short: 0.62,
  h_struct: 0.58,
  regime_short: 'trend',
  regime_struct: 'trend',
  windows: { short: 60, struct: 120 },
  n_bars: 400,
  last_close: 100,
  ...over,
});

describe('lib/hurst', () => {
  it('hurstBadgeTitle expose TF, fenêtres et les deux horizons', () => {
    const t = hurstBadgeTitle('H4', entry());
    expect(t).toContain('Hurst H4');
    expect(t).toContain('60 barres');
    expect(t).toContain('120 barres');
    expect(t).toContain('0.62');
    expect(t).toContain('0.58');
  });

  it('hurstBadgeTitle tolère les valeurs nulles', () => {
    const t = hurstBadgeTitle('M15', entry({ h_short: null, regime_short: null }));
    expect(t).toContain('H=—');
    expect(t).toContain('(—)');
  });

  it('chaque régime a une couleur définie', () => {
    for (const r of ['trend', 'neutral', 'mean_revert'] as const) {
      expect(HURST_REGIME_COLOR[r]).toBeTruthy();
    }
  });
});
