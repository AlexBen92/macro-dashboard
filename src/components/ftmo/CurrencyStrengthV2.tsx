'use client';
import { motion } from 'framer-motion';
import TimeframeBadge from '@/components/ui/TimeframeBadge';
import ConfidenceBadge from '@/components/ui/ConfidenceBadge';

interface Props {
  strength: Record<string, number>;
}

export default function CurrencyStrengthV2({ strength }: Props) {
  const entries = Object.entries(strength);
  if (entries.length === 0) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-6 text-center">
        <div className="font-mono text-sm text-[#5a6070]">Pas de données de force relative</div>
      </div>
    );
  }

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const maxAbs = Math.max(...sorted.map(([, v]) => Math.abs(v)), 0.01);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[2px] text-[#8890a0]">
          CURRENCY STRENGTH
        </span>
        <div className="flex items-center gap-2">
          <TimeframeBadge tf="D1" />
          <ConfidenceBadge level="WEAK" />
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map(([ccy, val], i) => (
          <motion.div
            key={ccy}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center gap-3"
          >
            <span className={`font-mono text-sm font-bold w-10 ${i === 0 ? 'text-emerald-400' : i === sorted.length - 1 ? 'text-rose-400' : 'text-[#eaeef4]'}`}>
              {ccy}
            </span>
            <div className="flex-1 h-2.5 bg-[#1a1a2e] rounded-full overflow-hidden relative">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[#2a2a3e]" />
              {val >= 0 ? (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(val / maxAbs) * 50}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="absolute top-0 left-1/2 h-full rounded-r-full bg-emerald-500"
                />
              ) : (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(Math.abs(val) / maxAbs) * 50}%` }}
                  transition={{ duration: 0.6, delay: i * 0.05 }}
                  className="absolute top-0 h-full rounded-l-full bg-rose-500"
                  style={{ right: '50%' }}
                />
              )}
            </div>
            <span className={`font-mono text-xs font-semibold w-16 text-right ${val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-[#5a6070]'}`}>
              {val > 0 ? '+' : ''}{val.toFixed(2)}
            </span>
          </motion.div>
        ))}
      </div>

      {/* Best pair */}
      <div className="mt-4 pt-4 border-t border-[#1e1e32]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[0.62rem] text-[#5a6070]">MEILLEURE PAIRE :</span>
          <span className="font-mono font-bold text-sm text-[#eaeef4]">
            {strongest[0]}/{weakest[0]}
          </span>
          <span className="font-mono text-[0.62rem] text-emerald-400 font-bold">LONG</span>
        </div>
        <div className="font-mono text-[0.52rem] text-[#3a4050] mt-1">
          Clare et al. 2022 : Sharpe OOS 0.06 — indicateur de CONTEXTE, pas de signal.
        </div>
      </div>
    </div>
  );
}
