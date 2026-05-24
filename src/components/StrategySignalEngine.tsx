'use client';
import { useEffect, useState, useCallback } from 'react';
import { VOL_WINDOWS, MIN_EDGE } from '@/lib/constants';

interface StrategySignal {
  symbol:        string;
  strategy:      string;
  direction:     'LONG' | 'SHORT' | 'NEUTRAL';
  confidence:    number;  // 0-100
  entryPrice:    number;
  stopLoss:      number;
  takeProfit:    number;
  rrRatio:       number;
  reasons:       string[];
  valid:         boolean;
}

const STRATEGIES = [
  { name: 'Funding Squeeze', weight: 0.30 },
  { name: 'OI Breakout',     weight: 0.25 },
  { name: 'Vol Alignment',   weight: 0.20 },
  { name: 'Momentum Sync',   weight: 0.15 },
  { name: 'Time Window',     weight: 0.10 },
] as const;

function computeSignals(
  meta: Array<{ name: string }>,
  ctxs: Array<Record<string, string>>
): StrategySignal[] {
  const signals: StrategySignal[] = [];
  const nowH = new Date().getUTCHours();
  const win = VOL_WINDOWS.find(w => nowH >= w.start && nowH < w.end);

  for (let i = 0; i < Math.min(meta.length, ctxs.length); i++) {
    const symbol = meta[i].name;
    const ctx = ctxs[i];
    if (!ctx) continue;

    const price   = parseFloat(ctx.markPx ?? '0');
    const funding = parseFloat(ctx.funding ?? '0');
    const oi      = parseFloat(ctx.openInterest ?? '0');
    const vol24h  = parseFloat(ctx.dayNtlVlm ?? '0');

    // Skip low OI
    if (oi < 1e8) continue;

    const reasons: string[] = [];
    let score = 0;
    let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

    // 1. Funding Squeeze
    const absFunding = Math.abs(funding);
    if (absFunding > 0.0004) {
      score += 30 * (absFunding / 0.001);
      if (funding < 0) {
        direction = 'LONG';
        reasons.push(`Funding négatif: ${(funding * 100).toFixed(4)}%`);
      } else {
        direction = 'SHORT';
        reasons.push(`Funding positif: +${(funding * 100).toFixed(4)}%`);
      }
    }

    // 2. OI Breakout
    if (oi > 5e8) {
      score += 25 * Math.min(oi / 2e9, 1);
      reasons.push(`OI élevé: $${(oi / 1e9).toFixed(2)}B`);
    }

    // 3. Vol Alignment
    if (win && win.score >= 0.7) {
      score += 20 * win.score;
      reasons.push(`Fenêtre active: ${win.label}`);
    } else if (!win) {
      score -= 10;
      reasons.push('Off-hours: vol faible');
    }

    // 4. Momentum
    const prevPrice = parseFloat(ctx.prevDayPx ?? '0');
    if (prevPrice > 0) {
      const change24h = ((price - prevPrice) / prevPrice) * 100;
      if (Math.abs(change24h) > 3) {
        score += 15 * Math.min(Math.abs(change24h) / 10, 1);
        if (change24h > 0 && direction === 'NEUTRAL') direction = 'LONG';
        if (change24h < 0 && direction === 'NEUTRAL') direction = 'SHORT';
        reasons.push(`Momentum 24h: ${change24h > 0 ? '+' : ''}${change24h.toFixed(2)}%`);
      }
    }

    // 5. Volume confirmation
    if (vol24h > 5e8) {
      score += 15 * Math.min(vol24h / 2e9, 1);
      reasons.push(`Volume 24h: $${(vol24h / 1e9).toFixed(2)}B`);
    }

    // Normalize score to 0-100
    const confidence = Math.min(Math.max(score, 0), 100);

    // Only include if minimum confidence
    if (confidence < 40) continue;

    // Calculate SL/TP based on ATR approximation (using 24h range as proxy)
    const atrProxy = price * 0.02; // 2% approx ATR
    let stopLoss, takeProfit;

    if (direction === 'LONG') {
      stopLoss = price - atrProxy * 1.5;
      takeProfit = price + atrProxy * 2.5;
    } else if (direction === 'SHORT') {
      stopLoss = price + atrProxy * 1.5;
      takeProfit = price - atrProxy * 2.5;
    } else {
      stopLoss = price;
      takeProfit = price;
    }

    const rrRatio = atrProxy > 0 ? (2.5 * atrProxy) / (1.5 * atrProxy) : 0;

    signals.push({
      symbol,
      strategy: 'Multi-Factor Composite',
      direction,
      confidence: Math.round(confidence),
      entryPrice: price,
      stopLoss,
      takeProfit,
      rrRatio: Math.round(rrRatio * 10) / 10,
      reasons,
      valid: confidence >= 60,
    });
  }

  return signals.sort((a, b) => b.confidence - a.confidence).slice(0, 8);
}

