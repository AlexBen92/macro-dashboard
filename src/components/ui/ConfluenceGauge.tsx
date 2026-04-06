'use client';
import { motion } from 'framer-motion';

interface ConfluenceGaugeProps {
  score: number; // 0 to 100 (0=bearish, 50=neutral, 100=bullish)
  label: string;
  activeCount: number;
  totalCount: number;
}

export default function ConfluenceGauge({ score, label, activeCount, totalCount }: ConfluenceGaugeProps) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const biasColor = clampedScore > 60 ? '#4ade80' : clampedScore < 40 ? '#ff3355' : '#ffaa00';

  return (
    <div className="flex items-center gap-4">
      {/* Label */}
      <div className="min-w-[100px]">
        <div className="font-mono text-[1.1rem] font-bold" style={{ color: biasColor }}>
          {label}
        </div>
        <div className="font-mono text-[0.65rem] text-[#5a6070]">
          {activeCount}/{totalCount} signaux actifs
        </div>
      </div>

      {/* Gauge */}
      <div className="flex-1 relative h-3 rounded-full bg-[#12121e] overflow-hidden border border-[#1e1e32]">
        {/* Gradient track */}
        <div
          className="absolute inset-0 rounded-full opacity-30"
          style={{ background: 'linear-gradient(90deg, #ff3355 0%, #ffaa00 40%, #4ade80 60%, #00e5ff 100%)' }}
        />
        {/* Center line */}
        <div className="absolute inset-y-0 left-1/2 w-px bg-[#5a6070] z-10" />
        {/* Cursor */}
        <motion.div
          animate={{ left: `${clampedScore}%` }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-[#0a0a14] shadow-lg z-20"
          style={{ background: biasColor }}
        />
      </div>

      {/* Score */}
      <div className="font-mono text-[0.85rem] font-bold min-w-[48px] text-right" style={{ color: biasColor }}>
        {clampedScore}%
      </div>
    </div>
  );
}
