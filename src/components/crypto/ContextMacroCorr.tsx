'use client';

import { useState } from 'react';

import { useCorrMacro } from '@/hooks/api/useCorrMacro';
import { corrCellColor } from '@/lib/ui/corrColors';

const COL_LABELS: Record<string, string> = {
  'DX-Y.NYB': 'DXY',
  '^TYX': 'US30Y',
  '^VIX': 'VIX',
  '^NDX': 'NDQ',
  '^GSPC': 'SPX',
  M2SL: 'M2SL',
  UNRATE: 'UNRATE',
};

const CONTEXT_LABEL = 'Contexte informatif — corrélation ≠ signal de trading validé';

function colLabel(col: string): string {
  return COL_LABELS[col] ?? col;
}

export default function ContextMacroCorr() {
  const { data, isLoading, error, isStale } = useCorrMacro();
  const [window, setWindow] = useState<string>('30d');

  if (error) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 font-mono text-[0.65rem] text-[var(--caution)]">
        CORR MACRO INDISPO — {error}
      </div>
    );
  }

  const windows = data?.windows ?? ['7d', '30d', '90d'];
  const cols = data?.cols ?? [];
  const rows = data?.rows ?? [];
  const dailyCells = data?.daily.cells.filter((c) => c.window === window) ?? [];
  const monthlyCells = data?.monthly.cells ?? [];

  const get = (row: string, col: string): { r: number; n: number } | null => {
    const c = dailyCells.find((x) => x.row === row && x.col === col);
    return c ? { r: c.r, n: c.n } : null;
  };

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between flex-wrap gap-2">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          CORRÉLATIONS CRYPTO × MACRO ÉTENDUES
        </div>
        <div className="flex items-center gap-3">
          {isStale && (
            <span className="font-mono text-[0.55rem] text-[var(--caution)] uppercase tracking-[1px]">
              STALE
            </span>
          )}
          <div className="flex">
            {windows.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindow(w)}
                className={`px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-[1px] border border-[var(--border)] first:rounded-l-[3px] last:rounded-r-[3px] ${
                  w === window
                    ? 'bg-[var(--bg3)] text-[var(--fg)]'
                    : 'text-[var(--muted)] hover:text-[var(--fg)]'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <div className="font-mono text-[0.55rem] text-[var(--muted)]">
            {isLoading ? 'LOADING...' : data?.as_of ? `AS OF ${data.as_of}` : ''}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.6rem]">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="text-left px-2 py-1 text-[var(--label)] uppercase tracking-[1.5px]">
                &nbsp;
              </th>
              {cols.map((m) => (
                <th
                  key={m}
                  className="px-1.5 py-1 text-[var(--label)] uppercase tracking-[1.5px] text-center border-l border-[var(--border)]"
                >
                  {colLabel(m)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row} className="border-b border-[var(--border)] last:border-0">
                <td className="px-2 py-1.5 text-[var(--fg)] uppercase tracking-[1.5px] whitespace-nowrap">
                  {row === 'ALTS_INDEX' ? (
                    <span
                      title={
                        data
                          ? `équipondéré ${data.alt_index.members.length} membres L1/L2/L3`
                          : ''
                      }
                    >
                      ALTS·IND
                    </span>
                  ) : (
                    row
                  )}
                </td>
                {cols.map((m) => {
                  const cell = get(row, m);
                  const color = cell ? corrCellColor(cell.r) : null;
                  return (
                    <td
                      key={`${row}-${m}`}
                      title={cell ? `n=${cell.n} (dates NYSE communes)` : undefined}
                      className="px-1.5 py-1.5 text-center border-l border-[var(--border)]"
                      style={color ? { background: color.bg, color: color.text } : undefined}
                    >
                      {cell ? cell.r.toFixed(2) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {monthlyCells.length > 0 && (
        <div className="border-t border-[var(--border)] px-2 py-2">
          <div className="font-mono text-[0.55rem] text-[var(--label)] uppercase tracking-[1.5px] mb-1">
            Macro lent — {data?.monthly.window_months ?? 36} mois glissants, variations
            mensuelles (M2SL % m/m · UNRATE pts)
          </div>
          <table className="font-mono text-[0.6rem]">
            <tbody>
              {rows.map((row) => {
                const cells = monthlyCells.filter((c) => c.row === row);
                if (cells.length === 0) return null;
                return (
                  <tr key={row}>
                    <td className="pr-3 py-0.5 text-[var(--fg)] uppercase tracking-[1px]">
                      {row === 'ALTS_INDEX' ? 'ALTS·IND' : row}
                    </td>
                    {cells.map((c) => {
                      const color = corrCellColor(c.r);
                      return (
                        <td
                          key={`${c.row}-${c.col}`}
                          className="px-2 py-0.5 text-center border-l border-[var(--border)]"
                          style={{ background: color.bg, color: color.text }}
                          title={`n_obs=${c.n_obs}`}
                        >
                          {colLabel(c.col)} {c.r.toFixed(2)}
                          <span className="text-[0.5rem] text-[var(--muted)]"> n{c.n_obs}</span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.errors.length > 0 && (
        <div className="border-t border-[var(--border)] px-3 py-1 font-mono text-[0.5rem] text-[var(--muted)]">
          excl/err: {data.errors.map((e) => e.id).join(', ')}
        </div>
      )}

      <div className="border-t border-[var(--border)] px-3 py-1.5 font-mono text-[0.5rem] text-[var(--muted)] leading-relaxed">
        {CONTEXT_LABEL} · daily = intersection dates NYSE (close-to-close, pas
        d&apos;interpolation sur sessions crypto) · seuils |ρ|&lt;0.20 diversifiant ·
        0.20-0.60 à pondérer · &gt;0.60 même cluster
      </div>
    </div>
  );
}
