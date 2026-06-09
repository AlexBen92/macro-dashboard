'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';

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
  vwtsmom: { direction: string; confidence: number };
  funding: { signal: string; strength: string };
  regime: string;
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

function MacroIntelligence({ data }: { data: MacroData }) {
  const recessionRisk = 'low';
  const realRate = data.yield10y - data.cpi;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            🏛️ Macro Intelligence
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Yield Curve · DXY · Real Rates · Regime Detection
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">VIX</div>
          <div className="text-2xl font-bold text-white mt-1">
            {data.vix.toFixed(1)}
          </div>
          <div className={`text-[10px] mt-1 ${
            data.vix > 30 ? 'text-red-400' : data.vix > 25 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {data.vix > 30 ? 'ELEVATED' : data.vix > 25 ? 'MODERATE' : 'NORMAL'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">DXY</div>
          <div className="text-2xl font-bold text-white mt-1">
            {data.dxy.toFixed(1)}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            USD Strength
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Real Rate</div>
          <div className="text-2xl font-bold text-white mt-1">
            {realRate.toFixed(1)}%
          </div>
          <div className={`text-[10px] mt-1 ${
            realRate < 0 ? 'text-green-400' : realRate < 1.5 ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {realRate < 0 ? 'NEGATIVE' : realRate < 1.5 ? 'LOW' : 'HIGH'}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`p-3 rounded-lg border bg-gray-900/60 ${
            data.nextEvent.hours < 24 ? 'border-yellow-800/50 bg-yellow-950/20' : 'border-gray-800'
          }`}
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Next Event</div>
          <div className="text-sm font-bold text-white mt-1 truncate">
            {data.nextEvent.name}
          </div>
          <div className={`text-[10px] mt-1 ${
            data.nextEvent.hours < 24 ? 'text-yellow-400' : 'text-gray-400'
          }`}>
            {Math.floor(data.nextEvent.hours)}h left
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`mt-3 p-3 rounded-lg border text-center ${
          recessionRisk === 'low'
            ? 'border-green-800/30 bg-green-950/20'
            : 'border-yellow-800/30 bg-yellow-950/20'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          Macro Regime
        </div>
        <div className={`text-lg font-bold ${
          recessionRisk === 'low' ? 'text-green-400' : 'text-yellow-400'
        }`}>
          {recessionRisk === 'low' ? '🟢 LOW RISK' : '🟡 MODERATE RISK'}
        </div>
      </motion.div>
    </section>
  );
}

function CryptoSignalsCard({ signals }: { signals: CryptoSignal[] }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            🧠 Academic Signals
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            VW-TSMOM · Funding Divergence · Regime Detection
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {signals.map((signal, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`p-4 rounded-lg border ${
              signal.composite.overall === 'long'
                ? 'bg-green-950/20 border-green-800/40'
                : signal.composite.overall === 'short'
                ? 'bg-red-950/20 border-red-800/40'
                : 'bg-gray-900/40 border-gray-800'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">{signal.symbol}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  signal.composite.overall === 'long'
                    ? 'bg-green-500/20 text-green-400'
                    : signal.composite.overall === 'short'
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {signal.composite.overall.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-gray-500">{signal.composite.confidence}%</div>
            </div>

            <div className="text-[10px] text-gray-400">
              {signal.composite.reasons.slice(0, 2).join(' · ')}
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function QuantRegimesCard({ regime }: { regime: QuantRegime }) {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            📊 Quant Regime Detection
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Hurst · Stationarity · Variance Ratio · Efficiency
          </p>
        </div>
      </div>

      <div className={`p-4 rounded-lg border text-center mb-3 ${
        regime.regime === 'trend_following'
          ? 'bg-green-950/30 border-green-800/50'
          : regime.regime === 'mean_reverting'
          ? 'bg-purple-950/30 border-purple-800/50'
          : 'bg-gray-900/40 border-gray-800'
      }`}>
        <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
          Market Regime
        </div>
        <div className={`text-xl font-bold ${
          regime.regime === 'trend_following'
            ? 'text-green-400'
            : regime.regime === 'mean_reverting'
            ? 'text-purple-400'
            : 'text-gray-400'
        }`}>
          {regime.regime === 'trend_following' ? '📈 TREND FOLLOWING' :
           regime.regime === 'mean_reverting' ? '🔄 MEAN REVERTING' :
           regime.regime === 'volatile_chop' ? '🌪️ VOLATILE CHOP' : '🎲 RANDOM WALK'}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/60 text-center">
          <div className="text-[10px] text-gray-500 uppercase">Hurst</div>
          <div className="text-lg font-bold text-white">{regime.hurst.toFixed(3)}</div>
        </div>
        <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/60 text-center">
          <div className="text-[10px] text-gray-500 uppercase">Efficiency</div>
          <div className="text-lg font-bold text-white">{(regime.efficiency * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/60 text-center">
          <div className="text-[10px] text-gray-500 uppercase">Vol Regime</div>
          <div className="text-lg font-bold text-white">{regime.vol_regime.toUpperCase()}</div>
        </div>
        <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/60 text-center">
          <div className="text-[10px] text-gray-500 uppercase">Strategy</div>
          <div className="text-sm font-bold text-green-400">
            {regime.recommended_strategies[0] || 'WAIT'}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function Home() {
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
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#06060a] flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-[#1a1a30] border-t-[#00e5ff] rounded-full animate-spin mx-auto mb-4" />
          <div className="font-mono text-[0.8rem] text-[#556680] tracking-[3px]">MACRO STACK</div>
          <div className="font-mono text-[0.6rem] text-[#1a1a30] mt-1">Loading...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#06060a] flex items-center justify-center">
        <div className="text-center text-red-400">
          <div className="text-4xl mb-2">⚠️</div>
          <div>{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#06060a]">
      {/* NAV */}
      <nav className="flex items-center gap-3 px-6 py-2.5 bg-[#06060a] border-b border-[#1a1a30]">
        <span className="font-mono text-[0.85rem] font-bold text-[#556680] tracking-[3px] mr-4">
          MACRO STACK
        </span>
        <Link href="/crypto" className="relative">
          <span className="font-mono text-[0.9rem] font-semibold px-4 py-1.5 rounded transition-colors text-[#556680] hover:text-[#e8e8f0]">
            CRYPTO
          </span>
        </Link>
        <Link href="/scalping" className="relative">
          <span className="font-mono text-[0.9rem] font-semibold px-4 py-1.5 rounded transition-colors text-[#00e5ff] hover:text-[#00e5ff]">
            SCALPING
          </span>
        </Link>
      </nav>

      <div className="v4-container px-4 py-8 max-w-6xl mx-auto">
        {/* MACRO INTELLIGENCE */}
        {macro && <MacroIntelligence data={macro} />}

        {/* CRYPTO SIGNALS */}
        {cryptoSignals.length > 0 && <CryptoSignalsCard signals={cryptoSignals} />}

        {/* QUANT REGIMES */}
        {regime && <QuantRegimesCard regime={regime} />}

        {/* ACADEMIC REFERENCES */}
        <div className="mt-6 p-3 rounded-lg border border-gray-800 bg-gray-900/20">
          <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">
            📚 Academic References
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] text-gray-500">
            <div>Daniel (2024) — VW-TSMOM</div>
            <div>He (2024) — Funding Divergence</div>
            <div>Huang (2024) — Regime Detection</div>
            <div>Mesíček (2025) — Multi-TF MACD</div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex items-center gap-3 px-6 py-1.5 border-t border-[#1e1e32] bg-[#0e0e1a] font-mono text-[0.65rem] text-[#5a6070]">
        <span>Macro Dashboard v2.0</span>
        <span className="flex-1" />
        <span>Auto-refresh 60s</span>
      </div>
    </div>
  );
}
