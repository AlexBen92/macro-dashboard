'use client';

import { motion } from 'framer-motion';
import RotationScoreboard from '@/components/markets/RotationScoreboard';
import SectorHeatmap from '@/components/markets/SectorHeatmap';
import LiquidBasketTable from '@/components/markets/LiquidBasketTable';
import EdgeWatchlist from '@/components/markets/EdgeWatchlist';
import { useMarketSectors } from '@/hooks/api/useMarketSectors';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 22 } },
};

export default function MarketsPage() {
  const { data, isLoading, asOf } = useMarketSectors();
  const trends = data?.trends ?? {};

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
              MARKETS · MULTI-ASSET REGIME
            </div>
            <div className="font-[var(--font-display)] italic text-[0.85rem] text-[var(--dim)] mt-0.5">
              daily · 4h · rotation · correlation
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[0.58rem] text-[var(--bull)] tracking-[2px]">LIVE</span>
            </div>
            <span className="font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
              {asOf ? new Date(asOf).toISOString().slice(0, 16).replace('T', ' ') + 'Z' : '—'}
            </span>
          </div>
        </div>
      </div>

      <motion.div
        className="max-w-[96rem] mx-auto p-4 space-y-4"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {isLoading && !data && (
          <motion.div variants={fadeUp}>
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-6 text-center font-mono text-[0.7rem] text-[var(--muted)] uppercase tracking-[2px]">
              fetching trends · yahoo multi-ticker · ~10s
            </div>
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <RotationScoreboard trends={trends} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <SectorHeatmap trends={trends} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <LiquidBasketTable trends={trends} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <EdgeWatchlist trends={trends} />
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between px-2 pt-2 pb-4 font-mono text-[0.55rem] text-[var(--muted)] uppercase tracking-[2px]">
            <span>refresh 10min · cache yahoo · daily + 4h regime detection, pas M15 execution</span>
            <span className="text-[var(--dim)]">educational · not investment advice</span>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
