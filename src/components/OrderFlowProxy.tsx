/**
 * ORDER FLOW PROXY v8.0
 * Approxime le CVD (Cumulative Volume Delta) depuis les trades Hyperliquid.
 * Buy% vs Sell% des N dernières minutes.
 * Alerte si déséquilibre > 65%
 */
'use client';

import { useState, useEffect } from 'react';
import ActionabilityBadge from '@/components/ui/ActionabilityBadge';

const HL_API = 'https://api.hyperliquid.xyz/info';

interface Trade {
  sz: string;
  px: string;
  side: string;
  time: number;
}

interface FlowData {
  buyVol: number;
  sellVol: number;
  buyPct: number;
  symbol: string;
  nTrades: number;
}

function computeCVD(trades: Trade[]): { buyVol: number; sellVol: number; buyPct: number } {
  let buyVol = 0, sellVol = 0;
  for (const t of trades) {
    const sz = Math.abs(parseFloat(t.sz || '0')) * parseFloat(t.px || '0');
    if (t.side === 'B') { buyVol += sz; }
    else { sellVol += sz; }
  }
  const total = buyVol + sellVol;
  return { buyVol, sellVol, buyPct: total > 0 ? buyVol / total * 100 : 50 };
}

interface OrderFlowProxyProps {
  symbol?: string;
}

export default function OrderFlowProxy({ symbol = 'BTC' }: OrderFlowProxyProps) {
  const [data, setData]   = useState<FlowData | null>(null);
  const [syms, setSyms]   = useState<string[]>(['BTC', 'ETH', 'LINK', 'SOL', 'HYPE']);
  const [sel, setSel]     = useState(symbol);
  const [loading, setLoading] = useState(true);

  const fetch15mTrades = async (sym: string) => {
    try {
      const now15 = Date.now() - 15 * 60 * 1000;
      const res = await fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'trades', coin: sym }),
      });
      const trades: Trade[] = await res.json();
      const recent = trades.filter(t => t.time >= now15).slice(-500);
      const flow   = computeCVD(recent);
      setData({ ...flow, symbol: sym, nTrades: recent.length });
      setLoading(false);
    } catch (err) {
      console.error('OrderFlow error:', err);
    }
  };

  useEffect(() => {
    fetch15mTrades(sel);
    const id = setInterval(() => fetch15mTrades(sel), 15_000);
    return () => clearInterval(id);
  }, [sel]);

  const fmtUSDT = (v: number): string => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : `$${(v/1e3).toFixed(0)}K`;
  const bias = data ? (data.buyPct > 65 ? '📈 BULLISH' : data.buyPct < 35 ? '📉 BEARISH' : '⬜ NEUTRE') : '';
  const biasColor = data ? (data.buyPct > 65 ? '#22c55e' : data.buyPct < 35 ? '#f87171' : '#94a3b8') : '#94a3b8';

  return (
    <div style={{ background: '#0a0f1a', border: '1px solid #1e3a5f', borderRadius: 12, padding: 16, fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ color: '#60a5fa', margin: 0, fontSize: 15, fontWeight: 700 }}>📊 ORDER FLOW 15m</h3>
        <ActionabilityBadge variant="informational" />
        <select
          value={sel}
          onChange={e => { setSel(e.target.value); setLoading(true); }}
          style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', padding: '3px 8px', fontSize: 12 }}
        >
          {syms.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 20 }}>⏳ Chargement...</div>
      ) : data ? (
        <>
          {/* Bias badge */}
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <span style={{ background: biasColor + '22', border: `1px solid ${biasColor}`, borderRadius: 6, padding: '4px 16px', color: biasColor, fontWeight: 700, fontSize: 15 }}>
              {bias}
            </span>
          </div>

          {/* Buy/Sell bar */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 4 }}>
              <span style={{ color: '#4ade80' }}>BUY {data.buyPct.toFixed(1)}%</span>
              <span style={{ color: '#f87171' }}>SELL {(100 - data.buyPct).toFixed(1)}%</span>
            </div>
            <div style={{ height: 12, background: '#1e293b', borderRadius: 6, overflow: 'hidden', display: 'flex' }}>
              <div style={{ width: `${data.buyPct}%`, background: 'linear-gradient(90deg, #16a34a, #4ade80)', transition: 'width 0.5s ease' }} />
              <div style={{ flex: 1, background: 'linear-gradient(90deg, #f87171, #dc2626)' }} />
            </div>
          </div>

          {/* Volumes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
            <div style={{ textAlign: 'center', background: '#16a34a11', borderRadius: 6, padding: '6px' }}>
              <div style={{ color: '#4ade80', fontWeight: 700 }}>{fmtUSDT(data.buyVol)}</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>Buy Vol</div>
            </div>
            <div style={{ textAlign: 'center', background: '#1e293b', borderRadius: 6, padding: '6px' }}>
              <div style={{ color: '#94a3b8' }}>{data.nTrades}</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>Trades 15m</div>
            </div>
            <div style={{ textAlign: 'center', background: '#dc262611', borderRadius: 6, padding: '6px' }}>
              <div style={{ color: '#f87171', fontWeight: 700 }}>{fmtUSDT(data.sellVol)}</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>Sell Vol</div>
            </div>
          </div>

          {data.buyPct > 65 && (
            <div style={{ marginTop: 10, background: '#16a34a11', border: '1px solid #16a34a44', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#4ade80' }}>
              ⚡ Pression acheteuse dominante — confirme setup LONG si autres filtres valides
            </div>
          )}
          {data.buyPct < 35 && (
            <div style={{ marginTop: 10, background: '#dc262611', border: '1px solid #dc262644', borderRadius: 6, padding: '6px 10px', fontSize: 11, color: '#f87171' }}>
              ⚡ Pression vendeuse dominante — confirme setup SHORT si autres filtres valides
            </div>
          )}
        </>
      ) : (
        <div style={{ color: '#ef4444', textAlign: 'center' }}>Erreur chargement</div>
      )}
    </div>
  );
}
