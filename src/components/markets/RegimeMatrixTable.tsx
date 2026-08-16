'use client';

import { useState } from 'react';
import { useRegimeMatrix } from '@/hooks/api/useRegimeMatrix';
import {
  assetsBySource,
  hurstColor,
  hurstDivergenceState,
  hurstShort,
  hurstStruct,
  stationarityColor,
  superTrendColor,
  trendScoreColor,
  type RegimeMatrixAsset,
} from '@/lib/regimeMatrix';

type Tab = 'macro' | 'hyperliquid';

function AssetRow({ a }: { a: RegimeMatrixAsset }) {
  const ok = a.status === 'ok';
  const div = hurstDivergenceState(a);
  return (
    <tr className="hover:bg-[var(--bg3)]">
      <td className="py-1.5 pr-3">
        <div className="text-[var(--label)]">{a.name}</div>
        <div className="text-[var(--muted)] text-[0.52rem] uppercase tracking-[1px]">{a.id}</div>
      </td>
      <td
        className="py-1.5 px-2 uppercase tracking-[1px] font-semibold"
        style={{ color: hurstColor(a.hurst_regime) }}
      >
        {ok ? a.hurst_regime ?? '—' : '—'}
      </td>
      <td
        className="py-1.5 px-2 text-right text-[var(--dim)]"
        title={`H structural (DFA-1, ${a.hurst_windows?.structural ?? '120'} barres / régime de fond)`}
      >
        {ok ? hurstStruct(a)?.toFixed(2) ?? '—' : '—'}
      </td>
      <td
        className="py-1.5 px-2 text-right"
        style={{ color: hurstColor(a.hurst_short_regime ?? null) }}
        title={`H court (DFA-1, ${a.hurst_windows?.short ?? '60'} barres / régime récent, plus bruité)`}
      >
        {ok ? hurstShort(a)?.toFixed(2) ?? '—' : '—'}
      </td>
      <td
        className={`py-1.5 px-2 text-center ${
          div.strong ? 'text-[var(--caution)] font-semibold' : 'text-[var(--muted)]'
        }`}
        title="Écart H court − H structural : divergence forte (|Δ| ≥ 0.08) = transition de régime en cours"
      >
        {ok && div.arrow ? (
          <span>
            {div.arrow} <span className="text-[0.52rem]">{div.strong ? div.label : ''}</span>
          </span>
        ) : (
          '—'
        )}
      </td>
      <td
        className="py-1.5 px-2 uppercase tracking-[1px] font-semibold"
        style={{ color: superTrendColor(a.supertrend_dir) }}
      >
        {ok ? a.supertrend_dir ?? '—' : '—'}
      </td>
      <td className="py-1.5 px-2 text-right text-[var(--dim)]">
        {ok ? a.st_flips_30d ?? '—' : '—'}
      </td>
      <td className="py-1.5 px-2 text-right text-[var(--dim)]">
        {ok ? a.adx_14?.toFixed(0) ?? '—' : '—'}
      </td>
      <td
        className="py-1.5 px-2 uppercase tracking-[1px]"
        style={{ color: stationarityColor(a.stationarity) }}
      >
        {ok ? a.stationarity?.replace('_', ' ') ?? '—' : '—'}
      </td>
      <td className="py-1.5 px-2 text-right" style={{ color: trendScoreColor(a.trend_score) }}>
        {ok ? a.trend_score?.toFixed(0) ?? '—' : '—'}
      </td>
      <td className="py-1.5 pl-2 text-[var(--dim)]">
        {a.status === 'insufficient_history' ? (
          <span className="text-[0.5rem] uppercase tracking-[1px]">young ({a.bars}d)</span>
        ) : a.status !== 'ok' ? (
          <span className="text-[0.5rem] uppercase tracking-[1px] text-[var(--caution)]">err</span>
        ) : (
          '—'
        )}
      </td>
    </tr>
  );
}

export default function RegimeMatrixTable() {
  const { data, isLoading, error, isStale } = useRegimeMatrix();
  const [tab, setTab] = useState<Tab>('macro');

  const rows = assetsBySource(data, tab === 'macro' ? 'yahoo' : 'hyperliquid');
  const asOf = data?.as_of
    ? new Date(data.as_of).toISOString().slice(0, 16).replace('T', ' ') + 'Z'
    : null;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
          REGIME MATRIX{' '}
          <span className="text-[0.58rem] text-[var(--muted)] ml-2">
            hurst dfa-1 dual {tab === 'macro' ? '41/83 bars (≈60/120j calendaires, 252j/an)' : '60/120 bars (365j/an)'} ·
            supertrend 10/3 · adx 14 · adf+kpss stationarity
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isStale && (
            <span className="px-1.5 py-0.5 rounded-[2px] text-[0.5rem] uppercase tracking-[1px] bg-[var(--bear)]/15 text-[var(--bear)] border border-[var(--bear)]/30">
              stale — export hs
            </span>
          )}
          <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
            {asOf ?? '—'}
          </span>
        </div>
      </div>

      <div className="flex gap-2 mb-3">
        {(['macro', 'hyperliquid'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 rounded-[3px] font-mono text-[0.55rem] uppercase tracking-[2px] border ${
              tab === t
                ? 'bg-[var(--bg3)] text-[var(--label)] border-[var(--border)]'
                : 'text-[var(--muted)] border-transparent hover:text-[var(--label)]'
            }`}
          >
            {t === 'macro' ? `macro futures (${data?.universe.macro_n ?? '—'})` : `hyperliquid top ${data?.universe.hl_n ?? 50}`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.62rem] min-w-[900px]">
          <thead>
            <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
              <th className="text-left py-2 pr-3">Asset</th>
              <th className="text-left py-2 px-2">Hurst Regime</th>
              <th className="text-right py-2 px-2" title="H structural DFA-1 (régime de fond)">H struct</th>
              <th className="text-right py-2 px-2" title="H court DFA-1 (régime récent, plus bruité)">H court</th>
              <th className="text-center py-2 px-2" title="Convergence/divergence des deux fenêtres — divergence = transition de régime">Δ fenêtres</th>
              <th className="text-left py-2 px-2">ST 10/3</th>
              <th className="text-right py-2 px-2">Flips 30d</th>
              <th className="text-right py-2 px-2">ADX</th>
              <th className="text-left py-2 px-2">Stationarity</th>
              <th className="text-right py-2 px-2">Score</th>
              <th className="text-left py-2 pl-2">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {rows.map((a) => (
              <AssetRow key={`${a.source}:${a.id}`} a={a} />
            ))}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
          loading regime matrix · daily export 05:43 utc...
        </div>
      )}
      {error && (
        <div className="mt-2 font-mono text-[0.55rem] text-[var(--bear)] uppercase tracking-[2px]">
          {error.slice(0, 80)}
        </div>
      )}
    </div>
  );
}
