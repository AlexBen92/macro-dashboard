'use client';

import { useRegimeStatus, type RegimeLabel } from '@/hooks/api/useRegimeStatus';

const REGIME_COLS: RegimeLabel[] = ['CALM', 'BUILDING', 'STRESS', 'CRISIS'];

const REGIME_COLOR: Record<RegimeLabel, string> = {
  CALM: 'var(--bull)',
  BUILDING: 'var(--info-soft)',
  STRESS: 'var(--caution)',
  CRISIS: 'var(--bear)',
};

function cellStyle(sh: number | null, nObs: number, passesDsr: boolean, passesMinN: boolean): {
  bg: string; color: string;
} {
  if (sh === null || nObs === 0) {
    return { bg: 'var(--bg3)', color: 'var(--muted)' };
  }
  const sign = sh >= 0 ? 1 : -1;
  const base = sign > 0 ? '74,222,128' : '255,51,85';
  const intensity = Math.min(0.32, (Math.abs(sh) / 8) * 0.32);
  let alpha = intensity;
  if (!passesMinN) alpha *= 0.5;
  const bg = `rgba(${base},${alpha.toFixed(3)})`;
  const color = !passesMinN
    ? 'var(--muted)'
    : passesDsr
      ? sign > 0
        ? 'var(--bull)'
        : 'var(--bear)'
      : 'var(--caution)';
  return { bg, color };
}

export default function RegimeStrategyMatrix() {
  const { data, isLoading, error } = useRegimeStatus();

  if (isLoading) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 h-[180px] animate-pulse" />
    );
  }
  if (error || !data || !data.matrix || data.matrix.length === 0) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 font-mono text-[0.6rem] text-[var(--muted)]">
        Matrix indisponible — export cron 05:17 UTC en attente
      </div>
    );
  }

  const currentRegime = data.current_regime;
  const rows = [...data.matrix].sort((a, b) => {
    const cellA = a.regimes.find((c) => c.regime === currentRegime);
    const cellB = b.regimes.find((c) => c.regime === currentRegime);
    const shA = cellA?.passes_dsr ? cellA.sharpe_annual : -999;
    const shB = cellB?.passes_dsr ? cellB.sharpe_annual : -999;
    return shB - shA;
  });
  const excluded = data.matrix_excluded ?? [];

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-3 flex flex-col gap-2 min-w-0">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[2px]">
          Régime × Stratégie · Sharpe annualisé
        </span>
        <span className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
          DSR-gated · n{'>'}0 only
        </span>
      </div>

      <div className="overflow-x-auto min-w-0 w-full">
        <table className="w-full font-mono text-[0.55rem] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left py-1 px-1.5 text-[var(--muted)] uppercase tracking-[1px] font-normal">
                Strategy
              </th>
              {REGIME_COLS.map((r) => (
                <th
                  key={r}
                  className="text-right py-1 px-1.5 uppercase tracking-[1px] font-normal"
                  style={{
                    color: r === currentRegime ? REGIME_COLOR[r] : 'var(--muted)',
                    fontWeight: r === currentRegime ? 700 : 400,
                  }}
                >
                  {r === currentRegime ? '▸ ' : ''}{r.slice(0, 4)}
                </th>
              ))}
              <th className="text-right py-1 px-1.5 text-[var(--label)] uppercase tracking-[1px] font-normal border-l border-[var(--border)]">
                Pooled
              </th>
              <th className="text-right py-1 px-1.5 text-[var(--bull)] uppercase tracking-[1px] font-normal">
                Actif?
              </th>
              <th className="text-right py-1 px-1.5 text-[var(--muted)] uppercase tracking-[1px] font-normal">
                N
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const cellByRegime = new Map(row.regimes.map((c) => [c.regime as RegimeLabel, c]));
              return (
                <tr key={row.strategy} className="border-b border-[var(--border)]/40">
                  <td className="py-1 px-1.5 text-[var(--text)]">{row.strategy}</td>
                  {REGIME_COLS.map((r) => {
                    const cell = cellByRegime.get(r);
                    const sh = cell ? cell.sharpe_annual : null;
                    const nObs = cell ? cell.n_obs : 0;
                    const passesDsr = cell ? cell.passes_dsr : false;
                    const passesMinN = cell ? cell.passes_min_n : false;
                    const sty = cellStyle(sh, nObs, passesDsr, passesMinN);
                    return (
                      <td
                        key={r}
                        className="text-right py-1 px-1.5 tabular-nums"
                        style={{ background: sty.bg, color: sty.color }}
                        title={
                          cell
                            ? `${r} · Sh=${sh?.toFixed(2)} · n=${nObs} · DSR=${cell.dsr_probability.toFixed(2)}`
                            : `${r} · no observation`
                        }
                      >
                        {sh === null || nObs === 0 ? '—' : sh.toFixed(2)}
                      </td>
                    );
                  })}
                  <td
                    className="text-right py-1 px-1.5 tabular-nums border-l border-[var(--border)]"
                    style={{
                      color:
                        row.pooled_sharpe > 1
                          ? 'var(--bull)'
                          : row.pooled_sharpe < 0
                            ? 'var(--bear)'
                            : 'var(--text)',
                    }}
                  >
                    {row.pooled_sharpe.toFixed(2)}
                  </td>
                  {(() => {
                    const cell = currentRegime ? cellByRegime.get(currentRegime) : undefined;
                    const actionable = cell?.passes_dsr && (cell.sharpe_annual ?? 0) > 0.5;
                    return (
                      <td
                        className="text-right py-1 px-1.5 uppercase tracking-[1px]"
                        style={{ color: actionable ? 'var(--bull)' : 'var(--muted)' }}
                      >
                        {actionable ? '✓ GO' : '· skip'}
                      </td>
                    );
                  })()}
                  <td className="text-right py-1 px-1.5 tabular-nums text-[var(--muted)]">
                    {row.pooled_n}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {excluded.length > 0 && (
        <div className="font-mono text-[0.5rem] text-[var(--muted)] flex flex-col gap-0.5 pt-1 border-t border-[var(--border)]/40">
          <span className="uppercase tracking-[1px]">Excluded ({excluded.length})</span>
          {excluded.map((ex) => (
            <span key={ex.strategy}>
              · <span className="text-[var(--text)]">{ex.strategy}</span> — {ex.reason}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between font-mono text-[0.5rem] text-[var(--muted)] pt-1 border-t border-[var(--border)]/40">
        <span className="uppercase tracking-[1px]">Légende</span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2" style={{ background: 'rgba(74,222,128,0.32)' }} />
            DSR pass
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2" style={{ background: 'rgba(255,170,0,0.32)' }} />
            DSR fail
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2 h-2" style={{ background: 'var(--bg3)' }} />
            n=0
          </span>
        </span>
      </div>
    </div>
  );
}
