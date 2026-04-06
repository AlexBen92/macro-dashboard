'use client';
import { motion } from 'framer-motion';

interface SignalStat {
  signalId: string;
  signalName: string;
  wins: number;
  total: number;
}

interface SignalHeatmapProps {
  stats: SignalStat[];
}

function winRateColor(wr: number): { bar: string; text: string } {
  if (wr >= 60) return { bar: '#4ade80', text: '#4ade80' };
  if (wr >= 50) return { bar: '#ffaa00', text: '#ffaa00' };
  return { bar: '#ff3355', text: '#ff3355' };
}

export default function SignalHeatmap({ stats }: SignalHeatmapProps) {
  if (stats.length === 0) {
    return (
      <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-5 text-center font-mono text-[0.75rem] text-[#5a6070]">
        Enregistrez des trades avec des signaux pour voir la heatmap de précision.
      </div>
    );
  }

  const sorted = [...stats].sort((a, b) => (b.wins / b.total) - (a.wins / a.total));

  return (
    <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-5">
      <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-4">PRÉCISION PAR SIGNAL</div>
      <div className="space-y-3">
        {sorted.map((s, i) => {
          const wr = s.total > 0 ? (s.wins / s.total) * 100 : 0;
          const { bar, text } = winRateColor(wr);
          return (
            <div key={s.signalId}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-[0.7rem] text-[#a0a8b8] truncate max-w-[60%]">{s.signalName}</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[0.65rem] text-[#5a6070]">{s.wins}/{s.total}</span>
                  <span className="font-mono text-[0.75rem] font-bold" style={{ color: text }}>{wr.toFixed(0)}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-[#1e1e32] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: bar }}
                  initial={{ width: 0 }}
                  animate={{ width: `${wr}%` }}
                  transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
