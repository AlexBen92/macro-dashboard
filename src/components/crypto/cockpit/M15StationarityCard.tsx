'use client';

import { useEdgeM15Status } from '@/hooks/api/useEdgeM15Status';
import { m15StationarityVerdict, stationarityGuidance } from '@/lib/cockpit/m15Stationarity';

/**
 * Tier 2 — ADF/KPSS stationnarité closes M15 (BTC, fenêtre 24h).
 * Oriente famille de setups: mean-reversion vs momentum. Indicatif, n≈96.
 */
export default function M15StationarityCard() {
  const { data, isLoading, error } = useEdgeM15Status();
  const candles = data?.candles_m15_last ?? [];
  const verdict = m15StationarityVerdict(candles);
  const guidance = stationarityGuidance(verdict);

  return (
    <div
      className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3"
      data-testid="m15-stationarity-card"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          ADF · STATIONNARITÉ M15
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">
          BTC perp · {verdict.n} closes · fenêtre ~24h
        </span>
      </div>

      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && !isLoading && (
        <div className="font-mono text-[0.55rem] text-[var(--caution)]">export indisponible</div>
      )}
      {!isLoading && !error && verdict.conclusion === 'INSUFFICIENT' && (
        <div className="font-mono text-[0.55rem] text-[var(--caution)]">
          {verdict.n} closes M15 — minimum 30 requis
        </div>
      )}
      {verdict.conclusion !== 'INSUFFICIENT' && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric
              label="ADF stat"
              value={verdict.adf ? verdict.adf.statistic.toFixed(2) : '—'}
              sub={verdict.adf ? `p≈${verdict.adf.pValue.toFixed(2)} · ${verdict.adf.usedLags} lag(s)` : ''}
              ok={verdict.adf?.isStationary ?? null}
            />
            <Metric
              label="KPSS stat"
              value={verdict.kpss ? verdict.kpss.statistic.toFixed(2) : '—'}
              sub={verdict.kpss ? `p≈${verdict.kpss.pValue.toFixed(2)}` : ''}
              ok={verdict.kpss?.isStationary ?? null}
            />
            <Metric
              label="Conclusion"
              value={
                verdict.conclusion === 'STATIONARY'
                  ? 'STATIONNAIRE'
                  : verdict.conclusion === 'NON_STATIONARY'
                    ? 'NON-STATIONNAIRE'
                    : 'MIXTE'
              }
              sub="ADF × KPSS croisés"
              ok={
                verdict.conclusion === 'STATIONARY' ? true : verdict.conclusion === 'NON_STATIONARY' ? false : null
              }
            />
            <div className="rounded-[3px] border border-dashed border-[var(--border)] px-2 py-1.5">
              <div className="font-mono text-[0.42rem] uppercase tracking-[2px] text-[var(--label)]">
                Biais famille
              </div>
              <div className="font-mono text-[0.6rem] font-bold" style={{ color: guidance.color }}>
                {guidance.label}
              </div>
            </div>
          </div>
          <div className="font-mono text-[0.45rem] leading-relaxed text-[var(--muted)]">
            {guidance.detail}
          </div>
          <div className="font-mono text-[0.42rem] leading-relaxed text-[var(--dim)]">
            H0 ADF = racine unitaire (rejet p&lt;0.05 → stationnaire) · H0 KPSS = stationnaire (non-rejet
            p&gt;0.05 → stationnaire). n≈96 barres = puissance faible: indicatif, pas un gate.
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  ok,
}: {
  label: string;
  value: string;
  sub?: string;
  ok: boolean | null;
}) {
  const color = ok === true ? 'var(--bull)' : ok === false ? 'var(--caution)' : 'var(--muted)';
  return (
    <div className="rounded-[3px] border border-dashed border-[var(--border)] px-2 py-1.5">
      <div className="font-mono text-[0.42rem] uppercase tracking-[2px] text-[var(--label)]">{label}</div>
      <div className="font-mono text-[0.7rem] font-bold" style={{ color }}>
        {value}
      </div>
      {sub && <div className="font-mono text-[0.42rem] text-[var(--dim)]">{sub}</div>}
    </div>
  );
}
