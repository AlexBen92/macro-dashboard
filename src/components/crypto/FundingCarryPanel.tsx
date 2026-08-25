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

interface MTMLegs {
  spot_bps: number;
  perp_bps: number;
  funding_bps: number;
  net_bps: number;
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
    cron?: string;
    assets_universe?: string[];
    n_open: number;
    n_closed: number;
    cum_net_bps: number;
    latest_trail_day_frac: Record<string, number | null>;
    divergence_zscore?: Record<string, number>;
    divergence_z_max?: number;
    positions: Record<string, CarryPosition>;
    mark_to_market?: Record<string, MTMLegs>;
    mark_to_market_total_bps?: number | null;
    thresholds: {
      entry_trail_day?: number;
      entry_trail_day_per_asset?: Record<string, number>;
      exit_hysteresis_day?: number;
      exit_hysteresis_day_per_asset?: Record<string, number>;
      cost_rt_bps_leg: number;
    };
  } | null;
  funding: Record<string, FundingAsset>;
  sources: { paper_state_ok: boolean; hl_history_ok: boolean };
}

const fetcher = (u: string) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<FundingCarryPayload>;
  });

const fmt = (x: number, d = 1) => `${x >= 0 ? '+' : ''}${x.toFixed(d)}`;

function TrailBar({
  trailBpDay,
  open,
  entryBp,
}: {
  trailBpDay: number | null;
  open: boolean;
  entryBp: number;
}) {
  const scale = Math.max(entryBp * 2, 1); // 2× seuil entrée, min 1 bp/j
  const pct = trailBpDay == null ? null : Math.min(Math.abs(trailBpDay) / scale, 1) * 100;
  return (
    <div
      className="mt-0.5 basis-full"
      title={`Trail 3j : ${trailBpDay == null ? '—' : `${trailBpDay.toFixed(2)} bp/j`} — entrée |trail| > 1 bp/j, sortie hystérésis < 0,5 bp/j`}
    >
      <div className="relative h-1 bg-[var(--bg3)] rounded-[1px]">
        <div className="absolute top-[-2px] bottom-[-2px] w-px bg-[var(--border)]" style={{ left: '25%' }} />
        {/* repère seuil entrée 1 bp/j = 50% de l'échelle */}
        <div className="absolute top-[-3px] bottom-[-3px] w-px bg-[var(--muted)]" style={{ left: '50%' }} />
        {pct != null && (
          <div
            className="absolute top-[-2px] h-2 w-2 rounded-full"
            style={{
              left: `calc(${pct}% - 4px)`,
              background: open ? 'var(--bull)' : 'var(--muted)',
            }}
          />
        )}
      </div>
      <div className="flex justify-between font-mono text-[0.45rem] text-[var(--dim)] mt-0.5">
        <span>0</span>
        <span>0,5 · sortie</span>
        <span>1 · entrée</span>
        <span>2 bp/j</span>
      </div>
    </div>
  );
}

function DivBadge({ z, zMax }: { z: number | null; zMax: number }) {
  if (z == null) return null;
  const hot = Math.abs(z) >= zMax;
  return (
    <span
      className="font-mono text-[0.5rem] px-1 rounded-[2px]"
      style={{
        color: hot ? 'var(--bear)' : 'var(--dim)',
        border: `1px solid ${hot ? 'var(--bear)' : 'var(--border)'}`,
      }}
      title={`z(divergence funding HL/Binance, fenêtre 168×8h — gate RiskManager: |z| ≥ ${zMax} bloque les NOUVELLES entrées (fin de vie divergence, V40 S8b)`}
    >
      z(div) {z >= 0 ? '+' : ''}{z.toFixed(2)}
    </span>
  );
}

