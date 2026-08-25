'use client';

import { useCockpitState } from '@/hooks/api/useCockpitState';
import {
  formatPct,
  lightColor,
  lightLabel,
} from '@/lib/cockpit/display';

/**
 * Bloc 1 — État global du système. Gate principal: l'agent M15 ne doit
 * JAMAIS trader si ce bloc est rouge.
 */
export default function GlobalSystemGateBar() {
  const { data, isLoading, error, isStale } = useCockpitState();
  const gate = data?.gate ?? null;

  const light = gate?.light ?? null;
  const color = lightColor(light);

  return (
    <section
      aria-label="Gate global du système"
      className="rounded-[3px] border bg-[var(--bg2)] px-4 py-3"
      style={{ borderColor: color }}
      data-testid="cockpit-gate"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          />
          <span className="font-mono text-[0.7rem] font-bold tracking-[2px]" style={{ color }}>
            {lightLabel(light)}
          </span>
          {isStale && (
            <span className="font-mono text-[0.5rem] text-[var(--caution)] uppercase">
              stale
            </span>
          )}
        </div>

        {isLoading && (
          <span className="font-mono text-[0.55rem] text-[var(--muted)]">chargement…</span>
        )}
        {error && (
          <span className="font-mono text-[0.55rem] text-[var(--bear)]">
            cockpit_state indisponible — exporteur VPS
          </span>
        )}

        {gate && (
          <>
            <Metric label="Régime" value={gate.regime.current} sub={gate.regime.days_in_regime !== null ? `${gate.regime.days_in_regime}j` : null} />
            <Metric
              label="HL-agent"
              value={gate.agent_status.hl_agent}
              sub={gate.agent_status.hl_mode}
              warn={gate.agent_status.hl_agent === 'HALTED' || gate.agent_status.hl_agent === 'STALE'}
            />
            <Metric label="M15-agent" value={gate.agent_status.m15_agent} warn={gate.agent_status.m15_agent === 'HALTED'} />
            <Metric
              label="Trades M15 jour"
              value={`${gate.counters.trades_today}/${gate.counters.max_trades}`}
              sub={`restants ${gate.counters.trades_remaining}`}
              warn={gate.counters.trades_remaining <= 0}
            />
            <Metric
              label="PnL jour / stop"
              value={`${formatPct(gate.counters.daily_pnl_pct)} / ${formatPct(-gate.counters.daily_stop_pct)}`}
              warn={gate.counters.stop_hit}
            />
            <Metric
              label="Carry D1"
              value={
                gate.carry_universe
                  ? Object.entries(gate.carry_universe)
                      .map(([a, s]) => `${a}:${s === 'ACTIF' ? 'ON' : 'OFF'}`)
                      .join(' ')
                  : '—'
              }
            />
            <Metric
              label="Vol BTC"
              value={`H ${gate.vol_regime.H_btc ?? '—'}`}
              sub={gate.vol_regime.label}
              warn={gate.vol_regime.rough_extreme}
            />
          </>
        )}
      </div>

      {gate && (gate.reasons_red.length > 0 || gate.reasons_orange.length > 0) && (
        <div className="mt-2 font-mono text-[0.5rem] text-[var(--muted)]">
          {gate.reasons_red.length > 0 && (
            <div style={{ color: 'var(--bear)' }}>
              ■ BLOCAGE: {gate.reasons_red.join(' · ')}
            </div>
          )}
          {gate.reasons_orange.length > 0 && (
            <div style={{ color: 'var(--caution)' }}>
              ■ PRUDENCE: {gate.reasons_orange.join(' · ')}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub?: string | null;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 min-w-[90px]">
      <span className="font-mono text-[0.45rem] uppercase tracking-[2px] text-[var(--label)]">
        {label}
      </span>
      <span
        className="font-mono text-[0.65rem] font-bold"
        style={{ color: warn ? 'var(--caution)' : 'var(--text)' }}
      >
        {value}
        {sub && <span className="ml-1 font-normal text-[var(--dim)] text-[0.5rem]">{sub}</span>}
      </span>
    </div>
  );
}
