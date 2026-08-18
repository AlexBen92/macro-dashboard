'use client';

import useSWR from 'swr';
import DataField from '@/components/ui/DataField';

interface CarryPosition {
  side_perp: number | null;
  entry_ts: string | null;
  entry_perp: number | null;
  entry_spot: number | null;
  accrued_funding_bps: number | null;
}

interface FundingAsset {
  funding_hourly: number;
  funding_apr_pct: number;
  mean_apr_pct_window: number;
  percentile_window: number | null;
  window_days: number;
  n_events: number;
}

interface FundingCarryPayload {
  as_of: string;
  paper_state: {
    validation: string;
    paper_since: string;
    n_open: number;
    n_closed: number;
    cum_net_bps: number;
    latest_trail_day_frac: Record<string, number | null>;
    positions: Record<string, CarryPosition>;
    thresholds: { entry_trail_day: number; exit_hysteresis_day: number; cost_rt_bps_leg: number };
  } | null;
  funding: Record<string, FundingAsset>;
  sources: { paper_state_ok: boolean; hl_history_ok: boolean };
}

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<FundingCarryPayload>;
  });

export default function FundingCarryPanel() {
  const { data, isLoading, error } = useSWR<FundingCarryPayload>('/api/funding-carry', fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const ps = data?.paper_state ?? null;

  return (
    <section
      className="bg-[var(--bg2)] border border-[var(--bull)]/40 rounded-[4px] px-3 py-2"
      title="Funding_Carry_Systematic_D1 — seule stratégie VALIDATED du programme H4/D1 (6/6 gates WF). Paper trading 2 jambes depuis 2026-08-15."
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[0.55rem] uppercase tracking-[2px] text-[var(--bull)]">
          ✓ live edge — funding carry d1
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          validated 6/6 gates wf · paper 2 jambes
        </span>
        {ps && (
          <span className="font-mono text-[0.55rem] text-[var(--muted)]">
            paper {ps.paper_since} → {ps.n_open} pos ouverte(s) · {ps.n_closed} close(s) · cum{' '}
            <span style={{ color: ps.cum_net_bps >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              {ps.cum_net_bps >= 0 ? '+' : ''}
              {ps.cum_net_bps.toFixed(1)}bps
            </span>
          </span>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 font-mono text-[0.62rem]">
        {(['BTC', 'ETH'] as const).map((coin) => {
          const f = data?.funding[coin];
          return (
            <div key={coin} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[var(--label)] uppercase tracking-[1px] w-9">{coin}</span>
              <DataField
                loading={isLoading && !f}
                value={f ? `${f.funding_apr_pct >= 0 ? '+' : ''}${f.funding_apr_pct.toFixed(2)}% APR` : null}
                title={`Funding horaire ${(f?.funding_hourly ?? 0).toExponential(2)} — Hyperliquid`}
              />
              <DataField
                value={f?.percentile_window != null ? `p${Math.round(f.percentile_window)} (${f.window_days}j)` : null}
                title={`Percentile du funding actuel vs distribution ${f?.window_days ?? '?'}j (${f?.n_events ?? 0} événements horaires)`}
                className="text-[0.55rem]"
              />
              {(() => {
                const pos = ps?.positions[coin];
                if (!pos || pos.side_perp == null) {
                  return (
                    <span className="text-[0.55rem] text-[var(--muted)]" title="Aucune jambe ouverte — trail sous seuil d'entrée (1bp/j)">
                      flat
                    </span>
                  );
                }
                return (
                  <span
                    className="text-[0.55rem]"
                    style={{ color: 'var(--bull)' }}
                    title={`Ouvert ${pos.entry_ts} · perp ${pos.entry_perp} / spot ${pos.entry_spot}`}
                  >
                    {pos.side_perp < 0 ? 'short perp + spot' : 'long perp + short spot'} ·{' '}
                    {pos.accrued_funding_bps != null ? `${pos.accrued_funding_bps.toFixed(1)}bps collectés` : ''}
                  </span>
                );
              })()}
            </div>
          );
        })}
      </div>

      <div className="mt-1 font-mono text-[0.5rem] text-[var(--muted)]">
        entrée |trail 3j| &gt; 1bp/j · sortie hystérésis 0,5bp/j · coûts 5bps/leg RT ·{' '}
        {error ? (
          <span style={{ color: 'var(--caution)' }}>
            source paper/HL indisponible — dernière valeur si affichée
          </span>
        ) : (
          <DataField
            value={ps && data ? `état paper ${new Date(data.as_of).toLocaleTimeString('en-GB')}` : null}
            unavailableReason="État paper trader (VPS) indisponible"
          />
        )}
      </div>
    </section>
  );
}
