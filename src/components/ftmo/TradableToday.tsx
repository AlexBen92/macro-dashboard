'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { TradableInstrument } from '@/lib/ftmo/tradableToday';

const STATUS_ICON: Record<string, string> = {
  tradable: '✅',
  blocked: '❌',
  sleeping: '💤',
};

function SwapBadge({ value, isTriple }: { value: number; isTriple: boolean }) {
  const cost = isTriple ? value * 3 : value;
  const color = cost > 0 ? '#4ade80' : cost < -20 ? '#ff3355' : cost < 0 ? '#ffaa00' : '#556680';
  return (
    <span className="font-mono text-[0.68rem]" style={{ color }}>
      {cost > 0 ? '+' : ''}{cost.toFixed(0)}$
      {isTriple && <span className="text-[#ff3355] font-bold ml-0.5">x3</span>}
    </span>
  );
}

export default function TradableToday({ instruments }: { instruments: TradableInstrument[] }) {
  const tradableCount = instruments.filter(i => i.tradable).length;
  const isWednesday = instruments.some(i => i.isTripleSwap);
  const now = new Date();
  const dayName = now.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dateStr = now.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="font-mono text-[0.85rem] text-[#e8e8f0]">
          <span className="capitalize">{dayName}</span> {dateStr} — <span className={tradableCount > 0 ? 'text-[#4ade80] font-bold' : 'text-[#ff3355] font-bold'}>{tradableCount} tradable{tradableCount > 1 ? 's' : ''}</span>
        </div>
        {isWednesday && (
          <motion.div
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="font-mono text-[0.72rem] font-bold text-[#ff3355] px-2.5 py-1 rounded bg-[#ff3355]/10 border border-[#ff3355]/30"
          >
            SWAP TRIPLE
          </motion.div>
        )}
      </div>

      {/* Instrument list */}
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {instruments.map((inst, i) => {
            const icon = inst.tradable ? STATUS_ICON.tradable : inst.sessionActive ? STATUS_ICON.blocked : STATUS_ICON.sleeping;
            const borderColor = inst.tradable
              ? inst.strategyReady ? '#4ade80' : '#00e5ff'
              : inst.blockedByEvent ? '#ff3355' : inst.blockedByCorrelation ? '#ffaa00' : '#1a1a30';

            return (
              <motion.div
                key={inst.instrument}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded border bg-[#0c0c16]"
                style={{ borderColor, borderLeftWidth: 3 }}
              >
                {/* Icon */}
                <span className="text-base w-6 text-center shrink-0">{icon}</span>

                {/* Instrument name */}
                <span className={`font-mono text-[1rem] font-bold min-w-[80px] ${inst.tradable ? 'text-[#e8e8f0]' : 'text-[#556680]'}`}>
                  {inst.instrument}
                </span>

                {/* Strategy status */}
                <div className="flex-1 min-w-0">
                  <div className={`font-mono text-[0.78rem] truncate ${inst.strategyReady ? 'text-[#4ade80]' : 'text-[#a0a0b8]'}`}>
                    {inst.strategyStatus}
                  </div>
                  {/* Warnings */}
                  {inst.warnings.length > 0 && (
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {inst.warnings.map((w, wi) => (
                        <span key={wi} className="font-mono text-[0.65rem] text-[#ffaa00]">
                          ⚠ {w}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap costs */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <div className="flex items-center gap-1.5 font-mono text-[0.62rem] text-[#556680]">
                    <span>L:</span>
                    <SwapBadge value={inst.swapLong} isTriple={inst.isTripleSwap} />
                  </div>
                  <div className="flex items-center gap-1.5 font-mono text-[0.62rem] text-[#556680]">
                    <span>S:</span>
                    <SwapBadge value={inst.swapShort} isTriple={inst.isTripleSwap} />
                  </div>
                </div>

                {/* Session indicator */}
                <div className={`w-2 h-2 rounded-full shrink-0 ${inst.sessionActive ? 'bg-[#4ade80]' : 'bg-[#1a1a30]'}`} title={inst.sessionActive ? 'En session' : 'Hors session'} />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Correlation groups legend */}
      <div className="mt-3 pt-2 border-t border-[#1a1a30]">
        <div className="font-mono text-[0.62rem] text-[#556680] tracking-[2px] uppercase mb-1.5">GROUPES DE CORRELATION</div>
        <div className="flex flex-wrap gap-2">
          {[
            { pairs: 'EUR/USD ↔ USD/CHF', corr: '-0.92' },
            { pairs: 'EUR/USD ↔ GBP/USD', corr: '0.82' },
            { pairs: 'NAS100 ↔ US30', corr: '0.88' },
          ].map((g, i) => (
            <span key={i} className="font-mono text-[0.68rem] text-[#a0a0b8] px-2 py-0.5 rounded bg-[#10101c] border border-[#1a1a30]">
              {g.pairs} <span className="text-[#ffaa00]">({g.corr})</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
