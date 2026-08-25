'use client';

import { useCockpitState } from '@/hooks/api/useCockpitState';
import {
  attributionBars,
  formatPct,
  isDeltaDominated,
} from '@/lib/cockpit/display';

/**
 * Bloc 5 — Attribution PnL: décomposition delta / funding / basis / fees par
 * position et trade récent. Icône « chance / non-carry » quand le delta
 * domine (tag directional_unintended).
 */
export default function PnlAttributionPanel() {
  const { data, isLoading, error } = useCockpitState();
  const attr = data?.attribution ?? null;

  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3" data-testid="pnl-attribution-panel">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          ATTRIBUTION PnL — δ / FUNDING / BASIS
        </span>
        {attr?.summary && (
          <span className="font-mono text-[0.45rem] text-[var(--dim)]">
            part structurelle{' '}
            <span style={{ color: (attr.summary.structural_pnl_share ?? 0) > 0.3 ? 'var(--bull)' : 'var(--caution)' }}>
              {attr.summary.structural_pnl_share !== null
                ? `${(attr.summary.structural_pnl_share * 100).toFixed(0)}%`
                : '—'}
            </span>{' '}
            · {attr.summary.n_trades} trades
          </span>
        )}
      </div>
      {isLoading && <div className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</div>}
      {error && <div className="font-mono text-[0.55rem] text-[var(--caution)]">indisponible</div>}
      {attr && attr.positions.length === 0 && attr.trades_recent.length === 0 && (
        <div className="font-mono text-[0.55rem] text-[var(--dim)]">
          Aucune position ni trade récent — 0 trade = résultat correct si edge NO_EDGE.
        </div>
      )}
      {attr && attr.positions.length > 0 && (
        <Section title="Positions ouvertes (shadow)">
          {attr.positions.map((p, i) => (
            <Row
              key={`${p.source}-${p.asset}-${i}`}
              label={`${p.asset} · ${p.source}`}
              sub={p.has_legs ? '2 jambes δ-neutre' : `1 jambe ${p.direction ?? ''}`}
              total={p.attribution.total_pct}
              bars={attributionBars(p.attribution)}
              luck={p.tag === 'directional_unintended' || (!p.has_legs && isDeltaDominated(p.attribution))}
              drift={p.attribution.basis_drift_bps ?? null}
            />
          ))}
        </Section>
      )}
      {attr && attr.trades_recent.length > 0 && (
        <Section title="Trades récents (fermés + ouverts)">
          {attr.trades_recent.slice(0, 12).map((t, i) => (
            <Row
              key={`${t.source}-${t.ts}-${i}`}
              label={`${t.asset} · ${t.source}`}
              sub={`${t.ts?.slice(5, 16).replace('T', ' ')} ${t.exit_reason ?? ''}`}
              total={t.attribution.total_pct}
              bars={attributionBars(t.attribution)}
              luck={t.tag === 'directional_unintended' || isDeltaDominated(t.attribution)}
              drift={null}
            />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <div className="font-mono text-[0.42rem] uppercase tracking-[1.5px] text-[var(--label)] mb-1">
        {title}
      </div>
      <div className="flex flex-col gap-1">{children}</div>
    </div>
  );
}

function Row({
  label,
  sub,
  total,
  bars,
  luck,
  drift,
}: {
  label: string;
  sub: string;
  total: number;
  bars: ReturnType<typeof attributionBars>;
  luck: boolean;
  drift: number | null;
}) {
  const pos = total >= 0;
  return (
    <div className="rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 font-mono text-[0.5rem]">
        <span className="font-bold">
          {label} <span className="text-[var(--dim)] font-normal">{sub}</span>
        </span>
        <span className="flex items-center gap-2">
          {luck && (
            <span
              title="PnL dominé par le delta — structure non exploitée (chance)"
              className="text-[var(--caution)]"
            >
              🎲 chance/non-carry
            </span>
          )}
          {drift !== null && <span className="text-[var(--dim)]">drift {drift.toFixed(1)}bps</span>}
          <span style={{ color: pos ? 'var(--bull)' : 'var(--bear)' }}>{formatPct(total)}</span>
        </span>
      </div>
      <div className="mt-1 flex h-2 gap-px overflow-hidden rounded-[2px]">
        {bars.map((b) => (
          <div
            key={b.label}
            title={`${b.label}: ${formatPct(b.value)}`}
            style={{ width: `${b.widthPct}%`, background: b.color, opacity: 0.85 }}
          />
        ))}
      </div>
      <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-[0.42rem] text-[var(--dim)]">
        {bars.map((b) => (
          <span key={b.label}>
            {b.label} {formatPct(b.value)}
          </span>
        ))}
      </div>
    </div>
  );
}
