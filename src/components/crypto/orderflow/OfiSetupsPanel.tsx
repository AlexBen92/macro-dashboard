'use client';

import { useOrderflowStatus, type OfiStatus, type OfiStrategyEntry } from '@/hooks/api/useOrderflowStatus';

const STATUS_STYLE: Record<OfiStatus, { bg: string; text: string; border: string; label: string }> = {
  ON: { bg: 'rgba(74,222,128,0.18)', text: 'var(--bull)', border: 'var(--bull)', label: 'ON' },
  OFF: { bg: 'rgba(140,140,160,0.10)', text: 'var(--dim)', border: 'var(--border)', label: 'OFF' },
  ALPHA_DECAY: { bg: 'rgba(255,170,0,0.18)', text: 'var(--caution)', border: 'var(--caution)', label: 'DECAY' },
  NULL: { bg: 'rgba(255,90,90,0.15)', text: 'var(--bear)', border: 'var(--bear)', label: 'NULL' },
};

function ShCell({ sh }: { sh: number }) {
  const color = sh > 1.0 ? 'var(--bull)' : sh > 0.5 ? 'rgb(180,200,140)' : sh < 0.1 ? 'var(--bear)' : 'var(--dim)';
  return <span style={{ color }} className="font-mono">{sh >= 0 ? '+' : ''}{sh.toFixed(2)}</span>;
}

function StrategyRow({ s }: { s: OfiStrategyEntry }) {
  const style = STATUS_STYLE[s.status];
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--label)]">
        {s.name}
        {s.alpha_decay_flag && (
          <span title="Alpha decayed vs 1m baseline" className="ml-1 text-[var(--caution)]">⚠</span>
        )}
      </td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">{s.symbol}</td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--dim)]">{s.horizon}</td>
      <td className="px-2 py-1.5">
        <span
          className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
          style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
        >
          {style.label}
        </span>
      </td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">{s.fee_scenario}</td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem]"><ShCell sh={s.metrics.sh_oos} /></td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">
        {s.metrics.mc_p5_bps >= 0 ? '+' : ''}{s.metrics.mc_p5_bps.toFixed(1)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">{s.metrics.n_trades}</td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--dim)]">
        ${Math.round(s.capacity_usd / 1000)}k
      </td>
    </tr>
  );
}

export default function OfiSetupsPanel() {
  const { data, isLoading, isStale } = useOrderflowStatus();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[260px] animate-pulse" />
    );
  }

  const strategies = data.strategies ?? [];
  const validation = data.validation_status ?? { wf_complete: false };

  const onCount = strategies.filter((s) => s.status === 'ON').length;
  const decayCount = strategies.filter((s) => s.status === 'ALPHA_DECAY').length;
  const nullCount = strategies.filter((s) => s.status === 'NULL').length;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          OFI Setups · {strategies.length} strategies
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {onCount > 0 && <span className="text-[var(--bull)]">{onCount} ON</span>}
          {decayCount > 0 && <span className="text-[var(--caution)] ml-2">{decayCount} DECAY</span>}
          {nullCount > 0 && <span className="text-[var(--bear)] ml-2">{nullCount} NULL</span>}
          {isStale && <span className="text-[var(--caution)] ml-2">⚠ STALE</span>}
        </span>
      </div>
      {!validation.wf_complete && (
        <div className="bg-[var(--caution)]/10 border border-[var(--caution)]/30 rounded-[2px] px-2 py-1 mb-2 font-mono text-[0.5rem] text-[var(--caution)]">
          WF en cours ou incomplet — résultats non validés
        </div>
      )}
      {strategies.length === 0 ? (
        <div className="font-mono text-[0.55rem] text-[var(--dim)] py-4 text-center">
          Aucune stratégie OFI — WF non lancé ou pipeline cassé
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="font-mono text-[0.45rem] uppercase tracking-[1px] text-[var(--muted)]">
                <th className="px-2 py-1">Strategy</th>
                <th className="px-2 py-1">Symbol</th>
                <th className="px-2 py-1">Horizon</th>
                <th className="px-2 py-1">Status</th>
                <th className="px-2 py-1">Fee</th>
                <th className="px-2 py-1">Sh OOS</th>
                <th className="px-2 py-1">MC p5 bps</th>
                <th className="px-2 py-1">N trades</th>
                <th className="px-2 py-1">Capacity</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, i) => <StrategyRow key={`${s.name}-${s.symbol}-${s.horizon}-${s.fee_scenario}-${i}`} s={s} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
