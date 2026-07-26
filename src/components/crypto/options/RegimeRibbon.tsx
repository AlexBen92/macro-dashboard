'use client';

import type { GammaRegime, DealerDeltaBias, OptionLevel } from '@/lib/options/types';

interface RegimeRibbonProps {
  gammaRegime: GammaRegime;
  dealerDelta: DealerDeltaBias;
  spot: number | null;
  zeroGamma: OptionLevel | null;
}

const REGIME_STYLE: Record<
  GammaRegime,
  { bg: string; border: string; text: string; label: string; hint: string }
> = {
  positive: {
    bg: 'rgba(74,222,128,0.07)',
    border: 'var(--bull)',
    text: 'var(--bull)',
    label: 'γ POSITIVE',
    hint: 'amortit · range/mean-reversion · fade impulsions · breakouts échouent',
  },
  negative: {
    bg: 'rgba(255,51,85,0.07)',
    border: 'var(--bear)',
    text: 'var(--bear)',
    label: 'γ NEGATIVE',
    hint: 'amplifie · trend follow · breakouts crédibles · risque accélération',
  },
  neutral: {
    bg: 'rgba(140,140,160,0.05)',
    border: 'var(--muted)',
    text: 'var(--muted)',
    label: 'γ NEUTRAL',
    hint: 'régime indéterminé · patience · confirmer par prix',
  },
  unknown: {
    bg: 'rgba(140,140,160,0.04)',
    border: 'var(--border)',
    text: 'var(--muted)',
    label: 'γ UNKNOWN',
    hint: 'snapshot indispo ou données insuffisantes',
  },
};

const DEX_STYLE: Record<DealerDeltaBias, { color: string; label: string; hint: string }> = {
  long: {
    color: 'var(--bull)',
    label: 'DEX long',
    hint: 'setup long: conviction OK · setup short: contre-contexte, réduis taille',
  },
  short: {
    color: 'var(--bear)',
    label: 'DEX short',
    hint: 'setup short: conviction OK · setup long: contre-contexte, réduis taille',
  },
  flat: {
    color: 'var(--muted)',
    label: 'DEX flat',
    hint: 'pas de biais contextuel',
  },
  unknown: {
    color: 'var(--muted)',
    label: 'DEX n/a',
    hint: 'données indispo',
  },
};

export default function RegimeRibbon({
  gammaRegime,
  dealerDelta,
  spot,
  zeroGamma,
}: RegimeRibbonProps) {
  const g = REGIME_STYLE[gammaRegime];
  const d = DEX_STYLE[dealerDelta];

  const zgDist = zeroGamma?.strike && spot ? ((zeroGamma.strike - spot) / spot) * 100 : null;
  const zgClose = zgDist !== null && Math.abs(zgDist) <= 1.5;
  const zgSide =
    spot && zeroGamma?.strike
      ? spot > zeroGamma.strike
        ? 'above'
        : 'below'
      : null;

  return (
    <div
      className="border-l-[3px] px-3 py-2 flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4"
      style={{ background: g.bg, borderColor: g.border }}
    >
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="font-mono text-[0.65rem] uppercase tracking-[2px] font-semibold"
          style={{ color: g.text }}
        >
          {g.label}
        </span>
        <span className="font-mono text-[0.6rem] text-[var(--dim)] hidden md:inline">
          {g.hint}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="px-1.5 py-0.5 rounded-[2px] font-mono text-[0.6rem] uppercase tracking-[1.5px]"
          style={{
            color: d.color,
            background: `${d.color}11`,
            border: `1px solid ${d.color}44`,
          }}
          title={`RAW provider · pas dealer positioning\n${d.hint}`}
        >
          {d.label}
        </span>
        <span className="font-mono text-[0.55rem] text-[var(--dim)] hidden lg:inline">
          {d.hint}
        </span>
      </div>

      {zeroGamma && spot && (
        <div
          className="flex items-center gap-2 flex-shrink-0 lg:ml-auto"
          title="Zero Gamma = bascule régime · spot traverse → surveiller accélération"
        >
          <span className="font-mono text-[0.6rem] text-[var(--purple)] uppercase tracking-[1.5px]">
            ZG {zeroGamma.strike.toLocaleString('en-US', { maximumFractionDigits: 0 })}
          </span>
          <span
            className={`font-mono text-[0.6rem] tabular-nums ${zgClose ? 'animate-pulse' : ''}`}
            style={{
              color: zgClose ? 'var(--caution)' : 'var(--muted)',
              fontWeight: zgClose ? 600 : 400,
            }}
          >
            {zgDist !== null ? `${zgDist > 0 ? '+' : ''}${zgDist.toFixed(2)}%` : 'n/a'}
          </span>
          {zgClose && (
            <span className="font-mono text-[0.5rem] text-[var(--caution)] uppercase tracking-[1px] animate-pulse">
              ⚡ approche flip
            </span>
          )}
          {zgSide && !zgClose && (
            <span className="font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px]">
              spot {zgSide}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
