/**
 * TOP TOKENS M15 SCANNER — v9.0 (OFI + AUTOCORRELATION)
 * Scanne tous les tokens Hyperliquid toutes les 30s.
 * Score composite 0-100 : L1 (30%) + L2 (40%) + L3 (30%)
 * NOUVEAU: OFI autocorrélation + ACF + realized volatility en temps réel
 * Affiche TOP 20 avec colonnes OFI, ACF, VOL + panel de détail au clic
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { getOFIEngine, type ACFResult, type RVResult, type DepthFeatures } from '@/lib/ofi-autocorr';
import { OFIBadge } from './OFIBadge';
import { ACFMiniChart } from './ACFMiniChart';
import { RVRegimeBadge } from './RVRegimeBadge';
import { OFIDetailPanel, type TokenSignalExtended } from './OFIDetailPanel';
import { useMultiAssetL2WebSocket } from '@/hooks/api/useHyperliquidL2WebSocket';

const HL_API = '/api/hyperliquid';

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
  // === OFI + AUTOCORRELATION FIELDS ===
  ofiScore: number;           // 0..100
  autoCorr: number;           // 0..100
  acfDirection: 'BUY' | 'SELL' | 'NEUTRAL';
  acfStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  pContinuation: number;      // 0..1
  rvRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXPLOSIVE';
  depthImbalance: number;     // -1..+1
  spreadBps: number;
  acfLags: number[];          // rho_1..rho_10
  // L1/L2/L3 breakdown for detail panel
  l1Score?: number;
  l2Score?: number;
  l3Score?: number;
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

/** Compute L1/L2/L3 scores from OFI engine data */
function computeLayerScores(token: TokenData, sessionScore: number): { l1: number; l2: number; l3: number } {
  // L1: Session + volume (30% of final)
  const l1Session = sessionScore >= 70 ? 100 : sessionScore >= 35 ? 50 : 0;
  const l1Vol = token.vol24h >= 10_000_000 ? 100 : token.vol24h >= 2_000_000 ? 60 : 20;
  const l1 = (l1Session * 0.6 + l1Vol * 0.4);

  // L2: VWAP proxy + funding + OI + OFI + depth (40% of final)
  const l2Funding = Math.abs(token.fundingEdge) >= 0.10 ? 100 : Math.abs(token.fundingEdge) >= 0.05 ? 60 : 30;
  const l2OI = token.oi >= 5_000_000 ? 100 : token.oi >= 2_000_000 ? 60 : 30;
  const l2OFI = token.ofiScore; // 0..100 from OFI engine
  const l2Depth = Math.abs(token.depthImbalance) >= 0.15 ? 100 : Math.abs(token.depthImbalance) >= 0.05 ? 60 : 40;
  const l2Spread = token.spreadBps <= 2 ? 100 : token.spreadBps <= 5 ? 70 : 40;
  const l2 = (l2Funding * 0.25 + l2OI * 0.20 + l2OFI * 0.30 + l2Depth * 0.15 + l2Spread * 0.10);

  // L3: Trend + vol + autocorr + pContinuation (30% of final)
  const l3Trend = Math.abs(token.change24h) >= 1 ? 100 : Math.abs(token.change24h) >= 0.5 ? 60 : 30;
  const l3Vol = token.rvRegime === 'NORMAL' ? 100 : token.rvRegime === 'HIGH' ? 70 : token.rvRegime === 'LOW' ? 50 : 0;
  const l3AutoCorr = token.autoCorr; // 0..100 from ACF
  const l3PCont = token.pContinuation * 100; // 0..100
  const l3 = (l3Trend * 0.30 + l3Vol * 0.20 + l3AutoCorr * 0.30 + l3PCont * 0.20);

  return { l1, l2, l3 };
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
  const [selectedToken, setSelectedToken] = useState<TokenSignalExtended | null>(null);
  const [ofiSignals, setOfiSignals] = useState<Record<string, {
    acf: ACFResult | null;
    rv: RVResult;
    depth: DepthFeatures | null;
  }>>({});

  // L2 WebSocket pour données OFI temps réel
  const [trackedSymbols, setTrackedSymbols] = useState<string[]>(['BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'ARB', 'OP', 'MATIC']);
  const l2WebSocket = useMultiAssetL2WebSocket(trackedSymbols);

  const fetchTokens = useCallback(async (retries = 3) => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res  = await fetch(`${HL_API}?method=meta`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          if (attempt < retries - 1) {
            const backoff = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw new Error(`HTTP ${res.status}`);
        }

        const json = await res.json();

        if (!json.success) {
          if (attempt < retries - 1) {
            const backoff = Math.pow(2, attempt) * 1000;
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw new Error(json.error || 'API error');
        }

        const data = json.data;
        const sess = getSessionInfo();
        setSession(sess);

        // L'API GET renvoie des données transformées
        const tokenList = data.map((token: any) => {
          const { symbol, price, volume24h, openInterest, fundingRate, prevDayPx } = token;

          // Formater les données pour compatibilité
          const funding = fundingRate * 100; // convertir en %
          const vol24h = volume24h;
          const oi = openInterest;
          // Calculer change24h à partir de prevDayPx
          const change24h = prevDayPx > 0 ? ((price - prevDayPx) / prevDayPx) * 100 : 0;
          const atrProxy = Math.max(0.004, Math.abs(funding) / 100 + 0.005);

          const tokenPartial: Partial<TokenData> = {
            symbol,
            price,
            funding,
            vol24h,
            oi,
            change24h,
            atrProxy
          };
          const setup = computeSetupScore(tokenPartial, sess.score);

          // === GET OFI SIGNALS ===
          const engine = getOFIEngine(symbol);
          const acf = engine.computeACF();
          const rv = engine.computeRV();
          const depth = engine.getLastDepth();

          // Compute OFI scores
          const ofiScore = acf ? Math.max(0, Math.min(100,
            50 +
            (acf.direction === 'BUY' ? 15 : acf.direction === 'SELL' ? -15 : 0) +
            (acf.persistence - 0.5) * 40 +
            Math.min(acf.sumACF * 15, 20)
          )) : 50;

          const autoCorr = acf ? Math.max(0, Math.min(100,
            50 + acf.sumACF * 50 + (acf.persistence - 0.5) * 60
          )) : 50;

          // Compute L1/L2/L3 for detail panel
          const tokenWithOFI: TokenData = {
            symbol,
            price,
            funding,
            vol24h,
            oi,
            change24h,
            atrProxy,
            slDist: Math.max(0.004, 0.75 * atrProxy),
            entryZone: price,
            ...setup,
            // OFI fields
            ofiScore,
            autoCorr,
            acfDirection: acf?.direction ?? 'NEUTRAL',
            acfStrength: acf?.strength ?? 'WEAK',
            pContinuation: acf?.pContinuation ?? 0.5,
            rvRegime: rv.regime,
            depthImbalance: depth?.depthImbalance ?? 0,
            spreadBps: depth?.spreadBps ?? 0,
            acfLags: acf?.lags ?? [],
          };

          // Compute L1/L2/L3 scores
          const layerScores = computeLayerScores(tokenWithOFI, sess.score);
          tokenWithOFI.l1Score = layerScores.l1;
          tokenWithOFI.l2Score = layerScores.l2;
          tokenWithOFI.l3Score = layerScores.l3;

          return tokenWithOFI;
        });

        const filteredList = tokenList.filter((t: TokenData) => t.price > 0 && t.vol24h > 100_000);

        // Trier par score décroissant, puis volume
        filteredList.sort((a: TokenData, b: TokenData) => b.score - a.score || b.vol24h - a.vol24h);

        setTokens(filteredList);
        setLoading(false);
        setLast(new Date());

        // Alertes browser pour setup ≥ 4 en session active
        if (alertEnabled && sess.active && typeof window !== 'undefined' && 'Notification' in window) {
          const newSetups = filteredList.filter((t: TokenData) => t.score >= 4 && t.direction !== 'WAIT');
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

        return; // Success
      } catch (err) {
        console.error('TopTokenScanner fetch error:', err);
        if (attempt === retries - 1) {
          setLoading(false);
        }
      }
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

  // Mettre à jour les symbols suivis par le L2 WebSocket quand les tokens changent
  useEffect(() => {
    if (tokens.length > 0) {
      const topSymbols = tokens.slice(0, 20).map(t => t.symbol);
      setTrackedSymbols(prev => {
        const newSymbols = [...new Set([...prev, ...topSymbols])];
        return newSymbols.slice(0, 30); // Max 30 symbols pour WS
      });
    }
  }, [tokens]);

  // Mettre à jour les signaux OFI depuis le L2 WebSocket
  useEffect(() => {
    if (l2WebSocket.connected && Object.keys(l2WebSocket.ofiSignals).length > 0) {
      setTokens(prev => prev.map(token => {
        const signal = l2WebSocket.ofiSignals[token.symbol];
        if (!signal) return token;

        return {
          ...token,
          ofiScore: signal.ofiScore,
          autoCorr: signal.autoCorr,
          acfDirection: signal.acfDirection,
          acfStrength: signal.acfStrength,
          pContinuation: signal.pContinuation,
          rvRegime: signal.rvRegime,
          depthImbalance: signal.depthImbalance,
          spreadBps: signal.spreadBps,
          acfLags: signal.acfLags,
        };
      }));
    }
  }, [l2WebSocket.ofiSignals, l2WebSocket.connected]);

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
          {/* L2 WebSocket Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: l2WebSocket.connected ? '#22c55e' : '#ef4444', animation: l2WebSocket.connected ? 'pulse 2s infinite' : 'none' }} />
            <span style={{ fontSize: 10, color: l2WebSocket.connected ? '#22c55e' : '#ef4444', fontFamily: 'monospace' }}>
              L2 WS {l2WebSocket.connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
            {l2WebSocket.connected && Object.keys(l2WebSocket.ofiSignals).length > 0 && (
              <span style={{ fontSize: 9, color: '#64748b', marginLeft: 4 }}>
                ({Object.keys(l2WebSocket.ofiSignals).length} assets)
              </span>
            )}
          </div>
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
                {['#', 'Token', 'Score', 'Prix', 'Funding', '24h', 'Vol', 'OI', 'OFI', 'ACF', 'VOL', 'Dir', 'SL', 'TP1', 'TP2', 'Size'].map(h => (
                  <th key={h} style={{ color: '#64748b', padding: '4px 6px', textAlign: 'left', fontWeight: 600, fontSize: 10 }}>{h}</th>
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
                  <tr
                    key={t.symbol}
                    style={{ background: rowBg, borderBottom: '1px solid #0f172a', cursor: 'pointer' }}
                    onClick={() => setSelectedToken(t as TokenSignalExtended)}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#1e3a5f22'}
                    onMouseLeave={(e) => e.currentTarget.style.background = rowBg}
                  >
                    <td style={{ color: '#475569', padding: '4px 6px', fontSize: 11 }}>{i+1}</td>
                    <td style={{ color: isSetup ? '#22c55e' : '#f1f5f9', padding: '4px 6px', fontWeight: isSetup ? 700 : 400, fontSize: 11 }}>
                      {isSetup && '🎯 '}{t.symbol}
                    </td>
                    <td style={{ padding: '4px 6px' }}>
                      <span style={{ background: scoreColor(t.score) + '33', border: `1px solid ${scoreColor(t.score)}`, borderRadius: 3, padding: '1px 4px', color: scoreColor(t.score), fontWeight: 700, fontSize: 11 }}>
                        {t.score}/6
                      </span>
                    </td>
                    <td style={{ color: '#e2e8f0', padding: '4px 6px', fontSize: 11 }}>${t.price < 1 ? t.price.toFixed(5) : t.price < 100 ? t.price.toFixed(3) : t.price.toFixed(1)}</td>
                    <td style={{ color: t.funding > 0.02 ? '#f87171' : t.funding < -0.02 ? '#4ade80' : '#94a3b8', padding: '4px 6px', fontSize: 10 }}>
                      {t.funding > 0 ? '+' : ''}{t.funding.toFixed(3)}%
                    </td>
                    <td style={{ color: t.change24h > 0 ? '#4ade80' : '#f87171', padding: '4px 6px', fontSize: 10 }}>
                      {t.change24h > 0 ? '+' : ''}{t.change24h.toFixed(1)}%
                    </td>
                    <td style={{ color: '#94a3b8', padding: '4px 6px', fontSize: 10 }}>{fmtVol(t.vol24h)}</td>
                    <td style={{ color: '#94a3b8', padding: '4px 6px', fontSize: 10 }}>{fmtVol(t.oi)}</td>
                    {/* OFI Badge */}
                    <td style={{ padding: '4px 6px' }}>
                      <OFIBadge
                        direction={t.acfDirection}
                        strength={t.acfStrength}
                        pContinuation={t.pContinuation}
                        ofiScore={t.ofiScore}
                        rho1={t.acfLags[0]}  // Premier lag ACF pour décision immédiate
                      />
                    </td>
                    {/* ACF MiniChart */}
                    <td style={{ padding: '4px 6px' }}>
                      <ACFMiniChart lags={t.acfLags} />
                    </td>
                    {/* RV Regime Badge */}
                    <td style={{ padding: '4px 6px' }}>
                      <RVRegimeBadge regime={t.rvRegime} compact />
                    </td>
                    <td style={{ padding: '4px 6px', fontSize: 10 }}>
                      <span style={{ color: t.direction === 'LONG 📈' ? '#4ade80' : t.direction === 'SHORT 📉' ? '#f87171' : '#64748b', fontWeight: 600 }}>
                        {t.direction === 'LONG 📈' ? 'L' : t.direction === 'SHORT 📉' ? 'S' : 'W'}
                      </span>
                    </td>
                    <td style={{ color: '#f87171', padding: '4px 6px', fontSize: 10 }}>{sl}</td>
                    <td style={{ color: '#84cc16', padding: '4px 6px', fontSize: 10 }}>{tp1}</td>
                    <td style={{ color: '#22c55e', padding: '4px 6px', fontSize: 10 }}>{tp2}</td>
                    <td style={{ color: '#60a5fa', padding: '4px 6px', fontWeight: t.direction !== 'WAIT' ? 600 : 400, fontSize: 10 }}>
                      {t.direction !== 'WAIT' ? `$${size}` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Légende score + OFI */}
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

      {/* Légende OFI */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap', padding: '8px 12px', background: '#0d1117', borderRadius: 6, fontSize: 10, color: '#666' }}>
        <span>🟢 OFI BUY = flux acheteur persistant</span>
        <span>🔴 OFI SELL = pression vendeuse persistante</span>
        <span>ACF = autocorrélation OFI lags 1–10 (vert = positif)</span>
        <span>p% = probabilité de continuation du move</span>
        <span>VOL:HIGH = spread/stops à élargir</span>
        <span>🔎 Click ligne = détail microstructure</span>
        {l2WebSocket.connected && (
          <span style={{ color: '#22c55e', marginLeft: 'auto' }}>
            ⚡ Données OFI temps réel (L2 WS)
          </span>
        )}
      </div>

      {/* OFI Detail Panel */}
      {selectedToken && (
        <OFIDetailPanel
          token={selectedToken}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </div>
  );
}
