'use client';
import { motion } from 'framer-motion';
import { useWhaleDiscovery } from '@/hooks/useWhaleDiscovery';
import { useMarketData } from '@/hooks/useMarketData';
import { useTradeSelection } from '@/hooks/useTradeSelection';
import { useSessionGuide } from '@/hooks/useSessionGuide';
import DecisionBar from '@/components/DecisionBar';
import ActionPanel from '@/components/ActionPanel';
import ContextPanel from '@/components/ContextPanel';
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

export default function Home() {
  const { whales, positions, whaleByCoin, totalLong, totalShort, loading: whaleLoading } = useWhaleDiscovery();
  const { data, score, coinData, loading, countdown, apiStatus, latency } = useMarketData(whaleByCoin, totalLong, totalShort);
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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen"
    >
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

      <div className="grid grid-cols-[65fr_35fr] min-h-[calc(100vh-88px)] max-md:grid-cols-1">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <ActionPanel
            trades={trades}
            alerts={alerts}
            whaleCount={whales.length}
            positions={positions}
            totalLong={totalLong}
            totalShort={totalShort}
            whaleByCoin={whaleByCoin}
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <ContextPanel
            data={data}
            score={score}
            whales={whales}
            positions={positions}
            whaleLoading={whaleLoading}
          />
        </motion.div>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-3 px-6 py-1 border-t border-[#1a1a30] bg-[#0c0c16] font-mono text-[0.62rem] text-[#556680] flex-wrap">
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
    </motion.div>
  );
}
