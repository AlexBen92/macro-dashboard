'use client';

import { useEdgeM15Status } from '@/hooks/api/useEdgeM15Status';

function verdictColor(label: string): { text: string; bg: string; border: string } {
  if (label.startsWith('MR LONG') || label.startsWith('MR SHORT') || label.startsWith('SCALP')) {
    return {
      text: 'var(--bull)',
      bg: 'rgba(74,222,128,0.08)',
      border: 'var(--bull)',
    };
  }
  if (label.startsWith('NO TRADE')) {
    return {
      text: 'var(--muted)',
      bg: 'rgba(140,140,160,0.05)',
      border: 'var(--muted)',
    };
  }
  return {
    text: 'var(--caution)',
    bg: 'rgba(255,170,0,0.05)',
    border: 'var(--caution)',
  };
}

function metricRow(label: string, value: string | number | null, hint?: string) {
  const display = value == null ? '—' : typeof value === 'number' ? value.toFixed(2) : value;
  return (
    <div className="flex items-center justify-between font-mono text-[0.6rem] py-0.5">
      <span className="text-[var(--muted)] uppercase tracking-[1px]">
        {label}
        {hint ? <span className="text-[var(--dim)] ml-1 normal-case">{hint}</span> : null}
      </span>
      <span className="tabular-nums text-[var(--text)]">{display}</span>
    </div>
  );
}

export default function EdgeM15BTCCard() {
  const { data, isLoading } = useEdgeM15Status();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[200px] animate-pulse" />
    );
  }

  const v = data.verdict_btc;
  const style = verdictColor(v.label);

  return (
    <div
      className="bg-[var(--bg2)] border rounded-[4px] p-3 flex flex-col gap-2"
      style={{ background: style.bg, borderColor: style.border }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Edge M15 BTC · Verdict
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {data.as_of?.slice(11, 16)} UTC
        </span>
      </div>

      <div
        className="font-mono text-[1.6rem] font-bold leading-none text-center py-2"
        style={{ color: style.text }}
      >
        {v.label}
      </div>
      <div className="font-mono text-[0.6rem] text-[var(--muted)] text-center -mt-1">
        {v.reason}
      </div>

      <div className="border-t border-[var(--border)] pt-1.5">
        {metricRow('ADX(14) M15', v.adx, v.adx < 20 ? 'range' : v.adx > 25 ? 'trend' : 'mix')}
        {metricRow('Vol ratio', v.vol_ratio, v.vol_ratio != null ? (v.vol_ratio < 1 ? 'cool' : 'hot') : '')}
        {metricRow('RSI(14)', v.rsi, v.rsi < 30 ? 'oversold' : v.rsi > 70 ? 'overbought' : 'neutral')}
        {metricRow('Order flow (10 cand)', v.delta_proxy, v.delta_proxy > 0 ? 'buy' : 'sell')}
        {metricRow('Recent trades Δ', v.recent_trades_delta)}
        {v.bb_upper != null && v.bb_lower != null
          ? metricRow('BB[20,2]', `${v.bb_lower.toFixed(0)}–${v.bb_upper.toFixed(0)}`,
                       v.bb_bw_expanding ? 'expanding' : 'flat')
          : null}
        {v.close != null && metricRow('Close', v.close)}
      </div>
    </div>
  );
}