export default function StrategySignalEngine() {
  const [signals, setSignals]   = useState<StrategySignal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [ts, setTs]             = useState('');
  const [err, setErr]           = useState('');

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

      const computed = computeSignals(meta, ctxs);
      setSignals(computed);
      setTs(new Date().toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setErr('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  const validSignals = signals.filter(s => s.valid);
  const watchSignals = signals.filter(s => !s.valid);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            ⚡ Strategy Signal Engine
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Multi-factor composite · Confidence ≥60% = VALID · {ts}
          </p>
        </div>
        <button
          onClick={refresh}
          className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
        >
          ↻
        </button>
      </div>

      {err && (
        <div className="mb-3 p-2 bg-red-950/40 text-red-400 text-xs rounded border border-red-800/30">
          {err}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-900/60 rounded-xl animate-pulse border border-gray-800" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed border-gray-800 rounded-xl">
          <div className="text-3xl mb-2">🔇</div>
          <div className="text-lg font-bold text-gray-500">AUCUN SIGNAL</div>
          <div className="text-sm text-gray-600 mt-1">
            Aucun setup ne passe les filtres multi-factor
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Valid Signals */}
          {validSignals.length > 0 && (
            <div>
              <div className="text-xs font-mono text-green-400 mb-2 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                SIGNALS VALIDES ({validSignals.length})
              </div>
              <div className="space-y-2">
                {validSignals.map(s => (
                  <div
                    key={s.symbol}
                    className={`p-4 rounded-xl border ${
                      s.direction === 'LONG'
                        ? 'bg-green-950/20 border-green-800/40'
                        : 'bg-red-950/20 border-red-800/40'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-white">{s.symbol}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                          s.direction === 'LONG'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {s.direction}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${
                          s.confidence >= 80 ? 'text-green-400' : s.confidence >= 60 ? 'text-yellow-400' : 'text-gray-400'
                        }`}>
                          {s.confidence}%
                        </div>
                        <div className="text-[10px] text-gray-500">Confiance</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3 mb-2 text-xs font-mono">
                      <div>
                        <span className="text-gray-500">Entry:</span>{' '}
                        <span className="text-white">${s.entryPrice.toFixed(s.entryPrice > 1 ? 2 : 5)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">SL:</span>{' '}
                        <span className="text-red-400">${s.stopLoss.toFixed(s.stopLoss > 1 ? 2 : 5)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">TP:</span>{' '}
                        <span className="text-green-400">${s.takeProfit.toFixed(s.takeProfit > 1 ? 2 : 5)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">R:R:</span>{' '}
                        <span className="text-white">{s.rrRatio.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {s.reasons.map((r, i) => (
                        <span key={i} className="text-[10px] px-2 py-0.5 bg-black/30 rounded text-gray-300">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Watch Signals */}
          {watchSignals.length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs font-mono text-yellow-400 mb-2 flex items-center gap-2 list-none">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                SIGNALS SURVEILLANCE ({watchSignals.length})
              </summary>
              <div className="mt-2 space-y-2">
                {watchSignals.map(s => (
                  <div
                    key={s.symbol}
                    className="p-3 rounded-lg border border-yellow-900/30 bg-yellow-950/10"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-white">{s.symbol}</span>
                      <span className="text-xs text-yellow-400">{s.confidence}%</span>
                    </div>
                    <div className="text-[10px] text-gray-500 mt-1">
                      {s.direction} · {s.rrRatio.toFixed(1)}R · {s.reasons[0]}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-gray-600 text-center">
        Mis à jour toutes les 60s · SL/TP basés sur ATR proxy · Non-backtesté
      </p>
    </section>
  );
}
