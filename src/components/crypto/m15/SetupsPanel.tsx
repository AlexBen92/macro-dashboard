'use client';

import { useEdgeM15Status, type SetupRow } from '@/hooks/api/useEdgeM15Status';

const STRATEGY_LABEL: Record<string, string> = {
  S1_V16_thr5: 'S1 · IV straddle arb',
  S10_V26_h24_agg: 'S10 · SPX lead-lag',
  C2_V21_revert_ADA: 'C2 · ADA range-revert',
};

const TAG_STYLE: Record<SetupRow['tag'], { bg: string; text: string; border: string }> = {
  STRONG: { bg: 'rgba(74,222,128,0.18)', text: 'var(--bull)', border: 'var(--bull)' },
  OK: { bg: 'rgba(140,180,255,0.15)', text: 'rgb(140,180,255)', border: 'rgb(140,180,255)' },
  'LOW-N': { bg: 'rgba(140,140,160,0.10)', text: 'var(--muted)', border: 'var(--muted)' },
  'LOW-DSR': { bg: 'rgba(140,140,160,0.10)', text: 'var(--muted)', border: 'var(--muted)' },
};

export default function SetupsPanel() {
  const { data, isLoading } = useEdgeM15Status();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[200px] animate-pulse" />
    );
  }

  const setups = data.setups_actifs ?? [];
  const excluded = data.matrix_excluded ?? [];

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Setups filtrés · régime {data.regime}
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {setups.length} actifs
        </span>
      </div>

      {setups.length === 0 ? (
        <div className="font-mono text-[0.6rem] text-[var(--muted)] py-3">
          Aucun setup qualifié pour le régime courant.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {setups.map((s) => {
            const tag = TAG_STYLE[s.tag];
            const label = STRATEGY_LABEL[s.strategy] ?? s.strategy;
            return (
              <div
                key={s.strategy}
                className="flex items-center gap-2 border rounded-[3px] px-2 py-1.5"
                style={{
                  borderColor: s.active ? tag.border : 'var(--border)',
                  background: s.active ? tag.bg : 'transparent',
                  opacity: s.active ? 1 : 0.55,
                }}
              >
                <span
                  className="font-mono text-[0.5rem] uppercase tracking-[1px] px-1.5 py-0.5 rounded-[2px] flex-shrink-0"
                  style={{ background: tag.bg, color: tag.text, border: `1px solid ${tag.border}` }}
                >
                  {s.tag}
                </span>
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-mono text-[0.65rem] text-[var(--text)] truncate">
                    {label}
                  </span>
                  <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
                    {s.strategy}
                  </span>
                </div>
                <div className="flex gap-3 font-mono text-[0.55rem] tabular-nums">
                  <div className="text-right">
                    <div className="text-[var(--muted)] text-[0.45rem] uppercase">Sh</div>
                    <div style={{ color: s.sharpe >= 3 ? 'var(--bull)' : 'var(--text)' }}>
                      {s.sharpe.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--muted)] text-[0.45rem] uppercase">DSR</div>
                    <div style={{ color: s.passes_dsr ? 'var(--bull)' : 'var(--muted)' }}>
                      {s.dsr.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[var(--muted)] text-[0.45rem] uppercase">N</div>
                    <div style={{ color: s.passes_min_n ? 'var(--text)' : 'var(--caution)' }}>
                      {s.n_obs}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {excluded.length > 0 && (
        <div className="border-t border-[var(--border)] mt-2 pt-2 font-mono text-[0.5rem] text-[var(--dim)] leading-tight">
          {excluded.map((e) => (
            <div key={e.strategy}>
              ⛔ {e.strategy} — {e.reason}
            </div>
          ))}
        </div>
      )}

      <div className="font-mono text-[0.5rem] text-[var(--dim)] pt-2">
        STRONG = DSR≥0.95 + N≥30 + Sh≥3 · LOW-DSR = &lt;0.95 (ignoré) · LOW-N = &lt;30 (ignoré)
      </div>
    </div>
  );
}
