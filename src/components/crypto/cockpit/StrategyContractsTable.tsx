'use client';

import { useCockpitState } from '@/hooks/api/useCockpitState';
import { complianceColor, gateStateBadge } from '@/lib/cockpit/display';

/**
 * Bloc 6 — Contrats de stratégie & conformité. L'agent M15 ne doit utiliser
 * que les stratégies marquées OK; un signal dont la stratégie est REJETÉ ou
 * EN_TEST doit être refusé même si le setup semble attractif.
 */
export default function StrategyContractsTable() {
  const { data, isLoading, error } = useCockpitState();
  const rows = data?.contracts.rows ?? [];

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="contracts-table">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          CONTRATS DE STRATÉGIE & CONFORMITÉ
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">
          validator hl-agent — contrôle AVANT sizing/executor, même en shadow
        </span>
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {rows.length > 0 && (
        <table className="w-full border-collapse font-mono text-[0.5rem]">
          <thead>
            <tr className="text-[var(--label)] text-[0.42rem] uppercase tracking-[1.5px]">
              {['Stratégie', 'Template de jambes requis', 'Conformité', 'Gate', 'Statut stat.', 'Motif rejet', 'Rejets 7j'].map((h) => (
                <th key={h} className="text-left py-1 pr-2 border-b border-[var(--border)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const badge = gateStateBadge(r.gate_state);
              return (
                <tr key={r.strategy} className="border-b border-[var(--border)]/50">
                  <td className="py-1.5 pr-2 font-bold">{r.strategy}</td>
                  <td className="py-1.5 pr-2 text-[var(--muted)]">{r.leg_template}</td>
                  <td className="py-1.5 pr-2">
                    <span
                      className="px-1.5 py-0.5 rounded-[2px] border"
                      style={{ color: complianceColor(r.compliance), borderColor: complianceColor(r.compliance) }}
                    >
                      {r.compliance}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2" style={{ color: badge.color }}>
                    {badge.text}
                  </td>
                  <td
                    className="py-1.5 pr-2"
                    style={{
                      color: r.statistical_status === 'VALIDATED'
                        ? 'var(--bull)'
                        : r.statistical_status === 'UNTESTED'
                          ? 'var(--dim)'
                          : 'var(--caution)',
                    }}
                  >
                    {r.statistical_status ?? '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-[var(--caution)]">{r.rejection_reason ?? '—'}</td>
                  <td className="py-1.5">{r.recent_contract_rejects}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      <div className="mt-1.5 font-mono text-[0.42rem] text-[var(--dim)] leading-relaxed">
        Règle moteur M15: signal dont la stratégie associée est REJETÉ ou EN_TEST → refus, quel que
        soit le score d'edge. Règle tradable: ALLOWED exige statut statistique VALIDATED au
        registre — les contraintes de risque (H rough, STRESS, feu, carry) retirent seulement.
      </div>
    </div>
  );
}
