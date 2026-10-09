'use client';

import { useHurstCrypto } from '@/hooks/api/useHurstCrypto';
import {
  HURST_REGIME_COLOR,
  hurstBadgeTitle,
  type HurstTimeframe,
} from '@/lib/hurst';

interface HurstBadgeProps {
  symbol: string;
  timeframe: HurstTimeframe;
}

/** Exposant de Hurst (DFA-1, HL) pour un couple actif × timeframe.
 *  Affiché partout où un timeframe est sélectionné (/crypto topbar). */
export default function HurstBadge({ symbol, timeframe }: HurstBadgeProps) {
  const { data } = useHurstCrypto();
  const entry = data?.assets?.[symbol]?.[timeframe];

  if (!entry) {
    return (
      <span
        className="px-2 py-1 rounded-[3px] font-mono text-[0.6rem] tracking-[1px] bg-[var(--bg2)] text-[var(--muted)] border border-[var(--border)]"
        title="Hurst indisponible (export horaire VPS)"
      >
        H {timeframe} —
      </span>
    );
  }

  const color = HURST_REGIME_COLOR[entry.regime_short ?? 'neutral'];
  return (
    <span
      className="px-2 py-1 rounded-[3px] font-mono text-[0.6rem] tracking-[1px] bg-[var(--bg2)] border border-[var(--border)] flex items-center gap-1.5"
      title={hurstBadgeTitle(timeframe, entry)}
    >
      <span className="text-[var(--muted)] uppercase">H {timeframe}</span>
      <span style={{ color }} className="font-semibold">
        {entry.h_short?.toFixed(2) ?? '—'}
      </span>
      <span style={{ color }} className="uppercase text-[0.5rem]">
        {entry.regime_short ?? '—'}
      </span>
    </span>
  );
}
