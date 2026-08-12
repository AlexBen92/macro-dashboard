'use client';

import { useOrderflowStatus } from '@/hooks/api/useOrderflowStatus';

function OfiCell({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const sign = value > 0.05 ? 'pos' : value < -0.05 ? 'neg' : 'flat';
  const color = sign === 'flat'
    ? 'var(--dim)'
    : (invert ? sign === 'neg' : sign === 'pos')
      ? 'var(--bull)'
      : 'var(--bear)';
  return (
    <div className="flex flex-col">
      <span className="font-mono text-[0.45rem] text-[var(--muted)] uppercase tracking-[1px]">
        {label}
      </span>
      <span className="font-mono text-[0.75rem]" style={{ color }}>
        {value >= 0 ? '+' : ''}{value.toFixed(2)}
      </span>
    </div>
  );
}

export default function OrderFlowImbalanceWidget() {
  const { data, isLoading, isStale } = useOrderflowStatus();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[160px] animate-pulse" />
    );
  }

  const symbols = data.symbols ?? [];
  const entries = symbols.map((s) => ({ symbol: s, rt: data.ofi_realtime?.[s] }));

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Order Flow Imbalance · live
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {isStale ? '⚠ STALE' : `${data.data_window_days}d capture`}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {entries.map(({ symbol, rt }) => {
          if (!rt) {
            return (
              <div key={symbol} className="border border-[var(--border)] rounded-[3px] p-2">
                <div className="font-mono text-[0.6rem] text-[var(--muted)]">{symbol}</div>
                <div className="font-mono text-[0.5rem] text-[var(--dim)] mt-1">no data</div>
              </div>
            );
          }
          const stale = rt.stale;
          return (
            <div
              key={symbol}
              className="border border-[var(--border)] rounded-[3px] p-2"
              title={rt.as_of ? `last bar: ${rt.as_of}` : 'no recent bar'}
            >
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-[0.65rem] text-[var(--label)]">{symbol}</span>
                {stale && (
                  <span className="font-mono text-[0.45rem] text-[var(--caution)] uppercase tracking-[1px]">
                    stale
                  </span>
                )}
              </div>
              <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5">
                ${rt.mid_close?.toLocaleString(undefined, { maximumFractionDigits: 1 }) ?? '—'}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <OfiCell label="OFI z (1m)" value={rt.ofi_z_1m} />
                <OfiCell label="MLOFI z (1m)" value={rt.mlofi_z_1m} />
                <OfiCell label="VOI" value={rt.voi} />
                <OfiCell label="μPx dev bps" value={rt.microprice_dev_bps} />
              </div>
              <div className="font-mono text-[0.45rem] text-[var(--muted)] mt-2">
                spread {rt.spread_bps?.toFixed(2)} bps · {rt.n_trades_last?.toFixed(0)} trades/min
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
