'use client';
import { motion } from 'framer-motion';
import type { FtmoTrade } from '@/lib/ftmo/types';

function fmtPrice(instrument: string, p: number): string {
  if (instrument === 'XAUUSD') return '$' + p.toFixed(1);
  if (instrument.includes('JPY')) return p.toFixed(2);
  if (instrument === 'NAS100' || instrument === 'US30') return p.toFixed(0);
  return p.toFixed(4);
}

export default function FtmoTradeCard({ trade, index }: { trade: FtmoTrade; index: number }) {
  const isLong = trade.direction === 'LONG';
  const accentColor = isLong ? '#4ade80' : '#ff006e';
  const icon = isLong ? '▲' : '▼';

  return (
    <motion.div
      initial={{ x: -40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ scale: 1.01, boxShadow: `0 0 20px ${accentColor}22` }}
      className="border border-[#1a1a30] rounded-lg bg-[#0c0c16] overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      {/* Confidence bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(trade.confidence / 5) * 100}%` }}
        transition={{ delay: index * 0.12 + 0.3, duration: 0.8 }}
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${accentColor}, #00e5ff)` }}
      />

      <div className="p-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[1rem] font-bold tracking-[1px]" style={{ color: accentColor }}>
            {icon} {trade.direction}
          </span>
          <span className="font-mono text-[1.1rem] font-bold">{trade.instrument}</span>
          <span className="ml-auto font-mono text-[0.55rem] text-[#556680] px-1.5 py-0.5 border border-[#1a1a30] rounded">
            {trade.strategy}
          </span>
        </div>

        {/* Prices */}
        <div className="font-mono text-[0.68rem] text-[#a0a0b8] mb-1 leading-relaxed">
          Entry: <span className="text-[#e8e8f0]">{fmtPrice(trade.instrument, trade.entry)}</span> |
          Stop: <span className="text-[#ff3355]">{fmtPrice(trade.instrument, trade.stop)}</span> |
          TP1: <span className="text-[#4ade80]">{fmtPrice(trade.instrument, trade.tp1)}</span>
          {trade.tp2 && <> | TP2: <span className="text-[#4ade80]">{fmtPrice(trade.instrument, trade.tp2)}</span></>}
        </div>

        {/* Lot sizing */}
        <div className="font-mono text-[0.65rem] font-semibold text-[#d4a017] mb-1.5">
          Lot: {trade.lots.toFixed(2)} | Risque: ${trade.riskUsd} ({trade.riskPct.toFixed(2)}%) | R:R {trade.rrRatio.toFixed(1)}
        </div>

        {/* Reasons */}
        <div className="flex flex-col gap-0.5 mb-2">
          {trade.reasons.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.12 + 0.1 * i + 0.4 }}
              className="font-mono text-[0.6rem] text-[#a0a0b8] flex items-center gap-1"
            >
              <span className="text-[#4ade80] font-bold">✓</span> {r}
            </motion.div>
          ))}
        </div>

        {/* Confidence dots */}
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className={`w-3 h-1.5 rounded-sm ${i < trade.confidence ? 'bg-[#d4a017]' : 'bg-[#1a1a30]'}`} />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
