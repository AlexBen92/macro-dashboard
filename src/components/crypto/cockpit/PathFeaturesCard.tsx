'use client';

import { useVolSurface } from '@/hooks/api/useVolSurface';
import type { PathFeatureState } from '@/lib/cockpit/payloads';

const PATH_COLOR: Record<string, string> = {
  STABLE: 'var(--bull)',
  NEUTRAL: 'var(--muted)',
  CHAOTIC: 'var(--bear)',
  TRANSITION: 'var(--caution)',
  INSUFFICIENT_DATA: 'var(--dim)',
};

/**
 * Bloc 9 — Path features: log-signature ordre 2 (prix, vol) + score de
 * chemin STABLE / CHAOTIC / TRANSITION, description par actif.
 */
export default function PathFeaturesCard() {
  const { data, isLoading, error } = useVolSurface();
  const paths = data?.path_features ?? [];

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="path-features-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          PATH SIGNATURES & MÉMOIRE
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">fenêtre 96 barres M15</span>
      </div>
      <div className="mb-2 rounded-[3px] border border-dashed border-[var(--caution)]/40 px-2 py-1 font-mono text-[0.45rem] leading-relaxed text-[var(--caution)]">
        EXPÉRIMENTAL — non validé (WF/permutation/PBO), affiché à titre de R&amp;D.
        N&apos;influence aucun gate, aucun sizing, aucune décision.
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {paths.length === 0 && !isLoading && !error && (
        <div className="font-mono text-[0.55rem] text-[var(--dim)]">aucun path calculé</div>
      )}
      <div className="flex flex-col gap-1.5">
        {paths.map((p) => (
          <PathRow key={p.asset} p={p} />
        ))}
      </div>
      {data && data.basis_path_btc.length > 1 && (
        <div className="mt-2 font-mono text-[0.45rem] text-[var(--dim)]">
          Historique basis BTC: {data.basis_path_btc.length} points · dernier{' '}
          {data.basis_path_btc[data.basis_path_btc.length - 1].toFixed(2)}bps
        </div>
      )}
    </div>
  );
}

function PathRow({ p }: { p: PathFeatureState }) {
  const color = PATH_COLOR[p.path_label] ?? 'var(--dim)';
  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 font-mono text-[0.5rem]">
        <span className="font-bold text-[0.6rem]">{p.asset}</span>
        <span className="px-1.5 py-0.5 rounded-[2px] border" style={{ color, borderColor: color }}>
          {p.path_label}
        </span>
        <span className="text-[var(--dim)]">
          chaos {p.chaos_score.toFixed(2)} · RV {p.realized_vol_pct_bar.toFixed(2)}%/bar · jumps{' '}
          {p.jumps_4sigma}
          {p.rv_ratio_24h !== null && <> · ratio vol 24h {p.rv_ratio_24h.toFixed(2)}x</>}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative h-1.5 flex-1 rounded-[2px] bg-[var(--bg2)] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-[2px]"
            style={{ width: `${p.chaos_score * 100}%`, background: color }}
          />
        </div>
      </div>
      <div className="mt-1 font-mono text-[0.45rem] text-[var(--muted)] leading-relaxed">
        {p.description}
        {p.signature && (
          <span className="text-[var(--dim)]">
            {' '}· sig [X,X]={p.signature.xx.toExponential(1)} [X,Y]={p.signature.xy.toFixed(3)}{' '}
            [Y,Y]={p.signature.yy.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}
