'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { ScoreResult, TrafficLightStatus, SessionInfo } from '@/lib/types';
import TrafficLight from './TrafficLight';
import Countdown from './Countdown';
import { colorForScore } from '@/lib/format';

interface DecisionBarProps {
  light: TrafficLightStatus;
  verdict: string;
  score: ScoreResult | null;
  sizing: string;
  session: SessionInfo;
  nextEvent: { name: string; countdown: string; hoursLeft: number } | null;
  countdown: number;
  loading: boolean;
  latency: number;
  apiStatus?: Record<string, 'ok' | 'er' | 'ld'>;
}

export default function DecisionBar({
  light, verdict, score, sizing, session, nextEvent,
  countdown, loading, latency, apiStatus,
}: DecisionBarProps) {
  const scoreVal = score?.score ?? 0;
  const scoreColor = colorForScore(scoreVal);
  const verdictColor = light === 'go' ? '#4ade80' : light === 'caution' ? '#ffaa00' : '#ff006e';

  return (
    <div className="flex items-center gap-5 px-8 py-3 max-w-[72rem] mx-auto w-full min-h-[76px] flex-wrap">
      <TrafficLight status={light} />

      <AnimatePresence mode="wait">
        <motion.div
          key={verdict}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[2rem] font-bold tracking-[4px] min-w-[120px]"
          style={{ color: verdictColor }}
        >
          {verdict}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={scoreVal}
          initial={{ y: -15, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[2.6rem] font-bold min-w-[80px] text-center leading-none"
          style={{ color: scoreColor }}
        >
          {scoreVal >= 0 ? '+' : ''}{scoreVal.toFixed(1)}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={sizing}
          initial={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
          animate={{ backgroundColor: 'rgba(255,255,255,0)' }}
          transition={{ duration: 1 }}
          className="font-mono text-[0.85rem] font-semibold tracking-[2px] px-3 py-1.5 rounded-lg bg-[#12121e]"
          style={{ border: `1px solid ${verdictColor}40` }}
        >
          {sizing}
        </motion.div>
      </AnimatePresence>

      <div className="font-mono text-[0.82rem] text-[#a0a8b8]">
        {session.active ? (
          <span className="text-[#4ade80]">{session.active} ✓</span>
        ) : session.dead ? (
          <span className="text-[#ff3355]">{session.isSunday ? 'Sunday' : 'Dead'} ✗</span>
        ) : (
          <span className="text-[#5a6070]">Between</span>
        )}
      </div>

      {nextEvent && (
        <Countdown name={nextEvent.name} countdown={nextEvent.countdown} hoursLeft={nextEvent.hoursLeft} />
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3 max-md:hidden">
        {loading && (
          <div className="w-3.5 h-3.5 border-2 border-[#1e1e32] border-t-[#00e5ff] rounded-full animate-spin" />
        )}
        <span className="font-mono text-[0.68rem] text-[#5a6070]">{countdown}s</span>
        <div className="flex gap-1.5">
          {apiStatus && Object.entries(apiStatus).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 font-mono text-[0.6rem] text-[#5a6070]">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${v === 'ok' ? 'bg-[#4ade80]' : v === 'er' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
              {k?.toUpperCase?.() ?? k}
            </span>
          ))}
        </div>
        <span className="font-mono text-[0.6rem] text-[#5a6070]">{latency}ms</span>
      </div>
    </div>
  );
}
