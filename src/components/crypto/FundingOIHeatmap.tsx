'use client';
import { motion } from 'framer-motion';
import { useMemo } from 'react';

interface HeatmapData {
  symbol: string;
  fundingRate: number;
  openInterest: number;
  volume24h: number;
}

interface Props {
  data?: HeatmapData[];
  loading?: boolean;
}

// Sample data
const generateSampleData = (): HeatmapData[] => {
  const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'AVAX', 'MATIC', 'LINK', 'DOT', 'UNI'];

  return symbols.map(symbol => {
    const fundingRate = (Math.random() - 0.5) * 0.1;
    const openInterest = Math.random() * 10000000000 + 500000000;
    const volume24h = Math.random() * 5000000000 + 500000000;

    return { symbol, fundingRate, openInterest, volume24h };
  });
};

export default function FundingOIHeatmap({ data = generateSampleData(), loading }: Props) {
  const processedData = useMemo(() => {
    return data.map(item => {
      // Calculate size based on OI relative to max
      const maxOI = Math.max(...data.map(d => d.openInterest));
      const sizePct = (item.openInterest / maxOI) * 100;

      // Color based on funding rate
      // Red = positive funding (longs pay shorts) → potential squeeze
      // Green = negative funding (shorts pay longs) → potential bounce
      const fundingPct = item.fundingRate * 100;

      return {
        ...item,
        sizePct,
        fundingPct,
      };
    });
  }, [data]);

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING FUNDING HEATMAP...
        </motion.div>
      </div>
    );
  }

  const getColor = (fundingRate: number): string => {
    if (fundingRate > 0.05) return 'rgba(239, 68, 68, 0.9)'; // Strong positive funding
    if (fundingRate > 0.02) return 'rgba(239, 68, 68, 0.6)'; // Moderate positive
    if (fundingRate > -0.02) return 'rgba(100, 116, 139, 0.4)'; // Neutral
    if (fundingRate > -0.05) return 'rgba(74, 222, 128, 0.6)'; // Moderate negative
    return 'rgba(74, 222, 128, 0.9)'; // Strong negative
  };

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            FUNDING × OI HEATMAP
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          Size = OI | Color = Funding
        </div>
      </div>

      <div className="p-5">
        {/* Legend */}
        <div className="mb-4 flex items-center gap-4 font-mono text-[0.58rem]">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#ef4444]" />
            <span className="text-[#5a6070]">Positive (Longs pay)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-[#4ade80]" />
            <span className="text-[#5a6070]">Negative (Shorts pay)</span>
          </div>
          <div className="ml-auto font-mono text-[0.58rem] text-[#5a6070]">
            Size relative to OI
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
          {processedData.map((item, i) => (
            <motion.div
              key={item.symbol}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="aspect-square rounded-lg cursor-pointer hover:scale-110 transition-transform relative group"
              style={{
                background: getColor(item.fundingRate),
                minWidth: `${Math.max(60, item.sizePct * 0.8)}px`,
                minHeight: `${Math.max(60, item.sizePct * 0.8)}px`,
              }}
            >
              {/* Symbol */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-sm font-bold text-white drop-shadow-lg">
                  {item.symbol}
                </span>
              </div>

              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[#0a0a14] border border-[#1e1e32] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                <div className="font-mono text-[0.65rem]">
                  <div className="text-[#eaeef4] font-bold mb-1">{item.symbol}</div>
                  <div className="text-[#5a6070]">
                    Funding: <span className={`${item.fundingPct >= 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {item.fundingPct >= 0 ? '+' : ''}{item.fundingPct.toFixed(3)}%
                    </span>
                  </div>
                  <div className="text-[#5a6070]">
                    OI: ${(item.openInterest / 1e9).toFixed(2)}B
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Interpretation guide */}
        <div className="mt-6 p-4 bg-[#0e0e1a] border border-[#1e1e32] rounded-lg">
          <div className="font-mono text-[0.65rem] text-[#8890a0] uppercase mb-2">
            💡 Interprétation
          </div>
          <ul className="space-y-1 font-mono text-[0.58rem] text-[#5a6070]">
            <li>
              <span className="text-rose-400">Funding positif extrême</span> → Longs surpayent → Squeeze court possible
            </li>
            <li>
              <span className="text-emerald-400">Funding négatif extrême</span> → Shorts surpayent → Rebound long possible
            </li>
            <li>
              <span className="text-[#eaeef4]">Grosse taille (OI élevé)</span> → Plus de potentiel de mouvement
            </li>
          </ul>
        </div>

        {/* Squeeze alerts */}
        {processedData.some(d => Math.abs(d.fundingPct) > 0.08) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-4 rounded-lg border-2 border-[#ffaa00] bg-[#ffaa0010]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-mono text-[0.65rem] font-bold text-[#ffaa00] uppercase mb-1">
                  POTENTIEL DE SQUEEZE DÉTECTÉ
                </div>
                <div className="font-mono text-[0.58rem] text-[#eaeef4]">
                  {processedData
                    .filter(d => Math.abs(d.fundingPct) > 0.08)
                    .map(d => d.symbol)
                    .join(', ')}{' '}
                  ont des funding extrêmes
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
