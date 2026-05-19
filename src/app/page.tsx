'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWhaleDiscovery } from '@/hooks/useWhaleDiscovery';
import { useMarketData } from '@/hooks/useMarketData';
import { useTradeSelection } from '@/hooks/useTradeSelection';
import { useSessionGuide } from '@/hooks/useSessionGuide';
import DecisionBar from '@/components/DecisionBar';
import SignalSummary from '@/components/ui/SignalSummary';
import TradeCard from '@/components/TradeCard';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import WhaleConsensus from '@/components/WhaleConsensus';
import MacroBlock from '@/components/MacroBlock';
import FundingSnapshot from '@/components/FundingSnapshot';
import WhaleLeaderboard from '@/components/WhaleLeaderboard';
import PositionsTable from '@/components/PositionsTable';
import ScoreBreakdown from '@/components/ScoreBreakdown';
import Alerts from '@/components/Alerts';
import BacktestPanel from '@/components/ui/BacktestPanel';
import HyperliquidMonitor from '@/components/HyperliquidMonitor';
import IntradayOpportunities from '@/components/IntradayOpportunities';
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
  const { whales, positions, whaleByCoin, totalLong, totalShort, loading: whaleLoading } = useWhaleDiscovery();
  const { data, score, coinData, cryptoSignals, loading, countdown, apiStatus, latency } = useMarketData(whaleByCoin, totalLong, totalShort);
  const { trades, alerts } = useTradeSelection(coinData, data);
  const { session, nextEvent } = useSessionGuide();
  const [selectedTrade, setSelectedTrade] = useState<number | null>(null);

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
      {/* ÉTAPE 1 — STICKY DECISION BAR */}
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
        {/* ÉTAPE 1.5 — HYPERLIQUID PERPS MONITOR */}
        <motion.div variants={fadeUp}>
          <HyperliquidMonitor />
        </motion.div>

        {/* ÉTAPE 1.6 — INTRADAY OPPORTUNITIES */}
        <motion.div variants={fadeUp}>
          <IntradayOpportunities />
        </motion.div>

        {/* ÉTAPE 2A — SIGNAL SUMMARY */}
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

        {/* ÉTAPE 2B — TOP TRADES */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> TOP TRADES
          </div>
          <AnimatePresence mode="wait">
            {trades.length === 0 ? (
              <motion.div
                key="no-trade"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-16 border-2 border-dashed border-[#1e1e32] rounded-xl"
              >
                <div className="text-[3rem] mb-3 opacity-60">🔇</div>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-[1.6rem] font-bold text-[#ff3355] font-mono tracking-[3px] mb-2"
                >
                  PAS DE SETUP — CASH
                </motion.div>
                <div className="font-mono text-[0.85rem] text-[#5a6070] max-w-md mx-auto">
                  Aucun coin ne passe les {cryptoSignals?.signals.length ?? 6} filtres evidence-based.
                  {cryptoSignals && cryptoSignals.signals.filter(s => s.direction === 'NEUTRAL').length > 3
                    ? ' Le marché est en range — patience.'
                    : ' Les signaux se contredisent — éviter le risque.'}
                </div>
                <div className="mt-4 font-mono text-[0.72rem] text-[#5a6070]">
                  Prochain check dans {countdown}s
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="trades"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {trades.map((t, i) => (
                  <TradeCard key={t.coin + t.dir} trade={t} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ÉTAPE 2C — ALERTS */}
        {alerts.length > 0 && (
          <motion.div variants={fadeUp}>
            <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
              <div className="w-[6px] h-[6px] rounded-full bg-[#ffaa00]" /> ALERTS
            </div>
            <Alerts alerts={alerts} />
          </motion.div>
        )}

        {/* ÉTAPE 3 — CONTEXT (collapsible) */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="WHALE CONSENSUS" dot="#ff006e" defaultOpen>
            <WhaleConsensus
              whaleCount={whales.length}
              positionCount={positions.length}
              totalLong={totalLong}
              totalShort={totalShort}
              whaleByCoin={whaleByCoin}
            />
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="MACRO SNAPSHOT" dot="#4488ff">
            <MacroBlock data={data} />
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="FUNDING SNAPSHOT" dot="#4ade80">
            <FundingSnapshot data={data} />
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="WHALE LEADERBOARD" dot="#aa66ff">
            <WhaleLeaderboard whales={whales} loading={whaleLoading} />
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="WHALE POSITIONS" dot="#00e5ff">
            <PositionsTable positions={positions} />
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="SCORE BREAKDOWN" dot="#d4a017">
            {score ? <ScoreBreakdown breakdown={score.bd} /> : <div className="font-mono text-[0.72rem] text-[#5a6070]">Loading...</div>}
          </CollapsibleSection>
        </motion.div>

        <motion.div variants={fadeUp}>
          <CollapsibleSection title="BACKTEST — 1 000 BOUGIES H1" dot="#d4a017">
            <BacktestPanel />
          </CollapsibleSection>
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
        <span>MACRO STACK v5.0 — Decision Engine</span>
      </div>
    </div>
  );
}
