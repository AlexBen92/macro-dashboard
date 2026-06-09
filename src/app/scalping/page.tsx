'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================================
// TYPES
// ============================================================

interface MacroData {
  vix: number;
  dxy: number;
  yield10y: number;
  cpi: number;
  realRate: number;
  nextEvent: { name: string; hours: number };
  recessionRisk: 'low' | 'moderate' | 'high';
}

interface CryptoSignal {
  symbol: string;
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  vwtsmom: { direction: string; confidence: number };
  funding: { signal: string; strength: string };
  regime: string;
  macd_consensus: string;
  composite: { overall: string; confidence: number };
}

interface QuantRegime {
  hurst: number;
  regime: 'trend_following' | 'mean_reverting' | 'random_walk' | 'volatile_chop';
  trend_score: number;
  efficiency: number;
  vol_regime: string;
  recommended_strategies: string[];
}

interface ScalpingSignal {
  symbol: string;
  entry: string;
  sl: string;
  tp: string;
  rr: number;
  confidence: number;
  action: 'LONG' | 'SHORT' | 'WAIT';
  reasons: string[];
}

// ============================================================
// COMPONENTS
// ============================================================

function MacroCompact({ data }: { data: MacroData }) {
  const riskColor = data.recessionRisk === 'low' ? 'green' : data.recessionRisk === 'moderate' ? 'yellow' : 'red';

  return (
    <div className="grid grid-cols-5 gap-2 text-xs">
      <div className={`p-2 rounded border bg-gray-900/60 ${data.vix > 30 ? 'border-red-800' : data.vix > 25 ? 'border-yellow-800' : 'border-green-800'}`}>
        <div className="text-gray-500">VIX</div>
        <div className="text-lg font-bold">{data.vix.toFixed(1)}</div>
        <div className="text-[9px] text-gray-600">{data.vix > 30 ? 'HIGH' : data.vix > 25 ? 'ELEV' : 'OK'}</div>
      </div>
      <div className="p-2 rounded border border-gray-800 bg-gray-900/60">
        <div className="text-gray-500">DXY</div>
        <div className="text-lg font-bold">{data.dxy.toFixed(1)}</div>
        <div className="text-[9px] text-gray-600">USD STR</div>
      </div>
      <div className={`p-2 rounded border bg-gray-900/60 ${data.realRate < 0 ? 'border-green-800' : data.realRate > 2 ? 'border-red-800' : 'border-gray-800'}`}>
        <div className="text-gray-500">REAL RATE</div>
        <div className="text-lg font-bold">{data.realRate.toFixed(1)}%</div>
        <div className="text-[9px] text-gray-600">{data.realRate < 0 ? 'BULL CRYPTO' : 'NEUT'}</div>
      </div>
      <div className="p-2 rounded border border-gray-800 bg-gray-900/60">
        <div className="text-gray-500">YIELD 10Y</div>
        <div className="text-lg font-bold">{data.yield10y.toFixed(2)}%</div>
        <div className="text-[9px] text-gray-600">US TREASURY</div>
      </div>
      <div className={`p-2 rounded border bg-gray-900/60 ${data.nextEvent.hours < 24 ? 'border-yellow-800' : 'border-gray-800'}`}>
        <div className="text-gray-500">NEXT EVENT</div>
        <div className="text-sm font-bold truncate">{data.nextEvent.name}</div>
        <div className="text-[9px] text-yellow-400">{data.nextEvent.hours}h</div>
      </div>
    </div>
  );
}

function RegimeBadge({ regime, trendScore }: { regime: string; trendScore: number }) {
  const colors = {
    trend_following: 'green',
    mean_reverting: 'purple',
    volatile_chop: 'red',
    random_walk: 'gray',
  };
  const color = colors[regime as keyof typeof colors] || 'gray';

  return (
    <div className="flex items-center gap-3">
      <div className={`px-3 py-1 rounded-full bg-${color}-900/30 border border-${color}-800 text-${color}-400 text-xs font-bold`}>
        {regime.replace('_', ' ').toUpperCase()}
      </div>
      <div className="text-xs text-gray-500">
        Trend: <span className={trendScore > 0 ? 'text-green-400' : 'text-purple-400'}>{trendScore > 0 ? '+' : ''}{trendScore}</span>
      </div>
    </div>
  );
}

