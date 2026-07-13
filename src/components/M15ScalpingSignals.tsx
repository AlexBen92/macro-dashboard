'use client';

import { useState, useEffect, useCallback } from 'react';
import { VOL_WINDOWS, MIN_EDGE, HL_TAKER_FEE, HL_MAKER_FEE, HL_ROUND_TRIP } from '@/lib/constants';

interface M15Signal {
  symbol: string;
  price: number;
  funding: number;
  oi: number;
  vol24h: number;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  edgeNet: number;      // net edge per M30 candle
  edgeRt: number;       // round-trip edge vs fees
  signalStrength: number; // 0-100
  sessionOk: boolean;
  volWindow: string;
  signals: string[];
  entrySignal: 'STRONG_LONG' | 'LONG' | 'NEUTRAL' | 'SHORT' | 'STRONG_SHORT' | 'WAIT';
  slDist: number;      // suggested SL distance in %
  tp1: number;         // TP1 in %
  tp2: number;         // TP2 in %
  riskReward: string;
}

function currentVolWindow() {
  const h = new Date().getUTCHours();
  return VOL_WINDOWS.find(w => h >= w.start && h < w.end) ?? null;
}

function classifyBias(funding: number): 'LONG' | 'SHORT' | 'NEUTRAL' {
  if (funding < -0.0002) return 'SHORT';  // V21 §D2/A1: funding neg = bearish continuation
  if (funding > 0.0002) return 'LONG';   // V21 §D2/A1: funding pos = bullish continuation
  return 'NEUTRAL';
}

function computeM15Signals(ctx: Record<string, string>, win: (typeof VOL_WINDOWS)[number] | null): M15Signal {
  const symbol = ctx.name ?? 'UNKNOWN';
  const price = parseFloat(ctx.markPx ?? '0');
  const funding = parseFloat(ctx.funding ?? '0');
  const oi = parseFloat(ctx.openInterest ?? '0');
  const vol24h = parseFloat(ctx.dayNtlVlm ?? '0');

  const absFunding = Math.abs(funding);
  const bias = classifyBias(funding);

  // Edge calculations
  const edgePerM30 = absFunding / 16;
  const edgeNet = edgePerM30 - HL_TAKER_FEE;
  const edgeRt = (edgePerM30 * 2) - HL_ROUND_TRIP; // round-trip (entry+exit)

  // Signal strength calculation
  let strength = 0;
  const signals: string[] = [];

  // 1. Session score (40%)
  if (win) {
    strength += win.score * 40;
    signals.push(`⏰ ${win.label} (${(win.score * 100).toFixed(0)}/100)`);
  } else {
    signals.push('⬜ Off-session');
  }

  // 2. Carry théorique (30%) — edge net non validé (V25 §2.1: OFI×Funding NULL, R²<4%)
  const fundingRatio = edgeNet / MIN_EDGE;
  if (fundingRatio >= 1) {
    strength += 30;
    signals.push(`• Carry ${fundingRatio.toFixed(1)}× (non validé)`);
  } else if (fundingRatio >= 0.5) {
    strength += 15;
    signals.push(`• Carry ${fundingRatio.toFixed(1)}× (non validé)`);
  } else {
    signals.push(`• Carry ${(fundingRatio * 100).toFixed(1)}% (non validé)`);
  }

  // 3. Liquidity (20%)
  const oiScore = Math.min(oi / 2e9, 1);
  const volScore = Math.min(vol24h / 5e8, 1);
  strength += (oiScore * 10 + volScore * 10);
  if (oi > 1e9) signals.push(`🔥 OI $${(oi / 1e9).toFixed(2)}B`);
  if (vol24h > 5e8) signals.push(`📊 Vol $${(vol24h / 1e9).toFixed(2)}B`);

  // 4. Bias alignment (10%)
  if (bias === 'LONG' && funding < -0.0003) {
    strength += 10;
    signals.push('📈 Carry Long Strong');
  } else if (bias === 'SHORT' && funding > 0.0003) {
    strength += 10;
    signals.push('📉 Carry Short Strong');
  }

  // Entry signal determination
  let entrySignal: M15Signal['entrySignal'] = 'WAIT';
  if (win && win.score >= 0.7 && fundingRatio >= 1) {
    if (bias === 'LONG' && funding < -0.0003) {
      entrySignal = strength >= 80 ? 'STRONG_LONG' : 'LONG';
    } else if (bias === 'SHORT' && funding > 0.0003) {
      entrySignal = strength >= 80 ? 'STRONG_SHORT' : 'SHORT';
    } else if (strength >= 70) {
      entrySignal = bias === 'LONG' ? 'LONG' : bias === 'SHORT' ? 'SHORT' : 'NEUTRAL';
    }
  }

  // Risk calculations (proxy ATR ~0.5% for crypto)
  const atrProxy = 0.005;
  const slDist = Math.max(0.004, atrProxy * 0.75); // max(0.4%, 0.75×ATR)
  const tp1 = slDist * 1.0;  // R:R 1:1
  const tp2 = slDist * 2.0;  // R:R 1:2

  return {
    symbol,
    price,
    funding,
    oi,
    vol24h,
    bias,
    edgeNet,
    edgeRt,
    signalStrength: Math.round(strength),
    sessionOk: (win?.score ?? 0) >= 0.7,
    volWindow: win?.label ?? 'Off-hours',
    signals,
    entrySignal,
    slDist: slDist * 100,
    tp1: tp1 * 100,
    tp2: tp2 * 100,
    riskReward: `1:${tp1 / slDist}`,
  };
}

