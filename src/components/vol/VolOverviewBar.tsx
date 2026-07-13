'use client';

import { FlaskConical, AlertTriangle } from 'lucide-react';
import ActionabilityBadge from '@/components/ui/ActionabilityBadge';
import type { VolResearchPayload, VrpRegime } from '@/lib/types/vol-research';

interface Props {
  payload: VolResearchPayload;
}

const REGIME_COLOR: Record<VrpRegime, string> = {
  LOW_VRP: 'var(--bull)',
  MID_VRP: 'var(--dim)',
  HIGH_VRP: 'var(--caution)',
  NA: 'var(--muted)',
};

const REGIME_LABEL_SHORT: Record<VrpRegime, string> = {
  LOW_VRP: 'LOW',
  MID_VRP: 'MID',
  HIGH_VRP: 'HIGH',
  NA: '—',
};

export default function VolOverviewBar({ payload }: Props) {
  const btcVrp = payload.vrp.BTC;
  const ethVrp = payload.vrp.ETH;
  const paper = payload.s1_paper;

  const s1Active = (paper?.active_count ?? 0) > 0;
  const daysRunning = paper?.days_running ?? 0;
  const equityDelta =
    paper?.equity_current_usd && paper?.equity_start_usd
      ? paper.equity_current_usd - paper.equity_start_usd
      : 0;
  const equityPct = paper?.equity_start_usd
    ? (equityDelta / paper.equity_start_usd) * 100
    : 0;

  const globalRobustnessBadge =
    daysRunning < 30 ? (
      <ActionabilityBadge variant="validation" size="md" />
    ) : (
      <ActionabilityBadge variant="informational" size="md" />
    );

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Cell label="VRP BTC">
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color:
                  btcVrp.current_value_volpts === null
                    ? 'var(--muted)'
                    : btcVrp.current_value_volpts >= 0
                      ? 'var(--text)'
                      : 'var(--bear)',
              }}
            >
              {btcVrp.current_value_volpts === null
                ? '—'
                : `${btcVrp.current_value_volpts >= 0 ? '+' : ''}${btcVrp.current_value_volpts.toFixed(1)}`}
            </span>
            <span
              className="font-mono text-sm font-semibold"
              style={{ color: REGIME_COLOR[btcVrp.regime] }}
            >
              {REGIME_LABEL_SHORT[btcVrp.regime]}
            </span>
          </div>
        </Cell>

        <Cell label="VRP ETH">
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color:
                  ethVrp.current_value_volpts === null
                    ? 'var(--muted)'
                    : ethVrp.current_value_volpts >= 0
                      ? 'var(--text)'
                      : 'var(--bear)',
              }}
            >
              {ethVrp.current_value_volpts === null
                ? '—'
                : `${ethVrp.current_value_volpts >= 0 ? '+' : ''}${ethVrp.current_value_volpts.toFixed(1)}`}
            </span>
            <span
              className="font-mono text-sm font-semibold"
              style={{ color: REGIME_COLOR[ethVrp.regime] }}
            >
              {REGIME_LABEL_SHORT[ethVrp.regime]}
            </span>
          </div>
        </Cell>

        <Cell label="S1 Paper Trader">
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono text-2xl font-bold tabular-nums"
              style={{
                color: s1Active ? 'var(--bull)' : 'var(--text)',
              }}
            >
              ${paper?.equity_current_usd?.toFixed(0) ?? '—'}
            </span>
            <span
              className="font-mono text-[0.62rem]"
              style={{
                color: equityDelta >= 0 ? 'var(--bull)' : 'var(--bear)',
              }}
            >
              {equityDelta >= 0 ? '+' : ''}
              {equityPct.toFixed(2)}%
            </span>
          </div>
          <div className="font-mono text-[0.5rem] text-[var(--muted)] mt-0.5">
            {daysRunning}j · {paper?.fill_count ?? 0} fills
          </div>
        </Cell>

        <Cell label="Robustesse système">
          <div className="flex flex-col gap-1.5">
            {globalRobustnessBadge}
            <div className="flex items-center gap-1 font-mono text-[0.5rem] text-[var(--dim)] leading-snug">
              <FlaskConical size={9} strokeWidth={1.75} color="var(--caution)" />
              <span>
                S1 paper {daysRunning}j/30 · VRP OOS n=20
              </span>
            </div>
          </div>
        </Cell>
      </div>

      {(btcVrp.regime === 'HIGH_VRP' || ethVrp.regime === 'HIGH_VRP') && (
        <div className="mt-3 pt-3 border-t border-[var(--border)] flex items-center gap-2 font-mono text-[0.55rem] uppercase tracking-[0.08em] text-[var(--caution)]">
          <AlertTriangle size={11} strokeWidth={1.75} />
          VRP élevé détecté — prime de variance anormale, surveiller expansion de vol
        </div>
      )}
    </div>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-l border-[var(--border)] pl-3 first:border-l-0 first:pl-0">
      <div className="font-mono text-[0.5rem] uppercase tracking-[0.12em] text-[var(--muted)] mb-1.5">
        {label}
      </div>
      {children}
    </div>
  );
}