function ScalpingCard({ signal }: { signal: ScalpingSignal }) {
  const actionColor = signal.action === 'LONG' ? 'green' : signal.action === 'SHORT' ? 'red' : 'gray';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-3 rounded-lg border bg-gray-900/60 ${
        signal.action === 'LONG' ? 'border-green-800/50' :
        signal.action === 'SHORT' ? 'border-red-800/50' : 'border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-white">{signal.symbol}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold bg-${actionColor}-900/50 text-${actionColor}-400`}>
            {signal.action}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].slice(0, Math.floor(signal.confidence / 20)).map(i => (
            <div key={i} className="w-1 h-1 rounded-full bg-green-400" />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <div className="text-center p-1 rounded bg-gray-800">
          <div className="text-gray-600">ENTRY</div>
          <div className="font-mono text-white">{signal.entry}</div>
        </div>
        <div className="text-center p-1 rounded bg-gray-800">
          <div className="text-gray-600">SL</div>
          <div className="font-mono text-red-400">{signal.sl}</div>
        </div>
        <div className="text-center p-1 rounded bg-gray-800">
          <div className="text-gray-600">TP</div>
          <div className="font-mono text-green-400">{signal.tp}</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <div className="text-gray-500">R:R {signal.rr.toFixed(1)}x</div>
        <div className="text-gray-600">{signal.reasons.slice(0, 2).join(' · ')}</div>
      </div>
    </motion.div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function ScalpingPage() {
  const [macro, setMacro] = useState<MacroData | null>(null);
  const [cryptoSignals, setCryptoSignals] = useState<CryptoSignal[]>([]);
  const [regime, setRegime] = useState<QuantRegime | null>(null);
  const [scalpingSignals, setScalpingSignals] = useState<ScalpingSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [macroRes, cryptoRes, regimeRes] = await Promise.all([
          fetch('/api/macro'),
          fetch('/api/crypto-signals-advanced'),
          fetch('/api/quant-regimes?symbol=BTC'),
        ]);

        const macroData = await macroRes.json();
        const cryptoData = await cryptoRes.json();
        const regimeData = await regimeRes.json();

        setMacro({
          vix: macroData.vix?.v ?? 20,
          dxy: macroData.dxy?.v ?? 104,
          yield10y: macroData.yield10y?.v ?? 4.5,
          cpi: macroData.cpi?.v ?? 3.2,
          realRate: (macroData.yield10y?.v ?? 4.5) - (macroData.cpi?.v ?? 3.2),
          nextEvent: macroData.nextEvent ?? { name: 'None', hours: 999 },
          recessionRisk: 'low',
        });

        if (cryptoData.signals) {
          setCryptoSignals(cryptoData.signals);
        }

        setRegime({
          hurst: regimeData.hurst?.hurst_64 ?? 0.5,
          regime: regimeData.composite?.overall_regime ?? 'random_walk',
          trend_score: regimeData.composite?.trend_score ?? 0,
          efficiency: regimeData.efficiency?.efficiency_ratio ?? 0.5,
          vol_regime: regimeData.volatility?.vol_regime ?? 'normal',
          recommended_strategies: regimeData.composite?.recommended_strategies ?? [],
        });

        // Generate scalping signals based on all data
        const signals: ScalpingSignal[] = [];
        if (cryptoData.signals) {
          for (const sig of cryptoData.signals) {
            if (sig.composite.overall === 'long' || sig.composite.overall === 'short') {
              const action = sig.composite.overall === 'long' ? 'LONG' : 'SHORT';
              signals.push({
                symbol: sig.symbol,
                entry: 'MARKET',
                sl: '-0.4%',
                tp: '+0.8%',
                rr: 2.0,
                confidence: sig.composite.confidence,
                action,
                reasons: sig.composite.reasons || [],
              });
            }
          }
        }
        setScalpingSignals(signals);
      } catch (e) {
        console.error('Fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-gray-500">Loading scalping dashboard...</div>
      </div>
    );
  }

  const activeSignals = scalpingSignals.filter(s => s.action !== 'WAIT');
  const hasActiveSignals = activeSignals.length > 0;
  const macroSafe = macro && macro.vix < 30 && macro.nextEvent.hours > 2;
  const regimeFavorable = regime && (regime.regime === 'trend_following' || regime.regime === 'mean_reverting');

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800">
        <div className="px-4 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-sm font-bold text-white tracking-widest">M15 SCALPING</h1>
              {regime && <RegimeBadge regime={regime.regime} trendScore={regime.trend_score} />}
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${macroSafe ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-gray-500">MACRO</span>
              </div>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${regimeFavorable ? 'bg-green-400' : 'bg-yellow-400'}`} />
                <span className="text-gray-500">REGIME</span>
              </div>
              <div className="text-gray-600">|</div>
              <div className="text-gray-500" id="clock">--:--</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* MACRO INTELLIGENCE */}
        {macro && (
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Macro Intelligence</div>
            <MacroCompact data={macro} />
          </div>
        )}

        {/* MAIN SIGNAL GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {activeSignals.map((signal, i) => (
            <ScalpingCard key={i} signal={signal} />
          ))}
        </div>

        {/* NO SIGNALS STATE */}
        {activeSignals.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-gray-800 rounded-lg">
            <div className="text-4xl mb-2">⏸️</div>
            <div className="text-lg font-bold text-gray-500">NO ACTIVE SIGNALS</div>
            <div className="text-sm text-gray-600 mt-1">
              {macro && macro.vix > 30 ? 'VIX elevated - reduce size' :
               regime && regime.regime === 'volatile_chop' ? 'Market choppy - wait' :
               'Waiting for setup...'}
            </div>
          </div>
        )}

        {/* REGIME ANALYSIS */}
        {regime && (
          <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/40">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Regime Analysis</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-gray-600">Hurst</div>
                <div className="font-mono">{regime.hurst.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-gray-600">Efficiency</div>
                <div className="font-mono">{(regime.efficiency * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-gray-600">Vol Regime</div>
                <div className="font-mono">{regime.vol_regime.toUpperCase()}</div>
              </div>
              <div>
                <div className="text-gray-600">Strategy</div>
                <div className="text-green-400">{regime.recommended_strategies[0] || 'WAIT'}</div>
              </div>
            </div>
          </div>
        )}

        {/* ACADEMIC SIGNALS TABLE */}
        {cryptoSignals.length > 0 && (
          <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/40">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Academic Signals</div>
            <div className="space-y-2">
              {cryptoSignals.map((sig, i) => (
                <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-gray-800/50">
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{sig.symbol}</span>
                    <span className={`px-2 py-0.5 rounded ${
                      sig.composite.overall === 'long' ? 'bg-green-900/30 text-green-400' :
                      sig.composite.overall === 'short' ? 'bg-red-900/30 text-red-400' : 'bg-gray-700 text-gray-400'
                    }`}>
                      {sig.composite.overall.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-gray-600">
                    <span>VW: {sig.vwtsmom.direction.slice(0, 4).toUpperCase()}</span>
                    <span>Fund: {sig.funding.signal.slice(0, 4).toUpperCase()}</span>
                    <span>MACD: {sig.macd_consensus.slice(0, 4).toUpperCase()}</span>
                    <span className="text-gray-500">{sig.composite.confidence}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* FOOTER STATUS */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0f]/95 border-t border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <div className="flex items-center gap-4">
            <span>Scalping M15 · Auto-refresh 30s</span>
            <span className="text-gray-700">|</span>
            <span>Hurst · VW-TSMOM · Funding Divergence</span>
          </div>
          <div>
            Based on: Daniel (2024) · He (2024) · Huang (2024) · Mesíček (2025)
          </div>
        </div>
      </div>
    </div>
  );
}
