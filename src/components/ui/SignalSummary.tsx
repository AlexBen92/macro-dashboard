'use client';
import { motion } from 'framer-motion';
import SignalCard from './SignalCard';
import ConfluenceGauge from './ConfluenceGauge';
import ConflictAlert, { detectConflicts } from './ConflictAlert';
import type { ConfidenceLevel } from './ConfidenceBadge';
import type { AcademicSource } from './SourceCitation';

interface Signal {
  id: string;
  name: string;
  timeframe: string;
  confidence: ConfidenceLevel;
  source: AcademicSource;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  value: number;
  detail: string;
  active: boolean;
  instrument?: string;
}

interface SignalSummaryProps {
  signals: Signal[];
  netBias: number;
  biasLabel: string;
  activeCount: number;
  strongCount: number;
  title: string;
}

const SIGNAL_WEIGHTS: Record<ConfidenceLevel, number> = {
  STRONG: 1.0,
  MODERATE: 0.6,
  WEAK: 0.25,
  UNPROVEN: 0,
};

function calcConfluenceScore(signals: Signal[]): number {
  let bullish = 0;
  let total = 0;
  for (const s of signals.filter(s => s.active && s.direction !== 'NEUTRAL')) {
    const w = SIGNAL_WEIGHTS[s.confidence];
    total += w;
    if (s.direction === 'LONG') bullish += w;
  }
  if (total === 0) return 50;
  return Math.round((bullish / total) * 100);
}

export default function SignalSummary({ signals, netBias, biasLabel, activeCount, strongCount, title }: SignalSummaryProps) {
  const confluenceScore = calcConfluenceScore(signals);
  const conflicts = detectConflicts(signals);

  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  } as const;
  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 20 } },
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show">
      {/* Confluence gauge */}
      <motion.div variants={item} className="mb-4 py-4 px-5 rounded-xl border border-[#1e1e32] bg-[#0e0e1a]">
        <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-3">{title}</div>
        <ConfluenceGauge
          score={confluenceScore}
          label={biasLabel}
          activeCount={activeCount}
          totalCount={signals.length}
        />
      </motion.div>

      {/* Conflicts */}
      {conflicts.length > 0 && (
        <motion.div variants={item} className="mb-4">
          <ConflictAlert conflicts={conflicts} />
        </motion.div>
      )}

      {/* Signal cards */}
      <div className="flex flex-col gap-2">
        {signals.map((signal, i) => (
          <motion.div key={signal.id} variants={item}>
            <SignalCard
              name={signal.name}
              timeframe={signal.timeframe}
              confidence={signal.confidence}
              source={signal.source}
              direction={signal.direction}
              value={signal.value}
              detail={signal.detail}
              active={signal.active}
              instrument={signal.instrument}
              index={i}
            />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
