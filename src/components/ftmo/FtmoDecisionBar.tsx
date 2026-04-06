'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { FtmoScoreResult } from '@/lib/ftmo/types';
import type { TrafficLightStatus } from '@/lib/types';
import TrafficLight from '../TrafficLight';
import Countdown from '../Countdown';
import { colorForScore } from '@/lib/format';

interface Props {
  light: TrafficLightStatus;
  verdict: string;
  score: FtmoScoreResult;
  riskPct: number;
  sessionActive: boolean;
  nextEvent: { name: string; countdown: string; hoursLeft: number } | null;
  countdown: number;
  loading: boolean;
  latency: number;
}

export default function FtmoDecisionBar({
  light, verdict, score, riskPct, sessionActive, nextEvent, countdown, loading, latency,
}: Props) {
  const scoreVal = score.score;
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
          className="font-mono text-[2rem] font-bold tracking-[4px]"
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
          className="font-mono text-[2.6rem] font-bold leading-none"
          style={{ color: scoreColor }}
        >
          {scoreVal >= 0 ? '+' : ''}{scoreVal.toFixed(1)}
        </motion.div>
      </AnimatePresence>

      <div className="font-mono text-[0.82rem] px-3 py-1.5 rounded-lg bg-[#12121e] border border-[#1e1e32]">
        <span className="text-[#5a6070]">Risk</span>{' '}
        <span className="text-[#d4a017] font-bold">{riskPct}%</span>
      </div>

      <div className="font-mono text-[0.82rem]">
        {sessionActive
          ? <span className="text-[#4ade80]">Session ✓</span>
          : <span className="text-[#ff3355]">Hors session ✗</span>
        }
      </div>

      {nextEvent && (
        <Countdown name={nextEvent.name} countdown={nextEvent.countdown} hoursLeft={nextEvent.hoursLeft} />
      )}

      <div className="flex-1" />

      <div className="flex items-center gap-3 max-md:hidden">
        {loading && <div className="w-3.5 h-3.5 border-2 border-[#1e1e32] border-t-[#d4a017] rounded-full animate-spin" />}
        <span className="font-mono text-[0.68rem] text-[#5a6070]">{countdown}s</span>
        <span className="font-mono text-[0.6rem] text-[#5a6070]">{latency}ms</span>
        <span className="font-mono text-[0.6rem] text-[#d4a017] font-bold">FTMO v4</span>
      </div>
    </div>
  );
}
