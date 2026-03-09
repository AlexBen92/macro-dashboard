'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1 px-4 py-1.5 bg-[#06060a] border-b border-[#1a1a30]">
      <span className="font-mono text-[0.6rem] font-bold text-[#556680] tracking-[2px] mr-4">MACRO STACK</span>
      <Link
        href="/"
        className={`font-mono text-[0.65rem] px-3 py-1 rounded transition-colors ${
          path === '/' ? 'bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/30' : 'text-[#556680] hover:text-[#e8e8f0]'
        }`}
      >
        CRYPTO
      </Link>
      <Link
        href="/ftmo"
        className={`font-mono text-[0.65rem] px-3 py-1 rounded transition-colors ${
          path === '/ftmo' ? 'bg-[#d4a017]/10 text-[#d4a017] border border-[#d4a017]/30' : 'text-[#556680] hover:text-[#e8e8f0]'
        }`}
      >
        FTMO
      </Link>
    </nav>
  );
}
