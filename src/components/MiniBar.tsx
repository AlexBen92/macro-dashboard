'use client';
import { motion } from 'framer-motion';

export default function MiniBar({ value, color, maxWidth = 80 }: {
  value: number; // 0–100
  color: string;
  maxWidth?: number;
}) {
  return (
    <div className="h-1 rounded-sm overflow-hidden bg-[#08080f]" style={{ maxWidth }}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="h-full rounded-sm"
        style={{ background: color }}
      />
    </div>
  );
}
