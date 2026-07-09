'use client';
import { motion } from 'framer-motion';
import DerivativesMarketTable from '@/components/crypto/DerivativesMarketTable';
import FundingOIHeatmap from '@/components/crypto/FundingOIHeatmap';
import MarketRegimePanel from '@/components/crypto/MarketRegimePanel';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import RealTimeCryptoDashboard from '@/components/crypto/RealTimeCryptoDashboard';
import VolArbSignalCard from '@/components/crypto/VolArbSignalCard';
import TopTokensM15Monitor from '@/components/TopTokensM15Monitor';
import IntradayHeatmap from '@/components/IntradayHeatmap';
import CryptoAdvancedSignals from '@/components/CryptoAdvancedSignals';
import StrategySignalEngine from '@/components/StrategySignalEngine';
import TopTokenScanner from '@/components/TopTokenScanner';
import BtcEcosystemSection from '@/components/btc-ecosystem/BtcEcosystemSection';
import FundingAggregator from '@/components/FundingAggregator';
import OrderFlowProxy from '@/components/OrderFlowProxy';
import HyperliquidMonitor from '@/components/HyperliquidMonitor';
import VolSurfaceMotif from '@/components/ui/VolSurfaceMotif';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 20 } },
};

function SectionLabel({ label, hint, color }: { label: string; hint: string; color: string }) {
  return (
    <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
      <div className="w-[6px] h-[6px] rounded-full" style={{ background: color }} /> {label}
      <span className="text-[0.58rem] text-[#5a6070] ml-auto">{hint}</span>
    </div>
  );
}

export default function CryptoPage() {
  return (
    <div className="min-h-screen">
      <div className="px-6 py-4 border-b border-[#1e1e32] bg-[#0a0a14]">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase">
              CRYPTO RESEARCH TERMINAL
            </div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
              Temps reel · signaux · derivees · recherche S1
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-[180px] h-[40px] text-[#5a6070]">
              <VolSurfaceMotif height={40} opacity={0.6} atmStrikeX={0.55} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[0.58rem] text-[#4ade80]">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      <motion.div
        className="v4-container"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* SECTION 1 — TEMPS RÉEL */}
        <motion.div variants={fadeUp}>
          <SectionLabel label="TEMPS RÉEL" hint="WEBSOCKET + TOP TOKENS" color="#00ff9d" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-3">
            <div className="lg:col-span-2">
              <CollapsibleSection title="WEBSOCKET LIVE" dot="#00ff9d" defaultOpen={true}>
                <RealTimeCryptoDashboard />
              </CollapsibleSection>
            </div>
            <div>
              <TopTokensM15Monitor equity={1000} />
            </div>
          </div>
        </motion.div>

        {/* SECTION 2 — SIGNAUX */}
        <motion.div variants={fadeUp} className="mt-6">
          <SectionLabel label="SIGNAUX" hint="STRATEGIES + SCANNERS" color="#4ade80" />
          <div className="space-y-3">
            <CryptoAdvancedSignals />
            <StrategySignalEngine />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <TopTokenScanner equity={1000} />
              <IntradayHeatmap />
            </div>
            <BtcEcosystemSection />
          </div>
        </motion.div>

        {/* SECTION 3 — DÉRIVÉES */}
        <motion.div variants={fadeUp} className="mt-6">
          <SectionLabel label="DÉRIVÉES" hint="FUNDING + OI + RÉGIME" color="#aa66ff" />
          <div className="space-y-3">
            <MarketRegimePanel />
            <DerivativesMarketTable />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <FundingOIHeatmap />
              <FundingAggregator />
            </div>
          </div>
        </motion.div>

        {/* SECTION 4 — RECHERCHE */}
        <motion.div variants={fadeUp} className="mt-6">
          <SectionLabel label="RECHERCHE" hint="S1 VOL-ARB + HL + ORDER FLOW" color="#d4a017" />
          <div className="space-y-3">
            <VolArbSignalCard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <HyperliquidMonitor />
              <OrderFlowProxy symbol="BTC" />
            </div>
          </div>
        </motion.div>

        {/* PLACEHOLDERS — future integrations */}
        <motion.div variants={fadeUp} className="mt-6">
          <CollapsibleSection title="DEFI OPPORTUNITIES" dot="#00e5ff" defaultOpen={false}>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center font-mono text-sm text-[#8890a0]">
              À INTÉGRER — DefiLlama API (TVL, APY, volumes DEX)
            </div>
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="CRYPTO + MACRO CALENDAR" dot="#ff3355" defaultOpen={false}>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center font-mono text-sm text-[#8890a0]">
              À INTÉGRER — Calendrier unifié crypto + macro
            </div>
          </CollapsibleSection>
        </motion.div>
      </motion.div>

      <div className="flex items-center gap-3 px-6 py-1.5 border-t border-[#1e1e32] bg-[#0e0e1a] font-mono text-[0.65rem] text-[#5a6070]">
        <span className="flex-1" />
        <span>CRYPTO RESEARCH — Temps réel + Signaux + Dérivées + S1</span>
      </div>
    </div>
  );
}
