'use client';
import { motion } from 'framer-motion';
import TimeframeBadge from '@/components/ui/TimeframeBadge';
import type { COTData } from '@/hooks/useEdgeFinder';

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const startRad = (startAngle * Math.PI) / 180;
  const endRad = (endAngle * Math.PI) / 180;
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

function COTGauge({ index, size = 120 }: { index: number; size?: number }) {
  const radius = size / 2 - 10;
  const color = index > 80 ? '#4ade80' : index > 60 ? '#a3e635' : index > 40 ? '#fbbf24' : index > 20 ? '#f97316' : '#ef4444';
  const endAngle = 180 + (index / 100) * 180;

  return (
    <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
      {/* Background arc */}
      <path d={describeArc(size / 2, size / 2, radius, 180, 360)} fill="none" stroke="#1a1a2e" strokeWidth={8} />
      {/* Value arc */}
      <motion.path
        d={describeArc(size / 2, size / 2, radius, 180, endAngle)}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />
      {/* Value text */}
      <text x={size / 2} y={size / 2 - 2} textAnchor="middle" fill={color} className="font-mono" fontSize="18" fontWeight="bold">
        {index}
      </text>
      {/* Labels */}
      <text x={12} y={size / 2 + 10} fill="#556680" className="font-mono" fontSize="8">0</text>
      <text x={size - 20} y={size / 2 + 10} fill="#556680" className="font-mono" fontSize="8">100</text>
    </svg>
  );
}

function Sparkline({ data, width = 180, height = 28, color }: { data: number[]; width?: number; height?: number; color: string }) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ');

  return (
    <svg width={width} height={height} className="w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.2} opacity={0.6} />
      {/* Zero line */}
      {min < 0 && max > 0 && (
        <line x1={0} y1={height - ((0 - min) / range) * height} x2={width} y2={height - ((0 - min) / range) * height}
          stroke="#556680" strokeWidth={0.5} strokeDasharray="3,3" />
      )}
    </svg>
  );
}

function COTCard({ symbol, data }: { symbol: string; data: COTData | undefined }) {
  if (!data) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-4 opacity-40">
        <div className="font-mono text-sm font-bold text-[#8890a0]">{symbol}</div>
        <div className="font-mono text-[0.65rem] text-[#5a6070] mt-2">Pas de données COT</div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-sm font-bold text-[#eaeef4]">{symbol}</span>
        <TimeframeBadge tf="W1" />
      </div>

      <div className="flex justify-center mb-2">
        <COTGauge index={data.cotIndex} size={110} />
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[0.7rem]">
          <span className="text-[#8890a0]">Net Position</span>
          <span className={`font-mono font-bold ${data.netPosition > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.netPosition > 0 ? '+' : ''}{data.netPosition.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-[0.7rem]">
          <span className="text-[#8890a0]">Weekly Δ</span>
          <span className={`font-mono font-bold ${data.weeklyChange > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {data.weeklyChange > 0 ? '+' : ''}{data.weeklyChange.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between text-[0.7rem]">
          <span className="text-[#8890a0]">Report</span>
          <span className="font-mono text-[#5a6070]">{data.reportDate?.slice(0, 10)}</span>
        </div>
      </div>

      {/* Sparkline */}
      {data.weeks52 && data.weeks52.length > 2 && (
        <div className="mt-3 pt-3 border-t border-[#1e1e32]">
          <Sparkline data={[...data.weeks52].reverse()} color={data.netPosition > 0 ? '#4ade80' : '#ff006e'} />
        </div>
      )}

      <div className="mt-2 font-mono text-[0.5rem] text-[#3a4050] leading-snug">
        Source: CFTC · Dreesmann et al. 2023
      </div>
    </motion.div>
  );
}

interface Props {
  cot: Record<string, COTData>;
}

export default function COTCards({ cot }: Props) {
  const symbols = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'GOLD', 'OIL'];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {symbols.map(s => (
        <COTCard key={s} symbol={s} data={cot[s]} />
      ))}
    </div>
  );
}
