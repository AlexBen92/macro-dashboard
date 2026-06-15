/**
 * TOP TOKENS M15 MONITOR v2.2 - REAL L2 DATA
 * 3-Layer scoring system for M15 scalping
 * - Layer 1: Hard Filters (news, spread, liquidity, session, chop)
 * - Layer 2: Setup Score (VWAP, funding, OI, volatility, order flow, trend)
 * - Layer 3: Confirmation Score (M5 momentum, reclaim, CVD, structure break)
 *
 * v2.2 - REAL L2 DATA:
 * - Real CVD from Binance WebSocket (trade-by-trade)
 * - OI history from Hyperliquid API
 * - Optimized parallel processing
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { computeM15Score, getSessionInfo as getM15SessionInfo, type M15TokenData, type M15ScoreResult } from '@/lib/m15-scoring';
import { VOL_WINDOWS } from '@/lib/constants';
import {
  fetchHLMeta,
  fetchHLTrades,
  fetchBinanceKlines,
  fetchBinanceOrderBook,
  computeMetricsFromKlines,
  computeCVD,
  computeOrderBookImbalance,
  mapHLToBinance,
} from '@/lib/multi-source-data';
import { fetchBatchInitialCVD, type CVDInitData } from '@/lib/binance-history';
import { fetchBatchOIMetrics, type OIMetrics } from '@/lib/hyperliquid-oi';
import { initializeBinanceWS, getCachedCVD } from '@/lib/binance-websocket';
import { useMultiAssetL2WebSocket } from '@/hooks/api/useHyperliquidL2WebSocket';
import { OFIBadge } from './OFIBadge';
import { ACFMiniChart } from './ACFMiniChart';
import { RVRegimeBadge } from './RVRegimeBadge';

const HL_API = 'https://api.hyperliquid.xyz/info';

type Timeframe = 'M5' | 'M15' | 'M30';

interface SessionInfo {
  name: string;
  score: number;
  active: boolean;
  end?: number;
  nextH?: number;
}

interface TokenScoreData extends M15TokenData {
  markPx: number;
}

interface ScoreCard {
  symbol: string;
  score: M15ScoreResult;
  price: number;
  funding: number;
  vol24h: number;
  oi: number;
  change24h: number;
  // OFI Autocorrelation fields
  ofiScore?: number;
  autoCorr?: number;
  acfDirection?: 'BUY' | 'SELL' | 'NEUTRAL';
  acfStrength?: 'STRONG' | 'MODERATE' | 'WEAK';
  pContinuation?: number;
  rvRegime?: 'LOW' | 'NORMAL' | 'HIGH' | 'EXPLOSIVE';
  depthImbalance?: number;
  spreadBps?: number;
  acfLags?: number[];
}

function getSessionInfo(): SessionInfo {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcT = utcH + utcM / 60;

  if (utcT >= 7 && utcT < 9)   return { name: 'EU Open',    score: 80,  active: true, end: 9 };
  if (utcT >= 13 && utcT < 17) return { name: 'EU/US Core', score: 100, active: true, end: 17 };
  if (utcT >= 17 && utcT < 20) return { name: 'US Extend',  score: 70,  active: true, end: 20 };
  if (utcT >= 1  && utcT < 4)  return { name: 'Asia',       score: 35,  active: false, end: 4 };

  let nextName = '', nextH = 0;
  if (utcT < 1)  { nextName = 'Asia';    nextH = 1; }
  else if (utcT >= 4 && utcT < 7)   { nextName = 'EU Open';    nextH = 7; }
  else if (utcT >= 9 && utcT < 13)  { nextName = 'EU/US Core'; nextH = 13; }
  else if (utcT >= 20)               { nextName = 'EU Open';    nextH = 31; };
  return { name: `Off (→ ${nextName} ${nextH % 24}h UTC)`, score: 0, active: false, nextH };
}

export default function TopTokensM15Monitor({ equity = 1000 }: { equity?: number }) {
  const [tokens, setTokens] = useState<ScoreCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLast] = useState<Date | null>(null);
  const [session, setSession] = useState<SessionInfo>(getSessionInfo());
  const [countdown, setCountdown] = useState('');
  const [timeframe, setTimeframe] = useState<Timeframe>('M15');
  const [equityInput, setEquity] = useState(equity);
  const [refreshCountdown, setRefreshCountdown] = useState(30);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // L2 WebSocket for OFI Engine
  const topSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX', 'SUI', 'ARB', 'OP', 'LINK'];
  const l2WebSocket = useMultiAssetL2WebSocket(topSymbols);

  const fetchTokens = useCallback(async () => {
    try {
      setLoading(true);

      // Fetch Hyperliquid metadata
      const hlRes = await fetch(HL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });
      const hlData = await hlRes.json();
      const meta = hlData[0]?.universe || [];
      const ctxs = hlData[1] || [];

      const sess = getSessionInfo();
      setSession(sess);

      // Process top tokens only
      const topSymbols = ['BTC', 'ETH', 'SOL', 'BNB', 'DOGE', 'AVAX', 'SUI', 'ARB', 'OP', 'LINK', 'WIF', 'PEPE', 'INJ', 'TIA', 'SEI'];

      // Fetch real L2 data in parallel (CVD + OI history)
      const [cvdData, oiData] = await Promise.all([
        fetchBatchInitialCVD(topSymbols),
        fetchBatchOIMetrics(topSymbols, new Map()),
      ]);

      // Initialize WebSocket for real-time CVD updates (first time only)
      if (typeof window !== 'undefined' && !(window as any).__binanceWSInitialized) {
        initializeBinanceWS(topSymbols);
        (window as any).__binanceWSInitialized = true;
      }

      // Prepare token data in parallel
      const tokenPromises = topSymbols.map(async (symbol) => {
        const idx = meta.findIndex((m: { name: string }) => m.name === symbol);
        if (idx === -1) return null;

        const ctx = ctxs[idx] || {};
        const price = parseFloat(ctx.markPx || 0);
        const funding = parseFloat(ctx.funding || 0) * 100;
        const vol24h = parseFloat(ctx.dayNtlVlm || 0);
        const oi = parseFloat(ctx.openInterest || 0) * price;
        const prevPx = parseFloat(ctx.prevDayPx || price);
        const change24h = prevPx > 0 ? ((price - prevPx) / prevPx) * 100 : 0;

        if (price === 0 || vol24h < 100_000) return null;

        const binanceSymbol = mapHLToBinance(symbol);

        // Parallel fetch all Binance data for this token
        const [klines5m, klines15m, orderBook] = await Promise.all([
          fetchBinanceKlines(binanceSymbol, '5m', 20).catch(() => []),
          fetchBinanceKlines(binanceSymbol, '15m', 50).catch(() => []),
          fetchBinanceOrderBook(binanceSymbol, 20).catch(() => null),
        ]);

        const metrics5m = computeMetricsFromKlines(klines5m);
        const metrics15m = computeMetricsFromKlines(klines15m);
        const obMetrics = orderBook ? computeOrderBookImbalance(orderBook) : {
          imbalance5: 50, imbalance10: 50, depth5: 0, depth10: 0, spread: 0
        };

        // Get real L2 data
        const cvd = cvdData.get(symbol) || { cvd5m: 50, cvd15m: 50, buyVol5m: 0, sellVol5m: 0, buyVol15m: 0, sellVol15m: 0 };
        const oiMetrics = oiData.get(symbol);
        const oiChange = oiMetrics?.change15m || 0;

        const tokenData: TokenScoreData = {
          symbol,
          price,
          funding,
          fundingRate: funding / 100,
          oi,
          oiChange,
          vol24h,
          change24h,
          markPx: price,
          spread: obMetrics.spread,
          bidAskImbalance: obMetrics.imbalance5,
          obDepth5: obMetrics.depth5,
          obDepth10: obMetrics.depth10,
          slippageEst: obMetrics.spread * 2,
          // REAL L2 DATA - from WebSocket/History
          cvd5m: cvd.cvd5m,
          cvd15m: cvd.cvd15m,
          cvdBuyVol5m: cvd.buyVol5m,
          cvdSellVol5m: cvd.sellVol5m,
          cvdBuyVol15m: cvd.buyVol15m,
          cvdSellVol15m: cvd.sellVol15m,
          deltaVolume: metrics5m.volume,
          vwapDist: metrics15m.vwap > 0 ? ((price - metrics15m.vwap) / price) : 0,
          atr5m: metrics5m.atr,
          atr15m: metrics15m.atr,
          atr1h: 0,
          realizedVol: metrics15m.atr / price,
          squeezeProb: metrics15m.atr > 0 ? Math.min(1, metrics15m.atr / price * 50) : 0,
        };

        const score = computeM15Score(tokenData, sess.score);

        return {
          symbol,
          score,
          price,
          funding,
          vol24h,
          oi,
          change24h,
        };
      });

      // Wait for all tokens to process
      const results = await Promise.all(tokenPromises);
      const tokenScores = results.filter((r): r is ScoreCard => r !== null);

      // Sort by final score
      tokenScores.sort((a, b) => b.score.finalScore - a.score.finalScore);
      setTokens(tokenScores.slice(0, 10));
      setLoading(false);
      setLast(new Date());
      setRefreshCountdown(30);
    } catch (err) {
      console.error('TopTokensM15Monitor fetch error:', err);
      setLoading(false);
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

  // Update tokens with real-time OFI data from L2 WebSocket
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

  const getActionColor = (action: string): string => {
    switch (action) {
      case 'READY': return '#22c55e';
      case 'WATCH': return '#f97316';
      case 'AVOID': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getDirectionColor = (dir: string): string => {
    switch (dir) {
      case 'LONG': return '#4ade80';
      case 'SHORT': return '#f87171';
      default: return '#64748b';
    }
  };

  const calcSize = (token: ScoreCard): string => {
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
            <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> Top Tokens M15 Monitor v2
            {/* L2 WebSocket Status */}
            <span className="ml-4 flex items-center gap-1.5 text-[0.6rem]">
              <span style={{
                width: '4px', height: '4px', borderRadius: '50%',
                background: l2WebSocket.connected ? '#22c55e' : '#ef4444',
                animation: l2WebSocket.connected ? 'pulse 2s infinite' : 'none'
              }} />
              <span style={{ color: l2WebSocket.connected ? '#22c55e' : '#ef4444' }}>
                L2 WS {l2WebSocket.connected ? 'ON' : 'OFF'}
              </span>
              {l2WebSocket.connected && Object.keys(l2WebSocket.ofiSignals).length > 0 && (
                <span style={{ color: '#64748b' }}>
                  ({Object.keys(l2WebSocket.ofiSignals).length})
                </span>
              )}
            </span>
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
            background: session.active ? '#22c55e22' : '#6b728022',
            borderColor: session.active ? '#22c55e' : '#6b7280',
            color: session.active ? '#22c55e' : '#6b7280',
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

      {/* Layer legend */}
      <div className="mb-3 px-3 py-2 bg-[#0d0d1a] border border-[#1e1e32] rounded flex flex-wrap gap-4 font-mono text-[0.6rem] text-[#5a6070]">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-[#3b82f6]" />
          <span>L1: Filters</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-[#8b5cf6]" />
          <span>L2: Setup</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded bg-[#ec4899]" />
          <span>L3: Confirm</span>
        </div>
        <span className="ml-auto">Score = L1×30% + L2×40% + L3×30%</span>
      </div>

      {/* OFI Legend */}
      {l2WebSocket.connected && (
        <div className="mb-3 px-3 py-1.5 bg-[#0a0a14] border border-[#1e1e32] rounded flex flex-wrap gap-3 font-mono text-[0.55rem] text-[#5a6070]">
          <span>🟢 OFI BUY = flux acheteur persistant</span>
          <span>🔴 OFI SELL = pression vendeuse</span>
          <span>ACF = autocorrélation lags 1-10</span>
          <span>p% = probabilité continuation</span>
          <span>VOL = régime volatilité réalisée</span>
          {l2WebSocket.connected && (
            <span className="ml-auto text-[#22c55e]">⚡ OFI temps réel</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-[#1e1e32] font-mono text-[0.6rem] text-[#5a6070] uppercase tracking-wider">
          <span>#</span>
          <span>Token</span>
          <span className="text-right">Score</span>
          <span className="text-right">L1</span>
          <span className="text-right">L2</span>
          <span className="text-right">L3</span>
          <span className="text-center">Action</span>
          <span className="text-center">Direction</span>
          <span className="text-center">OFI</span>
          <span className="text-center">ACF</span>
          <span className="text-center">VOL</span>
          <span className="text-right">Size</span>
        </div>

        {/* Body */}
        {loading ? (
          <div className="py-12 text-center font-mono text-[0.85rem] text-[#5a6070]">
            Loading tokens...
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto">
            {tokens.map((token, idx) => {
              const scoreColor = getScoreColor(token.score.finalScore);
              const actionColor = getActionColor(token.score.action);
              const directionColor = getDirectionColor(token.score.direction);
              const isExpanded = expandedRow === token.symbol;

              return (
                <div key={token.symbol}>
                  {/* Main row */}
                  <div
                    className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-[#1e1e32] hover:bg-[#1a1a2e] transition-colors font-mono text-[0.7rem] cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : token.symbol)}
                  >
                    <span className="font-semibold text-white">{idx + 1}</span>
                    <span className="font-semibold text-white">{token.symbol}</span>

                    {/* Final Score */}
                    <span className="text-right">
                      <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-semibold" style={{
                        background: scoreColor + '33',
                        border: `1px solid ${scoreColor}`,
                        color: scoreColor,
                      }}>
                        {token.score.finalScore}
                      </span>
                    </span>

                    {/* Layer scores */}
                    <span className="text-right tabular-nums text-[#3b82f6]">{token.score.layer1.score}</span>
                    <span className="text-right tabular-nums text-[#8b5cf6]">{token.score.layer2.total}</span>
                    <span className="text-right tabular-nums text-[#ec4899]">{token.score.layer3.total}</span>

                    {/* Action */}
                    <span className="text-center">
                      <span className="px-2 py-0.5 rounded text-[0.65rem] font-semibold" style={{
                        background: actionColor + '22',
                        border: `1px solid ${actionColor}`,
                        color: actionColor,
                      }}>
                        {token.score.action}
                      </span>
                    </span>

                    {/* Direction */}
                    <span className="text-center">
                      <span className="px-2 py-0.5 rounded text-[0.65rem] font-semibold" style={{
                        background: directionColor + '22',
                        border: `1px solid ${directionColor}`,
                        color: directionColor,
                      }}>
                        {token.score.direction}
                      </span>
                    </span>

                    {/* OFI Badge */}
                    <span className="text-center">
                      <OFIBadge
                        direction={token.acfDirection || 'NEUTRAL'}
                        strength={token.acfStrength || 'WEAK'}
                        pContinuation={token.pContinuation || 0.5}
                        ofiScore={token.ofiScore || 50}
                      />
                    </span>

                    {/* ACF MiniChart */}
                    <span className="text-center flex justify-center">
                      <ACFMiniChart lags={token.acfLags || []} width={60} height={20} />
                    </span>

                    {/* RV Regime Badge */}
                    <span className="text-center">
                      <RVRegimeBadge regime={token.rvRegime || 'NORMAL'} compact />
                    </span>

                    {/* Size */}
                    <span className="text-right text-white">{calcSize(token)}×</span>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 py-2 bg-[#0d0d1a] border-b border-[#1e1e32]">
                      <div className="grid grid-cols-3 gap-4 text-[0.65rem]">
                        {/* Layer 1 breakdown */}
                        <div>
                          <div className="font-semibold text-[#3b82f6] mb-1">L1: Hard Filters</div>
                          <div className="space-y-0.5 text-[#94a3b8]">
                            {token.score.layer1.reasons.map((r, i) => (
                              <div key={i}>{r}</div>
                            ))}
                          </div>
                        </div>

                        {/* Layer 2 breakdown */}
                        <div>
                          <div className="font-semibold text-[#8b5cf6] mb-1">L2: Setup</div>
                          <div className="space-y-0.5 text-[#94a3b8]">
                            {token.score.layer2.reasons.slice(0, 5).map((r, i) => (
                              <div key={i}>{r}</div>
                            ))}
                          </div>
                        </div>

                        {/* Layer 3 breakdown */}
                        <div>
                          <div className="font-semibold text-[#ec4899] mb-1">L3: Confirmation</div>
                          <div className="space-y-0.5 text-[#94a3b8]">
                            {token.score.layer3.reasons.slice(0, 5).map((r, i) => (
                              <div key={i}>{r}</div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Token metrics */}
                      <div className="mt-2 pt-2 border-t border-[#1e1e32] grid grid-cols-4 gap-2 text-[0.6rem] text-[#64748b]">
                        <div>Price: ${token.price < 1 ? token.price.toFixed(5) : token.price.toFixed(2)}</div>
                        <div>Funding: {token.funding > 0 ? '+' : ''}{token.funding.toFixed(4)}%</div>
                        <div>OI: {fmtVol(token.oi)}</div>
                        <div>Vol24h: {fmtVol(token.vol24h)}</div>
                      </div>

                      {/* Confidence scores */}
                      {token.score.confidenceScores && (
                        <div className="mt-2 pt-2 border-t border-[#1e1e32]">
                          <div className="font-semibold text-[#fbbf24] mb-1 text-[0.65rem]">Confidence Scores</div>
                          <div className="grid grid-cols-4 gap-3 text-[0.6rem]">
                            <div>
                              <div className="text-[#94a3b8]">L1 Confidence</div>
                              <div className="font-mono font-semibold text-white">{token.score.confidenceScores.l1}%</div>
                              <div className="text-[#64748b]">Pass: {token.score.confidenceScores.breakdown.l1.passRate}% | Margin: {token.score.confidenceScores.breakdown.l1.safetyMargin}%</div>
                            </div>
                            <div>
                              <div className="text-[#94a3b8]">L2 Confidence</div>
                              <div className="font-mono font-semibold text-white">{token.score.confidenceScores.l2}%</div>
                              <div className="text-[#64748b]">Coherence: {token.score.confidenceScores.breakdown.l2.coherence}% | Var: {token.score.confidenceScores.breakdown.l2.componentVariance}</div>
                            </div>
                            <div>
                              <div className="text-[#94a3b8]">L3 Confidence</div>
                              <div className="font-mono font-semibold text-white">{token.score.confidenceScores.l3}%</div>
                              <div className="text-[#64748b]">Align: {token.score.confidenceScores.breakdown.l3.signalAlignment}% | Str: {token.score.confidenceScores.breakdown.l3.confirmationStrength}%</div>
                            </div>
                            <div>
                              <div className="text-[#94a3b8]">Global Confidence</div>
                              <div className="font-mono font-semibold" style={{
                                color: token.score.confidenceScores.global >= 80 ? '#22c55e' :
                                       token.score.confidenceScores.global >= 60 ? '#f97316' : '#ef4444'
                              }}>{token.score.confidenceScores.global}%</div>
                              <div className="text-[#64748b]">Layer Align: {token.score.confidenceScores.breakdown.global.layerAlignment}% | Weakest: {token.score.confidenceScores.breakdown.global.weakestLink}%</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
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
        <span className="ml-auto">Click row for details · Multi-source data (HL + Binance)</span>
      </div>
    </div>
  );
}
