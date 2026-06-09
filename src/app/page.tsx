'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWhaleDiscovery } from '@/hooks/useWhaleDiscovery';
import { useMarketData } from '@/hooks/useMarketData';
import { useTradeSelection } from '@/hooks/useTradeSelection';
import { useSessionGuide } from '@/hooks/useSessionGuide';
import DecisionBar from '@/components/DecisionBar';
import SignalSummary from '@/components/ui/SignalSummary';
import HyperliquidMonitor from '@/components/HyperliquidMonitor';
import IntradayHeatmap from '@/components/IntradayHeatmap';
import Top5ScoreEngine from '@/components/Top5ScoreEngine';
import FundingAggregator from '@/components/FundingAggregator';
import StrategySignalEngine from '@/components/StrategySignalEngine';
import SessionCountdown from '@/components/SessionCountdown';
import TopTokenScanner from '@/components/TopTokenScanner';
import MacroContext from '@/components/MacroContext';
import OrderFlowProxy from '@/components/OrderFlowProxy';
import TradeJournal from '@/components/TradeJournal';
import BtcEcosystemSection from '@/components/btc-ecosystem/BtcEcosystemSection';
import M15ScalpingSignals from '@/components/M15ScalpingSignals';
import TradingChecklist from '@/components/TradingChecklist';
import { useTelegramAlerts } from '@/components/TelegramAlerts';
import MacroAdvancedPanel from '@/components/MacroAdvancedPanel';
import CryptoAdvancedSignals from '@/components/CryptoAdvancedSignals';
import QuantRegimesPanel from '@/components/QuantRegimesPanel';
import type { TrafficLightStatus } from '@/lib/types';
import Link from 'next/link';

function computeDecision(
  score: number,
  vixVal: number,
  sessionDead: boolean,
  sessionActive: string | null,
  eventHours: number,
  fngVal: number | undefined,
  avgVar: number,
): { light: TrafficLightStatus; verdict: string; sizing: string } {
  const absScore = Math.abs(score);
  const hasClearBias = absScore > 3;
  const vixDanger = vixVal > 30;
  const vixElevated = vixVal > 25;
  const eventImminent = eventHours < 2;
  const eventClose = eventHours < 24;
  const fgExtreme = fngVal != null && fngVal < 15;

  if (vixDanger || sessionDead || eventImminent) {
    return {
      light: 'stop',
      verdict: 'NO TRADE',
      sizing: hasClearBias ? 'TAILLE ÷4' : 'CASH',
    };
  }
  if (!hasClearBias || vixElevated || eventClose) {
    return {
      light: 'caution',
      verdict: 'PRUDENT',
      sizing: (vixElevated || fgExtreme) ? 'TAILLE ÷2' : 'TAILLE ÷2',
    };
  }
  return {
    light: 'go',
    verdict: 'TRADE',
    sizing: avgVar < 3 ? 'TAILLE PLEINE' : 'TAILLE ÷2',
  };
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 20 } },
};

