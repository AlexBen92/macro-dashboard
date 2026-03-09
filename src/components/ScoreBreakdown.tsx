'use client';
import type { ScoreBreakdown as SBType } from '@/lib/types';

export default function ScoreBreakdown({ breakdown }: { breakdown: SBType[] }) {
  return (
    <div>
      {breakdown.map((b, i) => {
        const c = b.pts > 0.01 ? '#4ade80' : b.pts < -0.01 ? '#ff3355' : '#556680';
        return (
          <div key={i} className="flex items-center gap-1.5 py-1 font-mono text-[0.75rem] border-b border-[#1a1a30]/30">
            <span className="flex-1 text-[#a0a0b8]">
              {b.l} <span className="text-[#556680] text-[0.62rem]">(w:{(b.w * 100).toFixed(0)}%)</span>
            </span>
            <span className="min-w-[42px] text-right font-bold" style={{ color: c }}>
              {b.pts >= 0 ? '+' : ''}{b.pts.toFixed(2)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
