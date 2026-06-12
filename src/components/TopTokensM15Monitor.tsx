/**
 * TOP TOKENS M15 MONITOR
 * Fusion de TopTokenScanner + HyperliquidMonitor.
 * Affichage unifié avec Score, Funding, OI, Vol, Setup, Action.
 * Switch M5/M15/M30, score colorisé, refresh auto.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

const HL_API = 'https://api.hyperliquid.xyz/info';
const FEES = { taker: 0.0005, maker: -0.0002, minEdgeRT: 0.001 };

type Timeframe = 'M5' | 'M15' | 'M30';

interface SessionInfo {
  name: string;
  score: number;
  color: string;
  active: boolean;
  end?: number;
  nextH?: number;
}

interface TokenData {
  symbol: string;
  price: number;
  funding: number;
  vol24h: number;
  oi: number;
  change24h: number;
  score: number;
  direction: string;
  fundingEdge: number;
  setup: 'READY' | 'WATCH' | 'AVOID';
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  strengthScore: number;
}

interface TokenScore {
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

function getSessionInfo(): SessionInfo {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcT = utcH + utcM / 60;

  if (utcT >= 7 && utcT < 9)   return { name: 'EU Open',    score: 80,  color: '#22c55e', active: true, end: 9 };
  if (utcT >= 13 && utcT < 17) return { name: 'EU/US Core', score: 100, color: '#16a34a', active: true, end: 17 };
  if (utcT >= 17 && utcT < 20) return { name: 'US Extend',  score: 70,  color: '#84cc16', active: true, end: 20 };
  if (utcT >= 1  && utcT < 4)  return { name: 'Asia',       score: 35,  color: '#eab308', active: false, end: 4 };

  let nextName = '', nextH = 0;
  if (utcT < 1)  { nextName = 'Asia';    nextH = 1; }
  else if (utcT >= 4 && utcT < 7)   { nextName = 'EU Open';    nextH = 7; }
  else if (utcT >= 9 && utcT < 13)  { nextName = 'EU/US Core'; nextH = 13; }
  else if (utcT >= 20)               { nextName = 'EU Open';    nextH = 31; };
  return { name: `Off (→ ${nextName} ${nextH % 24}h UTC)`, score: 0, color: '#6b7280', active: false, nextH };
}

function computeSetupScore(token: Partial<TokenScore>, sessionScore: number): { score: number; reasons: string[]; direction: string; fundingEdge: number } {
  let score = 0;
  const reasons: string[] = [];

  const vol24h = token.vol24h ?? 0;
  const funding = token.funding ?? 0;
  const change24h = token.change24h ?? 0;
  const oi = token.oi ?? 0;

  if (sessionScore >= 70) { score++; reasons.push('✅ Session'); }
  else reasons.push('⬜ Session off');

  if (vol24h > 10_000_000) { score++; reasons.push('✅ Vol'); }
  else if (vol24h > 2_000_000) { score += 0.5; reasons.push('🟡 Vol moyen'); }
  else reasons.push('⬜ Vol faible');

  const fundingEdge = Math.abs(funding / 16) - FEES.taker * 100;
  if (fundingEdge >= 0.10) { score++; reasons.push(`✅ Funding edge ${fundingEdge.toFixed(3)}%`); }
  else reasons.push(`⬜ Funding edge ${fundingEdge.toFixed(3)}%`);

  const hasTrend = Math.abs(change24h) > 0.5;
  if (hasTrend) { score++; reasons.push(`✅ Trend ${change24h > 0 ? '📈' : '📉'} ${change24h.toFixed(1)}%`); }
  else reasons.push('⬜ Trend faible');

  if (oi > 5_000_000) { score++; reasons.push('✅ OI'); }
  else reasons.push('⬜ OI faible');

  const volProxy = Math.abs(funding) * 100;
  if (volProxy > 0.01) { score++; reasons.push('✅ Volatilité'); }
  else reasons.push('⬜ Volatilité faible');

  let direction = 'WAIT';
  if (funding < -0.01 && change24h > 0) direction = 'LONG 📈';
  else if (funding > 0.01 && change24h < 0) direction = 'SHORT 📉';
  else if (Math.abs(change24h) > 1.5) direction = change24h > 0 ? 'LONG 📈' : 'SHORT 📉';

  return { score: Math.min(6, Math.round(score)), reasons, direction, fundingEdge };
}

function classifyBias(funding: number): 'LONG' | 'SHORT' | 'NEUTRAL' {
  if (funding < -0.0002) return 'LONG';
  if (funding > 0.0002) return 'SHORT';
  return 'NEUTRAL';
}

function computeStrengthScore(token: Partial<TokenData>, sessionScore: number): number {
  let strength = 0;
  const vol24h = token.vol24h ?? 0;
  const funding = token.funding ?? 0;
  const oi = token.oi ?? 0;
  const fundingEdge = Math.abs(funding / 16) - FEES.taker * 100;

  // Session (40%)
  strength += sessionScore * 40;

  // Funding edge (30%)
  const fundingRatio = fundingEdge / 0.10;
  if (fundingRatio >= 1) strength += 30;
  else if (fundingRatio >= 0.5) strength += 15;

  // Liquidity (20%)
  const oiScore = Math.min(oi / 2e9, 1);
  const volScore = Math.min(vol24h / 5e8, 1);
  strength += (oiScore * 10 + volScore * 10);

  // Bias alignment (10%)
  const bias = classifyBias(funding);
  if (bias === 'LONG' && funding < -0.0003) strength += 10;
  else if (bias === 'SHORT' && funding > 0.0003) strength += 10;

  return Math.round(strength);
}

export default function TopTokensM15Monitor({ equity = 1000 }: { equity?: number }) {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLast] = useState<Date | null>(null);
  const [session, setSession] = useState<SessionInfo>(getSessionInfo());
  const [countdown, setCountdown] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [equityInput, setEquity] = useState(equity);
  const [refreshCountdown, setRefreshCountdown] = useState(30);

  const fetchTokens = useCallback(async () => {
    try {
      const res = await fetch(HL_API, {
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
        const price = parseFloat(c.markPx || 0);
        const funding = parseFloat(c.funding || 0) * 100;
        const vol24h = parseFloat(c.dayNtlVlm || 0);
        const oi = parseFloat(c.openInterest || 0) * price;
        const prevPx = parseFloat(c.prevDayPx || price);
        const change24h = prevPx > 0 ? ((price - prevPx) / prevPx) * 100 : 0;
        const atrProxy = Math.max(0.004, Math.abs(funding) / 100 + 0.005);

        const token: Partial<TokenScore> = { symbol: m.name, price, funding, vol24h, oi, change24h, atrProxy };
        const setup = computeSetupScore(token, sess.score);
        const bias = classifyBias(funding);
        const strengthScore = computeStrengthScore({ price, funding, vol24h, oi, change24h }, sess.score);

        // Score calculation (0-100 based on all factors)
        const finalScore = Math.round(
          (setup.score / 6) * 40 +  // Setup score
          (strengthScore / 100) * 30 +  // Strength
          (sess.score / 100) * 20 +  // Session
          (vol24h > 10_000_000 ? 10 : vol24h > 2_000_000 ? 5 : 0)  // Volume
        );

        let setupStatus: 'READY' | 'WATCH' | 'AVOID';
        if (finalScore >= 80) setupStatus = 'READY';
        else if (finalScore >= 60) setupStatus = 'WATCH';
        else setupStatus = 'AVOID';

        return {
          symbol: m.name,
          price,
          funding,
          vol24h,
          oi,
          change24h,
          score: finalScore,
          direction: setup.direction,
          fundingEdge: setup.fundingEdge,
          setup: setupStatus,
          bias,
          strengthScore,
        } as TokenData;
      }).filter((t: TokenData) => t.price > 0 && t.vol24h > 100_000);

      tokenList.sort((a: TokenData, b: TokenData) => b.score - a.score);
      setTokens(tokenList.slice(0, 15));
      setLoading(false);
      setLast(new Date());
      setRefreshCountdown(30);
    } catch (err) {
      console.error('TopTokensM15Monitor fetch error:', err);
    }
  }, []);

  useEffect(() => {
    fetchTokens();
    const interval = setInterval(fetchTokens, 30_000);
    const clock = setInterval(() => {
      const sess = getSessionInfo();
      setSession(sess);
      if (!sess.active && sess.nextH) setCountdown(getCountdown(sess.nextH % 24));
      setRefreshCountdown(c => Math.max(0, c - 1));
    }, 1000);
    return () => { clearInterval(interval); clearInterval(clock); };
  }, [fetchTokens]);

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
    return `${h}h ${m.toString().padStart(2,'0')}m`;
  }

  const fmtVol = (v: number): string => v >= 1e9 ? `$${(v/1e9).toFixed(2)}B` : v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`;

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#22c55e';
    if (score >= 60) return '#f97316';
    return '#6b7280';
  };

  const getSetupColor = (setup: string): string => {
    switch (setup) {
      case 'READY': return '#22c55e';
      case 'WATCH': return '#f97316';
      case 'AVOID': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getBiasColor = (bias: string): string => {
    switch (bias) {
      case 'LONG': return '#4ade80';
      case 'SHORT': return '#f87171';
      default: return '#64748b';
    }
  };

  const getAction = (token: TokenData): string => {
    if (token.setup === 'READY') return token.direction === 'LONG 📈' ? 'LONG' : token.direction === 'SHORT 📉' ? 'SHORT' : 'WAIT';
    if (token.setup === 'WATCH') return 'MONITOR';
    return 'AVOID';
  };

  const calcSize = (token: TokenData): string => {
    const slDist = Math.max(0.004, 0.75 * (Math.abs(token.funding) / 100 + 0.005));
    const riskUSDT = equityInput * 0.0015;
    return (riskUSDT / slDist).toFixed(0);
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> Top Tokens M15 Monitor
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Timeframe Switch */}
          <div className="flex gap-1">
            {(['M5', 'M15', 'M30'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`font-mono text-[0.65rem] px-3 py-1 rounded transition-colors ${
                  timeframe === tf
                    ? 'bg-[#1e3a5f] text-[#00e5ff] border border-[#00e5ff]'
                    : 'bg-[#0f172a] text-[#64748b] border border-[#1e293b]'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Session badge */}
          <div className="px-3 py-1 rounded border text-[0.65rem] font-semibold flex items-center gap-2" style={{
            background: session.color + '22',
            borderColor: session.color,
            color: session.color,
          }}>
            <span>{session.active ? '🟢' : '🔴'}</span>
            <span>{session.name}</span>
            {session.active && <span>· {session.score}/100</span>}
          </div>

          {!session.active && countdown && (
            <span className="font-mono text-[0.6rem] text-[#94a3b8]">⏳ {countdown}</span>
          )}

          <button
            onClick={fetchTokens}
            className="font-mono text-[0.65rem] text-[#5a6070] hover:text-white transition-colors px-2 py-1 border border-[#1e1e32] rounded hover:border-[#3a3a4a]"
          >
            Refresh ({refreshCountdown}s)
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-[#1e1e32] font-mono text-[0.6rem] text-[#5a6070] uppercase tracking-wider">
          <span>#</span>
          <span>Token</span>
          <span className="text-right">Price</span>
          <span className="text-right">Funding</span>
          <span className="text-right">OI</span>
          <span className="text-right">24h Vol</span>
          <span className="text-right">Score</span>
          <span className="text-center">Setup</span>
          <span className="text-right">Action</span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-12 text-center font-mono text-[0.85rem] text-[#5a6070]">
            Loading tokens...
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {tokens.map((token, idx) => {
              const scoreColor = getScoreColor(token.score);
              const setupColor = getSetupColor(token.setup);
              const biasColor = getBiasColor(token.bias);
              const action = getAction(token);
              const actionColor = action === 'LONG' ? '#4ade80' : action === 'SHORT' ? '#f87171' : '#64748b';

              return (
                <div
                  key={token.symbol}
                  className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-[#1e1e32] hover:bg-[#1a1a2e] transition-colors font-mono text-[0.7rem]"
                >
                  <span className="font-semibold text-white">{idx + 1}</span>
                  <span className="font-semibold text-white">{token.symbol}</span>
                  <span className="text-right tabular-nums text-white">${token.price < 1 ? token.price.toFixed(5) : token.price < 100 ? token.price.toFixed(3) : token.price.toFixed(1)}</span>
                  <span className={`text-right tabular-nums ${token.funding > 0 ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>
                    {token.funding > 0 ? '+' : ''}{token.funding.toFixed(4)}%
                  </span>
                  <span className="text-right tabular-nums text-white">{fmtVol(token.oi)}</span>
                  <span className="text-right tabular-nums text-white">{fmtVol(token.vol24h)}</span>
                  <span className="text-right">
                    <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-semibold" style={{
                      background: scoreColor + '33',
                      border: `1px solid ${scoreColor}`,
                      color: scoreColor,
                    }}>
                      {token.score}
                    </span>
                  </span>
                  <span className="text-center">
                    <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-semibold" style={{
                      background: setupColor + '22',
                      border: `1px solid ${setupColor}`,
                      color: setupColor,
                    }}>
                      {token.setup}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="px-2 py-0.5 rounded text-[0.65rem] font-semibold" style={{
                      background: actionColor + '22',
                      border: `1px solid ${actionColor}`,
                      color: actionColor,
                    }}>
                      {action}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 font-mono text-[0.6rem] text-[#5a6070] flex-wrap">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded" style={{ background: '#22c55e' }} />
          <span>Score ≥80: READY</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded" style={{ background: '#f97316' }} />
          <span>Score 60-79: WATCH</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded" style={{ background: '#ef4444' }} />
          <span>Score &lt;60: AVOID</span>
        </div>
        <span className="ml-auto">Source: Hyperliquid API · Refresh: 30s</span>
      </div>
    </div>
  );
}
