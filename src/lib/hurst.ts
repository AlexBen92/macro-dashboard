/**
 * Types Hurst multi-timeframe (dash-data/hurst_crypto.json).
 * Source: regime/src/export_hurst_crypto.py — DFA-1, HL candleSnapshot.
 */
export type HurstTimeframe = 'M15' | 'H1' | 'H4' | 'D1';

export type HurstRegime = 'trend' | 'neutral' | 'mean_revert';

export interface HurstTfEntry {
  h_short: number | null;
  h_struct: number | null;
  regime_short: HurstRegime | null;
  regime_struct: HurstRegime | null;
  windows: { short: number; struct: number };
  n_bars: number;
  last_close: number | null;
}

export type HurstAsset = Partial<Record<HurstTimeframe, HurstTfEntry>>;

export interface HurstCryptoPayload {
  as_of: string;
  method: string;
  source: string;
  assets: Record<string, HurstAsset>;
}

export const HURST_REGIME_COLOR: Record<HurstRegime, string> = {
  trend: 'var(--bull, #16a34a)',
  neutral: 'var(--muted, #8b8b8b)',
  mean_revert: 'var(--bear, #dc2626)',
};

export const HURST_TF_LABEL: Record<HurstTimeframe, string> = {
  M15: 'M15',
  H1: 'H1',
  H4: 'H4',
  D1: 'D1',
};

/** H ∈ [0,1] → 0.5 = marche aléatoire; >0.55 persistant, <0.45 anti-persistant. */
export function hurstBadgeTitle(tf: HurstTimeframe, e: HurstTfEntry): string {
  return (
    `Hurst ${tf} (DFA-1, ${e.windows.short} barres): H=${e.h_short ?? '—'} ` +
    `(${e.regime_short ?? '—'}) · structurel ${e.windows.struct} barres: ` +
    `H=${e.h_struct ?? '—'} (${e.regime_struct ?? '—'}) · ${e.n_bars} barres HL`
  );
}
