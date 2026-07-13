'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ActionabilityBadge from '@/components/ui/ActionabilityBadge';

interface SignalDisplay {
  name: string;
  value: string;
  status: 'bullish' | 'bearish' | 'neutral';
  strength: number;
  reason: string;
}

export default function CryptoAdvancedSignals() {
  const [signals, setSignals] = useState<SignalDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState('');

  useEffect(() => {
    const fetchSignals = async () => {
      try {
        const res = await fetch('/api/crypto-signals-advanced');
        const data = await res.json();

        setSignals(data.signals ?? []);
        setLastUpdate(new Date().toLocaleTimeString('fr-FR', {
          timeZone: 'Europe/Paris',
          hour: '2-digit',
          minute: '2-digit',
        }));
      } catch (e) {
        console.error('Signals fetch error:', e);
        setSignals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSignals();
    const id = setInterval(fetchSignals, 30000);
    return () => clearInterval(id);
  }, []);

  const overallStatus = signals.length > 0
    ? signals.every(s => s.status === 'bearish')
      ? 'bearish'
      : signals.every(s => s.status === 'bullish')
      ? 'bullish'
      : 'mixed'
    : 'neutral';

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            🧠 Academic Signals Engine
          </h2>
          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>VW-TSMOM · Funding Divergence · Regime Detection · Last: {lastUpdate}</span>
            <ActionabilityBadge variant="actionable" note="VW-TSMOM backtesté" />
            <ActionabilityBadge variant="validation" note="Funding Divergence NULL (V21 §D2)" />
            <ActionabilityBadge variant="informational" note="Regime = filtre" />
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-900/60 rounded-xl animate-pulse border border-gray-800" />
          ))}
        </div>
      ) : signals.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-800 rounded-xl">
          <div className="text-3xl mb-2">⏳</div>
          <div className="text-lg font-bold text-gray-500">Chargement...</div>
        </div>
      ) : (
        <>
          {/* Overall Status Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-4 p-4 rounded-xl border text-center ${
              overallStatus === 'bullish'
                ? 'bg-green-950/30 border-green-800/50'
                : overallStatus === 'bearish'
                ? 'bg-red-950/30 border-red-800/50'
                : 'bg-yellow-950/20 border-yellow-800/30'
            }`}
          >
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">
              Consensus Académique
            </div>
            <div className={`text-xl font-bold ${
              overallStatus === 'bullish'
                ? 'text-green-400'
                : overallStatus === 'bearish'
                ? 'text-red-400'
                : 'text-yellow-400'
            }`}>
              {overallStatus === 'bullish' ? '🟢 BULLISH' :
               overallStatus === 'bearish' ? '🔴 BEARISH' : '🟡 MIXED'}
            </div>
          </motion.div>

          {/* Signals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <AnimatePresence>
              {signals.map((signal, idx) => (
                <motion.div
                  key={signal.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-4 rounded-xl border ${
                    signal.status === 'bullish'
                      ? 'bg-green-950/20 border-green-800/40'
                      : signal.status === 'bearish'
                      ? 'bg-red-950/20 border-red-800/40'
                      : 'bg-gray-900/40 border-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{signal.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        signal.status === 'bullish'
                          ? 'bg-green-500/20 text-green-400'
                          : signal.status === 'bearish'
                          ? 'bg-red-500/20 text-red-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {signal.status?.toUpperCase?.() ?? 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Strength indicator */}
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-1.5 rounded-full ${
                            i <= signal.strength / 20
                              ? signal.status === 'bullish'
                                ? 'bg-green-400'
                                : signal.status === 'bearish'
                                ? 'bg-red-400'
                                : 'bg-gray-400'
                              : 'bg-gray-800'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-lg font-bold text-white mb-2">
                    {signal.value}
                  </div>

                  <div className="text-[10px] text-gray-400">
                    {signal.reason}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Academic References */}
          <div className="mt-3 p-3 rounded-lg border border-gray-800 bg-gray-900/30">
            <div className="text-[10px] uppercase tracking-wider text-gray-600 mb-2">
              📚 References Académiques
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] text-gray-500">
              <div>• Daniel, Moskowitz (2024) — VW-TSMOM</div>
              <div>• He, Manela, Ross (2024) — Funding Divergence</div>
              <div>• Huang, Sangiorgi (2024) — Regime Detection</div>
              <div>• Mesíček, Vojtko (2025) — Multi-TF MACD</div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
