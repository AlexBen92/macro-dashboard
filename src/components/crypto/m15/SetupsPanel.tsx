'use client';

import { useEdgeM15Status, type SetupRow, type ValidationStatus } from '@/hooks/api/useEdgeM15Status';

const STRATEGY_LABEL: Record<string, string> = {
  S1_V16_thr5: 'S1 · IV straddle arb',
  S10_V26_h24_agg: 'S10 · SPX lead-lag',
  C2_V21_revert_ADA: 'C2 · ADA range-revert',
  mr_zscore_m15: 'M15 · MR Z-score',
  range_stoch_m15: 'M15 · Range Stoch',
  linear_channel_scalp_m15: 'M15 · Channel scalp',
  breakout_retest_15m: 'M15 · Breakout retest',
};

const TAG_STYLE: Record<SetupRow['tag'], { bg: string; text: string; border: string }> = {
  STRONG: { bg: 'rgba(74,222,128,0.18)', text: 'var(--bull)', border: 'var(--bull)' },
  OK: { bg: 'rgba(140,180,255,0.15)', text: 'rgb(140,180,255)', border: 'rgb(140,180,255)' },
  'LOW-N': { bg: 'rgba(140,140,160,0.10)', text: 'var(--muted)', border: 'var(--muted)' },
  'LOW-DSR': { bg: 'rgba(140,140,160,0.10)', text: 'var(--muted)', border: 'var(--muted)' },
};

const VALIDATION_BADGE: Record<ValidationStatus, { label: string; bg: string; text: string }> = {
  BACKTEST: { label: 'BACKTEST', bg: 'transparent', text: 'var(--dim)' },
  PAPER: { label: 'PAPER', bg: 'rgba(255,170,0,0.15)', text: 'var(--caution)' },
  EN_VALIDATION: { label: 'EN VALIDATION', bg: 'rgba(255,170,0,0.15)', text: 'var(--caution)' },
  LIVE: { label: 'LIVE', bg: 'rgba(74,222,128,0.15)', text: 'var(--bull)' },
};

function ClusterBadge({ id }: { id: number }) {
  return (
    <span
      className="font-mono text-[0.45rem] uppercase tracking-[1px] px-1 py-0.5 rounded-[2px] flex-shrink-0"
      style={{
        background: 'rgba(180,140,255,0.15)',
        color: 'rgb(200,170,255)',
        border: '1px solid rgba(180,140,255,0.4)',
      }}
      title={`Cluster de corrélation C${id} — risque partagé avec d'autres setups`}
    >
      C{id}
    </span>
  );
}

function SizingCell({ sizing }: { sizing: SetupRow['sizing_suggestion'] }) {
  if (!sizing || sizing.fraction <= 0) {
    return <span className="text-[var(--dim)]">—</span>;
  }
  const pct = (sizing.fraction * 100).toFixed(1);
  const capLabel = sizing.capped ? ' (¼-Kelly)' : '';
  return (
    <span title={`Kelly raw ${(sizing.kelly_raw * 100).toFixed(1)}% — cap ${capLabel}`}>
      {pct}%
    </span>
  );
}

export default function SetupsPanel() {
  const { data, isLoading, isStale } = useEdgeM15Status();

  if (isLoading || !data) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[200px] animate-pulse" />
    );
  }

  const setups = data.setups_actifs ?? [];
  const excluded = data.matrix_excluded ?? [];
  const familySummary = data.family_summary;
  const hasFamily = !!familySummary && (familySummary.strategies_passing?.length || familySummary.strategies_failing?.length || 0) > 0;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3">
      <div className="flex items-center justify-between pb-2">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Setups filtrés · régime {data.regime}
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          {setups.length} actifs {isStale ? '· ⚠ STALE' : ''}
        </span>
      </div>

      {hasFamily && (
        <div className="font-mono text-[0.5rem] text-[var(--dim)] pb-2 leading-tight border-b border-[var(--border)] mb-2">
          Famille M15: {(familySummary!.strategies_passing || []).length}/{(familySummary!.strategies_passing || []).length + (familySummary!.strategies_failing || []).length} passent WF+holdout
          {familySummary!.family_pbo?.PBO !== null && familySummary!.family_pbo?.PBO !== undefined && (
            <> · PBO {(familySummary!.family_pbo.PBO * 100).toFixed(0)}%</>
          )}
        </div>
      )}

      {setups.length === 0 ? (
        <div className="font-mono text-[0.6rem] text-[var(--muted)] py-3">
          Aucun setup qualifié pour le régime courant.
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {setups.map((s) => {
            const tag = TAG_STYLE[s.tag];
            const label = STRATEGY_LABEL[s.strategy] ?? s.strategy;
            const vstate = s.validation_status ?? 'BACKTEST';
            const vbadge = VALIDATION_BADGE[vstate];
            const isPaper = vstate === 'PAPER' || vstate === 'EN_VALIDATION';
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
                {s.cluster_id && <ClusterBadge id={s.cluster_id} />}
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
                    <div className="text-[var(--muted)] text-[0.45rem] uppercase">Size</div>
                    <div
                      style={{
                        color: isPaper ? 'var(--dim)' : 'var(--text)',
                        textDecoration: isPaper ? 'line-through' : 'none',
                      }}
                      title={isPaper ? 'Sizing masqué — phase paper' : undefined}
                    >
                      {isPaper ? 'paper' : <SizingCell sizing={s.sizing_suggestion} />}
                    </div>
                  </div>
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
                {vstate !== 'BACKTEST' && (
                  <span
                    className="font-mono text-[0.45rem] uppercase tracking-[1px] px-1 py-0.5 rounded-[2px] flex-shrink-0"
                    style={{ background: vbadge.bg, color: vbadge.text }}
                    title={
                      vstate === 'PAPER' || vstate === 'EN_VALIDATION'
                        ? `Paper PnL vs backtest: ${s.paper_pnl_vs_backtest_bps ?? 'n/a'} bps`
                        : undefined
                    }
                  >
                    {vbadge.label}
                  </span>
                )}
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
        STRONG = DSR≥0.95 + N≥30 + Sh≥3 · Size = vol-target × ¼-Kelly · C# = cluster corr &gt;0.6
      </div>
    </div>
  );
}
