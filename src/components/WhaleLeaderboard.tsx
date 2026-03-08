'use client';
import type { WhaleInfo } from '@/lib/types';
import { fU, shortAddr } from '@/lib/format';

export default function WhaleLeaderboard({ whales, loading }: { whales: WhaleInfo[]; loading: boolean }) {
  const active = whales.filter(w => (w.posCount ?? 0) > 0);

  if (loading) {
    return (
      <div className="font-mono text-[0.65rem] text-[#a0a0b8] text-center py-3.5">
        Discovering whales...
        <div className="h-[3px] bg-[#1a1a30] rounded-sm mt-1 overflow-hidden">
          <div className="h-full bg-[#00e5ff] rounded-sm animate-pulse w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3.5">
      {/* Header */}
      <div className="grid grid-cols-[22px_78px_52px_58px_36px_30px] gap-1 px-1 py-0.5 font-mono text-[0.5rem] text-[#556680] tracking-[1px] uppercase">
        <span>#</span><span>Wallet</span><span>Acct</span><span>PnL 30d</span><span>Shp</span><span>Pos</span>
      </div>
      {active.length === 0 ? (
        <div className="font-mono text-[0.6rem] text-[#556680] py-2 px-1">No active whales found</div>
      ) : (
        active.slice(0, 5).map((w, i) => {
          const shCol = w.sharpe != null
            ? (w.sharpe > 2 ? '#00e5ff' : w.sharpe > 1 ? '#4ade80' : w.sharpe > 0 ? '#e8e8f0' : '#ff3355')
            : '#556680';
          return (
            <div key={w.addr} className="grid grid-cols-[22px_78px_52px_58px_36px_30px] gap-1 px-1 py-0.5 font-mono text-[0.58rem] border-b border-[#1a1a30]/40 items-center">
              <span className="text-[#556680]">{i + 1}</span>
              <span className="text-[#a0a0b8] text-[0.52rem]">{shortAddr(w.addr)}</span>
              <span>{fU(w.av)}</span>
              <span className={w.pnl >= 0 ? 'text-[#4ade80]' : 'text-[#ff3355]'}>{fU(w.pnl)}</span>
              <span style={{ color: shCol }}>{w.sharpe != null ? w.sharpe.toFixed(1) : '—'}</span>
              <span>{w.posCount ?? 0}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