export default function M15ScalpingSignals() {
  const [signals, setSignals] = useState<M15Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState('');
  const [err, setErr] = useState('');
  const win = currentVolWindow();

  const refresh = useCallback(async () => {
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

      const processed: M15Signal[] = [];
      for (let i = 0; i < meta.length; i++) {
        const ctx = ctxs[i] ?? {};
        if (parseFloat(ctx.openInterest ?? '0') < 5e6) continue; // OI filter

        const signal = computeM15Signals({ name: meta[i].name, ...ctx }, win);
        if (signal.signalStrength >= 40) { // Only show relevant signals
          processed.push(signal);
        }
      }

      // Sort by signal strength
      processed.sort((a, b) => b.signalStrength - a.signalStrength);

      setSignals(processed.slice(0, 10)); // Top 10
      setTs(new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setErr('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [win]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const signalColor = (sig: M15Signal['entrySignal']) => {
    switch (sig) {
      case 'STRONG_LONG': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'LONG': return 'bg-green-500/10 text-green-300 border-green-500/30';
      case 'STRONG_SHORT': return 'bg-red-500/20 text-red-400 border-red-500/50';
      case 'SHORT': return 'bg-red-500/10 text-red-300 border-red-500/30';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            ⚡ M15 Scalping Signals
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Signaux scalping M15 · Session filter + Edge net · {ts}
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
        >
          ↻
        </button>
      </div>

      {/* Session banner */}
      <div className={`mb-4 px-3 py-2 rounded-lg text-xs border flex items-center gap-2 ${
        win && win.score >= 0.7
          ? 'border-green-700/40 bg-green-950/20 text-green-300'
          : win
          ? 'border-yellow-700/40 bg-yellow-950/20 text-yellow-300'
          : 'border-gray-700 bg-gray-900/30 text-gray-500'
      }`}>
        <span>{win ? `● ${win.label}` : '○ Off-session'}</span>
        {win ? (
          <>
            <span className="opacity-70">{win.start}h–{win.end}h UTC</span>
            <span className="ml-auto">
              {win.score >= 0.7 ? '✅ Trading M15 OK' : '⚠️ Vol faible'}
            </span>
          </>
        ) : (
          <span className="ml-auto">Prochaine fenêtre: EU Open 7h UTC</span>
        )}
      </div>

      {/* Fee reference bar */}
      <div className="mb-4 px-3 py-2 rounded-lg bg-gray-900 border border-gray-800 flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
        <span>Maker <span className="text-green-400 font-mono">−{(HL_MAKER_FEE * 100).toFixed(3)}%</span></span>
        <span>Taker <span className="text-yellow-400 font-mono">+{(HL_TAKER_FEE * 100).toFixed(3)}%</span></span>
        <span>RT min <span className="text-red-400 font-mono">{(HL_ROUND_TRIP * 100).toFixed(2)}%</span></span>
        <span className="ml-auto">SL ≈ max(0.4%, 0.75×ATR) · TP1 = 1R · TP2 = 2R</span>
      </div>

      {err && (
        <div className="mb-3 p-2 bg-red-950/40 text-red-400 text-xs rounded border border-red-800/30">
          {err}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 bg-gray-900/60 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="py-8 text-center text-gray-500 text-sm">
          Aucun signal M15 détecté
        </div>
      ) : (
        <div className="space-y-2">
          {/* Header */}
          <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 font-mono text-[10px] text-gray-500 uppercase tracking-wider">
            <span>Signal</span>
            <span>Asset</span>
            <span className="text-right">Strength</span>
            <span className="text-right">Edge RT</span>
            <span className="text-right">SL/TP</span>
            <span className="text-right">Bias</span>
          </div>

          {/* Rows */}
          {signals.map(s => (
            <div
              key={s.symbol}
              className={`grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr] gap-2 px-3 py-2 rounded-lg border transition-all hover:brightness-110 ${
                s.signalStrength >= 70 ? 'bg-gray-800/80' : 'bg-gray-900/40'
              }`}
              style={{ borderColor: s.signalStrength >= 70 ? '#4ade8044' : '#5a607044' }}
            >
              {/* Entry Signal */}
              <div className={`px-2 py-1 rounded text-xs font-semibold border ${signalColor(s.entrySignal)}`}>
                {s.entrySignal === 'STRONG_LONG' && '🚀 STRG LONG'}
                {s.entrySignal === 'LONG' && '📈 LONG'}
                {s.entrySignal === 'STRONG_SHORT' && '💥 STRG SHRT'}
                {s.entrySignal === 'SHORT' && '📉 SHORT'}
                {s.entrySignal === 'NEUTRAL' && '⬜ NEUTRAL'}
                {s.entrySignal === 'WAIT' && '⏳ WAIT'}
              </div>

              {/* Symbol */}
              <div className="font-mono text-sm text-white">{s.symbol}</div>

              {/* Strength */}
              <div className="text-right">
                <div className="font-mono text-sm text-white">{s.signalStrength}/100</div>
                {s.signalStrength >= 80 && <div className="text-[9px] text-green-400">HIGH</div>}
                {s.signalStrength >= 60 && s.signalStrength < 80 && <div className="text-[9px] text-yellow-400">STRONG</div>}
              </div>

              {/* Edge RT */}
              <div className="text-right">
                <div className="font-mono text-sm" style={{ color: s.edgeRt >= 0 ? '#4ade80' : '#ff3355' }}>
                  {s.edgeRt >= 0 ? '+' : ''}{(s.edgeRt * 100).toFixed(3)}%
                </div>
                <div className="text-[9px] text-gray-500">vs RT fees</div>
              </div>

              {/* SL/TP */}
              <div className="text-right">
                <div className="font-mono text-xs text-gray-300">
                  SL {s.slDist.toFixed(2)}%
                </div>
                <div className="font-mono text-[10px] text-gray-500">
                  TP1 {s.tp1.toFixed(2)}% · TP2 {s.tp2.toFixed(2)}%
                </div>
              </div>

              {/* Bias */}
              <div className="text-right">
                <div className={`px-2 py-0.5 rounded text-xs font-mono ${
                  s.bias === 'LONG' ? 'bg-green-500/20 text-green-400' :
                  s.bias === 'SHORT' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {s.bias}
                </div>
                <div className="text-[9px] text-gray-500 mt-0.5">
                  {(s.funding * 100).toFixed(4)}% fund
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Signals breakdown */}
      {signals.length > 0 && signals[0].signals.length > 0 && (
        <div className="mt-3 p-3 rounded-lg bg-gray-900/40 border border-gray-800">
          <div className="text-xs text-gray-500 mb-2">Top signal breakdown:</div>
          <div className="flex flex-wrap gap-1">
            {signals[0].signals.map((s, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 bg-black/30 rounded text-gray-300 border border-gray-700/30">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 text-[11px] text-gray-600 text-center">
        M15 scalping = micro-moves 0.2–0.5% avec stops serrés · SL max(0.4%, 0.75×ATR) · TP1 = 1R · TP2 = 2R
      </p>
    </section>
  );
}
