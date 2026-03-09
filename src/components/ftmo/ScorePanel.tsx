'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { FtmoScoreResult } from '@/lib/ftmo/types';

export default function ScorePanel({ score }: { score: FtmoScoreResult }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="font-mono text-[0.72rem] text-[#556680] tracking-[2px] cursor-pointer px-3 py-2 bg-[#10101c] border border-[#1a1a30] rounded w-full text-left flex justify-between hover:border-[#d4a017] hover:text-[#d4a017] transition-colors"
      >
        SCORE BREAKDOWN ({score.signal}) <span>{open ? '▲' : '▼'}</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="py-2 space-y-0.5">
          {score.breakdown.map((b, i) => {
            const c = b.pts > 0.01 ? '#4ade80' : b.pts < -0.01 ? '#ff3355' : '#556680';
            return (
              <div key={i} className="flex items-center gap-1.5 font-mono text-[0.72rem] border-b border-[#1a1a30]/30 py-1">
                <span className="flex-1 text-[#a0a0b8]">
                  {b.l} <span className="text-[#556680] text-[0.6rem]">(w:{(b.w * 100).toFixed(0)}%)</span>
                </span>
                <span className="min-w-[42px] text-right font-bold" style={{ color: c }}>
                  {b.pts >= 0 ? '+' : ''}{b.pts.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
