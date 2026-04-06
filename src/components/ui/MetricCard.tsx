'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';

export type MetricType = 'winRate' | 'profitFactor' | 'sharpe' | 'maxDD' | 'calmar' | 'expectancy' | 'streak' | 'neutral';

interface MetricCardProps {
  label: string;
  value: string | number;
  unit?: string;
  type?: MetricType;
  tooltip?: string;
  sub?: string;
}

function getMetricColor(type: MetricType, raw: number): { text: string; bg: string; border: string } {
  switch (type) {
    case 'winRate':
      if (raw >= 55) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw >= 45) return { text: '#ffaa00', bg: 'rgba(255,170,0,0.06)', border: 'rgba(255,170,0,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    case 'profitFactor':
      if (raw >= 1.5) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw >= 1.0) return { text: '#ffaa00', bg: 'rgba(255,170,0,0.06)', border: 'rgba(255,170,0,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    case 'sharpe':
      if (raw >= 1.5) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw >= 0.5) return { text: '#ffaa00', bg: 'rgba(255,170,0,0.06)', border: 'rgba(255,170,0,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    case 'maxDD':
      // maxDD is negative, so raw is absolute value %
      if (raw <= 10) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw <= 20) return { text: '#ffaa00', bg: 'rgba(255,170,0,0.06)', border: 'rgba(255,170,0,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    case 'calmar':
      if (raw >= 2) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw >= 0.5) return { text: '#ffaa00', bg: 'rgba(255,170,0,0.06)', border: 'rgba(255,170,0,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    case 'expectancy':
      if (raw >= 0.5) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw >= 0) return { text: '#ffaa00', bg: 'rgba(255,170,0,0.06)', border: 'rgba(255,170,0,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    case 'streak':
      if (raw > 0) return { text: '#4ade80', bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.18)' };
      if (raw === 0) return { text: '#8890a0', bg: 'rgba(136,144,160,0.06)', border: 'rgba(136,144,160,0.18)' };
      return { text: '#ff3355', bg: 'rgba(255,51,85,0.06)', border: 'rgba(255,51,85,0.18)' };
    default:
      return { text: '#eaeef4', bg: 'rgba(30,30,50,0.4)', border: '#1e1e32' };
  }
}

export default function MetricCard({ label, value, unit, type = 'neutral', tooltip, sub }: MetricCardProps) {
  const [showTip, setShowTip] = useState(false);
  const numVal = typeof value === 'number' ? value : parseFloat(String(value).replace('%', '')) || 0;
  const { text, bg, border } = getMetricColor(type, numVal);

  return (
    <div className="relative">
      <motion.div
        className="rounded-xl p-4 cursor-default select-none"
        style={{ background: bg, border: `1px solid ${border}` }}
        whileHover={{ scale: 1.02 }}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
      >
        <div className="font-mono text-[0.6rem] text-[#5a6070] tracking-[2px] uppercase mb-2">{label}</div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-[1.4rem] font-bold leading-none" style={{ color: text }}>
            {typeof value === 'number' ? value.toFixed(value % 1 === 0 ? 0 : 2) : value}
          </span>
          {unit && <span className="font-mono text-[0.7rem]" style={{ color: text }}>{unit}</span>}
        </div>
        {sub && <div className="font-mono text-[0.65rem] text-[#5a6070] mt-1">{sub}</div>}
      </motion.div>

      {tooltip && showTip && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 px-3 py-2 rounded-lg bg-[#12121e] border border-[#1e1e32] font-mono text-[0.65rem] text-[#8890a0] text-center pointer-events-none shadow-xl">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1e1e32]" />
        </div>
      )}
    </div>
  );
}
