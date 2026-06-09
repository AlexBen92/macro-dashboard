'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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
}

interface CryptoSignal {
  symbol: string;
  composite: { overall: string; confidence: number; reasons: string[] };
  vwtsmom: { direction: string };
  funding: { signal: string };
  macd_consensus: string;
}

interface QuantRegime {
  hurst: number;
  regime: string;
  trend_score: number;
  efficiency: number;
  vol_regime: string;
  recommended_strategies: string[];
}

// ============================================================
// COMPONENTS
// ============================================================

function MacroCompact({ data }: { data: MacroData }) {
  return (
    <div className="grid grid-cols-5 gap-2 text-xs">
      <div className={`p-2 rounded border bg-gray-900/60 ${
        data.vix > 30 ? 'border-red-800' : data.vix > 25 ? 'border-yellow-800' : 'border-green-800'
      }`}>
        <div className="text-gray-500">VIX</div>
        <div className="text-lg font-bold">{data.vix.toFixed(1)}</div>
        <div className="text-[9px] text-gray-600">
          {data.vix > 30 ? 'HIGH' : data.vix > 25 ? 'ELEV' : 'OK'}
        </div>
      </div>
      <div className="p-2 rounded border border-gray-800 bg-gray-900/60">
        <div className="text-gray-500">DXY</div>
        <div className="text-lg font-bold">{data.dxy.toFixed(1)}</div>
        <div className="text-[9px] text-gray-600">USD STR</div>
      </div>
      <div className={`p-2 rounded border bg-gray-900/60 ${
        data.realRate < 0 ? 'border-green-800' : data.realRate > 2 ? 'border-red-800' : 'border-gray-800'
      }`}>
        <div className="text-gray-500">REAL RATE</div>
        <div className="text-lg font-bold">{data.realRate.toFixed(1)}%</div>
        <div className="text-[9px] text-gray-600">
          {data.realRate < 0 ? 'BULL CRYPTO' : 'NEUT'}
        </div>
      </div>
      <div className="p-2 rounded border border-gray-800 bg-gray-900/60">
        <div className="text-gray-500">YIELD 10Y</div>
        <div className="text-lg font-bold">{data.yield10y.toFixed(2)}%</div>
        <div className="text-[9px] text-gray-600">US TREASURY</div>
      </div>
      <div className={`p-2 rounded border bg-gray-900/60 ${
        data.nextEvent.hours < 24 ? 'border-yellow-800' : 'border-gray-800'
      }`}>
        <div className="text-gray-500">NEXT EVENT</div>
        <div className="text-sm font-bold truncate">{data.nextEvent.name}</div>
        <div className="text-[9px] text-yellow-400">{data.nextEvent.hours}h</div>
      </div>
    </div>
  );
}

