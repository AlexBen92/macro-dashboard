'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TimeframeBadge from '@/components/ui/TimeframeBadge';
import type { EdgeFinderScore, EdgeFinderBreakdown } from '@/hooks/useEdgeFinder';

const INSTRUMENTS = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'GOLD', 'OIL'] as const;

const COLUMNS: { key: keyof EdgeFinderBreakdown; label: string; range: [number, number]; tf: string; updateFreq: string }[] = [
  { key: 'cot', label: 'COT', range: [-2, 2], tf: 'W1', updateFreq: 'Fri 15:30 ET' },
  { key: 'trend', label: 'TREND', range: [-3, 3], tf: 'D1', updateFreq: '4h' },
  { key: 'macro', label: 'MACRO', range: [-3, 3], tf: 'M1', updateFreq: 'Daily' },
  { key: 'sentiment', label: 'SENT.', range: [-1, 1], tf: 'D1', updateFreq: '30min' },
  { key: 'seasonal', label: 'SEAS.', range: [-1, 1], tf: '10Y', updateFreq: 'Static' },
];

function SignalBadge({ signal }: { signal: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    'STRONG BULL': { bg: '#4ade8025', text: '#4ade80' },
    'BULLISH': { bg: '#4ade8018', text: '#4ade80' },
    'MILD BULL': { bg: '#a3e63518', text: '#a3e635' },
    'NEUTRAL': { bg: '#55668018', text: '#8890a0' },
    'MILD BEAR': { bg: '#ffaa0018', text: '#ffaa00' },
    'BEARISH': { bg: '#ff335518', text: '#ff3355' },
    'STRONG BEAR': { bg: '#ff335525', text: '#ff3355' },
  };
  const c = colors[signal] || colors['NEUTRAL'];
  return (
    <span
      className="font-mono text-[0.62rem] font-bold px-2 py-1 rounded uppercase tracking-wider whitespace-nowrap"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.text}30` }}
    >
      {signal}
    </span>
  );
}

interface Props {
  scores: Record<string, EdgeFinderScore>;
  loading?: boolean;
}

export default function EdgeFinderTable({ scores, loading }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const sorted = [...INSTRUMENTS].sort((a, b) =>
    (scores[b]?.total ?? 0) - (scores[a]?.total ?? 0)
  );

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1.5 }} className="font-mono text-sm text-[#8890a0]">
          LOADING EDGEFINDER...
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
          EDGEFINDER SCORES
        </span>
        <span className="font-mono text-[0.6rem] text-[#5a6070]">
          5 piliers · {Object.keys(scores).length} instruments
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e32]">
              <th className="text-left px-4 py-3 font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">
                INST.
              </th>
              {COLUMNS.map(col => (
                <th key={col.key} className="px-3 py-3 text-center">
                  <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">
                    {col.label}
                  </div>
                  <div className="text-[0.52rem] text-[#3a4050] mt-0.5">{col.range[0]}/{col.range[1]}</div>
                  <div className="mt-1"><TimeframeBadge tf={col.tf} /></div>
                  <div className="text-[0.48rem] text-[#4a5060] mt-1" title="Fréquence de mise à jour">
                    {col.updateFreq}
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 text-center">
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">TOTAL</div>
                <div className="text-[0.52rem] text-[#3a4050] mt-0.5">-10/+10</div>
              </th>
              <th className="px-3 py-3 text-center font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">
                SIGNAL
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((inst, i) => {
              const s = scores[inst];
              if (!s) return null;
              const isSelected = selected === inst;

              return (
                <motion.tr
                  key={inst}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelected(isSelected ? null : inst)}
                  className={`cursor-pointer border-b border-[#1e1e32]/50 transition-colors ${isSelected ? 'bg-[#12121e]' : 'hover:bg-[#0e0e1a]'}`}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-bold text-[#eaeef4]">{inst}</span>
                    {(inst === 'GOLD' || inst === 'OIL') && (
                      <span className="text-[0.55rem] text-[#5a6070] ml-1.5">
                        {inst === 'GOLD' ? 'XAU' : 'WTI'}
                      </span>
                    )}
                  </td>

                  {COLUMNS.map(col => {
                    const val = s.breakdown[col.key];
                    const pct = Math.abs(val) / col.range[1];
                    return (
                      <td key={col.key} className="px-3 py-3 text-center relative">
                        {/* Background intensity bar */}
                        <div className="absolute inset-y-1 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none" style={{ width: `${pct * 80}%`, opacity: 0.08 }}>
                          <div className={`w-full h-full rounded ${val > 0 ? 'bg-emerald-500' : val < 0 ? 'bg-rose-500' : 'bg-gray-600'}`} />
                        </div>
                        <span className={`relative font-mono text-sm font-bold ${val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-[#5a6070]'}`}>
                          {val > 0 ? '+' : ''}{val}
                        </span>
                      </td>
                    );
                  })}

                  {/* Total + gauge */}
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className={`font-mono text-base font-extrabold ${s.total > 3 ? 'text-emerald-400' : s.total < -3 ? 'text-rose-400' : 'text-[#8890a0]'}`}>
                        {s.total > 0 ? '+' : ''}{s.total}
                      </span>
                      <div className="w-14 h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${((s.total + 10) / 20) * 100}%` }}
                          transition={{ duration: 0.8, delay: i * 0.04 }}
                          className={`h-full rounded-full ${s.total > 3 ? 'bg-emerald-500' : s.total < -3 ? 'bg-rose-500' : 'bg-[#5a6070]'}`}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Signal */}
                  <td className="px-3 py-3 text-center">
                    <SignalBadge signal={s.signal} />
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail panel when selected */}
      <AnimatePresence>
        {selected && scores[selected] && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-[#1e1e32]"
          >
            <div className="px-5 py-4 bg-[#0e0e1a]">
              <div className="font-mono text-xs font-bold text-[#8890a0] mb-3">
                {selected} — BREAKDOWN
              </div>
              <div className="grid grid-cols-5 gap-3">
                {COLUMNS.map(col => {
                  const val = scores[selected].breakdown[col.key];
                  return (
                    <div key={col.key} className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
                      <div className="font-mono text-[0.6rem] text-[#5a6070] uppercase mb-1">{col.label}</div>
                      <div className={`font-mono text-lg font-bold ${val > 0 ? 'text-emerald-400' : val < 0 ? 'text-rose-400' : 'text-[#5a6070]'}`}>
                        {val > 0 ? '+' : ''}{val}
                      </div>
                      <div className="w-full h-1 bg-[#1a1a2e] rounded-full mt-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${val > 0 ? 'bg-emerald-500' : val < 0 ? 'bg-rose-500' : 'bg-gray-600'}`}
                          style={{ width: `${(Math.abs(val) / col.range[1]) * 100}%` }}
                        />
                      </div>
                      <div className="font-mono text-[0.5rem] text-[#3a4050] mt-1">
                        {col.range[0]} to {col.range[1]}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
