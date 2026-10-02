'use client';

/**
 * Carte M15-TRADER (doc v3 §9.2) — état live réel du trader HL:
 * slots/risque, protection SL, exposition nette/bêta, mesure (budget),
 * incidents+SLO, events reconcile. Lecture seule: aucun calcul dérivé.
 */
import { useM15Trader } from '@/hooks/api/useM15Trader';
import { useM15Diag } from '@/hooks/api/useM15Diag';

function KV({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[var(--label)] text-[0.42rem] uppercase tracking-[1px]">{label}</span>
      <span className="font-mono text-[0.55rem]" style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

export function M15TraderCard() {
  const { data, isLoading, error, isStale } = useM15Trader();
  const { data: diag } = useM15Diag();

  if (isLoading) {
    return (
      <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 font-mono text-[0.5rem] text-[var(--muted)]">
        M15-TRADER · chargement…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] px-3 py-2 font-mono text-[0.5rem] text-[var(--muted)]">
        M15-TRADER · indisponible ({error ?? 'aucune donnée'})
      </div>
    );
  }

  const slots = data.open_setups?.length ?? 0;
  const nb = data.net_beta;
  const m = data.measurement;
  const slo = diag?.diag?.slo;
  const brake = diag?.brake?.brake;
  const modeLive = data.mode === 'live';

  return (
    <div className={`rounded-[3px] border bg-[var(--bg2)] px-3 py-2 flex flex-col gap-2 ${isStale ? 'border-[var(--caution)]/50' : 'border-[var(--border)]'}`}>
      <div className="flex items-center justify-between font-mono text-[0.5rem]">
        <span className="font-bold text-[var(--label)]">M15-TRADER · {modeLive ? 'LIVE HL' : 'paper'}</span>
        <span className="flex items-center gap-2">
          {m && (
            <span className="px-1.5 py-0.5 rounded-[2px] border border-[var(--muted)] text-[var(--muted)]">
              MESURE LIVE {m.budget_usdc != null ? `· budget ${m.budget_usdc}$` : ''}
            </span>
          )}
          {data.brake && (
            <span className="px-1.5 py-0.5 rounded-[2px] border border-[var(--caution)] text-[var(--caution)]">
              BRAKE {data.brake}
            </span>
          )}
          {isStale && <span className="text-[var(--caution)]">STALE</span>}
        </span>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        <KV label="Slots ouverts" value={`${slots}/5`} />
        <KV label="SL protégés" value={data.protected_sl ?? '—'} tone={data.protected_sl === slots && slots > 0 ? 'var(--bull)' : 'var(--bear)'} />
        <KV label="Positions HL" value={data.positions_seen ?? '—'} />
        <KV label="Equité" value={data.equity != null ? `${data.equity.toFixed(2)}$` : '—'} />
        <KV label="Net exposure" value={nb ? `${nb.net_exposure_usdc}$` : '—'} tone={nb && nb.net_exposure_usdc < 0 ? 'var(--bear)' : 'var(--bull)'} />
        <KV label="Net bêta vs BTC" value={nb ? `${nb.net_beta_usdc}$` : '—'} tone={nb && nb.net_beta_usdc < 0 ? 'var(--bear)' : 'var(--bull)'} />
      </div>

      <div className="grid grid-cols-3 gap-2 font-mono text-[0.45rem] text-[var(--muted)]">
        <span>hash <span className="text-[var(--label)]">{data.config_hash}</span></span>
        <span>SLO 7j: {slo ? `${slo.incidents_counted} incidents / ${slo.orders_placed} ordres${slo.incidents_per_100_orders != null ? ` (${slo.incidents_per_100_orders}/100)` : ''}` : '—'}</span>
        <span>SL absents 7j: {slo ? slo.sl_absent_events_journald : '—'}</span>
      </div>

      {brake && (
        <div className="font-mono text-[0.45rem] text-[var(--muted)]">
          Coût d&apos;opportunité BRAKE (sims): delta moyen{' '}
          <span className={brake.mean_delta_r != null && brake.mean_delta_r > 0 ? 'text-[var(--caution)]' : ''}>
            {brake.mean_delta_r ?? '—'} R
          </span>{' '}
          ({brake.pct_delta_positive != null ? `${Math.round(brake.pct_delta_positive * 100)}% favorables aux refusés` : '—'}) — le FCFS refuse souvent mieux qu&apos;il ne prend.
        </div>
      )}

      {(data.reconcile_events?.length ?? 0) > 0 && (
        <div className="font-mono text-[0.45rem] text-[var(--caution)]">
          reconcile: {data.reconcile_events.slice(0, 4).join(' · ')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-0.5">
        {(data.open_setups ?? []).slice(0, 6).map((s) => (
          <div key={s.id} className="flex items-center justify-between font-mono text-[0.45rem] border-b border-[var(--border)]/40 pb-0.5">
            <span className={s.side === 'long' ? 'text-[var(--bull)]' : 'text-[var(--bear)]'}>
              {s.symbol} {s.side.toUpperCase()}
            </span>
            <span className="text-[var(--muted)]">
              risque {s.size?.risk_usd != null ? `${s.size.risk_usd.toFixed(2)}$` : '—'} · notional {s.size?.notional_usd != null ? `${s.size.notional_usd.toFixed(0)}$` : '—'}
            </span>
          </div>
        ))}
      </div>

      <div className="font-mono text-[0.42rem] text-[var(--dim)] leading-relaxed">
        Playbook LIVE_MEASUREMENT au registre — non validé, budget borné ({m?.end_rule ?? 'n≥50 clusters / 5 USDC / STOP_LIVE'}).
      </div>
    </div>
  );
}