export default function Home() {
  // Enable Telegram alerts
  useTelegramAlerts();

  const { whales, positions, whaleByCoin, totalLong, totalShort } = useWhaleDiscovery();
  const { data, score, coinData, cryptoSignals, loading, countdown, apiStatus = {}, latency } = useMarketData(whaleByCoin, totalLong, totalShort);
  const { trades, alerts } = useTradeSelection(coinData, data);
  const { session, nextEvent } = useSessionGuide();

  // Compute avg VaR
  let avgVar = 2;
  const varVals = Object.values(coinData).filter(c => c.var95 != null);
  if (varVals.length > 0) {
    avgVar = varVals.reduce((a, c) => a + Math.abs(c.var95 ?? 0), 0) / varVals.length;
  }

  const vixVal = data?.vix?.v ?? 0;
  const eventHours = nextEvent ? nextEvent.hoursLeft : 999;
  const { light, verdict, sizing } = computeDecision(
    score?.score ?? 0, vixVal, session.dead, session.active,
    eventHours, data?.fng?.v, avgVar,
  );

  return (
    <div className="min-h-screen">
      {/* NAV BAR */}
      <nav className="flex items-center gap-3 px-6 py-2.5 bg-[#06060a] border-b border-[#1a1a30]">
        <span className="font-mono text-[0.85rem] font-bold text-[#556680] tracking-[3px] mr-4">
          MACRO STACK
        </span>
        <Link href="/crypto" className="relative">
          <span className="font-mono text-[0.9rem] font-semibold px-4 py-1.5 rounded transition-colors text-[#556680] hover:text-[#e8e8f0]">
            CRYPTO
          </span>
        </Link>
        <Link href="/scalping" className="relative">
          <span className="font-mono text-[0.9rem] font-semibold px-4 py-1.5 rounded transition-colors text-[#00e5ff] hover:text-[#00e5ff]">
            SCALPING
          </span>
        </Link>
      </nav>

      {/* STICKY DECISION BAR */}
      <div className="decision-bar-sticky">
        <DecisionBar
          light={light}
          verdict={verdict}
          score={score}
          sizing={sizing}
          session={session}
          nextEvent={nextEvent}
          countdown={countdown}
          loading={loading}
          latency={latency}
          apiStatus={apiStatus}
        />
      </div>

      {/* VERTICAL FLOW */}
      <motion.div
        className="v4-container"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* ============================================== */}
        {/*  MACRO STACK v8.0 — SESSION CLOCK                */}
        {/* ============================================== */}

        <motion.div variants={fadeUp}>
          <SessionCountdown />
        </motion.div>

        {/* ============================================== */}
        {/*  MACRO STACK v7.0 — CORE COMPONENTS             */}
        {/* ============================================== */}

        {/* MACRO ADVANCED PANEL */}
        <motion.div variants={fadeUp}>
          <MacroAdvancedPanel />
        </motion.div>

        {/* CRYPTO ADVANCED SIGNALS */}
        <motion.div variants={fadeUp}>
          <CryptoAdvancedSignals />
        </motion.div>

        {/* QUANT REGIMES PANEL */}
        <motion.div variants={fadeUp}>
          <QuantRegimesPanel />
        </motion.div>

        {/* TOP 5 SCORE ENGINE */}
        <motion.div variants={fadeUp}>
          <Top5ScoreEngine />
        </motion.div>

        {/* TOP TOKENS M15 SCANNER v8.0 */}
        <motion.div variants={fadeUp}>
          <TopTokenScanner equity={1000} />
        </motion.div>

        {/* TRADING CHECKLIST */}
        <motion.div variants={fadeUp}>
          <TradingChecklist />
        </motion.div>

        {/* M15 SCALPING SIGNALS */}
        <motion.div variants={fadeUp}>
          <M15ScalpingSignals />
        </motion.div>

        {/* INTRADAY HEATMAP */}
        <motion.div variants={fadeUp}>
          <IntradayHeatmap />
        </motion.div>

        {/* MACRO CONTEXT v8.0 */}
        <motion.div variants={fadeUp}>
          <MacroContext />
        </motion.div>

        {/* FUNDING AGGREGATOR */}
        <motion.div variants={fadeUp}>
          <FundingAggregator />
        </motion.div>

        {/* ORDER FLOW PROXY v8.0 */}
        <motion.div variants={fadeUp}>
          <OrderFlowProxy symbol="BTC" />
        </motion.div>

        {/* BTC ECOSYSTEM */}
        <motion.div variants={fadeUp}>
          <BtcEcosystemSection />
        </motion.div>

        {/* STRATEGY SIGNAL ENGINE */}
        <motion.div variants={fadeUp}>
          <StrategySignalEngine />
        </motion.div>

        {/* HYPERLIQUID PERPS MONITOR */}
        <motion.div variants={fadeUp}>
          <HyperliquidMonitor />
        </motion.div>

        {/* TRADE JOURNAL v8.0 */}
        <motion.div variants={fadeUp}>
          <TradeJournal />
        </motion.div>

        {/* EVIDENCE-BASED SIGNALS */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#aa66ff]" /> EVIDENCE-BASED SIGNALS
          </div>
          {cryptoSignals ? (
            <SignalSummary
              signals={cryptoSignals.signals}
              netBias={cryptoSignals.netBias}
              biasLabel={cryptoSignals.biasLabel}
              activeCount={cryptoSignals.activeCount}
              strongCount={cryptoSignals.strongCount}
              title="CRYPTO SIGNAL ENGINE V3"
            />
          ) : (
            <div className="py-10 text-center border-2 border-dashed border-[#1e1e32] rounded-xl font-mono text-[0.85rem] text-[#5a6070]">
              Chargement des signaux...
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-6 py-1.5 border-t border-[#1e1e32] bg-[#0e0e1a] font-mono text-[0.65rem] text-[#5a6070] flex-wrap">
        {apiStatus && Object.entries(apiStatus).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${v === 'ok' ? 'bg-[#4ade80]' : v === 'er' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
            {k?.toUpperCase?.() ?? k}
          </span>
        ))}
        <span className="flex-1" />
        <span>{latency}ms</span>
        <span>MACRO STACK v8.0 — M15 Scalping Mode</span>
      </div>
    </div>
  );
}
