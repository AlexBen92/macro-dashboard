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
    <div className="flex items-center gap-4 px-6 py-3 bg-[#0c0c16] border-b-2 border-[#1a1a30] sticky top-0 z-50 min-h-[72px] flex-wrap">
      <TrafficLight status={light} />

      <AnimatePresence mode="wait">
        <motion.div
          key={verdict}
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 10, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="font-mono text-[1.5rem] font-bold tracking-[3px] min-w-[120px]"
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
          className="font-mono text-[2rem] font-bold min-w-[70px] text-center"
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
          className="font-mono text-[0.85rem] font-semibold tracking-[1px] px-3.5 py-1.5 rounded-[3px] bg-[#10101c]"
          style={{ border: `1px solid ${sizingBorder}` }}
        >
          {sizing}
        </motion.div>
      </AnimatePresence>

      <div className="font-mono text-[0.75rem] text-[#a0a0b8] flex flex-col gap-px">
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

      <div className="flex items-center gap-2">
        {loading && (
          <div className="w-3 h-3 border-2 border-[#1a1a30] border-t-[#00e5ff] rounded-full animate-spin" />
        )}
        <div className="font-mono text-[0.65rem] text-[#556680] min-w-[20px]">{countdown}</div>
        <div className="flex gap-1.5">
          {Object.entries(apiStatus).map(([k, v]) => (
            <span key={k} className="flex items-center gap-0.5 font-mono text-[0.52rem] text-[#556680]">
              <span className={`w-1 h-1 rounded-full inline-block ${v === 'ok' ? 'bg-[#4ade80]' : v === 'er' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
              {k.toUpperCase()}
            </span>
          ))}
        </div>
        <span className="font-mono text-[0.52rem] text-[#556680]">{latency}ms</span>
      </div>
    </div>
  );
}
