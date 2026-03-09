'use client';
import type { YahooCandle } from '@/lib/ftmo/types';
import { atr } from '@/lib/ftmo/indicators';
import Sparkline from '../Sparkline';

interface Props {
  goldCandles: YahooCandle[];
  oilCandles: YahooCandle[];
  brentCandles: YahooCandle[];
  goldPrice: number;
  oilPrice: number;
  brentPrice: number;
}

export default function GoldOilPanel({ goldCandles, oilCandles, brentCandles, goldPrice, oilPrice, brentPrice }: Props) {
  const goldATR = goldCandles.length > 14 ? atr(goldCandles, 14) : 0;
  const oilATR = oilCandles.length > 14 ? atr(oilCandles, 14) : 0;

  // Brent-WTI spread
  const spread = brentPrice - oilPrice;

  // Pivot points (simple: yesterday H/L/C)
  const goldYesterday = goldCandles.length > 24 ? goldCandles[goldCandles.length - 25] : null;
  let pp = 0, r1 = 0, s1 = 0;
  if (goldYesterday) {
    pp = (goldYesterday.h + goldYesterday.l + goldYesterday.c) / 3;
    r1 = 2 * pp - goldYesterday.l;
    s1 = 2 * pp - goldYesterday.h;
  }

  return (
    <div className="space-y-3">
      {/* Gold */}
      <div className="border-b border-[#1a1a30] pb-3">
        <div className="flex items-center gap-2.5 font-mono text-[0.82rem] mb-1.5">
          <span className="text-[#d4a017] font-bold">🥇 GOLD</span>
          <span className="text-[#e8e8f0] font-bold text-[1.1rem]">${goldPrice.toFixed(1)}</span>
          <div className="flex-1"><Sparkline data={goldCandles.slice(-24).map(c => c.c)} color="#d4a017" width={80} height={20} /></div>
        </div>
        <div className="font-mono text-[0.72rem] text-[#a0a0b8] space-y-0.5">
          <div>ATR(14) H1: <span className="text-[#e8e8f0]">${goldATR.toFixed(2)}</span></div>
          {pp > 0 && (
            <div>
              Pivot: <span className="text-[#e8e8f0]">${pp.toFixed(0)}</span> |
              R1: <span className="text-[#ff3355]">${r1.toFixed(0)}</span> |
              S1: <span className="text-[#4ade80]">${s1.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Oil */}
      <div>
        <div className="flex items-center gap-2.5 font-mono text-[0.82rem] mb-1.5">
          <span className="text-[#ff8800] font-bold">🛢 WTI</span>
          <span className="text-[#e8e8f0] font-bold text-[1.1rem]">${oilPrice.toFixed(2)}</span>
          <span className="text-[#556680]">Brent ${brentPrice.toFixed(2)}</span>
        </div>
        <div className="font-mono text-[0.72rem] text-[#a0a0b8] space-y-0.5">
          <div>ATR(14) H1: <span className="text-[#e8e8f0]">${oilATR.toFixed(2)}</span></div>
          <div>Brent-WTI spread: <span className="text-[#e8e8f0]">${spread.toFixed(2)}</span></div>
        </div>
        <div className="mt-1.5"><Sparkline data={oilCandles.slice(-24).map(c => c.c)} color="#ff8800" width={100} height={20} /></div>
      </div>
    </div>
  );
}
