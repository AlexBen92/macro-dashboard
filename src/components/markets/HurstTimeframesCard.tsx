'use client';

import { useHurstCrypto } from '@/hooks/api/useHurstCrypto';
import {
  HURST_REGIME_COLOR,
  hurstBadgeTitle,
  type HurstTimeframe,
} from '@/lib/hurst';

const TFS: HurstTimeframe[] = ['M15', 'H1', 'H4', 'D1'];
const COINS = ['BTC', 'ETH', 'SOL'];

/** Carte Hurst multi-timeframe (/markets) — DFA-1, HL, export horaire VPS.
 *  Complète le Hurst D1 du RegimeMatrixTable avec les TF d'exécution. */
export default function HurstTimeframesCard() {
  const { data, isLoading } = useHurstCrypto();

  return (
    <div className="rounded-[4px] border border-[var(--border)] bg-[var(--bg2)] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.62rem] text-[var(--label)] tracking-[2px] uppercase">
          Hurst exponent — BTC · ETH · SOL × timeframe
        </div>
        <div className="font-mono text-[0.55rem] text-[var(--muted)]">
          DFA-1 · 60/120 barres · HL ·{' '}
          {data?.as_of
            ? new Date(data.as_of).toISOString().slice(11, 16) + 'Z'
            : isLoading
              ? '…'
              : 'indisponible'}
        </div>
      </div>
      <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] gap-x-3 gap-y-2">
        <div />
        {TFS.map((tf) => (
          <div
            key={tf}
            className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]"
          >
            {tf}
          </div>
        ))}
        {COINS.map((coin) => (
          <div key={coin} className="contents">
            <div className="font-mono text-[0.65rem] text-[var(--text)] font-semibold">
              {coin}
            </div>
            {TFS.map((tf) => {
              const e = data?.assets?.[coin]?.[tf];
              if (!e) {
                return (
                  <div
                    key={tf}
                    className="font-mono text-[0.65rem] text-[var(--muted)]"
                  >
                    —
                  </div>
                );
              }
              const color = HURST_REGIME_COLOR[e.regime_short ?? 'neutral'];
              return (
                <div
                  key={tf}
                  className="flex items-baseline gap-1.5 cursor-help"
                  title={hurstBadgeTitle(tf, e)}
                >
                  <span
                    className="font-mono text-[0.78rem] font-semibold"
                    style={{ color }}
                  >
                    {e.h_short?.toFixed(2) ?? '—'}
                  </span>
                  <span
                    className="font-mono text-[0.48rem] uppercase"
                    style={{ color }}
                  >
                    {e.regime_short ?? '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 font-mono text-[0.5rem] text-[var(--muted)] leading-relaxed">
        H&gt;0.55 persistant (trend) · H&lt;0.45 anti-persistant (mean-revert) ·
        sinon marche aléatoire. Lecture par TF: M15 microstructure vs D1 régime
        de fond — jamais un signal directionnel seul.
      </div>
    </div>
  );
}
