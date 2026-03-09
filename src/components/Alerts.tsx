'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { AlertItem } from '@/lib/types';

const borderColors: Record<string, string> = {
  danger: '#ff3355',
  info: '#4488ff',
  '': '#ffaa00',
};

const bgColors: Record<string, string> = {
  danger: 'rgba(255,51,85,0.04)',
  info: 'rgba(68,136,255,0.03)',
  '': 'rgba(255,170,0,0.04)',
};

export default function Alerts({ alerts }: { alerts: AlertItem[] }) {
  return (
    <div className="flex flex-col gap-1.5 mb-3">
      <AnimatePresence>
        {alerts.length === 0 ? (
          <div className="font-mono text-[0.82rem] text-[#556680] py-2">No active alerts</div>
        ) : (
          alerts.map((a, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: i * 0.1 }}
              className="font-mono text-[0.82rem] px-3 py-2 rounded text-[#a0a0b8]"
              style={{
                borderLeft: `3px solid ${borderColors[a.t] || '#ffaa00'}`,
                background: bgColors[a.t] || bgColors[''],
              }}
            >
              ⚠ {a.m}
            </motion.div>
          ))
        )}
      </AnimatePresence>
    </div>
  );
}
