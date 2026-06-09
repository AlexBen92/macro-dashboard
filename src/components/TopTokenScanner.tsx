/**
 * TOP TOKENS M15 SCANNER — v8.0
 * Scanne tous les tokens Hyperliquid toutes les 30s.
 * Score composite 0-6 : session + volume + funding + trend + OI + volatilité
 * Affiche TOP 15 avec badge SETUP READY si score ≥ 4/6
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

const HL_API = 'https://api.hyperliquid.xyz/info';

const FEES = { taker: 0.0005, maker: -0.0002, minEdgeRT: 0.001 };

interface SessionInfo {
  name: string;
  score: number;
  color: string;
  active: boolean;
  end?: number;
  nextH?: number;
}

interface TokenScore {
  score: number;
  reasons: string[];
  direction: string;
  fundingEdge: number;
}

interface TokenData {
  symbol: string;
  price: number;
  funding: number;
  vol24h: number;
  oi: number;
  change24h: number;
  atrProxy: number;
  slDist: number;
  entryZone: number;
  score: number;
  reasons: string[];
  direction: string;
  fundingEdge: number;
}

interface Alert {
  key: string;
  symbol: string;
  direction: string;
  score: number;
  time: Date;
}

function computeSetupScore(token: Partial<TokenData>, sessionScore: number): TokenScore {
  let score = 0;
  const reasons: string[] = [];

  const vol24h = token.vol24h ?? 0;
  const funding = token.funding ?? 0;
  const change24h = token.change24h ?? 0;
  const oi = token.oi ?? 0;

  // 1. Session active (≥ 70/100)
  if (sessionScore >= 70) { score++; reasons.push('✅ Session'); }
  else reasons.push('⬜ Session off');

  // 2. Volume significatif (top 30% approximation: > $10M 24h)
  if (vol24h > 10_000_000) { score++; reasons.push('✅ Vol'); }
  else if (vol24h > 2_000_000) { score += 0.5; reasons.push('🟡 Vol moyen'); }
  else reasons.push('⬜ Vol faible');

  // 3. Edge funding ≥ 0.10% net (funding/16 - taker fee)
  const fundingEdge = Math.abs(funding / 16) - FEES.taker * 100;
  if (fundingEdge >= 0.10) { score++; reasons.push(`✅ Funding edge ${fundingEdge.toFixed(3)}%`); }
  else reasons.push(`⬜ Funding edge ${fundingEdge.toFixed(3)}%`);

  // 4. Trend proxy: prix > moyenne implicite (24h change > 0 = bull, < 0 = bear)
  const hasTrend = Math.abs(change24h) > 0.5;
  if (hasTrend) { score++; reasons.push(`✅ Trend ${change24h > 0 ? '📈' : '📉'} ${change24h.toFixed(1)}%`); }
  else reasons.push('⬜ Trend faible (range)');

  // 5. OI significatif > $5M
  if (oi > 5_000_000) { score++; reasons.push('✅ OI'); }
  else reasons.push('⬜ OI faible');

  // 6. Volatilité exploitable: ATR proxy = (high-low)/close via funding magnitude
  const volProxy = Math.abs(funding) * 100;
  if (volProxy > 0.01) { score++; reasons.push('✅ Volatilité'); }
  else reasons.push('⬜ Volatilité faible');

  // Direction bias
  let direction = 'WAIT';
  if (funding < -0.01 && change24h > 0) direction = 'LONG 📈';
  else if (funding > 0.01 && change24h < 0) direction = 'SHORT 📉';
  else if (Math.abs(change24h) > 1.5) direction = change24h > 0 ? 'LONG 📈' : 'SHORT 📉';

  return { score: Math.min(6, Math.round(score)), reasons, direction, fundingEdge };
}

function getSessionInfo(): SessionInfo {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcT = utcH + utcM / 60;

  if (utcT >= 7 && utcT < 9)   return { name: 'EU Open',    score: 80,  color: '#22c55e', active: true, end: 9 };
  if (utcT >= 13 && utcT < 17) return { name: 'EU/US Core', score: 100, color: '#16a34a', active: true, end: 17 };
  if (utcT >= 17 && utcT < 20) return { name: 'US Extend',  score: 70,  color: '#84cc16', active: true, end: 20 };
  if (utcT >= 1  && utcT < 4)  return { name: 'Asia',       score: 35,  color: '#eab308', active: false, end: 4 };

  // Prochaine session
  let nextName = '', nextH = 0;
  if (utcT < 1)  { nextName = 'Asia';    nextH = 1; }
  else if (utcT >= 4 && utcT < 7)   { nextName = 'EU Open';    nextH = 7; }
  else if (utcT >= 9 && utcT < 13)  { nextName = 'EU/US Core'; nextH = 13; }
  else if (utcT >= 20)               { nextName = 'EU Open';    nextH = 31; } // next day 7h
  return { name: `Off (→ ${nextName} ${nextH % 24}h UTC)`, score: 0, color: '#6b7280', active: false, nextH };
}

function getCountdown(targetH: number): string {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcS = now.getUTCSeconds();
  let diffH = (targetH - utcH - 24) % 24;
  if (diffH <= 0) diffH += 24;
  const totalSec = diffH * 3600 - utcM * 60 - utcS;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

interface TopTokenScannerProps {
  equity?: number;
}

export default function TopTokenScanner({ equity = 1000 }: TopTokenScannerProps) {
  const [tokens, setTokens]     = useState<TokenData[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLast]   = useState<Date | null>(null);
  const [session, setSession]   = useState<SessionInfo>(getSessionInfo());
  const [countdown, setCountdown] = useState('');
  const [filter, setFilter]     = useState<'all' | 'long' | 'short' | 'setup'>('all');
  const [equityInput, setEquity] = useState(equity);
  const [alerts, setAlerts]     = useState<Alert[]>([]);
  const [alertEnabled, setAlertEnabled] = useState(false);

  const fetchTokens = useCallback(async () => {
    try {
      const res  = await fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });
      const data = await res.json();
      const meta = data[0]?.universe || [];
      const ctxs = data[1] || [];

      const sess = getSessionInfo();
      setSession(sess);

      const tokenList = meta.map((m: { name: string }, i: number) => {
        const c = ctxs[i] || {};
        const price   = parseFloat(c.markPx || 0);
        const funding = parseFloat(c.funding || 0) * 100; // en %
        const vol24h  = parseFloat(c.dayNtlVlm || 0);
        const oi      = parseFloat(c.openInterest || 0) * price;
        // change24h proxy via prevDayPx
        const prevPx  = parseFloat(c.prevDayPx || price);
        const change24h = prevPx > 0 ? ((price - prevPx) / prevPx) * 100 : 0;
        // ATR proxy: assume 1% per 8h period = ~0.125% per 15min
        const atrProxy = Math.max(0.004, Math.abs(funding) / 100 + 0.005);

        const token: Partial<TokenData> = { symbol: m.name, price, funding, vol24h, oi, change24h, atrProxy };
        const setup = computeSetupScore(token, sess.score);

        return {
          ...token,
          ...setup,
          // Position sizing (risk 0.15% equity, SL = max(0.4%, 0.75*ATR))
          slDist: Math.max(0.004, 0.75 * atrProxy),
          entryZone: price,
        } as TokenData;
      }).filter((t: TokenData) => t.price > 0 && t.vol24h > 100_000);

      // Trier par score décroissant, puis volume
      tokenList.sort((a: TokenData, b: TokenData) => b.score - a.score || b.vol24h - a.vol24h);

      setTokens(tokenList);
      setLoading(false);
      setLast(new Date());

      // Alertes browser pour setup ≥ 4 en session active
      if (alertEnabled && sess.active && typeof window !== 'undefined' && 'Notification' in window) {
        const newSetups = tokenList.filter((t: TokenData) => t.score >= 4 && t.direction !== 'WAIT');
        newSetups.forEach((t: TokenData) => {
          const key = `${t.symbol}_${Date.now()}`;
          if (Notification.permission === 'granted') {
            new Notification(`🎯 SETUP M15: ${t.symbol}`, {
              body: `Score ${t.score}/6 | ${t.direction} | Edge ${t.fundingEdge.toFixed(3)}%`,
              icon: '/favicon.ico',
            });
          }
          setAlerts(prev => [{ key, symbol: t.symbol, direction: t.direction, score: t.score, time: new Date() }, ...prev.slice(0, 4)]);
        });
      }
    } catch (err) {
      console.error('TopTokenScanner fetch error:', err);
    }
  }, [alertEnabled]);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 30_000);
    const clock    = setInterval(() => {
      const sess = getSessionInfo();
      setSession(sess);
      if (!sess.active && sess.nextH) setCountdown(getCountdown(sess.nextH % 24));
    }, 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchTokens]);

  // Position size calculator
  const calcSize = (slDist: number): string => {
    const riskUSDT = equityInput * 0.0015; // 0.15%
    return (riskUSDT / slDist).toFixed(0);
  };

  const calcSL = (price: number, slDist: number, dir: string): string =>
    dir === 'LONG 📈' ? (price * (1 - slDist)).toFixed(4) : (price * (1 + slDist)).toFixed(4);
  const calcTP1 = (price: number, slDist: number, dir: string): string =>
    dir === 'LONG 📈' ? (price * (1 + slDist * 1.2)).toFixed(4) : (price * (1 - slDist * 1.2)).toFixed(4);
  const calcTP2 = (price: number, slDist: number, dir: string): string =>
    dir === 'LONG 📈' ? (price * (1 + slDist * 2.5)).toFixed(4) : (price * (1 - slDist * 2.5)).toFixed(4);

  const filteredTokens = tokens.filter(t => {
    if (filter === 'long')  return t.direction === 'LONG 📈';
    if (filter === 'short') return t.direction === 'SHORT 📉';
    if (filter === 'setup') return t.score >= 4;
    return true;
  }).slice(0, 20);

  const scoreColor = (s: number): string => s >= 5 ? '#22c55e' : s >= 4 ? '#84cc16' : s >= 3 ? '#eab308' : s >= 2 ? '#f97316' : '#6b7280';
  const fmtVol = (v: number): string => v >= 1e9 ? `$${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`;

  return (
    <div style={{ background: '#0a0f1a', border: '1px solid #1e3a5f', borderRadius: 12, padding: 20, fontFamily: 'monospace' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ color: '#60a5fa', margin: 0, fontSize: 18, fontWeight: 700 }}>
            🔍 TOP TOKENS M15 SCANNER
          </h2>
          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>
            Score 0–6 · Session + Volume + Funding + Trend + OI + Volatilité · MAJ 30s
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {/* Session badge */}
          <div style={{ background: session.color + '22', border: `1px solid ${session.color}`, borderRadius: 6, padding: '4px 10px', marginBottom: 4 }}>
            <span style={{ color: session.color, fontWeight: 700, fontSize: 12 }}>
              {session.active ? '🟢' : '🔴'} {session.name}
              {session.active && ` · ${session.score}/100`}
            </span>
          </div>
          {!session.active && countdown && (
            <div style={{ color: '#94a3b8', fontSize: 11 }}>⏳ {countdown}</div>
          )}
        </div>
      </div>

      {/* Equity input + Alert toggle */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>Equity:</span>
          <input
            type="number"
            value={equityInput}
            onChange={e => setEquity(Number(e.target.value))}
            style={{ width: 90, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#f8fafc', padding: '3px 8px', fontSize: 12 }}
          />
          <span style={{ color: '#64748b', fontSize: 12 }}>USDT</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>🔔 Alertes:</span>
          <button
            onClick={() => {
              if (typeof window !== 'undefined' && 'Notification' in window && !alertEnabled && Notification.permission !== 'granted') {
                Notification.requestPermission();
              }
              setAlertEnabled(!alertEnabled);
            }}
            style={{ background: alertEnabled ? '#16a34a22' : '#1e293b', border: `1px solid ${alertEnabled ? '#22c55e' : '#334155'}`, borderRadius: 4, color: alertEnabled ? '#22c55e' : '#64748b', padding: '3px 10px', fontSize: 12, cursor: 'pointer' }}
          >
            {alertEnabled ? 'ON' : 'OFF'}
          </button>
        </div>
        {/* Filtres */}
        {(['all','setup','long','short'] as const).map(f => (
          <button key={f}
            onClick={() => setFilter(f)}
            style={{ background: filter === f ? '#1e3a5f' : '#0f172a', border: `1px solid ${filter === f ? '#3b82f6' : '#1e293b'}`, borderRadius: 4, color: filter === f ? '#60a5fa' : '#64748b', padding: '3px 10px', fontSize: 11, cursor: 'pointer' }}
          >
            {f === 'all' ? 'Tous' : f === 'setup' ? '🎯 Setup≥4' : f === 'long' ? '📈 Long' : '📉 Short'}
          </button>
        ))}
        {lastUpdate && (
          <span style={{ color: '#475569', fontSize: 10, marginLeft: 'auto' }}>
            MAJ {lastUpdate.toLocaleTimeString('fr-FR')}
          </span>
        )}
      </div>

      {/* Alertes récentes */}
      {alerts.length > 0 && (
        <div style={{ background: '#16a34a11', border: '1px solid #16a34a44', borderRadius: 6, padding: '8px 12px', marginBottom: 12 }}>
          <div style={{ color: '#22c55e', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>🔔 SETUPS ALERTÉS:</div>
          {alerts.map(a => (
            <div key={a.key} style={{ color: '#86efac', fontSize: 11 }}>
              {a.time.toLocaleTimeString('fr-FR')} · {a.symbol} · {a.direction} · Score {a.score}/6
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#60a5fa', padding: 30 }}>⏳ Chargement des tokens...</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['#', 'Token', 'Score', 'Prix', 'Funding', '24h %', 'Volume', 'OI', 'Direction', 'SL', 'TP1', 'TP2', 'Size (USDT)'].map(h => (
                  <th key={h} style={{ color: '#64748b', padding: '6px 8px', textAlign: 'left', fontWeight: 600, fontSize: 11 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((t, i) => {
                const isSetup = t.score >= 4 && t.direction !== 'WAIT' && session.active;
                const rowBg = isSetup ? '#16a34a08' : i % 2 === 0 ? '#0f172a' : 'transparent';
                const size = calcSize(t.slDist);
                const sl   = t.direction !== 'WAIT' ? calcSL(t.price, t.slDist, t.direction) : '-';
                const tp1  = t.direction !== 'WAIT' ? calcTP1(t.price, t.slDist, t.direction) : '-';
                const tp2  = t.direction !== 'WAIT' ? calcTP2(t.price, t.slDist, t.direction) : '-';

                return (
                  <tr key={t.symbol} style={{ background: rowBg, borderBottom: '1px solid #0f172a' }}>
                    <td style={{ color: '#475569', padding: '6px 8px' }}>{i+1}</td>
                    <td style={{ color: isSetup ? '#22c55e' : '#f1f5f9', padding: '6px 8px', fontWeight: isSetup ? 700 : 400 }}>
                      {isSetup && '🎯 '}{t.symbol}
                    </td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ background: scoreColor(t.score) + '33', border: `1px solid ${scoreColor(t.score)}`, borderRadius: 4, padding: '1px 6px', color: scoreColor(t.score), fontWeight: 700, fontSize: 12 }}>
                        {t.score}/6
                      </span>
                    </td>
                    <td style={{ color: '#e2e8f0', padding: '6px 8px' }}>${t.price < 1 ? t.price.toFixed(5) : t.price < 100 ? t.price.toFixed(3) : t.price.toFixed(1)}</td>
                    <td style={{ color: t.funding > 0.02 ? '#f87171' : t.funding < -0.02 ? '#4ade80' : '#94a3b8', padding: '6px 8px' }}>
                      {t.funding > 0 ? '+' : ''}{t.funding.toFixed(4)}%
                    </td>
                    <td style={{ color: t.change24h > 0 ? '#4ade80' : '#f87171', padding: '6px 8px' }}>
                      {t.change24h > 0 ? '+' : ''}{t.change24h.toFixed(2)}%
                    </td>
                    <td style={{ color: '#94a3b8', padding: '6px 8px' }}>{fmtVol(t.vol24h)}</td>
                    <td style={{ color: '#94a3b8', padding: '6px 8px' }}>{fmtVol(t.oi)}</td>
                    <td style={{ padding: '6px 8px' }}>
                      <span style={{ color: t.direction === 'LONG 📈' ? '#4ade80' : t.direction === 'SHORT 📉' ? '#f87171' : '#64748b', fontWeight: 600 }}>
                        {t.direction}
                      </span>
                    </td>
                    <td style={{ color: '#f87171', padding: '6px 8px', fontSize: 11 }}>{sl}</td>
                    <td style={{ color: '#84cc16', padding: '6px 8px', fontSize: 11 }}>{tp1}</td>
                    <td style={{ color: '#22c55e', padding: '6px 8px', fontSize: 11 }}>{tp2}</td>
                    <td style={{ color: '#60a5fa', padding: '6px 8px', fontWeight: t.direction !== 'WAIT' ? 600 : 400 }}>
                      {t.direction !== 'WAIT' ? `$${size}` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende score */}
      <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
        {[
          ['5-6/6', '#22c55e', '🎯 SETUP READY'],
          ['4/6',   '#84cc16', '🟢 Possible'],
          ['3/6',   '#eab308', '🟡 À surveiller'],
          ['1-2/6', '#6b7280', '⬜ Pas de setup'],
        ].map(([s, c, l]) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ background: c + '33', border: `1px solid ${c}`, borderRadius: 3, padding: '1px 5px', color: c }}>{s}</span>
            <span style={{ color: '#64748b' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
