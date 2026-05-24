'use client';
import { motion } from 'framer-motion';

interface OpportunityOverviewProps {
  totalScore: number;
  bullishSignals: number;
  bearishSignals: number;
  neutralSignals: number;
  activeOpportunities: number;
}

export default function OpportunityOverview({
  totalScore,
  bullishSignals,
  bearishSignals,
  neutralSignals,
  activeOpportunities,
}: OpportunityOverviewProps) {
  const maxSignals = bullishSignals + bearishSignals + neutralSignals;
  const bullishPct = maxSignals > 0 ? (bullishSignals / maxSignals) * 100 : 0;
  const bearishPct = maxSignals > 0 ? (bearishSignals / maxSignals) * 100 : 0;
  const neutralPct = maxSignals > 0 ? (neutralSignals / maxSignals) * 100 : 0;

  const scoreColor = totalScore >= 65 ? '#00ff88' : totalScore >= 50 ? '#ffcc00' : '#ff4466';
  const scoreLabel = totalScore >= 65 ? 'BULLISH' : totalScore >= 40 ? 'NEUTRAL' : 'BEARISH';

  return (
    <section className="mb-6 p-4 rounded-xl border bg-[#0d0d1a] border-[#1a1a30]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white tracking-wide">
          ?? OPPORTUNITÉS DU MOMENT
        </h2>
        <span className="text-xs text-gray-500">{new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {/* Main score circle */}
      <div className="flex items-center gap-6">
        <div className="relative w-24 h-24 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#1a1a30" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="45"
              fill="none"
              stroke={scoreColor}
              strokeWidth="8"
              strokeDasharray={`${(totalScore / 100) * 283} 283`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-white">{totalScore}</span>
            <span className="text-[10px] text-gray-400">/ 100</span>
          </div>
        </div>

        {/* Stats */}
        <div className="flex-1 grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-[#12122a]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Sentiment</div>
            <div className="text-lg font-bold" style={{ color: scoreColor }}>{scoreLabel}</div>
            <div className="text-[9px] text-gray-600">basé sur {maxSignals} signaux</div>
          </div>

          <div className="p-3 rounded-lg bg-[#12122a]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Setups Actifs</div>
            <div className="text-lg font-bold text-white">{activeOpportunities}</div>
            <div className="text-[9px] text-gray-600">sur 20 coins trackés</div>
          </div>

          <div className="p-3 rounded-lg bg-[#12122a]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Bias Long</div>
            <div className="text-lg font-bold text-green-400">{bullishPct.toFixed(0)}%</div>
            <div className="text-[9px] text-gray-600">{bullishSignals} signaux</div>
          </div>

          <div className="p-3 rounded-lg bg-[#12122a]">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Bias Short</div>
            <div className="text-lg font-bold text-red-400">{bearishPct.toFixed(0)}%</div>
            <div className="text-[9px] text-gray-600">{bearishSignals} signaux</div>
          </div>
        </div>
      </div>

      {/* Signal distribution bar */}
      <div className="mt-4 h-2 bg-gray-800 rounded-full overflow-hidden flex">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${bullishPct}%` }}
          transition={{ duration: 0.5 }}
          className="h-full bg-green-500"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${neutralPct}%` }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="h-full bg-yellow-500"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${bearishPct}%` }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="h-full bg-red-500"
        />
      </div>
    </section>
  );
}
