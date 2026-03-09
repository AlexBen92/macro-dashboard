'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import type { MarketData, ScoreResult, WhaleInfo, WhalePosition } from '@/lib/types';
import MacroBlock from './MacroBlock';
import FundingSnapshot from './FundingSnapshot';
import WhaleLeaderboard from './WhaleLeaderboard';
import PositionsTable from './PositionsTable';
import ScoreBreakdown from './ScoreBreakdown';

interface ContextPanelProps {
  data: MarketData | null;
  score: ScoreResult | null;
  whales: WhaleInfo[];
  positions: WhalePosition[];
  whaleLoading: boolean;
}

function Collapsible({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="font-mono text-[0.72rem] text-[#556680] tracking-[2px] cursor-pointer px-3 py-2 bg-[#10101c] border border-[#1a1a30] rounded w-full text-left flex justify-between hover:border-[#00e5ff] hover:text-[#00e5ff] transition-colors"
      >
        {title} <span>{open ? '▲' : '▼'}</span>
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? 'auto' : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        className="overflow-hidden"
      >
        <div className="py-2">{children}</div>
      </motion.div>
    </div>
  );
}

export default function ContextPanel({ data, score, whales, positions, whaleLoading }: ContextPanelProps) {
  return (
    <div className="p-6 overflow-y-auto bg-[#0c0c16] h-full">
      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#4488ff]" /> MACRO SNAPSHOT
      </div>
      <MacroBlock data={data} />

      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#4ade80]" /> FUNDING SNAPSHOT
      </div>
      <FundingSnapshot data={data} />

      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#aa66ff]" /> WHALE LEADERBOARD
      </div>
      <WhaleLeaderboard whales={whales} loading={whaleLoading} />

      <Collapsible title="WHALE POSITIONS">
        <PositionsTable positions={positions} />
      </Collapsible>

      <Collapsible title="SCORE BREAKDOWN">
        {score ? <ScoreBreakdown breakdown={score.bd} /> : <div className="font-mono text-[0.72rem] text-[#556680]">Loading...</div>}
      </Collapsible>
    </div>
  );
}
