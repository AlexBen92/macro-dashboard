'use client';

import { useCarryHealth } from '@/hooks/api/useCarryHealth';
import { formatBps } from '@/lib/cockpit/display';

/**
 * Bloc 4 — Basis & Carry Health: drift perp-spot, signe funding, statut de
 * contrat (DELTA_NEUTRE_OK / DIRECTIONNEL_INTERDIT), alerte drift > 3bps.
 */
export default function CarryBasisHealthPanel() {
  const { data, isLoading, error, isStale } = useCarryHealth();
  const health = data?.health ?? null;

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="carry-health-panel">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          BASIS & CARRY HEALTH — D1
        </span>
        <span
          className="font-mono text-[0.5rem] px-1.5 py-0.5 rounded-[2px] border"
          style={{
            color: health === 'OK' ? 'var(--bull)' : 'var(--bear)',
            borderColor: health === 'OK' ? 'var(--bull)' : 'var(--bear)',
          }}
        >
          {health ?? '—'} {isStale && <span className="text-[var(--caution)]">STALE</span>}
        </span>
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {data && (
        <table className="w-full border-collapse font-mono text-[0.5rem]">
          <thead>
            <tr className="text-[var(--label)] text-[0.42rem] uppercase tracking-[1.5px]">
              {['Actif', 'Basis', 'Drift', 'Funding/h', 'z(div)', 'Position', 'Contrat', ''].map((h) => (
                <th key={h} className="text-left py-1 pr-2 border-b border-[var(--border)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.asset} className="border-b border-[var(--border)]/50">
                <td className="py-1 pr-2 font-bold">{r.asset}</td>
                <td className="py-1 pr-2">{formatBps(r.basis_bps, 2)}</td>
                <td className="py-1 pr-2" style={{ color: r.drift_alert ? 'var(--bear)' : 'var(--text)' }}>
                  {formatBps(r.basis_drift_bps, 2)}
                  {r.drift_alert && <span title="alerte TG envoyée"> ⚠️</span>}
                </td>
                <td className="py-1 pr-2">
                  {r.funding_rate_hourly !== null ? (
                    <span style={{ color: r.funding_sign === 1 ? 'var(--bull)' : 'var(--bear)' }}>
                      {r.funding_sign === 1 ? '+' : ''}
                      {(r.funding_rate_hourly * 1e5).toFixed(1)}bp/h
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="py-1 pr-2">{r.divergence_zscore?.toFixed(2) ?? '—'}</td>
                <td className="py-1 pr-2">
                  <span
                    style={{
                      color: r.carry_position === 'ACTIF' ? 'var(--bull)' : 'var(--caution)',
                    }}
                  >
                    {r.carry_position}
                  </span>
                  {r.accrued_funding_bps !== null && r.accrued_funding_bps !== undefined && (
                    <span className="text-[var(--dim)]"> ({formatBps(r.accrued_funding_bps, 1)})</span>
                  )}
                </td>
                <td className="py-1 pr-2">
                  <span
                    style={{
                      color: r.contract.status === 'DELTA_NEUTRE_OK' ? 'var(--bull)' : 'var(--bear)',
                    }}
                    title={r.contract.reason}
                  >
                    {r.contract.status === 'DELTA_NEUTRE_OK' ? 'δ-NEUTRE OK' : 'DIRECTIONNEL ⛔'}
                  </span>
                </td>
                <td className="py-1 text-[var(--dim)]">
                  {r.contract.legs_expected.join(' + ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && data.alerts.length > 0 && (
        <div className="mt-1.5 font-mono text-[0.45rem]" style={{ color: 'var(--bear)' }}>
          Alerte(s) basis drift envoyée(s) TG ce cycle:{' '}
          {data.alerts.map((a) => `${a.asset} ${formatBps(a.drift_bps)}`).join(' · ')}
        </div>
      )}
      <div className="mt-1.5 font-mono text-[0.42rem] text-[var(--dim)] leading-relaxed">
        Basis même venue Binance (perp mark vs spot) — cohérent paper_trader_carry. Le M15 agent
        utilise ce bloc comme contexte funding, jamais comme signal de carry directionnel.
      </div>
    </div>
  );
}
