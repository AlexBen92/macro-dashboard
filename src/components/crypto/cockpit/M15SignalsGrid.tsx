'use client';

import { useCarryHealth } from '@/hooks/api/useCarryHealth';
import { useCockpitState } from '@/hooks/api/useCockpitState';
import { useEdgeM15Status } from '@/hooks/api/useEdgeM15Status';
import { useVolSurface } from '@/hooks/api/useVolSurface';
import { formatBps } from '@/lib/cockpit/display';
import type { CockpitGate } from '@/lib/cockpit/payloads';

const ASSETS = ['BTC', 'ETH', 'SOL'] as const;

function strategyType(edge: string | undefined | null): string {
  switch (edge) {
    case 'RANGE_MR':
      return 'MEAN_REVERSION';
    case 'BREAKOUT':
      return 'BREAKOUT';
    case 'TRANSITION':
      return 'SCALPING_RAPIDE';
    default:
      return 'AUCUNE (NO_EDGE)';
  }
}

/**
 * Bloc 8 — Signaux M15 & gating: grille multi-actifs croisant edge, session,
 * régime global + vol (rough/markovien), basis/funding health, statut
 * contractuel et indicateurs risk. Le gating fort est appliqué côté VPS
 * (gate.py) — cette grille reflète la décision du gate.
 */
export default function M15SignalsGrid() {
  const cockpit = useCockpitState();
  const vol = useVolSurface();
  const carry = useCarryHealth();
  const edge = useEdgeM15Status();

  const gate = cockpit.data?.gate ?? null;

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="m15-signals-grid">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          SIGNAUX M15 & GATING
        </span>
        {gate && (
          <span className="font-mono text-[0.45rem] text-[var(--dim)]">
            permission M15:{' '}
            <span
              style={{
                color:
                  gate.m15_permission === 'ALLOWED'
                    ? 'var(--bull)'
                    : gate.m15_permission === 'BLOCKED'
                      ? 'var(--bear)'
                      : 'var(--caution)',
              }}
            >
              {gate.m15_permission}
            </span>{' '}
            · session {edge.data?.session.name ?? '—'} · trades restants{' '}
            {gate.counters.trades_remaining}
          </span>
        )}
      </div>
      {cockpit.isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {cockpit.error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">gate indisponible — signaux non actionnables</div>}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        {ASSETS.map((asset) => (
          <AssetCard
            key={asset}
            asset={asset}
            gate={gate}
            volAsset={vol.data?.assets.find((a) => a.asset === asset) ?? null}
            path={vol.data?.path_features.find((p) => p.asset === asset) ?? null}
            carryRow={carry.data?.rows.find((r) => r.asset === asset) ?? null}
            edgeGlobal={asset === 'BTC' ? (edge.data?.edge_global ?? null) : null}
            verdictClose={asset === 'BTC' ? (edge.data?.verdict_btc.close ?? null) : null}
            kellyFraction={
              edge.data?.setups_actifs.find(
                (s) => s.active && s.sizing_suggestion && s.strategy.includes(asset === 'BTC' ? 'S1' : asset),
              )?.sizing_suggestion?.fraction ?? null
            }
          />
        ))}
      </div>
    </div>
  );
}

function AssetCard({
  asset,
  gate,
  volAsset,
  path,
  carryRow,
  edgeGlobal,
  verdictClose,
  kellyFraction,
}: {
  asset: string;
  gate: CockpitGate | null;
  volAsset: import('@/lib/cockpit/payloads').VolAssetState | null;
  path: import('@/lib/cockpit/payloads').PathFeatureState | null;
  carryRow: import('@/lib/cockpit/payloads').CarryHealthRow | null;
  edgeGlobal: string | null;
  verdictClose: number | null;
  kellyFraction: number | null;
}) {
  const strat = strategyType(edgeGlobal);
  const meanRev = gate?.m15_gating.M15_MeanReversion;
  const breakout = gate?.m15_gating.M15_Breakout;
  const carryGate = gate?.m15_gating.Carry_D1;
  const roughExtreme = gate?.vol_regime.rough_extreme ?? false;
  const regime = gate?.regime.current ?? '—';

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.7rem] font-bold">
          {asset}
          {verdictClose !== null && (
            <span className="ml-1.5 text-[0.5rem] text-[var(--dim)]">{verdictClose.toFixed(0)}</span>
          )}
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">
          {regime} · H {volAsset?.hurst.H_iv_skew_scaling?.H ?? volAsset?.hurst.H_realized_vol ?? '—'}
          {roughExtreme && <span style={{ color: 'var(--bear)' }}> ROUGH_EXTREME</span>}
        </span>
      </div>
      <KV label="Strat active" value={strat} />
      <KV
        label="Régime vol"
        value={volAsset?.regime_label ?? '—'}
        color={volAsset?.regime_label === 'REGIME_VOL_ROUGH' ? 'var(--bear)' : undefined}
      />
      <KV
        label="Chemin (expérim.)"
        value={path ? `${path.path_label} (chaos ${path.chaos_score.toFixed(2)}) — non validé, hors gates` : '—'}
      />
      <KV
        label="Basis / funding"
        value={
          carryRow
            ? `${formatBps(carryRow.basis_bps, 1)} · ${carryRow.funding_sign === 1 ? 'funding +' : carryRow.funding_sign === -1 ? 'funding −' : '—'}${carryRow.drift_alert ? ' ⚠️ drift' : ''}`
            : '—'
        }
        color={carryRow?.drift_alert ? 'var(--bear)' : undefined}
      />
      <div className="mt-0.5 flex flex-wrap gap-1 font-mono text-[0.42rem]">
        {meanRev && <GatingChip name="MR" g={meanRev} />}
        {breakout && <GatingChip name="BREAK" g={breakout} />}
        {carryGate && <GatingChip name="CARRY" g={carryGate} />}
      </div>
      <div className="mt-0.5 font-mono text-[0.42rem] text-[var(--dim)]">
        Risk: taille max {kellyFraction !== null ? `${(kellyFraction * 100).toFixed(1)}% équité` : 'sizing setups'} · SL/TP1/TP2 définis avant ENTER · stop journalier{' '}
        {gate ? (gate.counters.stop_hit ? 'ATTEINT' : 'inactif') : '—'}
      </div>
    </div>
  );
}

function KV({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex justify-between gap-2 font-mono text-[0.48rem]">
      <span className="text-[var(--label)] uppercase tracking-[1px]">{label}</span>
      <span style={{ color: color ?? 'var(--text)' }}>{value}</span>
    </div>
  );
}

function GatingChip({
  name,
  g,
}: {
  name: string;
  g: { state: string; reasons: string[] };
}) {
  const color =
    g.state === 'ALLOWED'
      ? 'var(--bull)'
      : g.state === 'BLOCKED'
        ? 'var(--bear)'
        : 'var(--caution)';
  return (
    <span
      className="px-1.5 py-0.5 rounded-[2px] border"
      style={{ color, borderColor: color }}
      title={g.reasons.join('; ') || 'aucun motif'}
    >
      {name} {g.state}
    </span>
  );
}
