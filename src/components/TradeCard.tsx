'use client';
import { motion } from 'framer-motion';
import type { TradeCandidate } from '@/lib/types';
import { fP, fPct, fF } from '@/lib/format';
import TimeframeBadge from './ui/TimeframeBadge';

export default function TradeCard({ trade, index }: { trade: TradeCandidate; index: number }) {
  const isLong = trade.dir === 'LONG';
  const isShort = trade.dir === 'SHORT';
  const accentColor = isLong ? '#00e5ff' : isShort ? '#ff006e' : '#ffaa00';
  const icon = isLong ? '▲' : isShort ? '▼' : '◆';
  const conf = trade.reasons.length;

  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ y: -2, boxShadow: `0 8px 30px ${accentColor}12` }}
      className="relative overflow-hidden rounded-xl border-2 border-[#1e1e32] bg-[#0e0e1a] transition-all"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <div className="p-6">
        {/* Row 1: Direction + Coin + Score */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-[2rem] font-bold" style={{ color: accentColor }}>
              {icon}
            </span>
            <span className="font-mono text-[1.6rem] font-bold text-[#eaeef4]">{trade.coin}</span>
            <TimeframeBadge tf="D1" />
          </div>
          <span className="font-mono text-[0.82rem] text-[#a0a8b8] px-3 py-1 border border-[#1e1e32] rounded-lg">
            Score {trade.score.toFixed(1)}
          </span>
        </div>

        {/* Row 2: Prices — EN GROS */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase tracking-wider mb-1">ENTRY</div>
            <div className="font-mono text-[1.1rem] font-bold text-[#eaeef4]">{fP(trade.vwap)}</div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">VWAP 24h</div>
          </div>
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase tracking-wider mb-1">STOP</div>
            <div className="font-mono text-[1.1rem] font-bold text-[#ff3355]">{fP(trade.twap)}</div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">TWAP 24h</div>
          </div>
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase tracking-wider mb-1">PRIX</div>
            <div className="font-mono text-[1.1rem] font-bold text-[#eaeef4]">{fP(trade.price)}</div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">Spot</div>
          </div>
        </div>

        {/* Row 3: Sizing */}
        <div className="font-mono text-[0.85rem] font-semibold text-[#ffaa00] mb-3 px-3 py-2 rounded-lg bg-[#ffaa00]/5 border border-[#ffaa00]/20">
          Taille : {trade.sizing}
        </div>

        {/* Row 4: Reasons */}
        <div className="flex flex-col gap-1.5 mb-4">
          {trade.reasons.map((reason, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.12 + 0.08 * i + 0.3 }}
              className="font-mono text-[0.78rem] text-[#a0a8b8] flex items-center gap-2"
            >
              <span className="text-[#4ade80] font-bold">✓</span> {reason}
            </motion.div>
          ))}
        </div>

        {/* Row 5: Footer metrics */}
        <div className="flex gap-5 font-mono text-[0.72rem] text-[#5a6070] pt-3 border-t border-[#1e1e32] flex-wrap">
          <div>
            <span className="text-[#8890a0]">VaR 95%</span>
            <div className="text-[#eaeef4] font-bold">{fPct(trade.var95)}</div>
          </div>
          <div>
            <span className="text-[#8890a0]">Funding</span>
            <div className="text-[#eaeef4] font-bold">{fF(trade.funding)}</div>
          </div>
          <div>
            <span className="text-[#8890a0]">Whales</span>
            <div className="text-[#eaeef4] font-bold">{trade.whaleCount}</div>
          </div>
          <div className="flex gap-1 items-end ml-auto">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className={`w-4 h-2 rounded-sm ${i < conf ? 'bg-[#4ade80]' : 'bg-[#1e1e32]'}`} />
            ))}
          </div>
        </div>
      </div>

      {/* Confidence bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(conf / 5) * 100}%` }}
        transition={{ delay: index * 0.12 + 0.5, duration: 0.8, ease: 'easeOut' }}
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${accentColor}, #4ade80)` }}
      />
    </motion.div>
  );
}
