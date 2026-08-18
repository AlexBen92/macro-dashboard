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
  trendVerdict,
  verdictColor,
  type RegimeMatrixAsset,
} from '@/lib/regimeMatrix';

type Tab = 'macro' | 'hyperliquid';

function Metric({ label, title, children }: { label: string; title?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5" title={title}>
      <span className="text-[0.5rem] uppercase tracking-[1.5px] text-[var(--muted)]">{label}</span>
      <span className="text-[0.68rem]">{children}</span>
    </div>
  );
}

function AssetDetail({ a, onClose }: { a: RegimeMatrixAsset; onClose: () => void }) {
  const ok = a.status === 'ok';
  const div = hurstDivergenceState(a);
  return (
    <div className="mt-2 border border-[var(--border)] rounded-[3px] px-3 py-2 bg-[var(--bg)]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-mono text-[0.65rem] text-[var(--label)] uppercase tracking-[2px]">
          {a.name} <span className="text-[var(--muted)] text-[0.52rem]">{a.id}</span>
          {a.status !== 'ok' && (
            <span className="ml-2 text-[0.5rem] uppercase text-[var(--caution)]">
              {a.status === 'insufficient_history' ? `young (${a.bars}d)` : 'erreur données'}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="font-mono text-[0.55rem] text-[var(--muted)] hover:text-[var(--text)] uppercase tracking-[1px]"
        >
          fermer ✕
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 font-mono">
        <Metric label="Hurst régime" title="Régime Hurst catégoriel (DFA-1)">
          <span style={{ color: hurstColor(a.hurst_regime) }} className="uppercase font-semibold">
            {ok ? a.hurst_regime ?? '—' : '—'}
          </span>
        </Metric>
        <Metric label="H struct" title={`H structural (DFA-1, ${a.hurst_windows?.structural ?? '120'} barres / régime de fond)`}>
          {ok ? hurstStruct(a)?.toFixed(2) ?? '—' : '—'}
        </Metric>
        <Metric label="H court" title={`H court (DFA-1, ${a.hurst_windows?.short ?? '60'} barres / régime récent, plus bruité)`}>
          <span style={{ color: hurstColor(a.hurst_short_regime ?? null) }}>
            {ok ? hurstShort(a)?.toFixed(2) ?? '—' : '—'}
          </span>
        </Metric>
        <Metric label="Δ fenêtres" title="Écart H court − H structural : divergence forte (|Δ| ≥ 0.08) = transition de régime en cours">
          {ok && div.arrow ? (
            <span className={div.strong ? 'text-[var(--caution)] font-semibold' : ''}>
              {div.arrow} {div.strong ? div.label : ''}
            </span>
          ) : (
            '—'
          )}
        </Metric>
        <Metric label="Score tendance" title="Score composite de tendance (0-100)">
          <span style={{ color: trendScoreColor(a.trend_score) }}>
            {ok ? a.trend_score?.toFixed(0) ?? '—' : '—'}
          </span>
        </Metric>
        <Metric label="SuperTrend 10/3" title="Direction SuperTrend (10,3)">
          <span style={{ color: superTrendColor(a.supertrend_dir) }} className="uppercase font-semibold">
            {ok ? a.supertrend_dir ?? '—' : '—'}
          </span>
        </Metric>
        <Metric label="Flips 30d" title="Nombre d'inversions SuperTrend sur 30j — élevé = range/bruit">
          {ok ? a.st_flips_30d ?? '—' : '—'}
        </Metric>
        <Metric label="ADX 14" title="ADX 14 — force de tendance (>25 tendance, <20 range)">
          {ok ? a.adx_14?.toFixed(0) ?? '—' : '—'}
        </Metric>
        <Metric label="Stationarité" title="Test ADF+KPSS combiné">
          <span style={{ color: stationarityColor(a.stationarity) }} className="uppercase">
            {ok ? a.stationarity?.replace('_', ' ') ?? '—' : '—'}
          </span>
        </Metric>
        <Metric label="Source" title="Source des données">
          <span className="uppercase text-[var(--dim)]">{a.source}</span>
        </Metric>
      </div>
    </div>
  );
}

function VerdictPill({ a }: { a: RegimeMatrixAsset }) {
  const v = trendVerdict(a);
  if (!v) return <span className="text-[var(--dim)]">—</span>;
  const arrow = v === 'BULLISH' ? '▲' : v === 'BEARISH' ? '▼' : '—';
  return (
    <span
      className={`inline-flex items-center gap-1 uppercase tracking-[1px] font-semibold ${
        v === 'NEUTRAL' ? 'text-[0.55rem]' : 'text-[0.58rem]'
      }`}
      style={{ color: verdictColor(v) }}
      title={`Verdict : force (score ${a.trend_score?.toFixed(0) ?? '—'} ≥ 60) + direction SuperTrend`}
    >
      {arrow} {v.toLowerCase()}
    </span>
  );
}

function CalloutList({
  title,
  assets,
  onSelect,
}: {
  title: string;
  assets: RegimeMatrixAsset[];
  onSelect: (a: RegimeMatrixAsset) => void;
}) {
  return (
    <div className="flex-1 min-w-0 border border-[var(--border)] rounded-[3px] px-2.5 py-1.5">
      <div className="font-mono text-[0.5rem] uppercase tracking-[2px] text-[var(--muted)] mb-1">{title}</div>
      {assets.length === 0 && (
        <div className="font-mono text-[0.55rem] text-[var(--dim)]">aucun</div>
      )}
      {assets.map((a) => (
        <button
          key={`${a.source}:${a.id}`}
          onClick={() => onSelect(a)}
          className="flex w-full items-center justify-between gap-2 py-0.5 font-mono text-[0.62rem] hover:bg-[var(--bg3)] rounded-[2px] px-1 -mx-1"
          title="Cliquer pour le détail complet"
        >
          <span className="text-[var(--label)] truncate">{a.name}</span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="text-[0.55rem] text-[var(--dim)] uppercase">{a.id}</span>
            <span style={{ color: trendScoreColor(a.trend_score) }}>{a.trend_score?.toFixed(0)}</span>
            <VerdictPill a={a} />
          </span>
        </button>
      ))}
    </div>
  );
}

function AssetRow({ a, selected, onSelect }: { a: RegimeMatrixAsset; selected: boolean; onSelect: () => void }) {
  const ok = a.status === 'ok';
  const div = hurstDivergenceState(a);
  return (
    <tr
      className={`cursor-pointer hover:bg-[var(--bg3)] ${selected ? 'bg-[var(--bg3)]' : ''}`}
      onClick={onSelect}
      title="Cliquer pour les 10 métriques complètes"
    >
      <td className="py-1.5 pr-3">
        <div className="text-[var(--label)]">{a.name}</div>
        <div className="text-[var(--muted)] text-[0.52rem] uppercase tracking-[1px]">{a.id}</div>
      </td>
      <td className="py-1.5 px-2">
        <span
          className="inline-flex items-center gap-1 uppercase tracking-[1px] font-semibold"
          style={{ color: hurstColor(a.hurst_regime) }}
        >
          {ok ? a.hurst_regime ?? '—' : '—'}
          {ok && div.strong && (
            <span className="text-[0.5rem] text-[var(--caution)]" title="Divergence H court/H struct — transition en cours">
              {div.arrow}
            </span>
          )}
        </span>
      </td>
      <td className="py-1.5 px-2 uppercase tracking-[1px]" style={{ color: superTrendColor(a.supertrend_dir) }}>
        {ok ? a.supertrend_dir ?? '—' : '—'}
      </td>
      <td className="py-1.5 px-2 text-right text-[var(--dim)]">
        {ok ? a.st_flips_30d ?? '—' : '—'}
      </td>
      <td className="py-1.5 pl-2 text-right" style={{ color: trendScoreColor(a.trend_score) }}>
        {ok ? a.trend_score?.toFixed(0) ?? '—' : '—'}
      </td>
      <td className="py-1.5 pl-2">{ok ? <VerdictPill a={a} /> : '—'}</td>
    </tr>
  );
}

export default function RegimeMatrixTable() {
  const { data, isLoading, error, isStale } = useRegimeMatrix();
  const [tab, setTab] = useState<Tab>('macro');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rows = assetsBySource(data, tab === 'macro' ? 'yahoo' : 'hyperliquid');
  const sorted = [...rows].sort(
    (a, b) => (b.trend_score ?? -Infinity) - (a.trend_score ?? -Infinity),
  );
  const selected = rows.find((r) => `${r.source}:${r.id}` === selectedId) ?? null;
  const asOf = data?.as_of
    ? new Date(data.as_of).toISOString().slice(0, 16).replace('T', ' ') + 'Z'
    : null;

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
          REGIME MATRIX{' '}
          <span className="text-[0.58rem] text-[var(--muted)] ml-2">
            triée par score · clic ligne = 10 métriques (hurst dfa-1 dual, supertrend 10/3, adx 14, adf+kpss)
          </span>
        </div>
        <div className="flex items-center gap-3">
          {isStale && data && (
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
            onClick={() => {
              setTab(t);
              setSelectedId(null);
            }}
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

      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <CalloutList
          title="▲ top 3 haussier"
          assets={sorted.filter((a) => trendVerdict(a) === 'BULLISH').slice(0, 3)}
          onSelect={(a) => setSelectedId(`${a.source}:${a.id}`)}
        />
        <CalloutList
          title="▼ top 3 baissier"
          assets={sorted.filter((a) => trendVerdict(a) === 'BEARISH').slice(0, 3)}
          onSelect={(a) => setSelectedId(`${a.source}:${a.id}`)}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full font-mono text-[0.62rem] min-w-[640px]">
          <thead>
            <tr className="text-[0.55rem] text-[var(--muted)] tracking-[2px] uppercase border-b border-[var(--border)]">
              <th className="text-left py-2 pr-3">Asset</th>
              <th className="text-left py-2 px-2" title="Régime Hurst catégoriel">Régime</th>
              <th className="text-left py-2 px-2" title="Direction SuperTrend 10/3">ST</th>
              <th className="text-right py-2 px-2" title="Inversions SuperTrend 30j — élevé = range/bruit">Flips 30d</th>
              <th className="text-right py-2 pl-2" title="Score composite de tendance">Score</th>
              <th className="text-left py-2 pl-2" title="Direction SuperTrend validée par la force du score (≥60)">Verdict</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {sorted.map((a) => (
              <AssetRow
                key={`${a.source}:${a.id}`}
                a={a}
                selected={`${a.source}:${a.id}` === selectedId}
                onSelect={() => setSelectedId(`${a.source}:${a.id}` === selectedId ? null : `${a.source}:${a.id}`)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {selected && <AssetDetail a={selected} onClose={() => setSelectedId(null)} />}

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
