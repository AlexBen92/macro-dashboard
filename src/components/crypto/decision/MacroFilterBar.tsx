'use client';

import type { MacroBlock, EventRiskBlock } from '@/lib/decision/types';
import { riskStateColor, Pill } from './styles';

export default function MacroFilterBar({ macro, eventRisk }: {
  macro: MacroBlock | null;
  eventRisk: EventRiskBlock | null;
}) {
  const pressureColor = (macro?.macro_pressure ?? 50) >= 75
    ? 'var(--bear)'
    : (macro?.macro_pressure ?? 50) <= 30 ? 'var(--bull)' : 'var(--caution)';
  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-2 flex items-center gap-3 flex-wrap">
      <span className="font-mono text-[0.5rem] text-[var(--label)] uppercase tracking-[2px]">
        Macro filter
      </span>
      {macro && (
        <>
          <Pill
            text={macro.risk_state}
            color={riskStateColor(macro.risk_state)}
            bg="rgba(0,0,0,0.3)"
            border={riskStateColor(macro.risk_state)}
          />
          <span className="font-mono text-[0.55rem] text-[var(--text)]">
            pressure{' '}
            <span style={{ color: pressureColor }} className="tabular-nums">
              {macro.macro_pressure}
            </span>
            /100
          </span>
          <div className="flex gap-2 font-mono text-[0.5rem] text-[var(--dim)] flex-wrap">
            {macro.drivers.slice(0, 6).map((d) => (
              <span key={d.asset}>
                {d.asset}{' '}
                <span style={{ color: d.corr_30d == null ? 'var(--dim)' : (d.corr_30d >= 0 ? 'var(--bull)' : 'var(--bear)') }}>
                  {d.corr_30d == null ? '—' : d.corr_30d.toFixed(2)}
                </span>
                {' '}
                <span style={{ color: (d.daily_change_pct ?? 0) >= 0 ? 'var(--bull)' : 'var(--bear)' }}>
                  {d.daily_change_pct == null ? '—' : `${d.daily_change_pct > 0 ? '+' : ''}${d.daily_change_pct}%`}
                </span>
              </span>
            ))}
          </div>
        </>
      )}
      {eventRisk && (
        <span className="ml-auto font-mono text-[0.5rem] uppercase tracking-[1px]"
              style={{ color: eventRisk.in_window ? 'var(--bear)' : 'var(--dim)' }}>
          {eventRisk.in_window ? `⛔ ${eventRisk.kind} in_window` : (eventRisk.kind ? `next ${eventRisk.kind} in ${eventRisk.minutes_until}min` : 'no event')}
        </span>
      )}
    </div>
  );
}
