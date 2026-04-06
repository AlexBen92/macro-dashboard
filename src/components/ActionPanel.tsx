'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { TradeCandidate, AlertItem, WhalePosition } from '@/lib/types';
import type { CryptoSignalSummary } from '@/lib/crypto-signals-v3';
import SignalSummary from './ui/SignalSummary';
import TradeCard from './TradeCard';
import WhaleConsensus from './WhaleConsensus';
import Alerts from './Alerts';

interface ActionPanelProps {
  trades: TradeCandidate[];
  alerts: AlertItem[];
  whaleCount: number;
  positions: WhalePosition[];
  totalLong: number;
  totalShort: number;
  whaleByCoin: Record<string, { l: number; s: number; n: number }>;
  cryptoSignals: CryptoSignalSummary | null;
}

export default function ActionPanel({
  trades, alerts, whaleCount, positions, totalLong, totalShort, whaleByCoin, cryptoSignals,
}: ActionPanelProps) {
  return (
    <div className="p-6 overflow-y-auto border-r border-[#1a1a30] h-full">
      {/* V3 Evidence-Based Signals */}
      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#aa66ff]" /> EVIDENCE-BASED SIGNALS
      </div>
      {cryptoSignals ? (
        <div className="mb-6">
          <SignalSummary
            signals={cryptoSignals.signals}
            netBias={cryptoSignals.netBias}
            biasLabel={cryptoSignals.biasLabel}
            activeCount={cryptoSignals.activeCount}
            strongCount={cryptoSignals.strongCount}
            title="CRYPTO SIGNAL ENGINE V3"
          />
        </div>
      ) : (
        <div className="mb-6 py-8 text-center border-2 border-dashed border-[#1a1a30] rounded font-mono text-[0.85rem] text-[#556680]">
          Chargement des signaux...
        </div>
      )}

      {/* Legacy Trade Cards (still useful for quick glance) */}
      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> TOP TRADES
      </div>
      <div className="flex flex-col gap-3 mb-6">
        <AnimatePresence mode="wait">
          {trades.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-10 border-2 border-dashed border-[#1a1a30] rounded-md"
            >
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-[1.4rem] font-bold text-[#ff3355] font-mono tracking-[3px] mb-2"
              >
                PAS DE SETUP — CASH
              </motion.div>
              <div className="font-mono text-[0.82rem] text-[#556680]">
                Aucun coin ne passe tous les filtres
              </div>
            </motion.div>
          ) : (
            trades.map((t, i) => <TradeCard key={t.coin + t.dir} trade={t} index={i} />)
          )}
        </AnimatePresence>
      </div>

      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#ff006e]" /> WHALE CONSENSUS
      </div>
      <WhaleConsensus
        whaleCount={whaleCount}
        positionCount={positions.length}
        totalLong={totalLong}
        totalShort={totalShort}
        whaleByCoin={whaleByCoin}
      />

      <div className="font-mono text-[0.72rem] text-[#556680] tracking-[3px] uppercase mb-3 flex items-center gap-2">
        <div className="w-[6px] h-[6px] rounded-full bg-[#ffaa00]" /> ACTIVE ALERTS
      </div>
      <Alerts alerts={alerts} />
    </div>
  );
}
