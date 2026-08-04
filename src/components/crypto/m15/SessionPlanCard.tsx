'use client';

import { useEdgeM15Status } from '@/hooks/api/useEdgeM15Status';

export default function SessionPlanCard() {
  const { data, isLoading } = useEdgeM15Status();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[140px] animate-pulse" />
    );
  }

  const s = data.session;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Session Plan M15
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {s.start_utc}–{s.end_utc} UTC
        </span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="font-mono text-[1.3rem] font-bold leading-none text-[var(--text)]">
          {s.name}
        </span>
        <span className="font-mono text-[0.6rem] text-[var(--muted)]">
          {s.regime}
        </span>
      </div>

      <div className="font-mono text-[0.65rem] text-[var(--text)] leading-snug border-l-2 pl-2"
            style={{ borderColor: 'var(--label)' }}>
        {s.rule_text}
      </div>

      <div className="flex gap-4 pt-1 border-t border-[var(--border)]">
        <div className="flex flex-col">
          <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
            Max trades / session
          </span>
          <span className="font-mono text-[1rem] font-bold text-[var(--text)]">
            {s.max_trades_session}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
            Régime streak
          </span>
          <span className="font-mono text-[1rem] font-bold text-[var(--text)]">
            {data.days_in_regime ?? 0}d
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
            Heure UTC
          </span>
          <span className="font-mono text-[1rem] font-bold text-[var(--text)]">
            {String(Math.floor(s.hour_utc)).padStart(2, '0')}h
          </span>
        </div>
      </div>
    </div>
  );
}
