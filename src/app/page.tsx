'use client';

import { motion } from 'framer-motion';
import { useWhaleDiscovery } from '@/hooks/useWhaleDiscovery';
import { useMarketData } from '@/hooks/useMarketData';
import { useSessionGuide } from '@/hooks/useSessionGuide';
import TradeJournal from '@/components/TradeJournal';
import M15ScalpingSignals from '@/components/M15ScalpingSignals';
import TradingChecklist from '@/components/TradingChecklist';
import { useTelegramAlerts } from '@/components/TelegramAlerts';
import MacroAdvancedPanel from '@/components/MacroAdvancedPanel';
import MacroCorrelationsPanel from '@/components/MacroCorrelationsPanel';
import QuantRegimesPanel from '@/components/QuantRegimesPanel';
import Top5ScoreEngine from '@/components/Top5ScoreEngine';
import MacroContext from '@/components/MacroContext';
import ExploratorySection from '@/components/ui/ExploratorySection';
import CompositeSignalsPanel from '@/components/CompositeSignalsPanel';
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
    return { light: 'stop', verdict: 'NO TRADE', sizing: hasClearBias ? '÷4' : 'CASH' };
  }
  if (!hasClearBias || vixElevated || eventClose) {
    return { light: 'caution', verdict: 'PRUDENT', sizing: (vixElevated || fgExtreme) ? '÷2' : '÷2' };
  }
  return { light: 'go', verdict: 'TRADE', sizing: avgVar < 3 ? 'FULL' : '÷2' };
}

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 },
};

export default function Home() {
  useTelegramAlerts();

  const { whales, whaleByCoin, totalLong, totalShort } = useWhaleDiscovery();
  const { data, score, coinData, apiStatus = {}, latency } = useMarketData(whaleByCoin, totalLong, totalShort);
  const { session, nextEvent } = useSessionGuide();

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

  const verdictColor = light === 'go' ? '#22c55e' : light === 'caution' ? '#f97316' : '#ef4444';

  return (
    <div className="min-h-screen bg-[#06060a]">
      {/* DECISION HEADER */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0a0a12] border-b border-[#1e1e32]">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: verdictColor }} />
          <span className="font-mono text-[0.75rem] font-bold" style={{ color: verdictColor }}>
            {verdict}
          </span>
        </div>
        <div className="w-px h-3 bg-[#1e1e32]" />
        <span className="font-mono text-[0.65rem] text-[#8890a0]">
          {(score?.score ?? 0) >= 0 ? '+' : ''}{(score?.score ?? 0).toFixed(1)}
        </span>
        <div className="w-px h-3 bg-[#1e1e32]" />
        <span className="font-mono text-[0.65rem] text-[#a0a8b8]">{sizing}</span>
        <div className="w-px h-3 bg-[#1e1e32]" />
        <span className="font-mono text-[0.6rem] text-[#5a6070]">REGIME</span>
        <span className="font-mono text-[0.65rem] text-[#8890a0]">RANGE</span>
        <div className="w-px h-3 bg-[#1e1e32]" />
        <span className="font-mono text-[0.6rem] text-[#5a6070]">SESSION</span>
        <span className={`font-mono text-[0.65rem] ${session.active ? 'text-[#22c55e]' : 'text-[#64748b]'}`}>
          {session.active || 'OFF'}
        </span>
        <div className="w-px h-3 bg-[#1e1e32]" />
        <span className="font-mono text-[0.6rem] text-[#5a6070]">NEWS</span>
        <span className={`font-mono text-[0.65rem] ${eventHours < 2 ? 'text-[#ef4444]' : eventHours < 24 ? 'text-[#f97316]' : 'text-[#64748b]'}`}>
          {eventHours < 2 ? 'HIGH' : eventHours < 24 ? 'MED' : 'LOW'}
        </span>
        <div className="flex-1" />
        <span className="font-mono text-[0.55rem] text-[#5a6070]">{latency}ms</span>
      </div>

      {/* MACRO DECISION */}
      <div className="max-w-[96rem] mx-auto p-3">
        <motion.div
          initial={fadeUp.hidden}
          animate={fadeUp.show}
          className="bg-[#0e0e1a] border border-[#1e1e32] rounded p-3 mb-3"
        >
          <div className="font-mono text-[0.6rem] text-[#5a6070] tracking-wider mb-2">MACRO DECISION ENGINE</div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono text-[0.7rem] text-[#8890a0]">Verdict</div>
              <div className="font-mono text-[0.9rem] font-bold mt-0.5" style={{ color: verdictColor }}>
                {verdict}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[0.7rem] text-[#8890a0]">Size</div>
              <div className="font-mono text-[0.9rem] font-bold mt-0.5 text-[#e8e8f0]">{sizing}</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-[#1e1e32] flex items-center justify-between">
            <span className="font-mono text-[0.6rem] text-[#5a6070]">Score</span>
            <span className="font-mono text-[0.7rem] text-[#8890a0]">
              {(score?.score ?? 0) >= 0 ? '+' : ''}{(score?.score ?? 0).toFixed(1)}
            </span>
          </div>
        </motion.div>

        {/* MACRO SECTIONS */}
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><MacroAdvancedPanel /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><MacroCorrelationsPanel /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><MacroContext /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><QuantRegimesPanel /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}>
          <ExploratorySection label="signaux composites · vw-tsmom / funding / macd">
            <CompositeSignalsPanel />
          </ExploratorySection>
        </motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><Top5ScoreEngine /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><TradingChecklist /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><M15ScalpingSignals /></motion.div>
        <motion.div initial={fadeUp.hidden} animate={fadeUp.show}><TradeJournal /></motion.div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-4 py-1 border-t border-[#1a1a30] bg-[#08080f] font-mono text-[0.55rem] text-[#5a6070]">
        {apiStatus && Object.entries(apiStatus).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`w-1 h-1 rounded-full ${v === 'ok' ? 'bg-[#4ade80]' : v === 'er' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'} inline-block`} />
            {k}
          </span>
        ))}
        <span className="flex-1" />
        <span>MACRO STACK — Décision + Contexte</span>
      </div>
    </div>
  );
}
