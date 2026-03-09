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
  apiStatus: Record<string, 'ok' | 'er' | 'ld'>;
}

export default function DecisionBar({
  light, verdict, score, sizing, session, nextEvent,
  countdown, loading, latency, apiStatus,
}: DecisionBarProps) {
  const scoreVal = score?.score ?? 0;
  const scoreColor = colorForScore(scoreVal);
  const verdictColor = light === 'go' ? '#4ade80' : light === 'caution' ? '#ffaa00' : '#ff006e';
  const sizingBorder = verdictColor;

  return (
    <div className="flex items-center gap-5 px-8 py-4 bg-[#0c0c16] border-b-2 border-[#1a1a30] sticky top-0 z-50 min-h-[84px] flex-wrap">
      <TrafficLight status={light} />

      <AnimatePresence mode="wait">
        <motion.div
          key={verdict}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[2.4rem] font-bold tracking-[4px] min-w-[140px]"
          style={{ color: verdictColor }}
        >
          {verdict}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={scoreVal}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[3.2rem] font-bold min-w-[90px] text-center leading-none"
          style={{ color: scoreColor }}
        >
          {scoreVal >= 0 ? '+' : ''}{scoreVal.toFixed(1)}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={sizing}
          initial={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
          animate={{ backgroundColor: 'rgba(255,255,255,0)' }}
          transition={{ duration: 1 }}
          className="font-mono text-[1rem] font-semibold tracking-[2px] px-4 py-2 rounded bg-[#10101c]"
          style={{ border: `1px solid ${sizingBorder}` }}
        >
          {sizing}
        </motion.div>
      </AnimatePresence>

      <div className="font-mono text-[0.85rem] text-[#a0a0b8] flex flex-col gap-px">
        {session.active ? (
          <span className="text-[#4ade80]">{session.active} ✓ active</span>
        ) : session.dead ? (
          <span className="text-[#ff3355]">{session.isSunday ? 'Sunday' : 'Dead zone'} ✗ avoid</span>
        ) : (
          <span>Between sessions</span>
        )}
      </div>

      {nextEvent && (
        <Countdown name={nextEvent.name} countdown={nextEvent.countdown} hoursLeft={nextEvent.hoursLeft} />
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3">
        {loading && (
          <div className="w-4 h-4 border-2 border-[#1a1a30] border-t-[#00e5ff] rounded-full animate-spin" />
        )}
        <div className="font-mono text-[0.72rem] text-[#556680] min-w-[24px]">{countdown}s</div>
        <div className="flex gap-2">
          {Object.entries(apiStatus).map(([k, v]) => (
            <span key={k} className="flex items-center gap-1 font-mono text-[0.62rem] text-[#556680]">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${v === 'ok' ? 'bg-[#4ade80]' : v === 'er' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
              {k.toUpperCase()}
            </span>
          ))}
        </div>
        <span className="font-mono text-[0.62rem] text-[#556680]">{latency}ms</span>
      </div>
    </div>
  );
}
