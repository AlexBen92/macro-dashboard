'use client';
import { useEffect, useMemo, useState } from 'react';
import { MIN_EDGE, HL_TAKER_FEE } from '@/lib/constants';
import ActionabilityBadge from '@/components/ui/ActionabilityBadge';

type BaseSignal = 'SQUEEZE_LONG' | 'SQUEEZE_SHORT' | 'CARRY_LONG' | 'CARRY_SHORT' | 'NEUTRAL';
type Signal =
  | BaseSignal
  | 'REVERT_LONG'
  | 'REVERT_SHORT'
  | 'ADA_RANGE_REVERT';

type VolRegime = 'LOW' | 'MID' | 'HIGH' | 'EXTREME' | 'UNKNOWN';

interface FundingRow {
  symbol:    string;
  funding:   number;
  oi:        number;
  signal:    Signal;
  extreme:   boolean;
  edgeM30:   number;
  regime:    VolRegime;
  pct70:     number;
  pct90:     number;
  adaNote?:  string;
}

const SIGNAL_META: Record<Signal, { label: string; color: string; icon: string; hint: string }> = {
  SQUEEZE_LONG:  { label: 'Continuation ↓',  color: '#00ff88', icon: '▼',
                   hint: 'Funding négatif extrême — continuation baissière (M1-CONT / V21 §D2), pas un squeeze haussier' },
  SQUEEZE_SHORT: { label: 'Continuation ↑',  color: '#ff4466', icon: '▲',
                   hint: 'Funding positif extrême — continuation haussière (M1-CONT / V21 §D2), pas un squeeze baissier' },
  CARRY_LONG:    { label: 'Carry Long',       color: '#55ff88', icon: '📈',
                   hint: 'Funding négatif modéré — carry long possible' },
  CARRY_SHORT:   { label: 'Carry Short',      color: '#ff8866', icon: '📉',
                   hint: 'Funding positif modéré — carry short possible' },
  NEUTRAL:       { label: 'Neutre',           color: '#666',    icon: '⬜',
                   hint: 'Funding intra-range — pas de signal' },
  REVERT_LONG:   { label: 'Revert ↑',         color: '#00d4ff', icon: '↺▲',
                   hint: 'V25 §2.4 — regime vol HIGH/EXTREME inverse SQUEEZE_SHORT : revert haussier attendu' },
  REVERT_SHORT:  { label: 'Revert ↓',         color: '#ffaa00', icon: '↺▼',
                   hint: 'V25 §2.4 — regime vol HIGH/EXTREME inverse SQUEEZE_LONG : revert baissier attendu' },
  ADA_RANGE_REVERT: { label: 'ADA Range Revert (C2 V21)', color: '#aa66ff', icon: '◐',
                   hint: 'C2 V21 — ADA range_revert +110 bps wr 70%. SHORT si close > 98% rolling high 20d, sinon LONG' },
};

// V25 §2.4 percentiles sur realized vol 24h (decimal daily std returns, pas annualisé)
function classifyVol(v?: number): VolRegime {
  if (v == null || !Number.isFinite(v) || v <= 0) return 'UNKNOWN';
  if (v < 0.3)  return 'LOW';
  if (v < 0.6)  return 'MID';
  if (v < 1.0)  return 'HIGH';
  return 'EXTREME';
}

function classifyBase(f: number, pct70: number, pct90: number): BaseSignal {
  const absF = Math.abs(f);
  const isExtreme = absF >= Math.max(pct90, 0.0005);
  const isCarry   = absF >= Math.max(pct70, 0.0002);
  if (isExtreme) return f < 0 ? 'SQUEEZE_LONG' : 'SQUEEZE_SHORT';
  if (isCarry)   return f < 0 ? 'CARRY_LONG'   : 'CARRY_SHORT';
  return 'NEUTRAL';
}

// V25 §2.4 — HIGH/EXTREME vol inverse les signaux squeeze (continuation → reversion)
function applySigmaStarGate(base: BaseSignal, regime: VolRegime): Signal {
  if (regime === 'HIGH' || regime === 'EXTREME') {
    if (base === 'SQUEEZE_LONG')  return 'REVERT_SHORT';
    if (base === 'SQUEEZE_SHORT') return 'REVERT_LONG';
  }
  return base;
}

function computePercentiles(history?: number[]): { pct70: number; pct90: number } {
  const DEFAULT = { pct70: 0.0002, pct90: 0.0005 };
  if (!history || history.length < 5) return DEFAULT;
  const absSorted = history.map(Math.abs).sort((a, b) => a - b);
  const pick = (p: number): number => {
    const idx = Math.min(absSorted.length - 1, Math.max(0, Math.floor(p * absSorted.length)));
    return absSorted[idx];
  };
  return { pct70: pick(0.7), pct90: pick(0.9) };
}

export interface FundingAggregatorProps {
  realizedVol24h?: Record<string, number>;       // decimal daily std returns (V25 §2.4)
  fundingHistory30d?: Record<string, number[]>;  // 90 derniers funding rates 8h
  rollingHigh20d?: Record<string, number>;       // rolling 20d high du prix (markPx)
}

