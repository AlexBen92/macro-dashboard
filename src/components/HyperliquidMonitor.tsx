'use client';

import { useState, useMemo } from 'react';
import { useHyperliquidMonitor } from '@/hooks/useHyperliquidMonitor';
import { formatVolume, formatPercentage, formatPrice } from '@/lib/market-data';
import ActionabilityBadge from '@/components/ui/ActionabilityBadge';

type SortField = 'symbol' | 'price' | 'change24h' | 'volume24h' | 'openInterest' | 'fundingRate' | 'strengthScore';
type SortOrder = 'asc' | 'desc';

const BIAS_COLORS: Record<string, string> = {
  green: 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/30',
  red: 'bg-[#ff3355]/10 text-[#ff3355] border-[#ff3355]/30',
  amber: 'bg-[#ffaa00]/10 text-[#ffaa00] border-[#ffaa00]/30',
  gray: 'bg-[#5a6070]/10 text-[#5a6070] border-[#5a6070]/30',
};

const STRENGTH_COLORS: Record<string, string> = {
  green: 'bg-[#4ade80]',
  red: 'bg-[#ff3355]',
  amber: 'bg-[#ffaa00]',
  gray: 'bg-[#5a6070]',
};

function StatCard({ label, value, sublabel, dot }: { label: string; value: string; sublabel?: string; dot?: string }) {
  return (
    <div className="flex-1 min-w-[140px] bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {dot && <div className="w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
        <span className="font-mono text-[0.65rem] text-[#5a6070] uppercase tracking-wider">{label}</span>
      </div>
      <div className="font-mono text-lg font-semibold text-white">{value}</div>
      {sublabel && <div className="font-mono text-[0.6rem] text-[#5a6070] mt-0.5">{sublabel}</div>}
    </div>
  );
}

function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <div className="group relative inline-block">
      {children}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-48 bg-[#1a1a2e] border border-[#3a3a4a] rounded p-2 text-[0.6rem] text-[#8890a0] text-center z-50">
        Heuristic score summarizing signal coherence. Not a backtested probability.
        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-[#1a1a2e]" />
      </div>
    </div>
  );
}

