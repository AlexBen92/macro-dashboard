'use client';
import { useEffect, useState } from 'react';
import { MIN_EDGE, HL_TAKER_FEE } from '@/lib/constants';

type Signal = 'SQUEEZE_LONG' | 'SQUEEZE_SHORT' | 'CARRY_LONG' | 'CARRY_SHORT' | 'NEUTRAL';

interface FundingRow {
  symbol:   string;
  funding:  number;
  oi:       number;
  signal:   Signal;
  extreme:  boolean;
  edgeM30:  number;  // net edge par bougie M30
}

const SIGNAL_META: Record<Signal, { label: string; color: string; icon: string }> = {
  SQUEEZE_LONG:  { label: 'Squeeze Long',  color: '#00ff88', icon: '🚀' },
  SQUEEZE_SHORT: { label: 'Squeeze Short', color: '#ff4466', icon: '💥' },
  CARRY_LONG:    { label: 'Carry Long',    color: '#55ff88', icon: '📈' },
  CARRY_SHORT:   { label: 'Carry Short',   color: '#ff8866', icon: '📉' },
  NEUTRAL:       { label: 'Neutre',        color: '#666',    icon: '⬜' },
};

function classify(f: number): Signal {
  if (f < -0.0005) return 'SQUEEZE_LONG';
  if (f >  0.0005) return 'SQUEEZE_SHORT';
  if (f < -0.0002) return 'CARRY_LONG';
  if (f >  0.0002) return 'CARRY_SHORT';
  return 'NEUTRAL';
}

export default function FundingAggregator() {
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

        // Filter: minimum OI $5M
        if (oi < 5e6) continue;

        // Edge calculation: funding per 30min (16 candles per 8h funding period)
        const edgePerM30 = funding / 16;
        const netEdge = edgePerM30 - HL_TAKER_FEE;

        const signal = classify(funding);
        const extreme = Math.abs(funding) > 0.0005;

        processed.push({
          symbol,
          funding,
          oi,
          signal,
          extreme,
          edgeM30: netEdge,
        });
      }

      // Sort by absolute funding (extreme first)
      processed.sort((a, b) => Math.abs(b.funding) - Math.abs(a.funding));

      setRows(processed.slice(0, 20)); // Top 20
      setTs(new Date().toLocaleTimeString('fr-FR'));
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
  }, []);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            💰 Funding Rate Aggregator
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Edge net par bougie M30 · Seuil: ≥{(MIN_EDGE * 100).toFixed(3)}% · {ts}
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
          <div className="grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 font-mono text-[10px] text-gray-500 uppercase tracking-wider">
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
                className={`grid grid-cols-[80px_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 rounded-lg border transition-all hover:brightness-110 ${
                  r.extreme ? 'bg-gray-800/80' : 'bg-gray-900/40'
                }`}
                style={{ borderColor: meta.color + '33' }}
              >
                <div className="flex items-center gap-1" style={{ color: meta.color }}>
                  <span>{meta.icon}</span>
                  <span className="text-[10px] font-semibold">{meta.label}</span>
                </div>
                <div className="font-mono text-sm text-white">{r.symbol}</div>
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
        Mis à jour toutes les 60s · Source: Hyperliquid API · Edge = (funding/16) - taker fee
      </p>
    </section>
  );
}
