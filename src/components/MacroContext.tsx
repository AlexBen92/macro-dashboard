/**
 * MACRO CONTEXT v8.0
 * Contexte macro rapide: Fear & Greed, BTC dominance, funding agrégé,
 * liquidations 24h, top gainers/losers Hyperliquid.
 */
'use client';

import { useState, useEffect } from 'react';

const HL_API = 'https://api.hyperliquid.xyz/info';

interface TokenData {
  name: string;
  price: number;
  change: number;
  vol: number;
  funding: number;
  oi: number;
}

interface MacroData {
  totalVol: number;
  totalOI: number;
  avgFunding: number;
  btcData: TokenData;
  ethData: TokenData;
  btcDom: string;
  gainers: TokenData[];
  losers: TokenData[];
  longFunding: number;
  shortFunding: number;
  neutralF: number;
  marketBias: string;
  nTokens: number;
}

interface FngData {
  value: number;
  label: string;
}

export default function MacroContext() {
  const [data, setData]   = useState<MacroData | null>(null);
  const [fng, setFng]     = useState<FngData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        // Hyperliquid global data
        const res  = await fetch(HL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'metaAndAssetCtxs' }) });
        const raw  = await res.json();
        const meta = raw[0]?.universe || [];
        const ctxs = raw[1] || [];

        const tokens: TokenData[] = meta.map((m: { name: string }, i: number) => {
          const c = ctxs[i] || {};
          const price    = parseFloat(c.markPx || 0);
          const prevPx   = parseFloat(c.prevDayPx || price);
          const vol      = parseFloat(c.dayNtlVlm || 0);
          const funding  = parseFloat(c.funding || 0) * 100;
          const oi       = parseFloat(c.openInterest || 0) * price;
          const change   = prevPx > 0 ? (price - prevPx) / prevPx * 100 : 0;
          return { name: m.name, price, change, vol, funding, oi };
        }).filter((t: TokenData) => t.price > 0 && t.vol > 100_000);

        const totalVol     = tokens.reduce((s, t) => s + t.vol, 0);
        const totalOI      = tokens.reduce((s, t) => s + t.oi, 0);
        const avgFunding   = tokens.reduce((s, t) => s + t.funding, 0) / (tokens.length || 1);
        const btcData      = tokens.find((t: TokenData) => t.name === 'BTC') || {} as TokenData;
        const ethData      = tokens.find((t: TokenData) => t.name === 'ETH') || {} as TokenData;
        const altVol       = tokens.filter((t: TokenData) => !['BTC','ETH'].includes(t.name)).reduce((s,t) => s+t.vol, 0);
        const btcDom       = totalVol > 0 ? ((btcData.vol || 0) / totalVol * 100).toFixed(1) : '50';

        const sorted       = [...tokens].sort((a, b) => b.change - a.change);
        const gainers      = sorted.slice(0, 5);
        const losers       = sorted.slice(-5).reverse();

        // Funding heatmap: positif = bearish (shorts paient)
        const longFunding  = tokens.filter((t: TokenData) => t.funding < -0.01).length;
        const shortFunding = tokens.filter((t: TokenData) => t.funding > 0.01).length;
        const neutralF     = tokens.length - longFunding - shortFunding;
        const marketBias   = longFunding > shortFunding ? 'BEARISH SENTIMENT' : shortFunding > longFunding ? 'BULLISH SENTIMENT' : 'NEUTRAL';

        setData({ totalVol, totalOI, avgFunding, btcData, ethData, btcDom, gainers, losers, longFunding, shortFunding, neutralF, marketBias, nTokens: tokens.length });

        // Fear & Greed (alternative.me public API)
        try {
          const fngRes = await fetch('https://api.alternative.me/fng/?limit=1');
          const fngJson = await fngRes.json();
          setFng({ value: parseInt(fngJson.data[0].value), label: fngJson.data[0].value_classification });
        } catch {}

        setLoading(false);
      } catch (err) {
        console.error('MacroContext error:', err);
        setLoading(false);
      }
    };

    fetchAll();
    const id = setInterval(fetchAll, 60_000);
    return () => clearInterval(id);
  }, []);

  const fmtB = (v: number): string => v >= 1e9 ? `$${(v/1e9).toFixed(2)}B` : `$${(v/1e6).toFixed(0)}M`;
  const fngColor = fng ? (fng.value >= 75 ? '#ef4444' : fng.value >= 55 ? '#f97316' : fng.value >= 45 ? '#eab308' : fng.value >= 25 ? '#84cc16' : '#22c55e') : '#94a3b8';

  return (
    <div style={{ background: '#0a0f1a', border: '1px solid #1e3a5f', borderRadius: 12, padding: 16, fontFamily: 'monospace' }}>
      <h3 style={{ color: '#60a5fa', margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>🌍 MACRO CONTEXT</h3>

      {loading ? (
        <div style={{ color: '#64748b', textAlign: 'center', padding: 16 }}>⏳ Chargement...</div>
      ) : data && (
        <>
          {/* Top metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            {[
              { label: 'Vol 24h (HL)', value: fmtB(data.totalVol), color: '#60a5fa' },
              { label: 'OI Total', value: fmtB(data.totalOI), color: '#a78bfa' },
              { label: 'Funding Moy', value: `${data.avgFunding > 0 ? '+' : ''}${data.avgFunding.toFixed(4)}%`, color: data.avgFunding > 0.01 ? '#f87171' : data.avgFunding < -0.01 ? '#4ade80' : '#94a3b8' },
              { label: 'BTC Dominance', value: `${data.btcDom}%`, color: '#fbbf24' },
              { label: 'Fear & Greed', value: fng ? `${fng.value} — ${fng.label}` : 'N/A', color: fngColor },
              { label: 'Market Bias', value: data.marketBias, color: data.marketBias.includes('BULL') ? '#4ade80' : data.marketBias.includes('BEAR') ? '#f87171' : '#94a3b8' },
            ].map(m => (
              <div key={m.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
                <div style={{ color: m.color, fontWeight: 700, fontSize: 13 }}>{m.value}</div>
                <div style={{ color: '#475569', fontSize: 10 }}>{m.label}</div>
              </div>
            ))}
          </div>

          {/* Funding distribution */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ color: '#64748b', fontSize: 11, marginBottom: 6 }}>Funding distribution ({data.nTokens} tokens)</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12 }}>
              <span style={{ color: '#4ade80' }}>📈 Carry Long: {data.longFunding}</span>
              <span style={{ color: '#94a3b8' }}>⬜ Neutre: {data.neutralF}</span>
              <span style={{ color: '#f87171' }}>📉 Carry Short: {data.shortFunding}</span>
            </div>
            <div style={{ height: 8, background: '#1e293b', borderRadius: 4, overflow: 'hidden', display: 'flex', marginTop: 6 }}>
              <div style={{ width: `${data.longFunding / data.nTokens * 100}%`, background: '#16a34a', transition: 'width 0.5s' }} />
              <div style={{ width: `${data.neutralF / data.nTokens * 100}%`, background: '#334155' }} />
              <div style={{ width: `${data.shortFunding / data.nTokens * 100}%`, background: '#dc2626' }} />
            </div>
          </div>

          {/* Gainers / Losers */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>🚀 TOP GAINERS 24h</div>
              {data.gainers.map(t => (
                <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #0f172a', fontSize: 12 }}>
                  <span style={{ color: '#e2e8f0' }}>{t.name}</span>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>+{t.change.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{ color: '#f87171', fontSize: 11, fontWeight: 600, marginBottom: 6 }}>💥 TOP LOSERS 24h</div>
              {data.losers.map(t => (
                <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #0f172a', fontSize: 12 }}>
                  <span style={{ color: '#e2e8f0' }}>{t.name}</span>
                  <span style={{ color: '#f87171', fontWeight: 600 }}>{t.change.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
