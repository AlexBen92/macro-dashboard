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
import { getGARCHEngine, type GARCHForecast } from '@/lib/garch-volatility';
import { GARCHBadge } from './GARCHBadge';
import { VolProjection } from './VolProjection';
// New Decision Engine imports
import { getGARCHEngine as getNewGARCHEngine, type GARCHOutput } from '@/lib/garch-engine';
import { getFlickerDetector, computeExecutionScore, type ExecutionScore } from '@/lib/execution-score';
import { computeDecision, type DecisionOutput, extractDirectionFromACF } from '@/lib/scalp-decision';
import { GARCHCard } from './GARCHCard';
import { DecisionCard } from './DecisionCard';
import { GARCHRegimeBadge } from './GARCHRegimeBadge';
import { StyleBadge } from './StyleBadge';

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
  // GARCH Volatility Regime fields
  garchForecast?: GARCHForecast;
  garchRegime?: 'COMPRESSED' | 'NORMAL' | 'ELEVATED' | 'EXPLOSIVE';
  garchVolRatio?: number;
  garchPhi?: number;
  sizeMultiplier?: number;
  allowedStyles?: ('TREND' | 'MEANREV' | 'SCALP' | 'NONE')[];
  // New Decision Engine fields
  garchOutput?: GARCHOutput;
  execScore?: ExecutionScore;
  decision?: DecisionOutput;
  scalpScore?: number;
  directionScore?: number;
  executionScore?: number;
  regimeScore?: number;
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

        // Update old GARCH with recent price change
        const garchEngine = getGARCHEngine(token.symbol);
        const return_pct = (token.change24h / 100) / Math.max(1, token.score.layer1.score); // approx return
        garchEngine.update(return_pct);

        const garchForecast = garchEngine.forecast();

        // ── NEW: Decision Engine Integration ────────────────────────

        // 1. Update new GARCH engine
        const newGarchEngine = getNewGARCHEngine(token.symbol);
        const garchOutput = newGarchEngine.update(return_pct);

        // 2. Execution Score
        const execMetrics = {
          spreadBps: signal.spreadBps ?? 2,
          topBidDepth: 100000, // default
          topAskDepth: 100000, // default
          depthRatio: signal.depthImbalance > 0
            ? (1 + signal.depthImbalance) / (1 - signal.depthImbalance)
            : 1,
          flickerCount: 0, // TODO: from FlickerDetector
          refillScore: 0.7, // default
        };
        const execScore = computeExecutionScore(execMetrics);

        // 3. Direction Input
        const dirInput = {
          ofiScore: signal.ofiScore ?? 50,
          autoCorr: signal.autoCorr ?? 50,
          pContinuation: signal.pContinuation ?? 0.5,
          vwapDeviation: 0, // TODO: from token data
          fundingSignal: 50, // TODO: from layer1
          oiSignal: 50, // TODO: from layer1
          acfDirection: signal.acfDirection ?? 'NEUTRAL',
        };

        // 4. Decision Engine
        const decision = computeDecision(dirInput, execScore, garchOutput);

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
          // Old GARCH fields
          garchForecast,
          garchRegime: garchForecast.regime,
          garchVolRatio: garchForecast.vol_ratio,
          garchPhi: garchForecast.phi,
          sizeMultiplier: garchForecast.size_multiplier,
          allowedStyles: garchForecast.allowed_styles,
          // New Decision Engine fields
          garchOutput,
          execScore,
          decision,
          scalpScore: decision.scalpScore,
          directionScore: decision.directionScore,
          executionScore: decision.executionScore,
          regimeScore: decision.regimeScore,
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
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-[#1e1e32] font-mono text-[0.6rem] text-[#5a6070] uppercase tracking-wider">
          <span>#</span>
          <span>Token</span>
          <span className="text-right">Scalp</span>
          <span className="text-center">Dir</span>
          <span className="text-center">Exec</span>
          <span className="text-center">Vol</span>
          <span className="text-center">Style</span>
          <span className="text-right">Size×</span>
          <span className="text-center">Verdict</span>
          <span className="text-center">L1</span>
          <span className="text-center">L2</span>
          <span className="text-center">L3</span>
          <span className="text-center">OFI</span>
          <span className="text-center">ACF</span>
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
                    className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 border-b border-[#1e1e32] hover:bg-[#1a1a2e] transition-colors font-mono text-[0.7rem] cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : token.symbol)}
                  >
                    <span className="font-semibold text-white">{idx + 1}</span>
                    <span className="font-semibold text-white">{token.symbol}</span>

                    {/* ScalpScore */}
                    <span className="text-right">
                      <span className="font-semibold" style={{
                        color: (token.scalpScore ?? 0) >= 75 ? '#00ff88'
                             : (token.scalpScore ?? 0) >= 55 ? '#ffaa00' : '#ff4444',
                        fontSize: 13
                      }}>
                        {token.scalpScore ?? '—'}
                      </span>
                    </span>

                    {/* Direction from decision */}
                    <span className="text-center">
                      <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-semibold" style={{
                        background: token.decision?.direction === 'LONG' ? '#22c55e22' :
                                   token.decision?.direction === 'SHORT' ? '#ef444422' : '#6b728022',
                        border: `1px solid ${token.decision?.direction === 'LONG' ? '#22c55e' :
                                   token.decision?.direction === 'SHORT' ? '#ef4444' : '#6b7280'}`,
                        color: token.decision?.direction === 'LONG' ? '#22c55e' :
                               token.decision?.direction === 'SHORT' ? '#ef4444' : '#6b7280',
                      }}>
                        {token.decision?.direction ?? 'FLAT'}
                      </span>
                    </span>

                    {/* Execution Score */}
                    <span className="text-center">
                      <span className="px-1.5 py-0.5 rounded text-[0.6rem] font-semibold" style={{
                        color: token.execScore?.label === 'CLEAN'  ? '#00ff88' :
                             token.execScore?.label === 'AVOID'  ? '#ff4444' : '#ffaa00',
                      }}>
                        {token.execScore?.label ?? '—'}
                      </span>
                    </span>

                    {/* Vol Regime */}
                    <span className="text-center">
                      <GARCHRegimeBadge output={token.garchOutput} compact />
                    </span>

                    {/* Style */}
                    <span className="text-center">
                      {token.decision && <StyleBadge style={token.decision.allowed_style} compact />}
                    </span>

                    {/* Size Multiplier */}
                    <span className="text-right">
                      <span style={{
                        color: (token.decision?.size_mult ?? 0) === 0 ? '#ff4444'
                             : (token.decision?.size_mult ?? 1) < 0.6 ? '#ffaa00' : '#00ff88',
                        fontFamily: 'monospace', fontWeight: 700
                      }}>
                        ×{((token.decision?.size_mult ?? 1) * 100).toFixed(0)}%
                      </span>
                    </span>

                    {/* Verdict */}
                    <span className="text-center" style={{ fontSize: 14 }}>
                      {token.decision?.verdictEmoji ?? '—'}
                    </span>

                    {/* Layer scores */}
                    <span className="text-right tabular-nums text-[#3b82f6]">{token.score.layer1.score}</span>
                    <span className="text-right tabular-nums text-[#8b5cf6]">{token.score.layer2.total}</span>
                    <span className="text-right tabular-nums text-[#ec4899]">{token.score.layer3.total}</span>

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
                      <ACFMiniChart lags={token.acfLags || []} width={50} height={18} />
                    </span>
                  </div>

                  {/* Expanded details - 4-card layout */}
                  {isExpanded && (
                    <div className="px-3 py-2 bg-[#0d0d1a] border-b border-[#1e1e32]">
                      <div className="grid grid-cols-2 gap-3 text-[0.65rem]">
                        {/* Card 1 — Signal (OFI) */}
                        <div className="bg-[#111] rounded-lg p-3">
                          <div className="text-[#888] mb-2 text-[0.7rem]">🎯 SIGNAL (OFI)</div>
                          <OFIBadge
                            direction={token.acfDirection || 'NEUTRAL'}
                            strength={token.acfStrength || 'WEAK'}
                            pContinuation={token.pContinuation || 0.5}
                            ofiScore={token.ofiScore || 50}
                          />
                          <div className="mt-2"><ACFMiniChart lags={token.acfLags ?? []} width={180} height={32} /></div>
                          <div className="text-[#666] mt-2 text-[0.6rem]">
                            VWAP dev: {(token.decision?.directionScore ?? 0).toFixed(1)}% · Fund: {token.funding > 0 ? '+' : ''}{token.funding.toFixed(4)}%
                          </div>
                        </div>

                        {/* Card 2 — GARCH Volatility */}
                        {token.garchOutput && <GARCHCard output={token.garchOutput} asset={token.symbol} />}

                        {/* Card 3 — Execution */}
                        <div className="bg-[#111] rounded-lg p-3">
                          <div className="text-[#888] mb-2 text-[0.7rem]">⚙️ EXECUTION</div>
                          {token.execScore && (
                            <>
                              <div className="text-[0.8rem] font-bold" style={{
                                color: token.execScore.label === 'CLEAN' ? '#00ff88' :
                                       token.execScore.label === 'AVOID' ? '#ff4444' : '#ffaa00'
                              }}>
                                {token.execScore.label}
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2">
                                {[
                                  { label: 'Spread', value: `${token.spreadBps?.toFixed(1) ?? '—'}bps` },
                                  { label: 'Depth',  value: token.execScore.depthOk ? '✅ OK' : '⚠️ THIN' },
                                  { label: 'Spoof',  value: token.execScore.spoofy ? '⚠️ YES' : '✅ NO' },
                                  { label: 'Score',  value: `${Math.round(token.execScore.raw)}/100` },
                                ].map(({ label, value }) => (
                                  <div key={label} className="bg-[#0a0a0f] rounded p-2">
                                    <div className="text-[#666] text-[0.55rem]">{label}</div>
                                    <div className="text-[#ccc] text-[0.7rem]">{value}</div>
                                  </div>
                                ))}
                              </div>
                            </>
                          )}
                        </div>

                        {/* Card 4 — Decision Engine */}
                        {token.decision && <DecisionCard decision={token.decision} />}
                      </div>
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
