'use client';
import { motion, AnimatePresence } from 'framer-motion';

interface StrategyCardProps {
  icon: string;
  title: string;
  type: 'manual' | 'ea' | 'semi';
  status: string;
  children: React.ReactNode;
}

const STATUS_STYLES: Record<string, string> = {
  TRIGGERED: 'bg-emerald-500/20 text-emerald-400',
  READY: 'bg-amber-500/20 text-amber-400',
  ACTIVE: 'bg-cyan-500/20 text-cyan-400',
  SETUP: 'bg-emerald-500/20 text-emerald-400',
  FORMING: 'bg-blue-500/20 text-blue-400',
  LIVE: 'bg-cyan-500/20 text-cyan-400',
  PLACING: 'bg-amber-500/20 text-amber-400',
  SCANNING: 'bg-amber-500/20 text-amber-400',
  SIGNAL: 'bg-emerald-500/20 text-emerald-400',
  WATCHING: 'bg-blue-500/20 text-blue-400',
  WAITING: 'bg-gray-500/20 text-gray-400',
  INACTIVE: 'bg-gray-500/20 text-gray-500',
  EXPIRED: 'bg-red-500/20 text-red-400',
  OFF: 'bg-gray-500/20 text-gray-500',
  DONE: 'bg-gray-500/20 text-gray-500',
  IN_TRADE: 'bg-emerald-500/20 text-emerald-400',
};

const TYPE_LABELS: Record<string, string> = {
  manual: '✋ Manuel',
  ea: '🤖 EA',
  semi: '🔄 Semi-auto',
};

export default function StrategyCard({ icon, title, type, status, children }: StrategyCardProps) {
  const statusClass = STATUS_STYLES[status] || 'bg-gray-500/20 text-gray-400';
  const isPulsing = ['TRIGGERED', 'SETUP', 'SIGNAL', 'ACTIVE'].includes(status);

  return (
    <div className="border border-[#1a1a30] rounded-lg bg-[#0c0c16] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a1a30]/60">
        <span className="text-sm">{icon}</span>
        <span className="font-mono text-[0.72rem] font-bold text-[#e8e8f0] flex-1 tracking-wide">{title}</span>
        <span className="font-mono text-[0.55rem] text-[#556680]">{TYPE_LABELS[type]}</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={status}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className={`px-2 py-0.5 rounded text-[0.6rem] font-mono font-bold ${statusClass} ${isPulsing ? 'animate-pulse' : ''}`}
          >
            {status}
          </motion.span>
        </AnimatePresence>
      </div>
      {/* Body */}
      <div className="px-3 py-2 font-mono text-[0.62rem] text-[#a0a0b8] leading-relaxed space-y-0.5">
        {children}
      </div>
    </div>
  );
}
