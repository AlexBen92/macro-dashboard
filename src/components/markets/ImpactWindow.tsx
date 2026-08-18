'use client';

import { useEventImpact } from '@/hooks/api/useEventImpact';
import { dayLabel, eventTooltip, ratioColor } from '@/lib/eventImpact';

export default function ImpactWindow() {
  const { data, isLoading, error, isStale } = useEventImpact();

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
          FENÊTRE D'IMPACT · 7 J{' '}
          <span
            className="text-[0.58rem] text-[var(--muted)] ml-2"
            title="Events classés par réaction historique moyenne (|move| ES=F le jour de publication vs jour normal). Statistique descriptive UNTESTED — jamais validée par le protocole WF/DSR/PBO."
          >
            triés par impact historique · descriptive, pas un signal
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isStale && (
            <span className="px-1.5 py-0.5 rounded-[2px] text-[0.5rem] uppercase tracking-[1px] bg-[var(--bear)]/15 text-[var(--bear)] border border-[var(--bear)]/30">
              stale — export hs
            </span>
          )}
          <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
            es=f daily · n≥40
          </span>
        </div>
      </div>

      {data && data.upcoming.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-[0.62rem] min-w-[560px]">
            <thead>
              <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
                <th className="text-left py-2 pr-3">Jour</th>
                <th className="text-left py-2 px-2">Événement</th>
                <th className="text-right py-2 px-2" title="Moyenne |move| ES=F le jour de publication">Réaction moy</th>
                <th className="text-right py-2 px-2" title="Réaction moyenne ÷ journée normale">× normal</th>
                <th className="text-right py-2 pl-2" title="% publications plus volatiles que la journée médiane">Hit rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {data.upcoming.map((e) => (
                <tr key={`${e.date}-${e.type}`} className="hover:bg-[var(--bg3)]" title={eventTooltip(e)}>
                  <td className="py-1.5 pr-3 uppercase tracking-[1px]">{dayLabel(e.date)}</td>
                  <td className="py-1.5 px-2 text-[var(--label)]">{e.label}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--dim)]">
                    {e.mean_abs_move_pct != null ? `±${e.mean_abs_move_pct}%` : '—'}
                  </td>
                  <td className="py-1.5 px-2 text-right font-semibold" style={{ color: ratioColor(e.ratio_vs_baseline) }}>
                    {e.ratio_vs_baseline != null ? `×${e.ratio_vs_baseline}` : '—'}
                  </td>
                  <td className="py-1.5 pl-2 text-right text-[var(--dim)]">
                    {e.hit_rate_vs_median != null ? `${e.hit_rate_vs_median}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.upcoming.length === 0 && !error && (
        <div className="font-mono text-[0.6rem] text-[var(--muted)] py-2">
          aucun event majeur (CPI · NFP · FOMC) dans les 7 prochains jours
        </div>
      )}

      {isLoading && (
        <div className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
          loading impact window · export quotidien 05:53 utc...
        </div>
      )}
      {error && (
        <div className="font-mono text-[0.55rem] text-[var(--bear)] uppercase tracking-[2px]">
          {error.slice(0, 80)}
        </div>
      )}
    </div>
  );
}