export default function FundingAggregator({
  realizedVol24h,
  fundingHistory30d,
  rollingHigh20d,
}: FundingAggregatorProps = {}) {
  const [rows, setRows] = useState<FundingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [ts, setTs] = useState('');

  const fetchFunding = async () => {
    try {
      const res = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const meta: Array<{ name: string }> = data[0]?.universe ?? [];
      const ctxs: Array<Record<string, string>> = data[1] ?? [];

      const processed: FundingRow[] = [];
      for (let i = 0; i < meta.length; i++) {
        const symbol = meta[i].name;
        const ctx = ctxs[i];
        if (!ctx) continue;

        const funding = parseFloat(ctx.funding ?? '0');
        const oi = parseFloat(ctx.openInterest ?? '0');
        const markPx = parseFloat(ctx.markPx ?? '0');

        if (oi < 5e6) continue;

        const { pct70, pct90 } = computePercentiles(fundingHistory30d?.[symbol]);
        const regime = classifyVol(realizedVol24h?.[symbol]);

        let signal: Signal;
        let adaNote: string | undefined;

        if (symbol === 'ADA') {
          // C2 V21 override — ADA range_revert, +110 bps wr 70%
          const rh = rollingHigh20d?.[symbol];
          signal = 'ADA_RANGE_REVERT';
          if (rh && rh > 0 && markPx > 0) {
            const isShort = markPx > rh * 0.98;
            adaNote = isShort
              ? `SHORT — close ${(markPx / rh).toFixed(3)}× RH20 (>98%)`
              : `LONG — close ${(markPx / rh).toFixed(3)}× RH20 (≤98%)`;
          } else {
            adaNote = 'RH20 indisponible — direction requires rollingHigh20d[ADA]';
          }
        } else {
          const base = classifyBase(funding, pct70, pct90);
          signal = applySigmaStarGate(base, regime);
        }

        const edgePerM30 = funding / 16;
        const netEdge = edgePerM30 - HL_TAKER_FEE;
        const extreme = Math.abs(funding) > Math.max(pct90, 0.0005);

        processed.push({
          symbol, funding, oi, signal, extreme,
          edgeM30: netEdge, regime, pct70, pct90, adaNote,
        });
      }

      processed.sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding));
      setRows(processed.slice(0, 20));
      setTs(new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setErr('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunding();
    const id = setInterval(fetchFunding, 60_000);
    return () => clearInterval(id);
  }, [realizedVol24h, fundingHistory30d, rollingHigh20d]);

  const v25Count = useMemo(
    () => rows.filter(r => r.signal === 'REVERT_LONG' || r.signal === 'REVERT_SHORT').length,
    [rows],
  );

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            💰 Funding Rate Aggregator
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
            <span>Edge net par bougie M30 · Seuil: ≥{(MIN_EDGE * 100).toFixed(3)}% · {ts}</span>
            <ActionabilityBadge variant="informational" />
            {v25Count > 0 && (
              <span className="ml-2 text-cyan-400">· {v25Count} σ*-revert</span>
            )}
          </p>
        </div>
        <button
          onClick={fetchFunding}
          className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
        >
          ↻
        </button>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-3 text-xs">
        {Object.entries(SIGNAL_META).map(([key, { label, color, icon }]) => (
          <div key={key} className="flex items-center gap-1">
            <span>{icon}</span>
            <span style={{ color }}>{label}</span>
          </div>
        ))}
      </div>

      {err && (
        <div className="mb-3 p-2 bg-red-950/40 text-red-400 text-xs rounded border border-red-800/30">
          {err}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-900/60 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm">
          Aucune donnée disponible
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Header */}
          <div className="grid grid-cols-[110px_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 font-mono text-[10px] text-gray-500 uppercase tracking-wider">
            <span>Signal</span>
            <span>Asset</span>
            <span className="text-right">Funding 8h</span>
            <span className="text-right">OI</span>
            <span className="text-right">Edge M30</span>
          </div>

          {/* Rows */}
          {rows.map(r => {
            const meta = SIGNAL_META[r.signal];
            return (
              <div
                key={r.symbol}
                className={`grid grid-cols-[110px_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 rounded-lg border transition-all hover:brightness-110 ${
                  r.extreme ? 'bg-gray-800/80' : 'bg-gray-900/40'
                }`}
                style={{ borderColor: meta.color + '33' }}
              >
                <div className="flex flex-col" style={{ color: meta.color }}>
                  <div className="flex items-center gap-1">
                    <span>{meta.icon}</span>
                    <span className="text-[10px] font-semibold">{meta.label}</span>
                  </div>
                  <span className="text-[9px] text-gray-500 mt-0.5 font-mono uppercase">
                    {r.regime}
                    {(r.signal === 'REVERT_LONG' || r.signal === 'REVERT_SHORT') && ' · σ*'}
                  </span>
                </div>
                <div className="font-mono text-sm text-white">
                  {r.symbol}
                  {r.adaNote && (
                    <div className="text-[9px] text-purple-400 mt-0.5">{r.adaNote}</div>
                  )}
                </div>
                <div className="font-mono text-sm text-right" style={{ color: r.funding < 0 ? '#00ff88' : '#ff4466' }}>
                  {r.funding >= 0 ? '+' : ''}{(r.funding * 100).toFixed(4)}%
                </div>
                <div className="font-mono text-xs text-right text-gray-400">
                  ${(r.oi / 1e9).toFixed(2)}B
                </div>
                <div className="font-mono text-sm text-right" style={{ color: r.edgeM30 >= 0 ? '#00ff88' : '#ff4466' }}>
                  {r.edgeM30 >= 0 ? '+' : ''}{(r.edgeM30 * 100).toFixed(4)}%
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-[11px] text-gray-600 text-center">
        Mis à jour toutes les 60s · Source: Hyperliquid API · σ* gate V25 §2.4 (HIGH/EXTREME vol → revert) · ADA override C2 V21
        {!realizedVol24h && !fundingHistory30d && !rollingHigh20d && (
          <span className="text-amber-700"> · props V25/C2 manquantes — fallback constantes actives</span>
        )}
      </p>
    </section>
  );
}
