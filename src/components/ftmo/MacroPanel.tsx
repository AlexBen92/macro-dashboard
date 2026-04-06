'use client';
import TimeframeBadge from '@/components/ui/TimeframeBadge';
import type { EdgeFinderScore } from '@/hooks/useEdgeFinder';

function MacroRow({ label, value, trend, note, size }: {
  label: string;
  value?: string;
  trend?: 'up' | 'down' | 'bullish' | 'bearish';
  note?: string;
  size?: 'lg';
}) {
  const trendColor =
    trend === 'up' || trend === 'bullish' ? 'text-emerald-400' :
    trend === 'down' || trend === 'bearish' ? 'text-rose-400' : 'text-[#eaeef4]';
  const trendIcon =
    trend === 'up' || trend === 'bullish' ? '▲' :
    trend === 'down' || trend === 'bearish' ? '▼' : '';

  return (
    <div>
      <div className="flex justify-between items-baseline">
        <span className="font-mono text-[0.7rem] text-[#8890a0]">{label}</span>
        {value && (
          <span className={`font-mono font-bold ${size === 'lg' ? 'text-base' : 'text-[0.75rem]'} ${trendColor}`}>
            {trendIcon && <span className="text-[0.55rem] mr-1">{trendIcon}</span>}
            {value}
          </span>
        )}
      </div>
      {note && <div className="font-mono text-[0.5rem] text-[#3a4050] mt-0.5 leading-snug">{note}</div>}
    </div>
  );
}

interface Props {
  macro: Record<string, number>;
  goldPrice: { price: number | null; source: string } | null;
  oilPrice: { price: number | null; prevPrice: number | null; source: string } | null;
  scores: Record<string, EdgeFinderScore>;
}

export default function MacroPanel({ macro, goldPrice, oilPrice, scores }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* US Macro */}
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[2px] text-[#8890a0]">US MACRO</span>
          <TimeframeBadge tf="M1" />
        </div>
        <div className="space-y-3">
          <MacroRow
            label="Fed Funds"
            value={macro.fedFunds != null ? `${macro.fedFunds.toFixed(2)}%` : 'N/A'}
            trend={macro.fedFunds > macro.fedFundsPrev ? 'up' : macro.fedFunds < macro.fedFundsPrev ? 'down' : undefined}
          />
          <MacroRow
            label="CPI YoY"
            value={macro.cpiYoY != null ? `${macro.cpiYoY.toFixed(1)}%` : 'N/A'}
            trend={macro.cpi > macro.cpiPrev ? 'up' : 'down'}
            note="CPI hausse = hawkish = USD fort"
          />
          <MacroRow
            label="NFP"
            value={macro.nfp != null ? `${(macro.nfp / 1000).toFixed(0)}K` : 'N/A'}
            trend={macro.nfp > macro.nfpPrev ? 'up' : 'down'}
            note="Emploi hausse = USD fort"
          />
          <MacroRow
            label="10Y"
            value={macro.treasury10y != null ? `${macro.treasury10y.toFixed(2)}%` : 'N/A'}
          />
          <MacroRow
            label="TIPS Real"
            value={macro.tipsReal != null ? `${macro.tipsReal.toFixed(2)}%` : 'N/A'}
            note="Real yield négatif = Gold bullish (He et al. 2020)"
          />
          <MacroRow
            label="Breakeven"
            value={macro.breakeven != null ? `${macro.breakeven.toFixed(2)}%` : 'N/A'}
          />
        </div>
        <div className="mt-3 pt-3 border-t border-[#1e1e32] font-mono text-[0.58rem] text-[#5a6070]">
          Stance: {macro.fedFunds > macro.breakeven
            ? 'Restrictive (real rate +) → USD fort'
            : 'Accommodative → USD faible'}
        </div>
      </div>

      {/* Gold Drivers */}
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[2px] text-[#d4a017]">GOLD DRIVERS</span>
          <TimeframeBadge tf="D1" />
        </div>
        <div className="space-y-3">
          <MacroRow
            label="Price"
            value={goldPrice?.price ? `$${goldPrice.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : 'N/A'}
            size="lg"
          />
          <MacroRow
            label="Real Yield"
            value={macro.tipsReal != null ? `${macro.tipsReal.toFixed(2)}%` : 'N/A'}
            trend={macro.tipsReal < 1.5 ? 'bullish' : 'bearish'}
            note="< 1.5% = Gold bullish (He, Guo & Yu, NAJEF 2020)"
          />
          <MacroRow
            label="USD Score"
            value={scores.USD ? `${scores.USD.total > 0 ? '+' : ''}${scores.USD.total}` : 'N/A'}
            trend={scores.USD?.total < 0 ? 'bullish' : 'bearish'}
            note="USD faible = Gold bullish (corr -0.72)"
          />
          <MacroRow
            label="COT Index"
            value={scores.GOLD ? `${scores.GOLD.breakdown.cot > 0 ? '+' : ''}${scores.GOLD.breakdown.cot}` : 'N/A'}
          />
          <MacroRow
            label="Seasonality"
            value={scores.GOLD?.breakdown.seasonal > 0 ? 'Bullish' : scores.GOLD?.breakdown.seasonal < 0 ? 'Bearish' : 'Neutral'}
          />
        </div>
      </div>

      {/* Oil Drivers */}
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[2px] text-rose-400">OIL DRIVERS</span>
          <TimeframeBadge tf="W1" />
        </div>
        <div className="space-y-3">
          <MacroRow
            label="WTI"
            value={oilPrice?.price ? `$${oilPrice.price.toFixed(2)}` : 'N/A'}
            size="lg"
          />
          {oilPrice?.price && oilPrice.prevPrice && (
            <MacroRow
              label="Change"
              value={`${(((oilPrice.price - oilPrice.prevPrice) / oilPrice.prevPrice) * 100).toFixed(1)}%`}
              trend={oilPrice.price > oilPrice.prevPrice ? 'up' : 'down'}
            />
          )}
          <MacroRow
            label="COT"
            value={scores.OIL ? `${scores.OIL.breakdown.cot > 0 ? '+' : ''}${scores.OIL.breakdown.cot}` : 'N/A'}
          />
          <MacroRow
            label="EIA"
            note="Mercredi 15:30 UTC — momentum post-annonce (Wen et al. 2022)"
          />
          <MacroRow
            label="Seasonality"
            value={scores.OIL?.breakdown.seasonal > 0 ? 'Bullish' : scores.OIL?.breakdown.seasonal < 0 ? 'Bearish' : 'Neutral'}
          />
        </div>
      </div>
    </div>
  );
}
