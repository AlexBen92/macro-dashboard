'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface MacroData {
  vix?: number;
  dxy?: number;
  yield10y?: number;
  cpi?: number;
  nextEvent?: { name: string; hoursLeft: number; impact: string };
  upcomingEvents?: Array<{ name: string; impact: string; hoursLeft: number }>;
}

export default function MacroAdvancedPanel() {
  const [data, setData] = useState<MacroData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMacro = async () => {
      try {
        const res = await fetch('/api/macro');
        const json = await res.json();
        setData({
          vix: json.vix?.v,
          dxy: json.dxy?.v,
          yield10y: json.yield10y?.v,
          cpi: json.cpi?.v,
          nextEvent: json.nextEvent,
        });
      } catch (e) {
        console.error('Macro fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchMacro();
    const id = setInterval(fetchMacro, 60000);
    return () => clearInterval(id);
  }, []);

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

  // Calculs locaux pour l'affichage
  const recessionRisk = 'low';
  // CORRIGÉ: CPI est maintenant en pourcentage d'inflation, pas en valeur absolue
  const realRate = (data?.yield10y ?? 4) - (data?.cpi ?? 2.8);
  // Simple DXY trend calculation (would use history in production)
  const dxyTrend = 'neutral' as 'bullish' | 'bearish' | 'neutral';

  return (
    <section className="mb-8">
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
        {/* VIX */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">VIX</div>
          <div className="text-2xl font-bold text-white mt-1">
            {data?.vix?.toFixed(1) ?? '--'}
          </div>
          <div className={`text-[10px] mt-1 ${
            (data?.vix ?? 20) > 30 ? 'text-red-400' :
            (data?.vix ?? 20) > 25 ? 'text-yellow-400' : 'text-green-400'
          }`}>
            {(data?.vix ?? 20) > 30 ? 'ELEVATED' :
             (data?.vix ?? 20) > 25 ? 'MODERATE' : 'NORMAL'}
          </div>
        </motion.div>

        {/* DXY */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">DXY</div>
          <div className="text-2xl font-bold text-white mt-1">
            {data?.dxy?.toFixed(1) ?? '--'}
          </div>
          <div className={`text-[10px] mt-1 ${
            dxyTrend === 'bearish' ? 'text-green-400' :
            dxyTrend === 'bullish' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {dxyTrend === 'bearish' ? '↓ BEARISH (Bullish Crypto)' :
             dxyTrend === 'bullish' ? '↑ BULLISH (Bearish Crypto)' : '→ NEUTRAL'}
          </div>
        </motion.div>

        {/* Real Rates */}
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
            realRate < 0 ? 'text-green-400' :
            realRate < 1 ? 'text-green-300' :
            realRate < 2 ? 'text-yellow-400' :
            realRate < 3 ? 'text-orange-400' : 'text-red-400'
          }`}>
            {realRate < 0 ? 'NEGATIVE (Very Bullish)' :
             realRate < 1 ? 'LOW (Bullish)' :
             realRate < 2 ? 'NEUTRAL' :
             realRate < 3 ? 'MODERATE (Slight Bearish)' : 'HIGH (Bearish)'}
          </div>
        </motion.div>

        {/* Next Event */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={`p-3 rounded-lg border bg-gray-900/60 ${
            (data?.nextEvent?.hoursLeft ?? 999) < 24
              ? 'border-yellow-800/50 bg-yellow-950/20'
              : 'border-gray-800'
          }`}
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Next Event</div>
          <div className="text-sm font-bold text-white mt-1 truncate">
            {data?.nextEvent?.name ?? 'None'}
          </div>
          <div className={`text-[10px] mt-1 ${
            (data?.nextEvent?.hoursLeft ?? 999) < 24 ? 'text-yellow-400' : 'text-gray-400'
          }`}>
            {data?.nextEvent
              ? `${Math.floor(data.nextEvent.hoursLeft)}h left`
              : 'No upcoming events'}
          </div>
        </motion.div>
      </div>

      {/* US High Impact Economic Calendar */}
      {data?.upcomingEvents && data.upcomingEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-3 p-3 rounded-lg border border-gray-800 bg-gray-900/60"
        >
          <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">
            📅 US High Impact Events
          </div>
          <div className="space-y-1.5">
            {data.upcomingEvents.map((event, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={
                    event.impact === 'high' ? 'text-red-400' : 'text-yellow-400'
                  }>
                    {event.impact === 'high' ? '🔴' : '🟡'}
                  </span>
                  <span className="text-gray-300">{event.name}</span>
                </div>
                <span className={event.hoursLeft < 24 ? 'text-yellow-400' : 'text-gray-500'}>
                  {event.hoursLeft < 48
                    ? `${event.hoursLeft}h`
                    : `${Math.floor(event.hoursLeft / 24)}d`
                  }
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Macro Regime Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`mt-3 p-3 rounded-lg border text-center ${
          recessionRisk === 'low'
            ? 'border-green-800/30 bg-green-950/20'
            : recessionRisk === 'moderate'
            ? 'border-yellow-800/30 bg-yellow-950/20'
            : 'border-red-800/30 bg-red-950/20'
        }`}
      >
        <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
          Macro Regime
        </div>
        <div className={`text-lg font-bold ${
          recessionRisk === 'low'
            ? 'text-green-400'
            : recessionRisk === 'moderate'
            ? 'text-yellow-400'
            : 'text-red-400'
        }`}>
          {recessionRisk === 'low' ? '🟢 LOW RISK' :
           recessionRisk === 'moderate' ? '🟡 MODERATE RISK' : '🔴 HIGH RISK'}
        </div>
        <div className="text-[10px] text-gray-500 mt-1">
          Yield curve: {((data?.yield10y ?? 4) - 4).toFixed(2)}% ·
          VIX: {data?.vix?.toFixed(1) ?? '--'}
        </div>
      </motion.div>
    </section>
  );
}
