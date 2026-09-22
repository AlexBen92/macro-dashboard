'use client';

import { useState } from 'react';

import ToxicitySparkline from '@/components/crypto/microstructure/ToxicitySparkline';
import { useMicrostructure } from '@/hooks/api/useMicrostructure';
import {
  clampDisplayScore,
  displayState,
  EXEC_TIER_MULTIPLIER,
  microTrend,
  regimeColor,
  tierColor,
  trendGlyph,
  type ExecTier,
  type MicrostructurePayload,
  type SymbolMetrics,
} from '@/lib/microstructure/payloads';

const STALE_THRESHOLD_MS = 5 * 60 * 1000;

function HealthBadge({ status }: { status: string }) {
  const style =
    status === 'CONNECTED'
      ? { bg: 'rgba(0,200,120,0.15)', fg: 'var(--bull)' }
      : status === 'STALE'
        ? { bg: 'rgba(255,170,0,0.18)', fg: 'var(--caution)' }
        : { bg: 'rgba(255,90,90,0.15)', fg: 'var(--bear)' };
  return (
    <span
      className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
      style={{ background: style.bg, color: style.fg, border: `1px solid ${style.fg}` }}
    >
      {status}
    </span>
  );
}

function UnavailableCell({ label }: { label: string }) {
  return (
    <span className="font-mono text-[0.55rem] text-[var(--muted)]" title="Données insuffisantes ou flux indisponible">
      {label}
    </span>
  );
}

function SymbolRow({
  coin,
  sym,
  live,
  threshold,
}: {
  coin: string;
  sym: SymbolMetrics;
  live: boolean;
  threshold: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const state = live && sym.available ? 'LIVE' : 'UNAVAILABLE';
  const rColor = regimeColor(sym.regime);
  const tier = sym.execution_risk_tier;
  const eColor = tier ? tierColor(tier) : 'var(--muted)';
  const mult = tier ? EXEC_TIER_MULTIPLIER[tier as ExecTier] ?? 1.0 : null;
  const trend = microTrend(sym.series, tier);
  const tColor = tierColor(trend === 'STRESS' ? 'EXTREME' : trend === 'DÉGRADATION' ? 'HIGH' : trend === 'AMÉLIORATION' ? 'LOW' : 'MEDIUM');
  return (
    <>
      <tr className="border-t border-[var(--border)]">
        <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--label)]">{coin}</td>
        <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">
          {sym.mid != null ? sym.mid.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
        </td>
        <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">
          {sym.spread_bps != null ? `${sym.spread_bps.toFixed(2)}` : '—'}
        </td>
        <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">
          {(sym.depth_imbalance ?? 0).toFixed(3)}
        </td>
        <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">
          {sym.slippage_bps != null ? `${sym.slippage_bps.toFixed(2)}` : '—'}
        </td>
        {state === 'LIVE' ? (
          <>
            <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--text)]">{sym.kappa.toFixed(3)}</td>
            <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--text)]">{sym.epsilon.toFixed(3)}</td>
            <td className="px-2 py-1.5 font-mono text-[0.55rem]" style={{ color: rColor }}>
              <span
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="cursor-help"
              >
                {sym.toxicity.toFixed(3)} · {clampDisplayScore(sym.display_score).toFixed(0)}/100
              </span>
            </td>
            <td className="px-2 py-1.5">
              {tier ? (
                <span
                  className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
                  style={{ color: eColor, border: `1px solid ${eColor}` }}
                  title={`Sizing m15-agent: ×${mult}`}
                >
                  {tier} {sym.execution_risk_score != null ? `${clampDisplayScore(sym.execution_risk_score).toFixed(0)}` : ''}
                </span>
              ) : (
                <UnavailableCell label="—" />
              )}
            </td>
            <td className="px-2 py-1.5">
              <span className="font-mono text-[0.5rem] uppercase tracking-[1px]" style={{ color: tColor }}>
                {trendGlyph(trend)}
              </span>
            </td>
            <td className="px-2 py-1.5">
              <span
                className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
                style={{ color: rColor, border: `1px solid ${rColor}` }}
              >
                {sym.regime}
              </span>
            </td>
          </>
        ) : (
          <>
            <td colSpan={3} className="px-2 py-1.5">
              <UnavailableCell label="UNAVAILABLE" />
            </td>
            <td className="px-2 py-1.5">
              <UnavailableCell label="—" />
            </td>
            <td className="px-2 py-1.5">
              <UnavailableCell label="—" />
            </td>
            <td className="px-2 py-1.5">
              <UnavailableCell label={sym.regime === 'INSUFFISANT' ? 'WARMUP' : '—'} />
            </td>
          </>
        )}
      </tr>
      {showTooltip && state === 'LIVE' && (
        <tr className="border-t border-[var(--border)] bg-[var(--bg2)]">
          <td colSpan={11} className="px-2 py-1.5 font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
            κ × ε est une mesure relative de cette implémentation — pas une preuve de rentabilité ni un
            signal directionnel. Seuil {threshold} = configuré, non universel. Composantes κ:
            imbalance {sym.components.trade_imbalance.toFixed(2)}, intensité {sym.components.intensity_norm.toFixed(2)},
            concentration {sym.components.concentration.toFixed(2)}, impact {sym.components.impact_norm.toFixed(2)} · ε:
            spread {sym.components.spread_norm.toFixed(2)}, slippage {sym.components.slippage_norm.toFixed(2)},
            OBI {sym.components.obi.toFixed(2)}, profondeur {sym.components.depth_stress.toFixed(2)}
          </td>
        </tr>
      )}
    </>
  );
}

