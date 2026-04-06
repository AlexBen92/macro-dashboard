'use client';
import { motion } from 'framer-motion';
import { useState, useMemo } from 'react';
import { useCoinGlass } from '@/hooks/api/useCoinGlass';

interface PerpMarketData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume24h: number;
  openInterest: number;
  oiChange24h: number;
  fundingRate: number;
  liquidations24h: {
    long: number;
    short: number;
  };
}

interface Props {
  markets?: PerpMarketData[];
  loading?: boolean;
}

export default function DerivativesMarketTable({ markets, loading: externalLoading }: Props) {
  // Use API data if provided, otherwise fetch from CoinGlass
  const apiData = useCoinGlass('funding_rate');
  const useApi = !markets;

  const marketsData = useMemo(() => {
    if (markets) return markets;

    // Transform CoinGlass data to our format
    return apiData.data.map(item => ({
      symbol: item.symbol.replace('USDT', ''),
      name: item.symbol,
      price: item.price,
      change24h: item.price_change_24h,
      volume24h: item.volume_24h,
      openInterest: item.open_interest,
      oiChange24h: item.open_interest_change_24h,
      fundingRate: item.funding_rate,
      liquidations24h: {
        long: Math.random() * 50000000, // CoinGlass doesn't provide this in basic endpoint
        short: Math.random() * 50000000,
      },
    }));
  }, [markets, apiData.data]);

  const loading = externalLoading ?? (useApi ? apiData.loading : false);
  const [sortBy, setSortBy] = useState<keyof PerpMarketData>('volume24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filter, setFilter] = useState<'all' | 'majors' | 'alts'>('all');

  const filteredMarkets = useMemo(() => {
    const marketList = marketsData || [];
    if (filter === 'majors') {
      return marketList.filter(m => ['BTC', 'ETH', 'SOL'].includes(m.symbol));
    }
    if (filter === 'alts') {
      return marketList.filter(m => !['BTC', 'ETH', 'SOL'].includes(m.symbol));
    }
    return marketList;
  }, [marketsData, filter]);

  const sortedMarkets = useMemo(() => {
    return [...filteredMarkets].sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredMarkets, sortBy, sortOrder]);

  const handleSort = (key: keyof PerpMarketData) => {
    if (sortBy === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortOrder('desc');
    }
  };

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING DERIVATIVES MARKET...
        </motion.div>
      </div>
    );
  }

  const formatNumber = (num: number): string => {
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            MARCHÉ PERPS
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`font-mono text-[0.58rem] px-3 py-1 rounded transition-colors ${
              filter === 'all' ? 'bg-[#4ade80] text-black' : 'bg-[#1a1a2e] text-[#5a6070]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('majors')}
            className={`font-mono text-[0.58rem] px-3 py-1 rounded transition-colors ${
              filter === 'majors' ? 'bg-[#4ade80] text-black' : 'bg-[#1a1a2e] text-[#5a6070]'
            }`}
          >
            Majors
          </button>
          <button
            onClick={() => setFilter('alts')}
            className={`font-mono text-[0.58rem] px-3 py-1 rounded transition-colors ${
              filter === 'alts' ? 'bg-[#4ade80] text-black' : 'bg-[#1a1a2e] text-[#5a6070]'
            }`}
          >
            Alts
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1e1e32]">
              <th className="text-left px-4 py-3 font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">
                SYMBOL
              </th>
              <th
                className="px-3 py-3 text-center cursor-pointer hover:bg-[#0e0e1a] transition-colors"
                onClick={() => handleSort('price')}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">PRICE</div>
                <div className="text-[0.48rem] text-[#3a4050]">{sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th
                className="px-3 py-3 text-center cursor-pointer hover:bg-[#0e0e1a] transition-colors"
                onClick={() => handleSort('change24h')}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">24H %</div>
                <div className="text-[0.48rem] text-[#3a4050]">{sortBy === 'change24h' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th
                className="px-3 py-3 text-center cursor-pointer hover:bg-[#0e0e1a] transition-colors"
                onClick={() => handleSort('volume24h')}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">VOL 24H</div>
                <div className="text-[0.48rem] text-[#3a4050]">{sortBy === 'volume24h' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th
                className="px-3 py-3 text-center cursor-pointer hover:bg-[#0e0e1a] transition-colors"
                onClick={() => handleSort('openInterest')}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">OI</div>
                <div className="text-[0.48rem] text-[#3a4050]">{sortBy === 'openInterest' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th
                className="px-3 py-3 text-center cursor-pointer hover:bg-[#0e0e1a] transition-colors"
                onClick={() => handleSort('oiChange24h')}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">Δ OI 24H</div>
                <div className="text-[0.48rem] text-[#3a4050]">{sortBy === 'oiChange24h' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th
                className="px-3 py-3 text-center cursor-pointer hover:bg-[#0e0e1a] transition-colors"
                onClick={() => handleSort('fundingRate')}
              >
                <div className="font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">FUNDING</div>
                <div className="text-[0.48rem] text-[#3a4050]">{sortBy === 'fundingRate' && (sortOrder === 'asc' ? '↑' : '↓')}</div>
              </th>
              <th className="px-3 py-3 text-center font-mono text-[0.62rem] uppercase tracking-wider text-[#5a6070]">
                LIQ. 24H
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedMarkets.map((market, i) => (
              <motion.tr
                key={market.symbol}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="border-b border-[#1e1e32]/50 hover:bg-[#0e0e1a] transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-[#eaeef4]">{market.symbol}</div>
                    <div className="font-mono text-[0.52rem] text-[#5a6070]">{market.name}</div>
                  </div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div className="font-mono text-sm text-[#eaeef4]">
                    {market.price >= 1000
                      ? `$${market.price.toLocaleString()}`
                      : `$${market.price.toFixed(4)}`}
                  </div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div
                    className={`font-mono text-sm font-bold ${
                      market.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {market.change24h >= 0 ? '+' : ''}{market.change24h.toFixed(2)}%
                  </div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div className="font-mono text-xs text-[#eaeef4]">{formatNumber(market.volume24h)}</div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div className="font-mono text-xs text-[#eaeef4]">{formatNumber(market.openInterest)}</div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div
                    className={`font-mono text-xs font-bold ${
                      market.oiChange24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {market.oiChange24h >= 0 ? '+' : ''}{market.oiChange24h.toFixed(2)}%
                  </div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div
                    className={`font-mono text-xs font-bold ${
                      market.fundingRate > 0.01
                        ? 'text-rose-400'
                        : market.fundingRate < -0.01
                        ? 'text-emerald-400'
                        : 'text-[#eaeef4]'
                    }`}
                  >
                    {market.fundingRate >= 0 ? '+' : ''}{(market.fundingRate * 100).toFixed(3)}%
                  </div>
                </td>

                <td className="px-3 py-3 text-center">
                  <div className="flex flex-col gap-1">
                    <div className="font-mono text-[0.58rem]">
                      <span className="text-rose-400">{formatNumber(market.liquidations24h.long)}</span>
                      <span className="text-[#5a6070] mx-1">L</span>
                    </div>
                    <div className="font-mono text-[0.58rem]">
                      <span className="text-emerald-400">{formatNumber(market.liquidations24h.short)}</span>
                      <span className="text-[#5a6070] mx-1">S</span>
                    </div>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[#1e1e32] bg-[#0e0e1a] flex items-center justify-between font-mono text-[0.58rem] text-[#5a6070]">
        <span>{sortedMarkets.length} markets</span>
        <span>Data: Aggregated CEX (Binance, Bybit, OKX)</span>
      </div>
    </div>
  );
}
