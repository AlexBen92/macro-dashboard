'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface RegimeData {
  hurst: {
    hurst_64: number;
    hurst_96: number;
    hurst_128: number;
    consensus: 'trending' | 'mean_reverting' | 'random_walk' | 'mixed';
    regime_score: number;
  };
  stationarity: {
    classification: 'stationary' | 'nonstationary' | 'mixed';
    confidence: number;
  };
  variance_ratio: {
    variance_ratio: number;
    regime: 'mean_reverting' | 'random_walk' | 'trending';
  };
  efficiency: {
    efficiency_ratio: number;
    choppiness_index: number;
    trend_strength: 'strong' | 'weak' | 'none';
  };
  composite: {
    overall_regime: 'trend_following' | 'mean_reverting' | 'random_walk' | 'volatile_chop';
    trend_score: number;
    confidence: number;
    recommended_strategies: string[];
    risk_multiplier: number;
  };
  volatility: {
    realized_vol: number;
    vol_percentile: number;
    vol_regime: 'low' | 'normal' | 'elevated' | 'extreme';
    range_position: number;
  };
}

export default function QuantRegimesPanel() {
  const [data, setData] = useState<RegimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('BTC');
  const [showAcademic, setShowAcademic] = useState(false);

  useEffect(() => {
    const fetchRegimes = async () => {
      try {
        const res = await fetch(`/api/quant-regimes?symbol=${symbol}`);
        const json = await res.json();
        setData(json);
      } catch (e) {
        console.error('Regimes fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchRegimes();
    const id = setInterval(fetchRegimes, 60000);
    return () => clearInterval(id);
  }, [symbol]);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/40">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="h-12 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  const composite = data?.composite;
  const vol = data?.volatility;

  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-white tracking-widest uppercase">
            📊 Quant Regime Detection
          </h2>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Hurst · Stationarity · Variance Ratio · Efficiency · Vol
          </p>
        </div>
        <div className="flex gap-2">
          {['BTC', 'ETH', 'SOL'].map((s) => (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={`px-2 py-1 rounded text-[10px] font-semibold ${
                symbol === s
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Main Regime Display */}
      {composite && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-4 p-4 rounded-xl border text-center ${
            composite.overall_regime === 'trend_following'
              ? 'bg-green-950/30 border-green-800/50'
              : composite.overall_regime === 'mean_reverting'
              ? 'bg-purple-950/30 border-purple-800/50'
              : composite.overall_regime === 'volatile_chop'
              ? 'bg-red-950/30 border-red-800/50'
              : 'bg-gray-900/40 border-gray-800'
          }`}
        >
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
            Market Regime
          </div>
          <div className={`text-2xl font-bold ${
            composite.overall_regime === 'trend_following'
              ? 'text-green-400'
              : composite.overall_regime === 'mean_reverting'
              ? 'text-purple-400'
              : composite.overall_regime === 'volatile_chop'
              ? 'text-red-400'
              : 'text-gray-400'
          }`}>
            {composite.overall_regime === 'trend_following' ? '📈 TREND FOLLOWING' :
             composite.overall_regime === 'mean_reverting' ? '🔄 MEAN REVERTING' :
             composite.overall_regime === 'volatile_chop' ? '🌪️ VOLATILE CHOP' : '🎲 RANDOM WALK'}
          </div>
          <div className="text-sm text-gray-400 mt-1">
            Trend Score: <span className={`font-bold ${
              composite.trend_score > 30 ? 'text-green-400' :
              composite.trend_score < -30 ? 'text-purple-400' : 'text-gray-400'
            }`}>{composite.trend_score > 0 ? '+' : ''}{composite.trend_score}</span>
            {' '}· Confidence: {composite.confidence}%
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Hurst Exponent */}
        {data?.hurst && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Hurst (H)</div>
            <div className="text-xl font-bold text-white mt-1">
              {data.hurst.hurst_64.toFixed(3)}
            </div>
            <div className={`text-[10px] mt-1 ${
              data.hurst.consensus === 'trending' ? 'text-green-400' :
              data.hurst.consensus === 'mean_reverting' ? 'text-purple-400' : 'text-gray-400'
            }`}>
              {data.hurst.consensus === 'trending' ? 'TRENDING' :
               data.hurst.consensus === 'mean_reverting' ? 'MEAN-REVERTING' : 'RANDOM WALK'}
            </div>
            <div className="text-[9px] text-gray-600 mt-1">
              H96: {data.hurst.hurst_96.toFixed(2)} · H128: {data.hurst.hurst_128.toFixed(2)}
            </div>
          </motion.div>
        )}

        {/* Stationarity */}
        {data?.stationarity && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Stationarity</div>
            <div className="text-xl font-bold text-white mt-1">
              {data.stationarity.classification === 'stationary' ? 'STATIONARY' :
               data.stationarity.classification === 'nonstationary' ? 'NON-STAT' : 'MIXED'}
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              {data.stationarity.confidence}% conf
            </div>
            <div className="text-[9px] text-gray-600 mt-1">
              ADF + KPSS tests
            </div>
          </motion.div>
        )}

        {/* Variance Ratio */}
        {data?.variance_ratio && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Variance Ratio</div>
            <div className="text-xl font-bold text-white mt-1">
              {data.variance_ratio.variance_ratio.toFixed(2)}
            </div>
            <div className={`text-[10px] mt-1 ${
              data.variance_ratio.regime === 'trending' ? 'text-green-400' :
              data.variance_ratio.regime === 'mean_reverting' ? 'text-purple-400' : 'text-gray-400'
            }`}>
              {data.variance_ratio.regime?.toUpperCase?.() ?? 'UNKNOWN'}
            </div>
            <div className="text-[9px] text-gray-600 mt-1">
              VR = 1 → Random Walk
            </div>
          </motion.div>
        )}

        {/* Efficiency */}
        {data?.efficiency && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
          >
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Efficiency</div>
            <div className="text-xl font-bold text-white mt-1">
              {(data.efficiency.efficiency_ratio * 100).toFixed(0)}%
            </div>
            <div className={`text-[10px] mt-1 ${
              data.efficiency.trend_strength === 'strong' ? 'text-green-400' :
              data.efficiency.trend_strength === 'weak' ? 'text-yellow-400' : 'text-red-400'
            }`}>
              {data.efficiency.trend_strength?.toUpperCase?.() ?? 'NONE'}
            </div>
            <div className="text-[9px] text-gray-600 mt-1">
              Choppiness: {data.efficiency.choppiness_index.toFixed(0)}
            </div>
          </motion.div>
        )}
      </div>

      {/* Volatility Regime */}
      {vol && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-3 grid grid-cols-2 gap-3"
        >
          <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/60">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Realized Vol</div>
            <div className="text-lg font-bold text-white mt-1">
              {vol.realized_vol.toFixed(1)}%
            </div>
            <div className="text-[10px] text-gray-400 mt-1">
              Percentile: {vol.vol_percentile.toFixed(0)}th
            </div>
          </div>
          <div className="p-3 rounded-lg border border-gray-800 bg-gray-900/60">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Range Position</div>
            <div className="text-lg font-bold text-white mt-1">
              {vol.range_position.toFixed(0)}%
            </div>
            <div className={`text-[10px] mt-1 ${
              vol.vol_regime === 'low' ? 'text-green-400' :
              vol.vol_regime === 'elevated' ? 'text-yellow-400' :
              vol.vol_regime === 'extreme' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {vol.vol_regime?.toUpperCase?.() ?? 'NORMAL'}
            </div>
          </div>
        </motion.div>
      )}

      {/* Recommended Strategies */}
      {composite && composite.recommended_strategies.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="mt-3 p-3 rounded-lg border border-gray-800 bg-gray-900/40"
        >
          <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">
            Recommended Strategies
          </div>
          <div className="flex flex-wrap gap-2">
            {composite.recommended_strategies.map((strategy, i) => (
              <span
                key={i}
                className="px-2 py-1 rounded bg-blue-900/30 text-blue-400 text-xs font-semibold"
              >
                {strategy}
              </span>
            ))}
            <span className="ml-auto px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs">
              Risk: ×{composite.risk_multiplier.toFixed(1)}
            </span>
          </div>
        </motion.div>
      )}

      {/* Academic References (collapsible) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-3"
      >
        <button
          onClick={() => setShowAcademic(!showAcademic)}
          className="text-[10px] uppercase tracking-wider text-gray-600 hover:text-gray-400 transition-colors mb-2 flex items-center gap-1"
        >
          📚 Academic References {showAcademic ? '▼' : '▶'}
        </button>
        {showAcademic && (
          <div className="p-2 rounded-lg border border-gray-800 bg-gray-900/20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[9px] text-gray-500">
              <div>Hurst (1951) — Long-term memory</div>
              <div>Lo (1991) — Modified R/S</div>
              <div>Lo-MacKinlay (1988) — Variance Ratio</div>
              <div>Kaufman — Efficiency Ratio</div>
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
