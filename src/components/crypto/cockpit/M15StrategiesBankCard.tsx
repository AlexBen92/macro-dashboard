'use client';

import { useCockpitState } from '@/hooks/api/useCockpitState';
import {
  bankHeadline,
  bankStatusColor,
  bankStatusText,
  effectiveBankStatus,
  formatBankMetrics,
  groupByFamily,
  retestNote,
} from '@/lib/cockpit/bank';

/**
 * Banque de stratégies M15 — catalogue par famille avec statut live du registre
 * statistique (fail-closed). Seul VALIDATED est tradable; la carte n'affiche que
 * ce que le payload contient (aucune métrique calculée côté client).
 */
export default function M15StrategiesBankCard() {
  const { data, isLoading, error } = useCockpitState();
  const bank = data?.m15_strategies_bank;

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="m15-bank-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          BANQUE DE STRATÉGIES M15
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">
          {bankHeadline(bank)} — statut = registre live, specs = catalogue
        </span>
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {bank && bank.strategies.length === 0 && (
        <div className="font-mono text-[0.55rem] text-[var(--muted)]">
          banque vide (config dir introuvable côté service)
        </div>
      )}
      {bank && bank.strategies.length > 0 && (
        <div className="flex flex-col gap-2">
          {groupByFamily(bank.strategies).map(([family, rows]) => (
            <div key={family}>
              <div className="font-mono text-[0.45rem] uppercase tracking-[1.5px] text-[var(--label)] mb-1">
                {family}
              </div>
              <table className="w-full border-collapse font-mono text-[0.5rem]">
                <tbody>
                  {rows.map((s) => {
                    const metrics = formatBankMetrics(s);
                    const note = retestNote(s);
                    return (
                      <tr key={s.id} className="border-b border-[var(--border)]/50">
                        <td className="py-1 pr-2 font-bold">{s.name ?? s.id}</td>
                        <td className="py-1 pr-2">
                          <span
                            className="px-1.5 py-0.5 rounded-[2px] border"
                            style={{ color: bankStatusColor(effectiveBankStatus(s)), borderColor: bankStatusColor(effectiveBankStatus(s)) }}
                          >
                            {bankStatusText(s)}
                          </span>
                        </td>
                        <td className="py-1 pr-2 text-[var(--muted)]">
                          {metrics.length > 0 ? metrics.join(' · ') : '—'}
                        </td>
                        <td className="py-1 text-[var(--caution)]">{note ?? '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <div className="mt-1.5 font-mono text-[0.42rem] text-[var(--dim)] leading-relaxed">
        Règle: un signal M15 n&apos;est ALLOWED que si sa stratégie est VALIDATED au registre.
        Familles NULL/BLOCKED = catalogue documentaire (politique anti-retest loi 8).
      </div>
    </div>
  );
}
