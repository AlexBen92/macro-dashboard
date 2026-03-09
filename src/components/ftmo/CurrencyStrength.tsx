'use client';
import { motion } from 'framer-motion';
import type { CurrencyStrength as CS } from '@/lib/ftmo/types';

const FLAG: Record<string, string> = {
  USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵', CHF: '🇨🇭', AUD: '🇦🇺', CAD: '🇨🇦',
};

export default function CurrencyStrength({ data }: { data: CS[] }) {
  const maxAbs = Math.max(...data.map(d => Math.abs(d.strength)), 1);

  return (
    <div className="space-y-1.5">
      {data.map((d, i) => {
        const pct = (d.strength / maxAbs) * 50 + 50; // 0-100 scale
        const color = d.strength > 0 ? '#4ade80' : d.strength < 0 ? '#ff3355' : '#556680';
        return (
          <div key={d.currency} className="flex items-center gap-2 font-mono text-[0.62rem]">
            <span className="w-5 text-center">{FLAG[d.currency] || ''}</span>
            <span className="w-7 font-bold text-[#e8e8f0]">{d.currency}</span>
            <div className="flex-1 h-[6px] bg-[#08080f] rounded overflow-hidden relative">
              <div className="absolute left-1/2 top-0 w-px h-full bg-[#1a1a30]" />
              <motion.div
                initial={{ width: '50%' }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, delay: i * 0.05 }}
                className="h-full rounded"
                style={{
                  background: color,
                  marginLeft: d.strength < 0 ? `${pct}%` : '50%',
                  width: `${Math.abs(pct - 50)}%`,
                  position: 'absolute',
                  left: d.strength < 0 ? undefined : '50%',
                  right: d.strength < 0 ? `${100 - 50}%` : undefined,
                }}
              />
            </div>
            <span className="w-10 text-right font-semibold" style={{ color }}>
              {d.strength > 0 ? '+' : ''}{d.strength}
            </span>
          </div>
        );
      })}

      {/* Best pair suggestion */}
      {data.length >= 2 && (
        <div className="mt-2 font-mono text-[0.58rem] text-[#d4a017] border-t border-[#1a1a30] pt-1.5">
          Best pair: <span className="font-bold">{data[0]?.currency}/{data[data.length - 1]?.currency}</span>
          {' '}(strongest vs weakest)
        </div>
      )}
    </div>
  );
}
