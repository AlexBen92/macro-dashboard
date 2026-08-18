'use client';

import { useEffect, useState } from 'react';

/**
 * Signaux composites recherche (VW-TSMOM · Funding · MACD consensus) —
 * /api/crypto-signals-advanced. Aucune de ces familles VALIDATED par le
 * protocole WF/DSR/PBO (funding divergence NULL V21 §D2) → à afficher
 * uniquement dans ExploratorySection, jamais comme signal actionnable.
 */

interface CryptoSignal {
  symbol: string;
  composite: { overall: string; confidence: number; reasons: string[] };
  vwtsmom: { direction: string };
  funding: { signal: string };
  macd_consensus: string;
}

export default function CompositeSignalsPanel() {
  const [signals, setSignals] = useState<CryptoSignal[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/crypto-signals-advanced');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as { signals?: CryptoSignal[] };
        setSignals(data.signals ?? []);
        setError(false);
      } catch {
        setError(true);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const active = signals.filter((s) => s.composite?.overall === 'long' || s.composite?.overall === 'short');

  if (error) {
    return (
      <div className="font-mono text-[0.6rem] text-[var(--muted)] uppercase tracking-[2px]">
        signaux composites indisponibles
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
        signaux actifs {active.length}/{signals.length} · refresh 60s · recherche non tradable
      </div>
      {active.length === 0 ? (
        <div className="font-mono text-[0.6rem] text-[var(--dim)]">
          aucun signal actif — WAIT
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {active.map((s) => {
            const long = s.composite.overall === 'long';
            return (
              <div
                key={s.symbol}
                className="bg-[var(--bg2)] border rounded-[4px] p-3"
                style={{ borderColor: long ? 'var(--bull)' : 'var(--bear)', opacity: 0.85 }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[0.8rem] font-bold text-[var(--label)]">{s.symbol}</span>
                  <span
                    className="font-mono text-[0.6rem] font-bold uppercase tracking-[2px]"
                    style={{ color: long ? 'var(--bull)' : 'var(--bear)' }}
                  >
                    {s.composite.overall} · {s.composite.confidence}%
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 font-mono text-[0.58rem] text-center">
                  <div className="bg-[var(--bg3)] rounded-[2px] py-1">
                    <div className="text-[var(--muted)] text-[0.5rem]">VW-TSMOM</div>
                    <div className="text-[var(--text)]">{s.vwtsmom?.direction?.slice(0, 4).toUpperCase() ?? '—'}</div>
                  </div>
                  <div className="bg-[var(--bg3)] rounded-[2px] py-1">
                    <div className="text-[var(--muted)] text-[0.5rem]">FUNDING</div>
                    <div className="text-[var(--text)]">{s.funding?.signal?.slice(0, 4).toUpperCase() ?? '—'}</div>
                  </div>
                  <div className="bg-[var(--bg3)] rounded-[2px] py-1">
                    <div className="text-[var(--muted)] text-[0.5rem]">MACD</div>
                    <div className="text-[var(--text)]">{s.macd_consensus?.slice(0, 4).toUpperCase() ?? '—'}</div>
                  </div>
                </div>
                {s.composite.reasons?.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-[var(--border)] font-mono text-[0.55rem] text-[var(--dim)]">
                    {s.composite.reasons.slice(0, 2).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
