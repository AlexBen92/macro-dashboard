'use client';
import { motion } from 'framer-motion';
import type { FtmoTrade } from '@/lib/ftmo/types';
import TimeframeBadge from '../ui/TimeframeBadge';
import ConfidenceBadge from '../ui/ConfidenceBadge';

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
  const confLevel = trade.confidence >= 4 ? 'STRONG' : trade.confidence >= 3 ? 'MODERATE' : 'WEAK';

  return (
    <motion.div
      initial={{ x: -30, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ delay: index * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
      whileHover={{ y: -2, boxShadow: `0 8px 30px ${accentColor}12` }}
      className="border-2 border-[#1e1e32] rounded-xl bg-[#0e0e1a] overflow-hidden transition-all"
      style={{ borderLeftWidth: 4, borderLeftColor: accentColor }}
    >
      <div className="p-6">
        {/* Row 1: Direction + Instrument + Confidence */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-[2rem] font-bold" style={{ color: accentColor }}>
              {icon}
            </span>
            <span className="font-mono text-[1.6rem] font-bold text-[#eaeef4]">{trade.instrument}</span>
            <TimeframeBadge tf="H1" />
          </div>
          <ConfidenceBadge level={confLevel} />
        </div>

        {/* Row 2: Prices — EN GROS */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase tracking-wider mb-1">ENTRY</div>
            <div className="font-mono text-[1.1rem] font-bold text-[#eaeef4]">{fmtPrice(trade.instrument, trade.entry)}</div>
          </div>
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase tracking-wider mb-1">STOP</div>
            <div className="font-mono text-[1.1rem] font-bold text-[#ff3355]">{fmtPrice(trade.instrument, trade.stop)}</div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">2×ATR</div>
          </div>
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase tracking-wider mb-1">TP1</div>
            <div className="font-mono text-[1.1rem] font-bold text-[#4ade80]">{fmtPrice(trade.instrument, trade.tp1)}</div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">3×ATR</div>
          </div>
        </div>

        {/* Row 3: Sizing */}
        <div className="flex items-center gap-5 mb-4 px-3 py-2.5 rounded-lg bg-[#d4a017]/5 border border-[#d4a017]/20">
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">LOT</div>
            <div className="font-mono text-[1rem] font-bold text-[#d4a017]">{trade.lots.toFixed(2)}</div>
          </div>
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">RISQUE</div>
            <div className="font-mono text-[1rem] font-bold text-[#ff3355]">${trade.riskUsd} ({trade.riskPct.toFixed(2)}%)</div>
          </div>
          <div>
            <div className="font-mono text-[0.62rem] text-[#5a6070]">R:R</div>
            <div className="font-mono text-[1rem] font-bold text-[#4ade80]">1:{trade.rrRatio.toFixed(1)}</div>
          </div>
        </div>

        {/* Row 4: Reasons */}
        <div className="flex flex-col gap-1.5 mb-3">
          {trade.reasons.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.12 + 0.08 * i + 0.3 }}
              className="font-mono text-[0.78rem] text-[#a0a8b8] flex items-center gap-2"
            >
              <span className="text-[#4ade80] font-bold">✓</span> {r}
            </motion.div>
          ))}
        </div>

        {/* Strategy badge */}
        <div className="font-mono text-[0.68rem] text-[#5a6070] px-2.5 py-1 border border-[#1e1e32] rounded inline-block">
          {trade.strategy}
        </div>
      </div>

      {/* Confidence bar */}
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${(trade.confidence / 5) * 100}%` }}
        transition={{ delay: index * 0.12 + 0.5, duration: 0.8 }}
        className="h-1"
        style={{ background: `linear-gradient(90deg, ${accentColor}, #00e5ff)` }}
      />
    </motion.div>
  );
}
