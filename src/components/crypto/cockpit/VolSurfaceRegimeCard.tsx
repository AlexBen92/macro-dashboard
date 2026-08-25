'use client';

import { useVolSurface } from '@/hooks/api/useVolSurface';
import { formatBps } from '@/lib/cockpit/display';
import type { VolAssetState, VolRegimeLabel } from '@/lib/cockpit/payloads';

const LABEL_STYLE: Record<VolRegimeLabel, { color: string; blurb: string }> = {
  REGIME_VOL_ROUGH: { color: 'var(--bear)', blurb: 'skew court explosif — rough' },
  REGIME_VOL_MARKOVIEN: { color: 'var(--bull)', blurb: 'surface standard — Markovien' },
  MIXED: { color: 'var(--caution)', blurb: 'signature mixte' },
  INSUFFICIENT_DATA: { color: 'var(--dim)', blurb: 'fit non concluant' },
  DATA_UNAVAILABLE: { color: 'var(--dim)', blurb: 'IV indisponible (realized only)' },
};

/**
 * Bloc 2 — Vol surface & régime par actif majeur: ATM IV (courte/moyenne/
 * longue), skew 1d/7d, H, qualité de fit rough vs Markovien.
 */
export default function VolSurfaceRegimeCard() {
  const { data, isLoading, error, isStale } = useVolSurface();

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="vol-surface-card">
      <Header
        title="VOL SURFACE & RÉGIME"
        sub={data?.assets.map((a) => a.asset).join(' · ') ?? null}
        stale={isStale}
      />
      {isLoading && <Loading />}
      {error && <Err />}
      {data && (
        <div className="flex flex-col gap-2">
          {data.assets.map((a) => (
            <AssetRow key={a.asset} a={a} />
          ))}
          <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-relaxed">
            Méthode: H par scaling du skew ATM (τ^(H−0.5), Bayer-Friz-Gatheral) · fit
            Markov 1-facteur vs power-law sur variance ATM · H realized par scaling
            log-RV. Source Deribit public — BTC/ETH, alts realized only.
          </div>
        </div>
      )}
    </div>
  );
}

function AssetRow({ a }: { a: VolAssetState }) {
  const style = LABEL_STYLE[a.regime_label] ?? LABEL_STYLE.MIXED;
  const h = a.hurst.H_iv_skew_scaling?.H ?? a.hurst.H_realized_vol;
  const rmseM = a.fits.markov_1f?.rmse_var;
  const rmseR = a.fits.rough_powerlaw?.rmse_var;
  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[0.65rem] font-bold">{a.asset}</span>
        <span
          className="font-mono text-[0.5rem] px-1.5 py-0.5 rounded-[2px] border"
          style={{ color: style.color, borderColor: style.color }}
        >
          {a.regime_label} — {style.blurb}
        </span>
      </div>
      <div className="mt-1.5 grid grid-cols-3 md:grid-cols-6 gap-x-3 gap-y-1 font-mono text-[0.5rem]">
        <Cell label="ATM court" value={a.iv.atm_short !== null ? `${a.iv.atm_short.toFixed(1)}%` : '—'} />
        <Cell label="ATM moyen" value={a.iv.atm_mid !== null ? `${a.iv.atm_mid.toFixed(1)}%` : '—'} />
        <Cell label="ATM long" value={a.iv.atm_long !== null ? `${a.iv.atm_long.toFixed(1)}%` : '—'} />
        <Cell label="Skew 1d" value={formatBps(a.iv.skew_1d)} />
        <Cell label="Skew 7d" value={formatBps(a.iv.skew_7d)} />
        <Cell
          label="H (IV / RV)"
          value={`${a.hurst.H_iv_skew_scaling?.H ?? '—'} / ${a.hurst.H_realized_vol ?? '—'}`}
          highlight={h !== null && h < 0.15}
        />
        <Cell label="RMSE Markov" value={rmseM !== undefined && rmseM !== null ? rmseM.toExponential(1) : '—'} />
        <Cell label="RMSE rough" value={rmseR !== undefined && rmseR !== null ? rmseR.toExponential(1) : '—'} />
        <Cell label="Vol-of-vol" value={a.realized.vol_of_vol?.toFixed(2) ?? '—'} />
        <Cell label="ρ proxy" value={a.realized.rho_proxy?.toFixed(2) ?? '—'} />
        <Cell label="RV 24h" value={a.realized.rv_pct_m15 !== null ? `${a.realized.rv_pct_m15.toFixed(2)}%/bar` : '—'} />
        <Cell label="Expiries" value={String(a.iv.n_expiries)} />
      </div>
    </div>
  );
}

function Cell({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.42rem] uppercase tracking-[1.5px] text-[var(--label)]">{label}</span>
      <span style={{ color: highlight ? 'var(--bear)' : 'var(--text)' }} className="font-bold">
        {value}
      </span>
    </div>
  );
}

export function Header({ title, sub, stale }: { title: string; sub: string | null; stale: boolean }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
        {title}
      </span>
      <span className="font-mono text-[0.45rem] text-[var(--dim)]">
        {sub} {stale && <span className="text-[var(--caution)]">STALE</span>}
      </span>
    </div>
  );
}

export function Loading() {
  return <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>;
}

export function Err() {
  return (
    <div className="font-mono text-[0.55rem] text-[var(--caution)]">
      endpoint indisponible (exporteur VPS)
    </div>
  );
}