export default function FundingCarryPanel() {
  const { data, isLoading, error } = useSWR<FundingCarryPayload>('/api/funding-carry', fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
  });

  const ps = data?.paper_state ?? null;
  const universe = ps?.assets_universe ?? ['BTC', 'ETH'];
  const assets = Array.from(new Set([...universe, ...Object.keys(ps?.positions ?? {})]));
  const zMax = ps?.divergence_z_max ?? 2;
  const entryBpFor = (coin: string) =>
    (ps?.thresholds.entry_trail_day_per_asset?.[coin] ??
      ps?.thresholds.entry_trail_day ??
      1e-4) * 1e4;
  const entryBps = assets.map((a) => entryBpFor(a));
  const entryRange =
    entryBps.length && Math.min(...entryBps) !== Math.max(...entryBps)
      ? `${Math.min(...entryBps).toFixed(0)}-${Math.max(...entryBps).toFixed(0)}`
      : `${(entryBps[0] ?? 1).toFixed(1)}`;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <section
      className="bg-[var(--bg2)] border border-[var(--bull)]/40 rounded-[4px] px-3 py-2"
      title="Funding_Carry_Systematic_D1 — seule stratégie VALIDATED du programme H4/D1 (6/6 gates WF). Paper trading 2 jambes, cron 00:25 UTC."
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="font-mono text-[0.55rem] uppercase tracking-[2px] text-[var(--bull)]">
          funding carry d1
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          validated 6/6 gates wf
        </span>
        {ps && (
          <span className="font-mono text-[0.55rem] text-[var(--muted)]">
            paper depuis {ps.paper_since} · {ps.cron ?? 'cron 00:25 UTC'} · {ps.n_open}/
            {assets.length} ouvertes · {ps.n_closed} close · ledger{' '}
            <span style={{ color: ps.cum_net_bps >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
              {fmt(ps.cum_net_bps)} bps
            </span>
          </span>
        )}
      </div>

      <div className="mt-1.5 grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-1.5 font-mono text-[0.62rem]">
        {assets.map((coin) => {
          const f = data?.funding[coin];
          const trailFrac = ps?.latest_trail_day_frac[coin];
          const trailBpDay = trailFrac == null ? null : trailFrac * 1e4;
          const pos = ps?.positions[coin];
          const openLeg = pos != null && pos.side_perp != null;
          const mtm = ps?.mark_to_market?.[coin] ?? null;
          const divZ = ps?.divergence_zscore?.[coin] ?? null;
          const isJ0 = openLeg && pos?.entry_ts != null && pos.entry_ts.slice(0, 10) === today;
          const days =
            openLeg && pos?.entry_ts
              ? (Date.now() - Date.parse(pos.entry_ts)) / 86_400_000
              : null;
          const entryBp = entryBpFor(coin);
          const underThreshold =
            !openLeg && trailBpDay != null && Math.abs(trailBpDay) < entryBp;
          return (
            <div key={coin} className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-[var(--label)] uppercase tracking-[1px] w-9">{coin}</span>
              <DataField
                loading={isLoading && !f}
                value={f ? `${f.funding_apr_pct >= 0 ? '+' : ''}${f.funding_apr_pct.toFixed(2)}% APR` : null}
                title={`Funding horaire ${(f?.funding_hourly ?? 0).toExponential(2)} — Hyperliquid`}
              />
              <DivBadge z={divZ} zMax={zMax} />

              {openLeg ? (
                <span className="basis-full text-[0.55rem] text-[var(--muted)]">
                  {pos!.side_perp! < 0 ? 'short perp + long spot' : 'long perp + short spot'}
                  {pos?.entry_ts ? ` · depuis ${pos.entry_ts.slice(5, 10)}` : ''}
                  {days != null ? ` (${days < 1 ? 'J0' : `J${days.toFixed(0)}`})` : ''}
                </span>
              ) : (
                <span
                  className="basis-full text-[0.55rem] text-[var(--dim)]"
                  title={
                    underThreshold
                      ? `Trail ${trailBpDay?.toFixed(2)} bp/j sous le seuil d'entrée ${entryBp.toFixed(1)} bp/j — discipline d'entrée respectée, pas de position`
                      : 'Aucune jambe ouverte'
                  }
                >
                  {underThreshold
                    ? `hors seuil — trail ${trailBpDay?.toFixed(2)} bp/j < entrée ${entryBp.toFixed(1)} → pas de position`
                    : 'flat'}
                </span>
              )}

              {openLeg && mtm && (
                <span className="basis-full text-[0.55rem]">
                  spot {fmt(mtm.spot_bps)} · perp {fmt(mtm.perp_bps)} · funding{' '}
                  {fmt(mtm.funding_bps, 2)} →{' '}
                  <span style={{ color: mtm.net_bps >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                    NET {fmt(mtm.net_bps)} bps
                  </span>
                </span>
              )}
              {openLeg && isJ0 && (
                <span className="basis-full text-[0.5rem] text-[var(--dim)]">
                  ⓘ ouvert aujourd&apos;hui — net négatif normal à J0 (coûts d&apos;entrée pas
                  encore compensés par le funding accru)
                </span>
              )}

              <TrailBar trailBpDay={trailBpDay} open={openLeg} entryBp={entryBp} />
            </div>
          );
        })}
      </div>

      <div className="mt-1 font-mono text-[0.5rem] text-[var(--muted)] flex flex-wrap gap-x-4">
        <span>
          entrée |trail 3j| &gt; {entryRange}bp/j (par instrument, cal-block V36) · sortie
          hystérésis ÷2 · coûts {ps?.thresholds.cost_rt_bps_leg ?? 2.5}bps/leg RT
        </span>
        {ps?.mark_to_market_total_bps != null && (
          <span>
            mark-to-market total:{' '}
            <span
              style={{
                color:
                  ps.mark_to_market_total_bps >= 0 ? 'var(--bull)' : 'var(--bear)',
              }}
            >
              {fmt(ps.mark_to_market_total_bps)} bps
            </span>
          </span>
        )}
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