function ScalpingCard({ signal, regime }: { signal: CryptoSignal; regime: QuantRegime | null }) {
  const action = signal.composite.overall === 'long' ? 'LONG' :
                 signal.composite.overall === 'short' ? 'SHORT' : 'WAIT';
  const actionColor = action === 'LONG' ? 'green' : action === 'SHORT' ? 'red' : 'gray';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`p-4 rounded-lg border bg-gray-900/60 ${
        action === 'LONG' ? 'border-green-800/50' :
        action === 'SHORT' ? 'border-red-800/50' : 'border-gray-800'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-lg">{signal.symbol}</span>
          <span className={`px-3 py-1 rounded text-xs font-bold bg-${actionColor}-900/50 text-${actionColor}-400`}>
            {action}
          </span>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Confidence</div>
          <div className="text-lg font-bold text-white">{signal.composite.confidence}%</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div className="text-center p-2 rounded bg-gray-800">
          <div className="text-gray-600">VW-TSMOM</div>
          <div className="font-bold text-white">{signal.vwtsmom?.direction?.slice(0, 4)?.toUpperCase?.() ?? '----'}</div>
        </div>
        <div className="text-center p-2 rounded bg-gray-800">
          <div className="text-gray-600">FUNDING</div>
          <div className="font-bold text-white">{signal.funding?.signal?.slice(0, 4)?.toUpperCase?.() ?? '----'}</div>
        </div>
        <div className="text-center p-2 rounded bg-gray-800">
          <div className="text-gray-600">MACD</div>
          <div className="font-bold text-white">{signal.macd_consensus?.slice(0, 4)?.toUpperCase?.() ?? '----'}</div>
        </div>
      </div>

      {signal.composite.reasons.length > 0 && (
        <div className="border-t border-gray-800 pt-2">
          <div className="text-[10px] text-gray-500 mb-1">REASONS</div>
          <div className="text-xs text-gray-400">
            {signal.composite.reasons.slice(0, 2).join(' · ')}
          </div>
        </div>
      )}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setError(null);
        const [macroRes, cryptoRes, regimeRes] = await Promise.all([
          fetch('/api/macro'),
          fetch('/api/crypto-signals-advanced'),
          fetch('/api/quant-regimes?symbol=BTC'),
        ]);

        if (!macroRes.ok || !cryptoRes.ok || !regimeRes.ok) {
          throw new Error('API error');
        }

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
      } catch (e) {
        console.error('Fetch error:', e);
        setError('Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Update clock
    const updateClock = () => {
      const now = new Date();
      const clockEl = document.getElementById('clock');
      if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
      }
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1a1a30] border-t-[#00e5ff] rounded-full animate-spin mx-auto mb-4" />
          <div className="text-gray-500">Loading scalping dashboard...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="text-center text-red-400">
          <div className="text-4xl mb-2">⚠️</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  const activeSignals = cryptoSignals.filter(s =>
    s.composite.overall === 'long' || s.composite.overall === 'short'
  );

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* HEADER */}
      <div className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur border-b border-gray-800">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-bold text-white tracking-widest">M15 SCALPING</h1>
              {regime && (
                <div className={`px-3 py-1 rounded-full text-xs font-bold ${
                  regime.regime === 'trend_following' ? 'bg-green-900/30 text-green-400 border border-green-800' :
                  regime.regime === 'mean_reverting' ? 'bg-purple-900/30 text-purple-400 border border-purple-800' :
                  regime.regime === 'volatile_chop' ? 'bg-red-900/30 text-red-400 border border-red-800' :
                  'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {regime.regime?.replace('_', ' ')?.toUpperCase?.() ?? 'RANDOM WALK'}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  macro && macro.vix < 30 && macro.nextEvent.hours > 2 ? 'bg-green-400' : 'bg-red-400'
                }`} />
                <span className="text-gray-500">MACRO</span>
              </div>
              <div className="text-gray-600">|</div>
              <div className="text-gray-500" id="clock">--:--:--</div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* MACRO INTELLIGENCE */}
        {macro && (
          <div>
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
              Macro Intelligence
            </div>
            <MacroCompact data={macro} />
          </div>
        )}

        {/* SIGNALS GRID */}
        <div>
          <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
            Active Signals ({activeSignals.length})
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {activeSignals.map((signal, i) => (
              <ScalpingCard key={i} signal={signal} regime={regime} />
            ))}
          </div>
        </div>

        {/* NO SIGNALS */}
        {activeSignals.length === 0 && (
          <div className="text-center py-16 border-2 border-dashed border-gray-800 rounded-lg">
            <div className="text-5xl mb-3">⏸️</div>
            <div className="text-xl font-bold text-gray-500">NO ACTIVE SIGNALS</div>
            <div className="text-sm text-gray-600 mt-2">
              {macro && macro.vix > 30 ? 'VIX elevated - reduce size' :
               regime && regime.regime === 'volatile_chop' ? 'Market choppy - wait' :
               'Waiting for setup...'}
            </div>
          </div>
        )}

        {/* REGIME INFO */}
        {regime && (
          <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/40">
            <div className="text-[10px] text-gray-600 uppercase tracking-wider mb-3">
              Regime Analysis
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-gray-600 text-xs">Hurst</div>
                <div className="font-mono text-white">{regime.hurst.toFixed(3)}</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs">Trend Score</div>
                <div className={`font-mono ${regime.trend_score > 0 ? 'text-green-400' : 'text-purple-400'}`}>
                  {regime.trend_score > 0 ? '+' : ''}{regime.trend_score}
                </div>
              </div>
              <div>
                <div className="text-gray-600 text-xs">Efficiency</div>
                <div className="font-mono text-white">{(regime.efficiency * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs">Vol Regime</div>
                <div className="font-mono text-white">{regime.vol_regime?.toUpperCase?.() ?? 'NORMAL'}</div>
              </div>
              <div>
                <div className="text-gray-600 text-xs">Strategy</div>
                <div className="font-mono text-green-400">
                  {regime.recommended_strategies[0] || 'WAIT'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ACADEMIC REFERENCES */}
        <div className="text-center">
          <div className="text-[10px] text-gray-700">
            Based on: Daniel (2024) VW-TSMOM · He (2024) Funding Divergence · Huang (2024) Regime Detection · Mesíček (2025) Multi-TF MACD
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0f]/95 border-t border-gray-800 px-4 py-2">
        <div className="flex items-center justify-between text-[10px] text-gray-600 max-w-7xl mx-auto">
          <div>Scalping M15 · Auto-refresh 30s</div>
          <div>
            <a href="/" className="hover:text-gray-500">← Back to Dashboard</a>
          </div>
        </div>
      </div>
    </div>
  );
}
