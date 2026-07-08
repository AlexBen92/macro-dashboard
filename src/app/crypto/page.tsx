'use client';
import { motion } from 'framer-motion';
import DerivativesMarketTable from '@/components/crypto/DerivativesMarketTable';
import FundingOIHeatmap from '@/components/crypto/FundingOIHeatmap';
import MarketRegimePanel from '@/components/crypto/MarketRegimePanel';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import RealTimeCryptoDashboard from '@/components/crypto/RealTimeCryptoDashboard';
import VolArbSignalCard from '@/components/crypto/VolArbSignalCard';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 20 } },
};

export default function CryptoPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#1e1e32] bg-[#0a0a14]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase">
              CRYPTO TRADING DASHBOARD
            </div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
              Analyse de marché dérivés en temps réel
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[0.58rem] text-[#4ade80]">LIVE</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <motion.div
        className="v4-container"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* ROW 1 — MARKET REGIME (PRIORITÉ) */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#d4a017]" /> MARKET REGIME
            <span className="text-[0.58rem] text-[#5a6070] ml-auto">SYNTHÈSE CONTEXTE</span>
          </div>
          <MarketRegimePanel />
        </motion.div>

        {/* ROW 1.5 — REAL-TIME WEBSOCKET */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="REAL-TIME WEBSOCKET" dot="#00ff9d" defaultOpen={true}>
            <RealTimeCryptoDashboard />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 2 — DERIVATIVES MARKET TABLE */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#4ade80]" /> DERIVATIVES
            <span className="text-[0.58rem] text-[#5a6070] ml-auto">STYLE COINALYZE</span>
          </div>
          <DerivativesMarketTable />
        </motion.div>

        {/* ROW 3 — FUNDING × OI HEATMAP */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#aa66ff]" /> FUNDING HEATMAP
            <span className="text-[0.58rem] text-[#5a6070] ml-auto">SQUEEZE DETECTION</span>
          </div>
          <FundingOIHeatmap />
        </motion.div>

        {/* ROW 3.5 — S1 VOL-SURFACE ARBITRAGE (PAPER TRADING) */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#d4a017]" /> S1 VOL-ARB SIGNAL
            <span className="text-[0.58rem] text-[#d4a017] ml-auto">PAPER TRADING — NON DÉPLOYÉ</span>
          </div>
          <VolArbSignalCard />
        </motion.div>

        {/* ROW 4 — DEFI OPPORTUNITIES (Placeholder for future) */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="DEFI OPPORTUNITIES" dot="#00e5ff" defaultOpen={false}>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="font-mono text-sm text-[#8890a0]"
              >
                COMING SOON — Intégration DefiLlama API
              </motion.div>
              <div className="font-mono text-[0.65rem] text-[#5a6070] mt-2">
                TVL, APY, volumes DEX par protocole
              </div>
            </div>
          </CollapsibleSection>
        </motion.div>

        {/* ROW 5 — ON-CHAIN FLOWS (Placeholder for future) */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="ON-CHAIN FLOWS" dot="#d4a017" defaultOpen={false}>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="font-mono text-sm text-[#8890a0]"
              >
                COMING SOON — Intégration CryptoQuant / Glassnode
              </motion.div>
              <div className="font-mono text-[0.65rem] text-[#5a6070] mt-2">
                Flux CEX, stablecoins, active addresses
              </div>
            </div>
          </CollapsibleSection>
        </motion.div>

        {/* ROW 6 — ECONOMIC CALENDAR (Placeholder for future) */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="CRYPTO + MACRO CALENDAR" dot="#ff3355" defaultOpen={false}>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
              <motion.div
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="font-mono text-sm text-[#8890a0]"
              >
                COMING SOON — Calendrier unifié crypto + macro
              </motion.div>
              <div className="font-mono text-[0.65rem] text-[#5a6070] mt-2">
                Unlocks, upgrades, events macro
              </div>
            </div>
          </CollapsibleSection>
        </motion.div>
      </motion.div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-6 py-1.5 border-t border-[#1e1e32] bg-[#0e0e1a] font-mono text-[0.65rem] text-[#5a6070]">
        <span className="flex-1" />
        <span>CRYPTO STACK — Derivatives Analysis + On-chain</span>
      </div>
    </div>
  );
}
