'use client';

import { motion } from 'framer-motion';
import { useIntradayOpportunities } from '@/hooks/useIntradayOpportunities';
import {
  formatOpportunityScore,
  getConfidenceColor,
  getDirectionColor,
  getStrategyColor,
  getStrategyFamilyLabel,
  getDirectionLabel,
  formatPriceChange,
  formatFunding,
  formatOI,
} from '@/lib/opportunities';
import type { TradeOpportunity } from '@/lib/opportunities';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'long', label: 'Long' },
  { id: 'short', label: 'Short' },
  { id: 'watch', label: 'Watch' },
];

const COUNTS = [10, 15, 20];

export default function IntradayOpportunities() {
  const {
    opportunities,
    stats,
    loading,
    error,
    refresh,
    setFilter,
    currentFilter,
    setCount,
    currentCount,
    countdown,
  } = useIntradayOpportunities(30);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-[0.72rem] text-[#8890a0] tracking-[3px] uppercase flex items-center gap-2">
            <div className="w-[6px] h-[6px] rounded-full bg-[#ff006e]" />
            Top Intraday Opportunities
          </div>
          <span className="font-mono text-[0.6rem] text-[#5a6070]">
            M15 setups filtered by H1 regime, OI, volume, funding
          </span>
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
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3">
            <div className="font-mono text-[0.65rem] text-[#5a6070] uppercase tracking-wider mb-1">Opportunités</div>
            <div className="font-mono text-lg font-semibold text-white">{stats.total}</div>
          </div>
          <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3">
            <div className="font-mono text-[0.65rem] text-[#5a6070] uppercase tracking-wider mb-1">Score Moyen</div>
            <div className="font-mono text-lg font-semibold text-[#00e5ff]">{stats.avgScore.toFixed(0)}</div>
          </div>
          <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3">
            <div className="font-mono text-[0.65rem] text-[#5a6070] uppercase tracking-wider mb-1">Long</div>
            <div className="font-mono text-lg font-semibold text-[#4ade80]">{stats.byDirection.long}</div>
          </div>
          <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3">
            <div className="font-mono text-[0.65rem] text-[#5a6070] uppercase tracking-wider mb-1">Short</div>
            <div className="font-mono text-lg font-semibold text-[#ff3355]">{stats.byDirection.short}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setFilter(filter.id)}
              className={`font-mono text-[0.7rem] px-3 py-1.5 rounded transition-colors ${
                currentFilter === filter.id
                  ? 'bg-[#00e5ff] text-black font-semibold'
                  : 'bg-[#0e0e1a] text-[#5a6070] hover:text-white border border-[#1e1e32]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {COUNTS.map((count) => (
            <button
              key={count}
              onClick={() => setCount(count)}
              className={`font-mono text-[0.7rem] px-2 py-1.5 rounded transition-colors ${
                currentCount === count
                  ? 'bg-[#ff006e] text-white'
                  : 'bg-[#0e0e1a] text-[#5a6070] hover:text-white border border-[#1e1e32]'
              }`}
            >
              Top {count}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      {loading ? (
        <div className="py-12 text-center font-mono text-[0.85rem] text-[#5a6070]">
          Loading opportunities...
        </div>
      ) : error ? (
        <div className="py-12 text-center font-mono text-[0.85rem] text-[#ff3355]">
          {error}
        </div>
      ) : opportunities.length === 0 ? (
        <div className="py-12 text-center font-mono text-[0.85rem] text-[#5a6070]">
          No opportunities found. Market conditions may not favor intraday setups.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {opportunities.map((opp, idx) => (
            <OpportunityCard key={opp.symbol} opportunity={opp} index={idx} />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 font-mono text-[0.6rem] text-[#5a6070] flex items-center justify-between">
        <span>Source: Hyperliquid API + Heuristic Scoring</span>
        <span>Opportunity Score: 0-100 (heuristic, not backtested)</span>
      </div>
    </div>
  );
}

function OpportunityCard({ opportunity, index }: { opportunity: TradeOpportunity; index: number }) {
  const directionColor = getDirectionColor(opportunity.direction);
  const strategyColor = getStrategyColor(opportunity.strategyFamily);
  const confidenceColor = getConfidenceColor(opportunity.confidenceLabel);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative bg-[#0e0e1a] border border-[#1e1e32] rounded-lg overflow-hidden hover:border-[#3a3a4a] transition-all"
      style={{ borderLeftWidth: 3, borderLeftColor: directionColor }}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.6rem] text-[#5a6070]">#{opportunity.rank}</span>
            <span className="font-mono text-[1.4rem] font-bold text-white">{opportunity.symbol}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className="font-mono text-[0.65rem] px-2 py-0.5 rounded font-semibold"
              style={{ background: directionColor + '20', color: directionColor }}
            >
              {getDirectionLabel(opportunity.direction)}
            </span>
            <span
              className="font-mono text-[0.6rem] px-2 py-0.5 rounded"
              style={{ background: strategyColor + '20', color: strategyColor }}
            >
              {getStrategyFamilyLabel(opportunity.strategyFamily)}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-mono text-[0.65rem] text-[#5a6070]">Signal Clarity</div>
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-lg font-bold"
              style={{ color: confidenceColor }}
            >
              {formatOpportunityScore(opportunity.opportunityScore)}
            </span>
            <span
              className="font-mono text-[0.6rem] px-2 py-0.5 rounded"
              style={{ background: confidenceColor + '20', color: confidenceColor }}
            >
              {opportunity.confidenceLabel.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Explanation */}
        <div className="font-mono text-[0.75rem] text-[#a0a8b8] mb-3">
          {opportunity.explanation}
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-2 mb-3 font-mono text-[0.65rem]">
          <div>
            <div className="text-[#5a6070]">24h</div>
            <div className="text-white font-semibold">{formatPriceChange(opportunity.metrics.priceChange)}</div>
          </div>
          <div>
            <div className="text-[#5a6070]">Funding</div>
            <div className="text-white font-semibold">{formatFunding(opportunity.metrics.fundingRate)}</div>
          </div>
          <div>
            <div className="text-[#5a6070]">OI</div>
            <div className="text-white font-semibold">{formatOI(opportunity.metrics.openInterest)}</div>
          </div>
          <div>
            <div className="text-[#5a6070]">Horizon</div>
            <div className="text-white font-semibold">{opportunity.entryHorizon}</div>
          </div>
        </div>

        {/* Invalidation */}
        <div className="font-mono text-[0.65rem] text-[#ff3355] border-t border-[#1e1e32] pt-2">
          ⚠ {opportunity.invalidation}
        </div>
      </div>
    </motion.div>
  );
}
