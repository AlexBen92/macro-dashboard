'use client';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface MoverData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  marketCap?: number;
}

interface Props {
  gainers?: MoverData[];
  losers?: MoverData[];
  loading?: boolean;
}

const generateSampleMovers = (): MoverData[] => {
  const coins = [
    { symbol: 'PEPE', name: 'Pepe', basePrice: 0.000005 },
    { symbol: 'FLOKI', name: 'Floki', basePrice: 0.00015 },
    { symbol: 'BONK', name: 'Bonk', basePrice: 0.00002 },
    { symbol: 'DOGE', name: 'Dogecoin', basePrice: 0.12 },
    { symbol: 'SHIB', name: 'Shiba Inu', basePrice: 0.00002 },
  ];

  return coins.map(coin => ({
    ...coin,
    price: coin.basePrice * (1 + (Math.random() - 0.3) * 0.3),
    change24h: (Math.random() * 40) - 5,
    volume24h: Math.random() * 500000000 + 50000000,
  }));
};

export default function TopMovers({ gainers, losers, loading }: Props) {
  const gainersData = gainers || generateSampleMovers().sort((a, b) => b.change24h - a.change24h).slice(0, 5);
  const losersData = losers || generateSampleMovers().sort((a, b) => a.change24h - b.change24h).slice(0, 5);

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING TOP MOVERS...
        </motion.div>
      </div>
    );
  }

  const formatPrice = (price: number): string => {
    if (price < 0.00001) return `$${price.toFixed(8)}`;
    if (price < 0.001) return `$${price.toFixed(6)}`;
    if (price < 1) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(2)}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            TOP MOVERS 24H
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          Gainers & Losers
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <div>
          <div className="font-mono text-[0.65rem] text-emerald-400 uppercase mb-3 flex items-center gap-2">
            <TrendingUp className="w-3 h-3" strokeWidth={1.5} />
            <span>Top Gainers</span>
          </div>
          <div className="space-y-2">
            {gainersData.map((mover, i) => (
              <motion.div
                key={mover.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3 hover:border-emerald-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#eaeef4]">
                        {mover.symbol}
                      </span>
                      <span className="font-mono text-[0.52rem] text-[#5a6070]">
                        {i + 1}
                      </span>
                    </div>
                    <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
                      {mover.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-[#eaeef4]">
                      {formatPrice(mover.price)}
                    </div>
                    <div className="font-mono text-sm font-bold text-emerald-400">
                      +{mover.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#1a1a2e] flex items-center justify-between">
                  <span className="font-mono text-[0.52rem] text-[#5a6070]">Volume 24h</span>
                  <span className="font-mono text-[0.58rem] text-[#8890a0]">{formatNumber(mover.volume24h)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div>
          <div className="font-mono text-[0.65rem] text-rose-400 uppercase mb-3 flex items-center gap-2">
            <TrendingDown className="w-3 h-3" strokeWidth={1.5} />
            <span>Top Losers</span>
          </div>
          <div className="space-y-2">
            {losersData.map((mover, i) => (
              <motion.div
                key={mover.symbol}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3 hover:border-rose-500/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#eaeef4]">
                        {mover.symbol}
                      </span>
                      <span className="font-mono text-[0.52rem] text-[#5a6070]">
                        {i + 1}
                      </span>
                    </div>
                    <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
                      {mover.name}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-bold text-[#eaeef4]">
                      {formatPrice(mover.price)}
                    </div>
                    <div className="font-mono text-sm font-bold text-rose-400">
                      {mover.change24h.toFixed(2)}%
                    </div>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[#1a1a2e] flex items-center justify-between">
                  <span className="font-mono text-[0.52rem] text-[#5a6070]">Volume 24h</span>
                  <span className="font-mono text-[0.58rem] text-[#8890a0]">{formatNumber(mover.volume24h)}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
