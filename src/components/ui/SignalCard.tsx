'use client';
import { motion } from 'framer-motion';
import TimeframeBadge from './TimeframeBadge';
import ConfidenceBadge from './ConfidenceBadge';
import SourceCitation from './SourceCitation';
import type { ConfidenceLevel } from './ConfidenceBadge';
import type { AcademicSource } from './SourceCitation';

interface SignalCardProps {
  name: string;
  timeframe: string;
  confidence: ConfidenceLevel;
  source: AcademicSource;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  value: number;
  detail: string;
  active: boolean;
  instrument?: string;
  index?: number;
}

const DIR_COLORS: Record<string, string> = {
  LONG: '#4ade80',
  SHORT: '#ff3355',
  NEUTRAL: '#556680',
};

const DIR_ICONS: Record<string, string> = {
  LONG: '▲',
  SHORT: '▼',
  NEUTRAL: '●',
};

export default function SignalCard({ name, timeframe, confidence, source, direction, value, detail, active, instrument, index = 0 }: SignalCardProps) {
  const borderColor = active ? DIR_COLORS[direction] : '#1a1a30';
  const bgActive = active ? `${DIR_COLORS[direction]}08` : 'transparent';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="rounded border py-3 px-4"
      style={{ borderColor, borderLeftWidth: 3, background: bgActive }}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
        <span className="font-mono text-[0.9rem] font-bold text-[#e8e8f0]">{name}</span>
        {instrument && <span className="font-mono text-[0.72rem] text-[#a0a0b8]">{instrument}</span>}
        <TimeframeBadge tf={timeframe.split(' ')[0]} />
        <ConfidenceBadge level={confidence} />
        <span className="flex-1" />
        {active && (
          <span
            className="font-mono text-[0.85rem] font-bold flex items-center gap-1"
            style={{ color: DIR_COLORS[direction] }}
          >
            {DIR_ICONS[direction]} {direction}
          </span>
        )}
      </div>

      {/* Detail */}
      <div className="font-mono text-[0.75rem] text-[#a0a0b8] mb-1">{detail}</div>

      {/* Strength bar */}
      {active && value !== 0 && (
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1 bg-[#1a1a30] rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.abs(value))}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="h-full rounded-full"
              style={{ background: DIR_COLORS[direction], marginLeft: value < 0 ? 'auto' : 0 }}
            />
          </div>
          <span className="font-mono text-[0.62rem] font-bold" style={{ color: DIR_COLORS[direction] }}>
            {value > 0 ? '+' : ''}{value}
          </span>
        </div>
      )}

      {/* Source */}
      <SourceCitation source={source} />
    </motion.div>
  );
}
