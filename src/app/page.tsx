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
import BtcEcosystemSection from '@/components/btc-ecosystem/BtcEcosystemSection';
import type { TrafficLightStatus } from '@/lib/types';

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
  const { whales, positions, whaleByCoin, totalLong, totalShort } = useWhaleDiscovery();
  const { data, score, coinData, cryptoSignals, loading, countdown, apiStatus, latency } = useMarketData(whaleByCoin, totalLong, totalShort);
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
        {/*  MACRO STACK v6.0 — CORE COMPONENTS             */}
        {/* ============================================== */}

        {/* TOP 5 SCORE ENGINE */}
        <motion.div variants={fadeUp}>
          <Top5ScoreEngine />
        </motion.div>

        {/* INTRADAY HEATMAP */}
        <motion.div variants={fadeUp}>
          <IntradayHeatmap />
        </motion.div>

        {/* FUNDING AGGREGATOR */}
        <motion.div variants={fadeUp}>
          <FundingAggregator />
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
        {Object.entries(apiStatus).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${v === 'ok' ? 'bg-[#4ade80]' : v === 'er' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
            {k.toUpperCase()}
          </span>
        ))}
        <span className="flex-1" />
        <span>{latency}ms</span>
        <span>MACRO STACK v6.0 — Clean Mode</span>
      </div>
    </div>
  );
}
