'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  dot?: string;
  children: React.ReactNode;
}

export default function CollapsibleSection({ title, defaultOpen = false, dot, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-[#1e1e32] rounded-xl overflow-hidden bg-[#0a0a14]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#0e0e1a] transition-colors"
      >
        <span className="font-mono text-[0.75rem] font-bold uppercase tracking-[3px] text-[#8890a0] flex items-center gap-2">
          {dot && <span className="w-[6px] h-[6px] rounded-full" style={{ background: dot }} />}
          {title}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-[#5a6070] text-[0.7rem]"
        >
          ▼
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
