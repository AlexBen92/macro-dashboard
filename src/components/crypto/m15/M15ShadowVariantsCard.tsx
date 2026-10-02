'use client';

/**
 * Tableau variantes shadow (doc v3, cap 18) + lentilles comptables + sims
 * de capacité. Lecture seule — verdicts produits par stats_shadow VPS.
 */
import { useM15Shadow } from '@/hooks/api/useM15Shadow';

const VERDICT_TONE: Record<string, string> = {
  VALIDATED: 'var(--bull)',
  NULL: 'var(--bear)',
  STOP_LIVE: 'var(--bear)',
  INSUFFICIENT: 'var(--muted)',
};

export function M15ShadowVariantsCard() {
  const { data, isLoading, error, isStale } = useM15Shadow();

  if (isLoading) {
    return (
      <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 font-mono text-[0.5rem] text-[var(--muted)]">
        Variantes shadow · chargement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 font-mono text-[0.5rem] text-[var(--muted)]">
        Variantes shadow · indisponible ({error ?? 'aucune donnée'})
      </div>
    );
  }

  const variants = Object.entries(data.variants ?? {})
    .sort(([a], [b]) => a.localeCompare(b));
  const sims = data.capacity_sims;
  const lenses = data.lenses;
  const ss = lenses?.side_split ?? {};
  const sz = lenses?.sizing_lens;

  return (
    <div className={`rounded-[3px] border bg-[var(--bg2)] px-3 py-2 flex flex-col gap-2 ${isStale ? 'border-[var(--caution)]/50' : 'border-[var(--border)]'}`}>
      <div className="flex items-center justify-between font-mono text-[0.5rem]">
        <span className="font-bold text-[var(--label)]">Panel shadow · cap 18 essais</span>
        <span className="text-[var(--muted)]">{variants.length} lignes · fee_gate V0 {data.fee_gate_v0?.pct ?? '—'}%</span>
      </div>

      <table className="w-full border-collapse font-mono text-[0.45rem]">
        <thead>
          <tr className="text-[var(--label)] text-left">
            <th className="pr-2 font-medium">variante</th>
            <th className="pr-2 font-medium">n/n_eff</th>
            <th className="pr-2 font-medium">R moyen</th>
            <th className="font-medium">verdict</th>
          </tr>
        </thead>
        <tbody>
          {variants.map(([vid, v]) => (
            <tr key={vid} className="border-b border-[var(--border)]/40">
              <td className={`py-0.5 pr-2 ${vid === 'V0' ? 'font-bold text-[var(--label)]' : ''}`}>{vid}</td>
              <td className="pr-2 text-[var(--muted)]">{v.n ?? 0}/{v.n_eff ?? 0}c</td>
              <td className="pr-2" style={{ color: (v.avg_r ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                {v.avg_r ?? '—'}
              </td>
              <td style={{ color: VERDICT_TONE[v.verdict ?? ''] ?? 'var(--dim)' }}>{v.verdict ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sims && (
        <div className="font-mono text-[0.45rem] text-[var(--muted)] leading-relaxed">
          Sims capacité ({sims.n_stream ?? '—'} setups): FCFS {sims['CAP-FCFS']?.avg_r ?? '—'} R
          ({sims['CAP-FCFS']?.n_admitted ?? '—'} admis) vs SCORE {sims['CAP-SCORE']?.avg_r ?? '—'} R
          ({sims['CAP-SCORE']?.n_admitted ?? '—'} admis) · ORISK {sims.orisk?.status ?? '—'}
          <span className="text-[var(--dim)]"> — sims = orientation, pas une vérité d&apos;exécution.</span>
        </div>
      )}

      {sz && (
        <div className="font-mono text-[0.45rem] text-[var(--muted)] leading-relaxed">
          Lentilles (hors cap): L {ss.long?.n ?? 0}/{ss.long?.avg_r ?? '—'} · S {ss.short?.n ?? 0}/{ss.short?.avg_r ?? '—'}
          {' · '}funding {lenses?.funding_lens?.total_r ?? '—'} R
          {' · '}expectancy R {sz.expectancy_r ?? '—'} vs $ {sz.expectancy_usd ?? '—'}
          {sz.sign_agreement === false && <span className="text-[var(--caution)]"> (SIGNES DIVERGENTS)</span>}
          {' · '}résiduel bêta-hedgé {lenses?.beta_hedged?.avg_r_residual_beta1 ?? '—'} R
        </div>
      )}

      <div className="font-mono text-[0.42rem] text-[var(--dim)] leading-relaxed">
        Décisions seulement à n_eff ≥ 50 clusters / ≥ 10 jours (DECISION_RULES.md). Lentilles et
        sims = vues comptables, ne comptent pas dans le cap.
      </div>
    </div>
  );
}
