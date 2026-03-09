'use client';
import type { WhalePosition } from '@/lib/types';
import { shortAddr, fU, fP } from '@/lib/format';

export default function PositionsTable({ positions }: { positions: WhalePosition[] }) {
  return (
    <table className="w-full border-collapse text-[0.75rem] font-mono">
      <thead>
        <tr>
          {['Wallet', 'Coin', 'Side', 'Lev', 'Notional', 'uPnL', 'Liq'].map(h => (
            <th key={h} className="text-[0.62rem] text-[#556680] tracking-[1px] uppercase text-right py-2 px-2 border-b border-[#1a1a30] first:text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {positions.slice(0, 20).map((p, i) => (
          <tr key={i} className="hover:bg-[rgba(0,229,255,0.02)]">
            <td className="text-left text-[#a0a0b8] py-2 px-2 border-b border-[#1a1a30]/30">{shortAddr(p.addr)}</td>
            <td className="text-right text-[#00e5ff] py-2 px-2 border-b border-[#1a1a30]/30">{p.coin}</td>
            <td className={`text-right py-2 px-2 border-b border-[#1a1a30]/30 ${p.side === 'LONG' ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>{p.side}</td>
            <td className="text-right py-2 px-2 border-b border-[#1a1a30]/30">{p.lev}x</td>
            <td className="text-right py-2 px-2 border-b border-[#1a1a30]/30">{fU(p.not)}</td>
            <td className={`text-right py-2 px-2 border-b border-[#1a1a30]/30 ${p.upnl >= 0 ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>{p.upnl >= 0 ? '+' : ''}{fU(p.upnl)}</td>
            <td className="text-right text-[#556680] py-2 px-2 border-b border-[#1a1a30]/30">{p.liq ? fP(p.liq) : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
