'use client';

import { useDecisionStatus } from '@/hooks/api/useDecisionStatus';
import { useDecisionAlerts } from '@/lib/decision/alerts';
import DecisionVerdictCard from './DecisionVerdictCard';
import MacroFilterBar from './MacroFilterBar';
import DataQualityPanel from './DataQualityPanel';

export default function DecisionEnginePanel() {
  const { data, isLoading, isStale, lastExportAgeMs } = useDecisionStatus();
  useDecisionAlerts(data);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[400px] animate-pulse" />
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[400px] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <MacroFilterBar macro={data.macro} eventRisk={data.event_risk} />
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] px-2 py-1 font-mono text-[0.5rem] text-[var(--dim)] uppercase tracking-[1px] whitespace-nowrap">
          pipeline {data.pipeline_version}
          {isStale && <span className="ml-2 text-[var(--caution)]">STALE {Math.round((lastExportAgeMs ?? 0) / 60000)}min</span>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DecisionVerdictCard asset={data.btc} />
        <DecisionVerdictCard asset={data.eth} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <DataQualityPanel dq={data.btc.data_quality} stale={isStale} />
        <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-2 flex flex-col gap-1">
          <span className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px]">
            Cross-asset
          </span>
          <div className="font-mono text-[0.55rem] text-[var(--text)] flex flex-col gap-0.5">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">β(ETH, BTC):</span>
              <span className="tabular-nums">{data.cross_asset.beta_eth_to_btc == null ? '—' : data.cross_asset.beta_eth_to_btc.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Lead/lag (h):</span>
              <span className="tabular-nums">{data.cross_asset.lead_lag_btc_eth_hours == null ? '—' : `${data.cross_asset.lead_lag_btc_eth_hours > 0 ? '+' : ''}${data.cross_asset.lead_lag_btc_eth_hours}`}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">BTC leadership:</span>
              <span className="tabular-nums" style={{ color: data.cross_asset.btc_leadership_score >= 70 ? 'var(--bull)' : data.cross_asset.btc_leadership_score < 40 ? 'var(--bear)' : 'var(--caution)' }}>
                {data.cross_asset.btc_leadership_score.toFixed(0)}/100
              </span>
            </div>
            {data.cross_asset.eth_suppressed && (
              <div className="text-[var(--bear)] mt-1">
                ⛔ ETH suppressed by BTC leadership
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
