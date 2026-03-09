'use client';
import type { MarketData } from '@/lib/types';
import { ASSETS } from '@/lib/constants';
import { fF } from '@/lib/format';

export default function FundingSnapshot({ data }: { data: MarketData | null }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-[48px_1fr_1fr_56px] gap-px bg-[#1a1a30] rounded overflow-hidden mb-4">
      <div className="bg-[#10101c] py-2 px-3 font-mono text-[0.62rem] text-[#556680] tracking-[1px] uppercase" />
      <div className="bg-[#10101c] py-2 px-3 font-mono text-[0.62rem] text-[#556680] tracking-[1px] uppercase">Binance</div>
      <div className="bg-[#10101c] py-2 px-3 font-mono text-[0.62rem] text-[#556680] tracking-[1px] uppercase">HL</div>
      <div className="bg-[#10101c] py-2 px-3 font-mono text-[0.62rem] text-[#556680] tracking-[1px] uppercase">Div</div>
      {ASSETS.map(a => {
        const bf = data.bFund[a] != null ? data.bFund[a] * 100 : null;
        const hf = data.hl[a] ? data.hl[a].f * 100 : null;
        const div = bf != null && hf != null && ((bf >= 0) !== (hf >= 0));
        return [
          <div key={a + '-name'} className="bg-[#10101c] py-2.5 px-3 font-mono text-[0.78rem] text-[#00e5ff] font-bold">{a}</div>,
          <div key={a + '-bin'} className="bg-[#0c0c16] py-2.5 px-3 font-mono text-[0.78rem] font-semibold text-center" style={{ color: bf != null ? (bf >= 0 ? '#4ade80' : '#ff3355') : '#556680' }}>{fF(bf)}</div>,
          <div key={a + '-hl'} className="bg-[#0c0c16] py-2.5 px-3 font-mono text-[0.78rem] font-semibold text-center" style={{ color: hf != null ? (hf >= 0 ? '#4ade80' : '#ff3355') : '#556680' }}>{fF(hf)}</div>,
          <div key={a + '-div'} className="bg-[#0c0c16] py-2.5 px-3 font-mono text-[0.78rem] text-center" style={{ color: div ? '#ffaa00' : '#556680' }}>{div ? '⚡ OUI' : 'non'}</div>,
        ];
      })}
    </div>
  );
}
