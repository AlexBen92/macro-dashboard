'use client';

import {
  useOfiObiStatus,
  type OfiObiBestCell,
  type OfiObiStatus,
} from '@/hooks/api/useOfiObiStatus';
import {
  formatBps,
  formatIc,
  isPayloadStale,
  statusStyleFor,
} from '@/lib/ofiobi/status';

const STALE_THRESHOLD_MS = 25 * 60 * 60 * 1000;

function StatusBadge({ status }: { status: OfiObiStatus | null }) {
  const style = statusStyleFor(status);
  return (
    <span
      className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
      style={{ background: style.bg, color: style.text, border: `1px solid ${style.border}` }}
    >
      {status ? style.label : '—'}
    </span>
  );
}

function CellRow({ c }: { c: OfiObiBestCell }) {
  const ic = c.ic_cal;
  const icColor = ic != null && Math.abs(ic) > 0.08 ? 'var(--bull)' : 'var(--muted)';
  return (
    <tr className="border-t border-[var(--border)]">
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--label)]">{c.coin}</td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">{c.signal}</td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--dim)]">N{c.n ?? '?'}·H{c.h ?? '?'}</td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem]" style={{ color: icColor }}>
        {formatIc(ic)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">
        {c.ic_perm_p != null ? c.ic_perm_p.toFixed(3) : '—'}
      </td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem]" style={{ color: (c.val_bps_day ?? 0) > 0 ? 'var(--bull)' : 'var(--bear)' }}>
        {formatBps(c.val_bps_day)}
      </td>
      <td className="px-2 py-1.5 font-mono text-[0.55rem] text-[var(--muted)]">{formatBps(c.holdout_bps_day)}</td>
      <td className="px-2 py-1.5"><StatusBadge status={c.status} /></td>
    </tr>
  );
}

function VerdictChip({ label, value }: { label: string; value: string | null }) {
  const isNull = (value ?? '').toUpperCase().startsWith('NULL');
  return (
    <span
      className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px]"
      style={{
        background: isNull ? 'rgba(255,90,90,0.15)' : 'rgba(255,170,0,0.18)',
        color: isNull ? 'var(--bear)' : 'var(--caution)',
        border: `1px solid ${isNull ? 'var(--bear)' : 'var(--caution)'}`,
      }}
    >
      {label}: {value ?? '—'}
    </span>
  );
}

export default function OfiObiStatusCard() {
  const { data, isLoading, isStale, error } = useOfiObiStatus();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[260px] animate-pulse" />
    );
  }

  if (data.error || error) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
        <div className="font-mono text-[0.55rem] uppercase tracking-[2px] text-[var(--label)]">
          OFI/OBI · microstructure HL
        </div>
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--bear)]">
          NO_DATA {data.error ? `— ${data.error}` : `— ${error ?? ''}`}
        </div>
      </div>
    );
  }

  const rows = data.best_by_signal ?? [];
  const pboBtc = data.pbo_lot?.BTC?.PBO;
  const pboEth = data.pbo_lot?.ETH?.PBO;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="font-mono text-[0.55rem] uppercase tracking-[2px] text-[var(--label)]">
          OFI/OBI · 30 j tape HL · Usage A exécution + Usage B signal
        </div>
        {isStale && <span className="font-mono text-[0.55rem] text-[var(--caution)]">⚠ STALE</span>}
      </div>

      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <VerdictChip label="Usage A" value={data.verdict?.usage_a} />
        <VerdictChip label="Usage B" value={data.verdict?.usage_b} />
        <span className="font-mono text-[0.5rem] text-[var(--muted)]">
          IC {data.usage_b?.ic_abs_range?.[0]?.toFixed(3)}–{data.usage_b?.ic_abs_range?.[1]?.toFixed(3)} ·
          perm p≤{data.usage_b?.perm_p_max?.toFixed(3)} · edge &lt; coûts taker
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              {['coin', 'signal', 'cellule', 'IC cal', 'perm p', 'val bps/j', 'holdout', 'statut'].map((h) => (
                <th key={h} className="px-2 py-1 text-left font-mono text-[0.5rem] uppercase tracking-[1px] text-[var(--label)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <CellRow key={`${c.coin}-${c.signal}`} c={c} />
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap font-mono text-[0.5rem] text-[var(--dim)]">
        <span>
          PBO lot BTC {pboBtc != null ? pboBtc.toFixed(2) : '—'} · ETH {pboEth != null ? pboEth.toFixed(2) : '—'} ·
          coûts {data.costs || '—'}
        </span>
        <span className="text-[var(--muted)]">hash {data.config_hash || '—'}</span>
      </div>
      <div className="mt-1 font-mono text-[0.5rem] text-[var(--dim)]">
        Réactivation candidate: exécution maker (queue filter OBI) — pas en taker. Re-test maker only.
      </div>
    </div>
  );
}
