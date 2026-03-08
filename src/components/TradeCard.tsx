'use client';
import { motion } from 'framer-motion';
import type { TradeCandidate } from '@/lib/types';
import { fP, fPct, fF } from '@/lib/format';

export default function TradeCard({ trade, index }: { trade: TradeCandidate; index: number }) {
  const isLong = trade.dir === 'LONG';
  const isShort = trade.dir === 'SHORT';
  const isContrarian = trade.dir.includes('CONTRARIAN');
  const accentColor = isLong ? '#00e5ff' : isShort ? '#ff006e' : '#ffaa00';
  const bgGrad = isLong
    ? 'linear-gradient(135deg, rgba(0,229,255,0.03) 0%, transparent 60%)'
    : isShort
    ? 'linear-gradient(135deg, rgba(255,0,110,0.03) 0%, transparent 60%)'
    : 'linear-gradient(135deg, rgba(255,170,0,0.03) 0%, transparent 60%)';

  const conf = trade.reasons.length;
  const icon = isLong ? '▲' : isShort ? '▼' : '◆';

  return (
    <motion.div
      initial={{ x: -50, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ scale: 1.02, boxShadow: `0 0 30px ${accentColor}22` }}
      className="relative overflow-hidden rounded-lg border border-[#1a1a30] bg-[#0c0c16]"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor, background: bgGrad }}
    >
      {/* Confidence bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(conf / 5) * 100}%` }}
        transition={{ delay: index * 0.15 + 0.3, duration: 0.8, ease: 'easeOut' }}
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${accentColor}, #4ade80)` }}
      />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-2">
          <span className="font-mono text-[1.1rem] font-bold tracking-[2px]" style={{ color: accentColor }}>
            {icon} {trade.dir}
          </span>
          <span className="font-mono text-[1.3rem] font-bold">{trade.coin}</span>
          <span className="ml-auto font-mono text-[0.7rem] text-[#a0a0b8] px-2 py-0.5 border border-[#1a1a30] rounded-full">
            Score {trade.score.toFixed(1)}
          </span>
        </div>

        {/* Prices */}
        <div className="font-mono text-[0.78rem] text-[#a0a0b8] mb-1.5 leading-relaxed">
          <span className="text-[#e8e8f0]">{fP(trade.price)}</span> → Entry VWAP <span className="text-[#e8e8f0]">{fP(trade.vwap)}</span>
          <br />
          {trade.dir.includes('LONG') ? 'Stop sous' : 'Stop au-dessus'} TWAP <span className="text-[#e8e8f0]">{fP(trade.twap)}</span>
        </div>

        {/* Sizing */}
        <div className="font-mono text-[0.7rem] font-semibold text-[#ffaa00] mb-2">
          Taille : {trade.sizing}
        </div>

        {/* Reasons */}
        <div className="flex flex-col gap-1 mb-2.5">
          {trade.reasons.map((reason, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.15 + 0.1 * i + 0.4 }}
              className="font-mono text-[0.68rem] text-[#a0a0b8] flex items-center gap-1.5"
            >
              <span className="text-[#4ade80] font-bold text-[0.75rem]">✓</span> {reason}
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 font-mono text-[0.65rem] text-[#556680] pt-2 border-t border-[#1a1a30] flex-wrap">
          <span>VaR 95%: <b className="text-[#e8e8f0]">{fPct(trade.var95)}</b></span>
          <span>Funding: <b className="text-[#e8e8f0]">{fF(trade.funding)}</b></span>
          <span>Whales: <b className="text-[#e8e8f0]">{trade.whaleCount}</b></span>
          <div className="flex gap-0.5 items-center ml-auto">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className={`w-3 h-1.5 rounded-sm ${i < conf ? 'bg-[#4ade80]' : 'bg-[#1a1a30]'}`} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
