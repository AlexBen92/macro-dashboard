'use client';
import { motion } from 'framer-motion';

export interface SignalConflict {
  signal1: string;
  signal2: string;
  description: string;
  resolution: string;
}

export function detectConflicts(signals: { name: string; direction: string; confidence: string; active: boolean }[]): SignalConflict[] {
  const conflicts: SignalConflict[] = [];
  const active = signals.filter(s => s.active && s.direction !== 'NEUTRAL');
  const longs = active.filter(s => s.direction === 'LONG');
  const shorts = active.filter(s => s.direction === 'SHORT');

  for (const l of longs) {
    for (const s of shorts) {
      if (l.confidence === 'STRONG' && s.confidence === 'STRONG') {
        conflicts.push({
          signal1: l.name,
          signal2: s.name,
          description: `${l.name} → LONG vs ${s.name} → SHORT`,
          resolution: 'Conflit STRONG vs STRONG — ne pas trader',
        });
      } else if (l.confidence === 'STRONG' || s.confidence === 'STRONG') {
        const stronger = l.confidence === 'STRONG' ? l : s;
        const weaker = l.confidence === 'STRONG' ? s : l;
        conflicts.push({
          signal1: l.name,
          signal2: s.name,
          description: `${l.name} → LONG vs ${s.name} → SHORT`,
          resolution: `Suivre ${stronger.name} (${stronger.confidence}) > ${weaker.name} (${weaker.confidence})`,
        });
      }
    }
  }
  return conflicts;
}

export default function ConflictAlert({ conflicts }: { conflicts: SignalConflict[] }) {
  if (conflicts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {conflicts.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-[#ffaa00]/30 bg-[#ffaa00]/5"
        >
          <span className="text-[#ffaa00] text-base shrink-0 mt-0.5">⚡</span>
          <div>
            <div className="font-mono text-[0.78rem] text-[#ffaa00] font-bold mb-0.5">
              CONFLIT : {c.description}
            </div>
            <div className="font-mono text-[0.68rem] text-[#8890a0]">
              → {c.resolution}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
