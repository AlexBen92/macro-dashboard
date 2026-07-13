'use client';

import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

import DerivativesMarketTable from '@/components/crypto/DerivativesMarketTable';
import FundingOIHeatmap from '@/components/crypto/FundingOIHeatmap';
import MarketRegimePanel from '@/components/crypto/MarketRegimePanel';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import RealTimeCryptoDashboard from '@/components/crypto/RealTimeCryptoDashboard';
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

import VrpCard from '@/components/vol/VrpCard';
import D1Card from '@/components/vol/D1Card';
import TermStructureCard from '@/components/vol/TermStructureCard';
import SkewCard from '@/components/vol/SkewCard';
import VolOverviewBar from '@/components/vol/VolOverviewBar';
import PedagogicalPanel from '@/components/vol/PedagogicalPanel';
import S1PaperPerformanceSection from '@/components/vol/S1PaperPerformanceSection';

import { useVolResearch } from '@/hooks/api/useVolResearch';

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
} as const;

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 22 } },
};

const BTC_COLOR = 'var(--caution)';
const ETH_COLOR = 'var(--info)';

function SectionLabel({
  label,
  hint,
  color,
}: {
  label: string;
  hint: string;
  color: string;
}) {
  return (
    <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase mb-3 flex items-center gap-2">
      <div className="w-[6px] h-[6px] rounded-full" style={{ background: color }} /> {label}
      <span className="text-[0.58rem] text-[var(--muted)] ml-auto">{hint}</span>
    </div>
  );
}

export default function CryptoPage() {
  const { payload, available, isLoading, error, lastUpdated } = useVolResearch();

  return (
    <div className="min-h-screen">
      <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--bg)] relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
              CRYPTO RESEARCH · VOL TERMINAL
            </div>
            <div className="font-[var(--font-display)] italic text-[0.85rem] text-[var(--dim)] mt-0.5">
              surface · régime · paper · validation
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-[200px] h-[44px] text-[var(--muted)]">
              <VolSurfaceMotif height={44} opacity={0.5} atmStrikeX={0.5} />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[0.58rem] text-[var(--bull)]">LIVE</span>
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
        {isLoading && (
          <motion.div variants={fadeUp}>
            <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-6 text-center font-mono text-[0.7rem] text-[var(--muted)]">
              CHARGEMENT VOL RESEARCH...
            </div>
          </motion.div>
        )}

        {!isLoading && !available && (
          <motion.div variants={fadeUp}>
            <div className="bg-[var(--bg2)] border border-[var(--caution)] rounded-[4px] p-4 flex items-center gap-3">
              <AlertTriangle size={18} color="var(--caution)" strokeWidth={1.75} />
              <div className="font-mono text-[0.65rem] text-[var(--caution)]">
                DONNÉES VOL RESEARCH INDISPONIBLES — VPS injoignable {error ? `(${error})` : ''}
              </div>
            </div>
          </motion.div>
        )}

        {available && payload && (
          <>
            <motion.div variants={fadeUp}>
              <SectionLabel
                label="VOLATILITÉ"
                hint={`MAJ ${lastUpdated ?? payload.last_updated}`}
                color="var(--bull)"
              />
              <div className="relative mb-4">
                <div className="absolute right-0 top-0 w-[280px] h-[80px] text-[var(--muted)] pointer-events-none opacity-40">
                  <VolSurfaceMotif height={80} opacity={0.4} atmStrikeX={0.5} />
                </div>
                <VolOverviewBar payload={payload} />
              </div>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <VrpCard ccy="BTC" data={payload.vrp.BTC} ccyColor={BTC_COLOR} />
              <VrpCard ccy="ETH" data={payload.vrp.ETH} ccyColor={ETH_COLOR} />
              <D1Card ccy="BTC" data={payload.d1_compression.BTC} ccyColor={BTC_COLOR} />
              <D1Card ccy="ETH" data={payload.d1_compression.ETH} ccyColor={ETH_COLOR} />
              <TermStructureCard
                ccy="BTC"
                data={payload.term_structure.BTC}
                ccyColor={BTC_COLOR}
              />
              <TermStructureCard
                ccy="ETH"
                data={payload.term_structure.ETH}
                ccyColor={ETH_COLOR}
              />
              <SkewCard ccy="BTC" data={payload.skew.BTC} ccyColor={BTC_COLOR} />
              <SkewCard ccy="ETH" data={payload.skew.ETH} ccyColor={ETH_COLOR} />
            </motion.div>

            <motion.div variants={fadeUp} className="mt-3">
              <PedagogicalPanel />
            </motion.div>

            <motion.div variants={fadeUp} className="mt-6">
              <SectionLabel
                label="S1 · PAPER TRADING"
                hint="VOL SURFACE ARBITRAGE"
                color="var(--caution)"
              />
              <S1PaperPerformanceSection />
            </motion.div>
          </>
        )}

        <motion.div variants={fadeUp} className="mt-6">
          <SectionLabel
            label="TEMPS RÉEL"
            hint="WEBSOCKET + TOP TOKENS"
            color="var(--bull)"
          />
          <CollapsibleSection title="WEBSOCKET LIVE + TOP TOKENS" dot="var(--bull)" defaultOpen={false}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <div className="lg:col-span-2">
                <RealTimeCryptoDashboard />
              </div>
              <div>
                <TopTokensM15Monitor equity={1000} />
              </div>
            </div>
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-3">
          <CollapsibleSection title="SIGNAUX · STRATEGIES + SCANNERS" dot="var(--bull)" defaultOpen={false}>
            <div className="space-y-3">
              <CryptoAdvancedSignals />
              <StrategySignalEngine />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <TopTokenScanner equity={1000} />
                <IntradayHeatmap />
              </div>
              <BtcEcosystemSection />
            </div>
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-3">
          <CollapsibleSection title="DÉRIVÉES · FUNDING + OI + RÉGIME" dot="var(--purple)" defaultOpen={false}>
            <div className="space-y-3">
              <MarketRegimePanel />
              <DerivativesMarketTable />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <FundingOIHeatmap />
                <FundingAggregator />
              </div>
            </div>
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp} className="mt-3">
          <CollapsibleSection title="HYPERLIQUID + ORDER FLOW" dot="var(--info)" defaultOpen={false}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <HyperliquidMonitor />
              <OrderFlowProxy symbol="BTC" />
            </div>
          </CollapsibleSection>
        </motion.div>
      </motion.div>

      <div className="flex items-center gap-3 px-6 py-1.5 border-t border-[var(--border)] bg-[var(--bg2)] font-mono text-[0.65rem] text-[var(--muted)]">
        <span className="flex-1" />
        <span>
          CRYPTO RESEARCH · vol research {available ? 'OK' : 'KO'} · refresh 5min
        </span>
      </div>
    </div>
  );
}
