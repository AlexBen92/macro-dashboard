'use client';

import { useCorrMatrix, type CorrWindowKey } from '@/hooks/api/useCorrMatrix';

const CRYPTO = ['BTC', 'ETH', 'SOL'] as const;
const MACRO = ['DXY', 'SPX', 'Gold'] as const;
const WINDOWS: CorrWindowKey[] = ['24h', '7d', '30d'];

function cellColor(r: number): { bg: string; text: string } {
  const abs = Math.abs(r);
  if (abs < 0.2) return { bg: 'rgba(74,222,128,0.18)', text: 'var(--bull)' };
  if (abs <= 0.6) return { bg: 'rgba(140,140,160,0.12)', text: 'var(--muted)' };
  return { bg: 'rgba(255,51,85,0.18)', text: 'var(--caution)' };
}

interface MacroCorrelationMatrixProps {
  extraRefs?: string[];
  compact?: boolean;
}

export default function MacroCorrelationMatrix({ extraRefs = [], compact = false }: MacroCorrelationMatrixProps) {
  const { cells, isLoading, error, asOf } = useCorrMatrix(WINDOWS);
  const cols = [...MACRO, ...extraRefs];

  if (error) {
    return (
      <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4 font-mono text-[0.65rem] text-[var(--caution)]">
        MACRO DATA INDISPO — {error}
      </div>
    );
  }

  const get = (a: string, b: string, w: CorrWindowKey): number | null => {
    const c = cells.find((x) => x.a === a && x.b === b && x.window === w);
    return c ? c.r : null;
  };

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px]">
      <div className="px-3 py-1.5 border-b border-[var(--border)] flex items-center justify-between">
        <div className="font-mono text-[0.6rem] text-[var(--label)] uppercase tracking-[2px]">
          CORR CRYPTO · MACRO{extraRefs.length > 0 ? ` + ${extraRefs.join('/')}` : ''}
        </div>
        <div className="font-mono text-[0.55rem] text-[var(--muted)]">
          {isLoading ? 'LOADING...' : asOf ? `AS OF ${asOf.slice(0, 16)}` : ''}
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
                <th key={m} colSpan={3} className="px-1.5 py-1 text-[var(--label)] uppercase tracking-[1.5px] text-center border-l border-[var(--border)]">
                  {m}
                </th>
              ))}
            </tr>
            <tr className="border-b border-[var(--border)]">
              <th className="px-2 py-1">&nbsp;</th>
              {cols.map((m) =>
                WINDOWS.map((w) => (
                  <th key={`${m}-${w}`} className="px-1.5 py-1 text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px] text-center border-l border-[var(--border)]">
                    {compact ? w.slice(0, 1) : w}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {CRYPTO.map((c) => (
              <tr key={c} className="border-b border-[var(--border)] last:border-0">
                <td className="px-2 py-1.5 text-[var(--fg)] uppercase tracking-[1.5px]">{c}</td>
                {cols.map((m) =>
                  WINDOWS.map((w) => {
                    const r = get(c, m, w);
                    const color = r !== null ? cellColor(r) : null;
                    return (
                      <td
                        key={`${c}-${m}-${w}`}
                        className="px-1.5 py-1.5 text-center border-l border-[var(--border)]"
                        style={color ? { background: color.bg, color: color.text } : undefined}
                      >
                        {r !== null ? r.toFixed(2) : '—'}
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
