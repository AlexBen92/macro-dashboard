'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { useFtmoData } from '@/hooks/ftmo/useFtmoData';
import { useFlowMap } from '@/hooks/ftmo/useFlowMap';
import { useEdgeFinder } from '@/hooks/useEdgeFinder';
import FtmoDecisionBar from '@/components/ftmo/FtmoDecisionBar';
import MacroFlowMap from '@/components/ftmo/MacroFlowMap';
import SignalSummary from '@/components/ui/SignalSummary';
import CollapsibleSection from '@/components/ui/CollapsibleSection';
import FtmoTradeCard from '@/components/ftmo/FtmoTradeCard';
import GoldOilPanel from '@/components/ftmo/GoldOilPanel';
import SessionClock from '@/components/ftmo/SessionClock';
import ScorePanel from '@/components/ftmo/ScorePanel';
import TradableToday from '@/components/ftmo/TradableToday';
import BacktestPanel from '@/components/ui/BacktestPanel';
import EdgeFinderTable from '@/components/ftmo/EdgeFinderTable';
import COTCards from '@/components/ftmo/COTCards';
import CurrencyStrengthV2 from '@/components/ftmo/CurrencyStrengthV2';
import MacroPanel from '@/components/ftmo/MacroPanel';
import FtmoRulesPanel from '@/components/ftmo/FtmoRulesPanel';
import GoNoGoPanel from '@/components/ftmo/GoNoGoPanel';
import PnLCalendar from '@/components/ftmo/PnLCalendar';
import PositionSizeCalculator from '@/components/ftmo/PositionSizeCalculator';
import type { TrafficLightStatus } from '@/lib/types';

function computeLight(score: number, vix: number, sessionActive: boolean, eventHours: number): { light: TrafficLightStatus; verdict: string } {
  if (vix > 30 || eventHours < 2) return { light: 'stop', verdict: 'NO TRADE' };
  if (score < -2 || !sessionActive || vix > 25 || eventHours < 24) return { light: 'caution', verdict: 'PRUDENT' };
  if (score > 2) return { light: 'go', verdict: 'TRADE' };
  return { light: 'caution', verdict: 'PRUDENT' };
}

const stagger = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 200, damping: 20 } },
};

