'use client';
import { motion } from 'framer-motion';
import type { TrafficLightStatus } from '@/lib/types';

const config: Record<TrafficLightStatus, { bg: string; border: string; shadow: string; text: string }> = {
  go: {
    bg: 'rgba(74,222,128,0.15)',
    border: '#4ade80',
    shadow: '0 0 30px rgba(74,222,128,0.4), 0 0 60px rgba(74,222,128,0.15)',
    text: '#4ade80',
  },
  caution: {
    bg: 'rgba(255,170,0,0.12)',
    border: '#ffaa00',
    shadow: '0 0 25px rgba(255,170,0,0.3)',
    text: '#ffaa00',
  },
  stop: {
    bg: 'rgba(255,0,110,0.12)',
    border: '#ff006e',
    shadow: '0 0 30px rgba(255,0,110,0.4), 0 0 60px rgba(255,0,110,0.15)',
    text: '#ff006e',
  },
};

export default function TrafficLight({ status }: { status: TrafficLightStatus }) {
  const c = config[status];
  return (
    <motion.div
      key={status}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        boxShadow: status === 'stop'
          ? ['0 0 20px rgba(255,0,110,0.3)', '0 0 40px rgba(255,0,110,0.6)', '0 0 20px rgba(255,0,110,0.3)']
          : c.shadow,
      }}
      transition={
        status === 'stop'
          ? { scale: { type: 'spring', stiffness: 300, damping: 20 }, boxShadow: { repeat: Infinity, duration: 1.5 } }
          : { type: 'spring', stiffness: 300, damping: 20 }
      }
      className="w-[60px] h-[60px] rounded-full flex items-center justify-center text-[1.8rem] font-bold shrink-0"
      style={{ background: c.bg, border: `3px solid ${c.border}`, color: c.text }}
    >
      ●
    </motion.div>
  );
}
