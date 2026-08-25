'use client';

import { useVolSurface } from '@/hooks/api/useVolSurface';
import type { VolAssetState } from '@/lib/cockpit/payloads';

/**
 * Bloc 3 — Rough vs Markovien: nature de la mémoire du marché.
 * Roughness (H 0→1), représentation mémoire (Markovien simple / lifté
 * N-facteurs / non-Markovien power-law), résumé court.
 */
export default function RoughVsMarkovCard() {
  const { data, isLoading, error } = useVolSurface();
  const btc = data?.assets.find((a) => a.asset === 'BTC') ?? null;

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="rough-markov-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          ROUGH vs MARKOVIEN
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">mémoire du marché</span>
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {data && (
        <div className="flex flex-col gap-2.5">
          {data.assets.map((a) => (
            <MemoryRow key={a.asset} a={a} />
          ))}
        </div>
      )}
      {btc && <Summary a={btc} />}
    </div>
  );
}

function memoryRepresentation(a: VolAssetState): { label: string; color: string; factors: string } {
  const h = a.hurst.H_iv_skew_scaling?.H ?? a.hurst.H_realized_vol;
  if (h === null) return { label: 'INCONNU', color: 'var(--dim)', factors: '—' };
  if (h < 0.2) return { label: 'NON-MARKOVIEN', color: 'var(--bear)', factors: 'kernel power-law (H<0.2)' };
  if (h < 0.4) return { label: 'MARKOVIEN LIFTÉ', color: 'var(--caution)', factors: 'multi-facteurs (3-5)' };
  return { label: 'MARKOVIEN SIMPLE', color: 'var(--bull)', factors: '1-2 facteurs' };
}

function MemoryRow({ a }: { a: VolAssetState }) {
  const h = a.hurst.H_iv_skew_scaling?.H ?? a.hurst.H_realized_vol;
  const mem = memoryRepresentation(a);
  const pct = h !== null ? Math.min(100, Math.max(0, h * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between font-mono text-[0.55rem]">
        <span className="font-bold">{a.asset}</span>
        <span style={{ color: mem.color }}>{mem.label} <span className="text-[var(--dim)]">({mem.factors})</span></span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[0.42rem] text-[var(--label)] w-12">rough</span>
        <div className="relative h-2 flex-1 rounded-[2px] bg-[var(--bg)] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-[2px]"
            style={{
              width: `${pct}%`,
              background: 'linear-gradient(90deg, var(--bear), var(--caution) 60%, var(--bull))',
            }}
          />
          <div className="absolute inset-y-0 left-[35%] w-px bg-[var(--border)]" title="H=0.35 seuil rough" />
        </div>
        <span className="font-mono text-[0.42rem] text-[var(--label)] w-12 text-right">brown</span>
        <span className="font-mono text-[0.55rem] font-bold w-10 text-right">H={h !== null ? h.toFixed(2) : '—'}</span>
      </div>
    </div>
  );
}

function Summary({ a }: { a: VolAssetState }) {
  const h = a.hurst.H_iv_skew_scaling?.H ?? a.hurst.H_realized_vol;
  let text: string;
  if (h === null) text = 'Estimation H indisponible ce cycle.';
  else if (h < 0.15)
    text = 'Vol très rugueuse — forte influence des chocs récents. Limiter breaks M15 agressifs, holds courts, stops serrés.';
  else if (h < 0.35)
    text = 'Vol rugueuse — les chocs récents pèsent davantage qu’un modèle markovien ne le prédit. Prudence sur les breakout M15.';
  else if (h < 0.45)
    text = 'Mémoire intermédiaire — approximation markovienne liftée (multi-facteurs) acceptable.';
  else
    text = 'Vol proche du Brownien — patterns M15 classiques (mean-reversion / breakout) plus fiables.';
  return (
    <div className="mt-1 rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
      {text}
    </div>
  );
}