export default function MicrostructurePanel() {
  const { data, isLoading, error } = useMicrostructure();
  const p: MicrostructurePayload | null = data;

  if (isLoading || !p) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[180px] animate-pulse" />
    );
  }

  const overall = displayState(p, STALE_THRESHOLD_MS);
  const coins = Object.keys(p.symbols ?? {});
  const first = coins.length ? p.symbols[coins[0]] : null;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="font-mono text-[0.55rem] uppercase tracking-[2px] text-[var(--label)]">
          Microstructure — Hyperliquid · indice κ × ε
        </div>
        <HealthBadge status={overall === 'LIVE' ? p.status : overall} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[0.5rem] text-[var(--muted)]">
        <span>
          symboles: <span className="text-[var(--text)]">{coins.join(', ') || '—'}</span>
        </span>
        <span>
          dernier message:{' '}
          <span className="text-[var(--text)]">{p.health.last_message_at ?? '—'}</span>
        </span>
        <span>
          msgs L2: <span className="text-[var(--text)]">{p.health.messages_received.l2}</span> · trades:{' '}
          <span className="text-[var(--text)]">{p.health.messages_received.trades}</span> · reconnexions:{' '}
          <span className="text-[var(--text)]">{p.health.reconnect_count}</span>
        </span>
        {p.health.error && (
          <span className="text-[var(--bear)]">err: {p.health.error}</span>
        )}
      </div>

      {overall === 'LIVE' && first && first.series.length >= 2 ? (
        <div className="flex flex-col gap-1">
          {coins.map((coin) => {
            const s = p.symbols[coin];
            return (
              <div key={coin} className="grid grid-cols-[auto_1fr_1fr_1fr] items-center gap-2">
                <span className="font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--label)] w-8">
                  {coin}
                </span>
                <ToxicitySparkline series={s.series} threshold={p.threshold} color={regimeColor(s.regime)} label="κ × ε" />
                <ToxicitySparkline series={s.series_spread ?? []} color="var(--caution)" label="spread (bps)" decimals={2} />
                <ToxicitySparkline series={s.series_slip ?? []} color="#e07000" label="slippage (bps)" decimals={2} />
              </div>
            );
          })}
          {(!first.series_spread || !first.series_slip) && (
            <div className="font-mono text-[0.45rem] text-[var(--muted)]">
              évolutions spread/slippage: série absente (payload pré-v2 collector)
            </div>
          )}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 font-mono text-[0.45rem] text-[var(--muted)]">
            <span />
            <span>κ × ε (seuil {p.threshold}, pointillé)</span>
            <span>spread (bps)</span>
            <span>slippage est. (bps)</span>
          </div>
        </div>
      ) : (
        <div className="h-[60px] flex items-center justify-center font-mono text-[0.5rem] text-[var(--bear)]">
          {error ? `NO_DATA — ${error}` : 'INDICE UNAVAILABLE — flux non vérifié ou warmup en cours'}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {['Sym', 'Mid', 'Spread (bps)', 'Depth imb.', 'Slip. est. (bps)', 'κ', 'ε', 'κ × ε · score', 'Exec risk', 'Trend', 'Régime'].map(
                (h) => (
                  <th
                    key={h}
                    className="px-2 py-1 text-left font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--label)]"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {coins.map((coin) => (
              <SymbolRow
                key={coin}
                coin={coin}
                sym={p.symbols[coin]}
                live={overall === 'LIVE'}
                threshold={p.threshold}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-[3px] border border-dashed border-[var(--border)] px-2 py-1 font-mono text-[0.5rem] leading-relaxed text-[var(--muted)]">
        Contexte de microstructure — non validé comme signal directionnel. Utiliser uniquement pour le
        pricing, le filtrage d&apos;exécution et le sizing du risque. Execution risk tier → sizing
        m15-agent ×1.0 / ×0.7 / ×0.4 / ×0.25 (calibrage initial, recalibrage sur données réelles).{' '}
        {p.threshold_note} ({p.threshold}) · {p.disclaimer}
      </div>
    </div>
  );
}
