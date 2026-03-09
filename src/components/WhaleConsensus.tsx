'use client';
import { motion } from 'framer-motion';
import type { WhalePosition } from '@/lib/types';
import { fU } from '@/lib/format';

interface WhaleConsensusProps {
  whaleCount: number;
  positionCount: number;
  totalLong: number;
  totalShort: number;
  whaleByCoin: Record<string, { l: number; s: number; n: number }>;
}

export default function WhaleConsensus({
  whaleCount, positionCount, totalLong, totalShort, whaleByCoin,
}: WhaleConsensusProps) {
  const total = totalLong + totalShort;
  const longPct = total > 0 ? (totalLong / total) * 100 : 50;
  const shortPct = total > 0 ? (totalShort / total) * 100 : 50;
  const bias = totalLong > totalShort;
  const biasText = total > 0 ? (bias ? 'BIAIS : LONG ▲' : 'BIAIS : SHORT ▼') : 'NO DATA';
  const biasColor = bias ? '#00e5ff' : '#ff006e';

  // Top 5 coins by notional
  const coins = Object.entries(whaleByCoin)
    .map(([coin, w]) => ({ coin, ...w, total: w.l + w.s }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const maxNot = coins[0]?.total || 1;

  return (
    <div className="mb-5 p-4 bg-[#0c0c16] border border-[#1a1a30] rounded">
      <div className="font-mono text-[0.75rem] text-[#556680] tracking-[1px] mb-2.5">
        {whaleCount} wallets, {positionCount} positions
      </div>

      {/* Long/Short bar */}
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[0.75rem] min-w-[100px] text-right text-[#00e5ff]">
          Long {fU(totalLong)} ({Math.round(longPct)}%)
        </span>
        <div className="relative flex-1 h-2.5 bg-[#08080f] rounded-full overflow-hidden flex">
          <motion.div
            initial={{ width: '50%' }}
            animate={{ width: `${longPct}%` }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400"
          />
          <motion.div
            initial={{ width: '50%' }}
            animate={{ width: `${shortPct}%` }}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-l from-rose-600 to-rose-400"
          />
        </div>
        <span className="font-mono text-[0.75rem] min-w-[100px] text-[#ff006e]">
          {fU(totalShort)} ({Math.round(shortPct)}%) Short
        </span>
      </div>

      <div className="font-mono text-[1rem] font-bold text-center mb-3" style={{ color: total > 0 ? biasColor : '#556680' }}>
        {biasText}
      </div>

      {/* Top coins */}
      <div className="flex flex-col gap-1.5">
        {coins.map(c => {
          const dir = c.l > c.s ? 'LONG' : 'SHORT';
          const col = c.l > c.s ? '#00e5ff' : '#ff006e';
          return (
            <div key={c.coin} className="flex items-center gap-2 font-mono text-[0.78rem]">
              <span className="text-[#00e5ff] font-bold min-w-[44px]">{c.coin}</span>
              <div className="flex-1 h-[6px] bg-[#08080f] rounded overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(c.total / maxNot) * 100}%` }}
                  transition={{ duration: 0.6 }}
                  className="h-full rounded"
                  style={{ background: col }}
                />
              </div>
              <span className="text-[0.72rem] min-w-[150px] text-right" style={{ color: col }}>
                {c.n} whales {dir} {fU(c.total)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
