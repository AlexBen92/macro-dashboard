'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';

export default function Nav() {
  const path = usePathname();
  const links = [
    { href: '/', label: 'CRYPTO', color: '#00e5ff' },
    { href: '/ftmo', label: 'FTMO', color: '#d4a017' },
  ];

  return (
    <nav className="flex items-center gap-3 px-6 py-2.5 bg-[#06060a] border-b border-[#1a1a30]">
      <span className="font-mono text-[0.85rem] font-bold text-[#556680] tracking-[3px] mr-4">MACRO STACK</span>
      {links.map(l => {
        const active = path === l.href;
        return (
          <Link key={l.href} href={l.href} className="relative">
            <span
              className={`font-mono text-[0.9rem] font-semibold px-4 py-1.5 rounded transition-colors ${
                active
                  ? `bg-[${l.color}]/10 border border-[${l.color}]/30`
                  : 'text-[#556680] hover:text-[#e8e8f0]'
              }`}
              style={active ? { color: l.color, borderColor: l.color + '4d', background: l.color + '1a' } : undefined}
            >
              {l.label}
            </span>
            {active && (
              <motion.div
                layoutId="nav-indicator"
                className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded"
                style={{ background: l.color }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