export default function FtmoPage() {
  const ftmo = useFtmoData();
  const { nodes, edges, alerts } = useFlowMap(ftmo.instruments);
  const edgeFinder = useEdgeFinder();

  const nowH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const sessionActive = (nowH >= 7 && nowH <= 16) || (nowH >= 13 && nowH <= 22);
  const eventHours = ftmo.nextEvent?.hoursLeft ?? 999;
  const { light, verdict } = computeLight(ftmo.score.score, ftmo.vix, sessionActive, eventHours);

  return (
    <div className="min-h-screen">
      {/* STICKY DECISION BAR */}
      <div className="decision-bar-sticky">
        <FtmoDecisionBar
          light={light}
          verdict={verdict}
          score={ftmo.score}
          riskPct={0.5}
          sessionActive={sessionActive}
          nextEvent={ftmo.nextEvent}
          countdown={ftmo.countdown}
          loading={ftmo.loading}
          latency={ftmo.latency}
        />
      </div>

      {/* VERTICAL FLOW */}
      <motion.div
        className="v4-container"
        variants={stagger}
        initial="hidden"
        animate="show"
      >
        {/* ROW 1 — EDGEFINDER SCORE TABLE (LE CŒUR) */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#d4a017]" /> EDGEFINDER
            {edgeFinder.timestamp && (
              <span className="text-[0.58rem] text-[#3a4050] ml-auto">
                {new Date(edgeFinder.timestamp).toLocaleTimeString()}
              </span>
            )}
          </div>
          <EdgeFinderTable scores={edgeFinder.scores} loading={edgeFinder.loading} />
          {edgeFinder.error && (
            <div className="mt-2 font-mono text-[0.65rem] text-rose-400">EdgeFinder error: {edgeFinder.error}</div>
          )}
        </motion.div>

        {/* ROW 2 — FTMO RULES PANEL (NEW - PRIORITÉ MAXIMALE) */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#ff3355] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#ff3355] animate-pulse" /> FTMO RULES
            <span className="text-[0.58rem] text-[#5a6070] ml-auto">CONFORMITÉ EN TEMPS RÉEL</span>
          </div>
          <FtmoRulesPanel loading={ftmo.loading} />
        </motion.div>

        {/* ROW 3 — GO/NO-GO PANEL (NEW) */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#4ade80]" /> GO / NO-GO
            <span className="text-[0.58rem] text-[#5a6070] ml-auto">CONTEXTES MARCHÉ × FTMO</span>
          </div>
          <GoNoGoPanel
            marketContext={{
              vix: ftmo.vix,
              realizedVol24h: 15 + Math.random() * 10,
              regime: ftmo.vix < 20 ? 'TREND' : 'VOLATILE',
              fundingRate: 0.01,
              openInterestChange: 5.2,
              sessionActive,
            }}
            ftmoContext={{
              drawdownUsed: 38,
              drawdownRemaining: 6.2,
              dailyLossUsed: 24,
              accountBalance: 100000,
            }}
            loading={ftmo.loading}
          />
        </motion.div>

        {/* ROW 4 — TRADABLE TODAY */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#4ade80]" /> TRADABLE TODAY
          </div>
          <TradableToday instruments={ftmo.tradableToday} />
        </motion.div>

        {/* ROW 3 — EVIDENCE-BASED SIGNALS */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#aa66ff]" /> EVIDENCE-BASED SIGNALS
          </div>
          <SignalSummary
            signals={ftmo.ftmoSignals.signals}
            netBias={ftmo.ftmoSignals.netBias}
            biasLabel={ftmo.ftmoSignals.biasLabel}
            activeCount={ftmo.ftmoSignals.activeCount}
            strongCount={ftmo.ftmoSignals.strongCount}
            title="FTMO SIGNAL ENGINE V3"
          />
        </motion.div>

        {/* ROW 4 — TOP TRADES */}
        <motion.div variants={fadeUp}>
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase mb-3 flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> TOP TRADES
          </div>
          <AnimatePresence mode="wait">
            {ftmo.trades.length > 0 ? (
              <motion.div
                key="trades"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {ftmo.trades.slice(0, 3).map((t, i) => (
                  <FtmoTradeCard key={t.instrument + t.direction} trade={t} index={i} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="no-trade"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16 border-2 border-dashed border-[#1e1e32] rounded-xl"
              >
                <div className="text-[3rem] mb-3 opacity-60">🔇</div>
                <motion.div
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="font-mono text-[1.6rem] font-bold text-[#ff3355] tracking-[3px] mb-2"
                >
                  PAS DE SETUP — CASH
                </motion.div>
                <div className="font-mono text-[0.85rem] text-[#5a6070] max-w-md mx-auto">
                  Aucune stratégie ne génère de signal. {ftmo.ftmoSignals.signals.filter(s => s.direction === 'NEUTRAL').length > 4
                    ? 'Marché en range — patience.'
                    : 'Signaux contradictoires — rester cash.'}
                </div>
                <div className="mt-4 font-mono text-[0.72rem] text-[#5a6070]">
                  Prochain check dans {ftmo.countdown}s
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ROW 5 — PNL CALENDAR (NEW) */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="PNL CALENDAR" dot="#aa66ff" defaultOpen={false}>
            <PnLCalendar loading={ftmo.loading} />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 6 — POSITION SIZE CALCULATOR (NEW) */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="POSITION SIZE CALCULATOR" dot="#4ade80" defaultOpen={false}>
            <PositionSizeCalculator />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 7 — MACRO FLOW MAP */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="MACRO FLOW MAP" dot="#d4a017" defaultOpen>
            <MacroFlowMap nodes={nodes} edges={edges} alerts={alerts} />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 6 — COT DETAIL */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="COT DETAIL" dot="#00e5ff">
            <COTCards cot={edgeFinder.cot} />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 7 — CURRENCY STRENGTH */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="CURRENCY STRENGTH" dot="#aa66ff">
            <CurrencyStrengthV2 strength={edgeFinder.strength} />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 8 — MACRO CONTEXT */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="MACRO CONTEXT" dot="#d4a017">
            <MacroPanel
              macro={edgeFinder.macro}
              goldPrice={edgeFinder.goldPrice}
              oilPrice={edgeFinder.oilPrice}
              scores={edgeFinder.scores}
            />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 9 — GOLD / OIL */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="GOLD / OIL" dot="#d4a017">
            <GoldOilPanel
              goldCandles={ftmo.raw['XAUUSD_1h']?.candles ?? []}
              oilCandles={ftmo.raw['OIL_1h']?.candles ?? []}
              brentCandles={ftmo.raw['BRENT_1h']?.candles ?? []}
              goldPrice={ftmo.instruments.XAUUSD?.price ?? 0}
              oilPrice={ftmo.instruments.OIL?.price ?? 0}
              brentPrice={ftmo.raw['BRENT_1h']?.price ?? 0}
            />
          </CollapsibleSection>
        </motion.div>

        {/* ROW 10 — SESSION / CALENDAR */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="SESSION / CALENDAR" dot="#aa66ff">
            <SessionClock />
            <div className="mt-3">
              <ScorePanel score={ftmo.score} />
            </div>
          </CollapsibleSection>
        </motion.div>

        {/* ROW 11 — BACKTEST */}
        <motion.div variants={fadeUp}>
          <CollapsibleSection title="BACKTEST — XAU · NAS100 · EUR · GBP" dot="#d4a017">
            <BacktestPanel mode="ftmo" />
          </CollapsibleSection>
        </motion.div>
      </motion.div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-6 py-1.5 border-t border-[#1e1e32] bg-[#0e0e1a] font-mono text-[0.65rem] text-[#5a6070]">
        <span>VIX: <span className={ftmo.vix > 25 ? 'text-[#ff3355]' : 'text-[#4ade80]'}>{ftmo.vix.toFixed(1)}</span></span>
        <span>DXY: <span className="text-[#eaeef4]">{ftmo.dxyPrice.toFixed(1)}</span></span>
        <span>10Y: <span className="text-[#eaeef4]">{ftmo.yield10y.toFixed(2)}%</span></span>
        <span className="flex-1" />
        <span>
          EF: {Object.values(edgeFinder.apiStatus).filter(s => s === 'ok').length}/{Object.keys(edgeFinder.apiStatus).length} APIs
        </span>
        <span>{ftmo.latency}ms</span>
        <span>MACRO STACK — FTMO Decision Engine v4 + EdgeFinder</span>
      </div>
    </div>
  );
}
