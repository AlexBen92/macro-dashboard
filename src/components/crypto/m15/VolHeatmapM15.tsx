'use client';

import { useEdgeM15Status, type VolHeatmap } from '@/hooks/api/useEdgeM15Status';

const SESSIONS: { key: keyof VolHeatmap['sessions']; label: string; hours: string }[] = [
  { key: 'ASIA', label: 'ASIA', hours: '00–08 UTC' },
  { key: 'LONDON', label: 'LONDON', hours: '08–13 UTC' },
  { key: 'NY', label: 'NY', hours: '13–21 UTC' },
  { key: 'OFFHOURS', label: 'OFF', hours: '21–24 UTC' },
];

function heatColor(pct: number): { bg: string; text: string } {
  if (!Number.isFinite(pct) || pct === 0) {
    return { bg: 'var(--bg3)', text: 'var(--muted)' };
  }
  if (pct > 0.8) return { bg: 'rgba(255,51,85,0.32)', text: 'var(--bear)' };
  if (pct > 0.6) return { bg: 'rgba(255,170,0,0.25)', text: 'var(--caution)' };
  if (pct > 0.4) return { bg: 'rgba(140,180,255,0.18)', text: 'rgb(140,180,255)' };
  return { bg: 'rgba(74,222,128,0.15)', text: 'var(--bull)' };
}

export default function VolHeatmapM15() {
  const { data, isLoading } = useEdgeM15Status();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[120px] animate-pulse" />
    );
  }

  const sessions = data.vol_heatmap?.sessions ?? {
    ASIA: 0, LONDON: 0, NY: 0, OFFHOURS: 0,
  };
  const current = data.vol_heatmap?.current_session;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Vol Heatmap M15
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          30d pct · ATR(14)
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1">
        {SESSIONS.map((s) => {
          const pct = sessions[s.key] ?? 0;
          const c = heatColor(pct);
          const isCurrent = current === s.key;
          return (
            <div
              key={s.key}
              className="border rounded-[3px] p-1.5 flex flex-col gap-0.5"
              style={{
                background: c.bg,
                borderColor: isCurrent ? c.text : 'var(--border)',
                borderWidth: isCurrent ? 2 : 1,
              }}
              title={`${s.label} ${s.hours} — ${((pct ?? 0) * 100).toFixed(0)}% percentile`}
            >
              <div className="font-mono text-[0.55rem] uppercase tracking-[1px]" style={{ color: c.text }}>
                {s.label}
                {isCurrent ? ' ●' : ''}
              </div>
              <div className="font-mono text-[0.65rem] tabular-nums" style={{ color: c.text }}>
                {((pct ?? 0) * 100).toFixed(0)}%
              </div>
              <div className="font-mono text-[0.45rem] text-[var(--dim)] leading-tight">
                {s.hours}
              </div>
            </div>
          );
        })}
      </div>

      <div className="font-mono text-[0.55rem] text-[var(--muted)] leading-tight">
        Pct = ATR(14 M15) actuel vs historique 30d même session. &gt;80% = fenêtre chaude,
        &lt;40% = fenêtre froide.
      </div>
    </div>
  );
}
