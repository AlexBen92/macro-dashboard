'use client';

import { Activity, HelpCircle, RefreshCw, Stethoscope, Wrench } from 'lucide-react';
import type { DataFreshness, GammaRegime, DealerDeltaBias, SupportedCurrency, Timeframe } from '@/lib/options/types';
import { fmtPrice, fmtPct } from '@/lib/options/format';

interface OptionsTopBarProps {
  symbol: SupportedCurrency;
  onSymbolChange: (s: SupportedCurrency) => void;
  timeframe: Timeframe;
  onTimeframeChange: (t: Timeframe) => void;
  spot: number | null;
  spotChgPct: number | null;
  gammaRegime: GammaRegime;
  dealerDelta: DealerDeltaBias;
  freshness: DataFreshness;
  freshnessTs: string | null;
  onRefresh: () => void;
  onOpenVolSurface: () => void;
  onOpenGuide: () => void;
  onOpenDiagnostics: () => void;
}

const FRESHNESS_COLOR: Record<DataFreshness, string> = {
  live: 'var(--bull)',
  delayed: 'var(--caution)',
  stale: 'var(--bear)',
  unavailable: 'var(--muted)',
};

const GAMMA_COLOR: Record<GammaRegime, string> = {
  positive: 'var(--bull)',
  negative: 'var(--bear)',
  neutral: 'var(--muted)',
  unknown: 'var(--muted)',
};

const DEX_COLOR: Record<DealerDeltaBias, string> = {
  long: 'var(--bull)',
  short: 'var(--bear)',
  flat: 'var(--muted)',
  unknown: 'var(--muted)',
};

function Pill({
  label,
  value,
  color,
  title,
}: {
  label: string;
  value: string;
  color: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      className="px-2 py-1 rounded-[3px] border font-mono text-[0.6rem] uppercase tracking-[1.5px] flex items-center gap-2"
      style={{ borderColor: `${color}55`, background: `${color}11`, color }}
    >
      <span className="opacity-70">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export default function OptionsTopBar(props: OptionsTopBarProps) {
  const {
    symbol,
    onSymbolChange,
    timeframe,
    onTimeframeChange,
    spot,
    spotChgPct,
    gammaRegime,
    dealerDelta,
    freshness,
    freshnessTs,
    onRefresh,
    onOpenVolSurface,
    onOpenGuide,
    onOpenDiagnostics,
  } = props;

  return (
    <div className="decision-bar-sticky top-0 z-40 px-4 py-2 flex items-center gap-3 flex-wrap">
      <div className="font-mono text-[0.65rem] text-[var(--label)] tracking-[3px] uppercase">
        OPTIONS COMMAND CENTER
      </div>

      <div className="flex items-center gap-1">
        {(['BTC', 'ETH'] as SupportedCurrency[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSymbolChange(s)}
            className={`px-2.5 py-1 rounded-[3px] font-mono text-[0.65rem] uppercase tracking-[1.5px] transition-colors ${
              symbol === s
                ? 'bg-[var(--accent)] text-[var(--bg)]'
                : 'bg-[var(--bg2)] text-[var(--muted)] border border-[var(--border)] hover:text-[var(--text)]'
            }`}
          >
            {s}
          </button>
        ))}
        <span
          title="SOL not supported by Deribit options scope"
          className="px-2.5 py-1 rounded-[3px] font-mono text-[0.65rem] uppercase tracking-[1.5px] bg-[var(--bg2)] text-[var(--muted)] border border-[var(--border)] opacity-50 cursor-not-allowed"
        >
          SOL
        </span>
      </div>

      <div className="flex items-center gap-1">
        {(['H4', 'H1', 'M15'] as Timeframe[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onTimeframeChange(t)}
            className={`px-2 py-1 rounded-[3px] font-mono text-[0.6rem] uppercase tracking-[1.5px] transition-colors ${
              timeframe === t
                ? 'bg-[var(--purple)] text-[var(--bg)]'
                : 'bg-[var(--bg2)] text-[var(--muted)] border border-[var(--border)] hover:text-[var(--text)]'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 font-mono text-[0.7rem]">
        <span className="text-[var(--text)] font-semibold tabular-nums">
          {fmtPrice(spot, symbol === 'BTC' ? 0 : 2)}
        </span>
        <span
          className="tabular-nums"
          style={{
            color:
              spotChgPct == null
                ? 'var(--muted)'
                : spotChgPct >= 0
                  ? 'var(--bull)'
                  : 'var(--bear)',
          }}
        >
          {fmtPct(spotChgPct)}
        </span>
      </div>

      <Pill
        label="γ"
        value={gammaRegime}
        color={GAMMA_COLOR[gammaRegime]}
        title={`Provider gamma regime · rule v1 · ${gammaRegime}`}
      />
      <Pill
        label="DEX"
        value={dealerDelta}
        color={DEX_COLOR[dealerDelta]}
        title="Provider net DEX direction — raw aggregate, NOT dealer/client positioning"
      />
      <Pill
        label={freshness}
        value={freshnessTs ? new Date(freshnessTs).toLocaleTimeString('en-GB') : '—'}
        color={FRESHNESS_COLOR[freshness]}
        title={
          freshnessTs
            ? `Source ts: ${freshnessTs}\nStatus: ${freshness}`
            : 'No source timestamp'
        }
      />

      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          title="Refresh options snapshot"
          className="p-1.5 rounded-[3px] bg-[var(--bg2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
        >
          <RefreshCw size={13} />
        </button>
        <button
          type="button"
          onClick={onOpenVolSurface}
          title="Vol Surface (VRP/D1/Term/Skew/S1)"
          className="p-1.5 rounded-[3px] bg-[var(--bg2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
        >
          <Activity size={13} />
        </button>
        <button
          type="button"
          onClick={onOpenDiagnostics}
          title="Diagnostics"
          className="p-1.5 rounded-[3px] bg-[var(--bg2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
        >
          <Stethoscope size={13} />
        </button>
        <button
          type="button"
          onClick={onOpenGuide}
          title="Options guide"
          className="p-1.5 rounded-[3px] bg-[var(--bg2)] border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
        >
          <HelpCircle size={13} />
        </button>
      </div>

      <div className="hidden lg:flex items-center gap-1 text-[var(--muted)]">
        <Wrench size={11} />
        <span className="font-mono text-[0.55rem] uppercase tracking-[2px]">
          day-trading console
        </span>
      </div>
    </div>
  );
}