export default function HyperliquidMonitor() {
  const { rows, stats, loading, error, refresh, countdown } = useHyperliquidMonitor(30);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('openInterest');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const filteredRows = useMemo(() => {
    let result = rows;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => r.symbol.toLowerCase().includes(q));
    }

    result.sort((a, b) => {
      const aVal = a[sortField] ?? (sortField === 'symbol' ? '' : 0);
      const bVal = b[sortField] ?? (sortField === 'symbol' ? '' : 0);

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      const numA = typeof aVal === 'number' ? aVal : 0;
      const numB = typeof bVal === 'number' ? bVal : 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });

    return result;
  }, [rows, search, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-[#3a3a4a]">⇅</span>;
    return sortOrder === 'asc' ? <span>↑</span> : <span>↓</span>;
  };

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#00e5ff]" /> Hyperliquid Perps Monitor
          </div>
          <span className="font-mono text-[0.6rem] text-[#5a6070]">
            OI · Volume · Funding · Market Bias
          </span>
          <ActionabilityBadge variant="informational" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refresh}
            className="font-mono text-[0.65rem] text-[#5a6070] hover:text-white transition-colors px-2 py-1 border border-[#1e1e32] rounded hover:border-[#3a3a4a]"
          >
            Refresh {countdown > 0 && `(${countdown}s)`}
          </button>
        </div>
      </div>

      {/* Stats */}
      {stats && !loading && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard
            label="Markets"
            value={stats.marketsTracked.toString()}
            sublabel="tracked perps"
            dot="#00e5ff"
          />
          <StatCard
            label="Aggregate OI"
            value={formatVolume(stats.aggregateOpenInterest)}
            sublabel="total open interest"
            dot="#ff006e"
          />
          <StatCard
            label="24h Volume"
            value={formatVolume(stats.aggregate24hVolume)}
            sublabel="total volume"
            dot="#aa66ff"
          />
          <StatCard
            label="Median Funding"
            value={formatPercentage(stats.medianFunding, 4)}
            sublabel="across markets"
            dot={stats.medianFunding > 0 ? '#4ade80' : stats.medianFunding < 0 ? '#ff3355' : '#5a6070'}
          />
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          type="text"
          placeholder="Search by symbol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0e0e1a] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-sm text-white placeholder-[#3a3a4a] focus:outline-none focus:border-[#3a3a4a]"
        />
      </div>

      {/* Table */}
      <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-2 px-3 py-2 bg-[#1a1a2e] border-b border-[#1e1e32] font-mono text-[0.6rem] text-[#5a6070] uppercase tracking-wider sticky top-0">
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1"
            onClick={() => handleSort('symbol')}
          >
            Asset <SortIcon field="symbol" />
          </div>
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1 text-right"
            onClick={() => handleSort('price')}
          >
            Price <SortIcon field="price" />
          </div>
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1 text-right"
            onClick={() => handleSort('change24h')}
          >
            24h <SortIcon field="change24h" />
          </div>
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1 text-right"
            onClick={() => handleSort('volume24h')}
          >
            24h Vol <SortIcon field="volume24h" />
          </div>
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1 text-right"
            onClick={() => handleSort('openInterest')}
          >
            OI <SortIcon field="openInterest" />
          </div>
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1 text-right"
            onClick={() => handleSort('fundingRate')}
          >
            Funding <SortIcon field="fundingRate" />
          </div>
          <div className="text-right">Bias</div>
          <div
            className="cursor-pointer hover:text-white transition-colors flex items-center gap-1 text-right"
            onClick={() => handleSort('strengthScore')}
          >
            <Tooltip>
              <span className="flex items-center gap-1">Signal Clarity <SortIcon field="strengthScore" /></span>
            </Tooltip>
          </div>
          <div className="text-left pl-2">Interpretation</div>
        </div>

        {/* Body */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="py-12 text-center font-mono text-[0.85rem] text-[#5a6070]">
              Loading Hyperliquid data...
            </div>
          ) : error ? (
            <div className="py-12 text-center font-mono text-[0.85rem] text-[#ff3355]">
              {error}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="py-12 text-center font-mono text-[0.85rem] text-[#5a6070]">
              No markets found
            </div>
          ) : (
            filteredRows.map((row, idx) => (
              <div
                key={row.symbol}
                className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_1fr_2fr] gap-2 px-3 py-2 border-b border-[#1e1e32] hover:bg-[#1a1a2e] transition-colors font-mono text-[0.7rem]"
              >
                <div className="font-semibold text-white">{row.symbol}</div>
                <div className="text-right tabular-nums text-white">{formatPrice(row.price, row.symbol)}</div>
                <div className={`text-right tabular-nums ${row.change24h && row.change24h > 0 ? 'text-[#4ade80]' : row.change24h && row.change24h < 0 ? 'text-[#ff3355]' : 'text-[#5a6070]'}`}>
                  {formatPercentage(row.change24h)}
                </div>
                <div className="text-right tabular-nums text-[#8890a0]">{formatVolume(row.volume24h)}</div>
                <div className="text-right tabular-nums text-white font-semibold">{formatVolume(row.openInterest)}</div>
                <div className={`text-right tabular-nums ${row.fundingRate && row.fundingRate > 0 ? 'text-[#4ade80]' : row.fundingRate && row.fundingRate < 0 ? 'text-[#ff3355]' : 'text-[#5a6070]'}`}>
                  {formatPercentage(row.fundingRate)}
                </div>
                <div className="text-right">
                  {row.biasLabel && row.biasColor && (
                    <span className={`px-1.5 py-0.5 rounded text-[0.6rem] border ${BIAS_COLORS[row.biasColor]}`}>
                      {row.biasLabel}
                    </span>
                  )}
                </div>
                <div className="text-right">
                  {row.strengthScore !== null && (
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[0.65rem] px-1.5 rounded ${STRENGTH_COLORS[row.biasColor ?? 'gray']}`}>
                        {row.strengthScore}%
                      </span>
                    </div>
                  )}
                </div>
                <div className="text-left pl-2 text-[#8890a0] text-[0.65rem] truncate">
                  {row.interpretation}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 font-mono text-[0.6rem] text-[#5a6070] flex items-center justify-between">
        <span>Source: Hyperliquid API</span>
        <span>{filteredRows.length} markets displayed</span>
      </div>
    </div>
  );
}
