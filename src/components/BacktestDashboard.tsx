'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface BacktestMetrics {
  totalReturn: number;
  sharpe: number;
  sortino: number;
  calmar: number;
  maxDD: number;
  winRate: number;
  avgTrade: number;
  totalTrades: number;
}

interface BacktestResult {
  strategy: string;
  period: string;
  metrics: BacktestMetrics;
  equityCurve: number[];
  monthlyReturns: Record<string, number>;
}

export default function BacktestDashboard() {
  const [results, setResults] = useState<BacktestResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStrategy, setSelectedStrategy] = useState<string | null>(null);

  useEffect(() => {
    const fetchBacktest = async () => {
      try {
        const res = await fetch('/api/backtest-results');
        const data = await res.json();
        setResults(data.results ?? []);
        if (data.results?.length > 0) {
          setSelectedStrategy(data.results[0].strategy);
        }
      } catch (e) {
        console.error('Backtest fetch error:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchBacktest();
  }, []);

  const selected = results.find(r => r.strategy === selectedStrategy);

  const formatPercent = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
  const formatNumber = (v: number) => v.toFixed(2);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            📊 Backtest Analytics
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Performance metrics · Drawdown analysis · Monthly breakdown
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-900/60 rounded-xl animate-pulse border border-gray-800" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <div className="py-10 text-center border-2 border-dashed border-gray-800 rounded-xl">
          <div className="text-3xl mb-2">📈</div>
          <div className="text-lg font-bold text-gray-500">Aucun backtest</div>
          <div className="text-sm text-gray-600 mt-1">
            Exécutez un backtest pour voir les résultats
          </div>
        </div>
      ) : (
        <>
          {/* Strategy Selector */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {results.map(r => (
              <button
                key={r.strategy}
                onClick={() => setSelectedStrategy(r.strategy)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  selectedStrategy === r.strategy
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {r.strategy}
              </button>
            ))}
          </div>

          {selected && (
            <motion.div
              key={selectedStrategy}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Total Return', value: formatPercent(selected.metrics.totalReturn), color: selected.metrics.totalReturn >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Sharpe Ratio', value: formatNumber(selected.metrics.sharpe), color: selected.metrics.sharpe >= 1 ? 'text-green-400' : 'text-yellow-400' },
                  { label: 'Max Drawdown', value: formatPercent(selected.metrics.maxDD), color: 'text-red-400' },
                  { label: 'Win Rate', value: formatPercent(selected.metrics.winRate), color: selected.metrics.winRate >= 50 ? 'text-green-400' : 'text-yellow-400' },
                  { label: 'Sortino', value: formatNumber(selected.metrics.sortino), color: selected.metrics.sortino >= 1 ? 'text-green-400' : 'text-yellow-400' },
                  { label: 'Calmar', value: formatNumber(selected.metrics.calmar), color: selected.metrics.calmar >= 1 ? 'text-green-400' : 'text-yellow-400' },
                  { label: 'Avg Trade', value: formatPercent(selected.metrics.avgTrade), color: selected.metrics.avgTrade >= 0 ? 'text-green-400' : 'text-red-400' },
                  { label: 'Total Trades', value: selected.metrics.totalTrades.toString(), color: 'text-gray-400' },
                ].map((metric) => (
                  <motion.div
                    key={metric.label}
                    className="p-3 rounded-lg border border-gray-800 bg-gray-900/60"
                  >
                    <div className="text-[10px] text-gray-500 uppercase tracking-wider">{metric.label}</div>
                    <div className={`text-xl font-bold mt-1 ${metric.color}`}>
                      {metric.value}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Monthly Returns Heatmap */}
              <div className="p-4 rounded-lg border border-gray-800 bg-gray-900/60">
                <div className="text-xs font-bold text-gray-400 mb-3">Monthly Returns</div>
                <div className="grid grid-cols-12 gap-1">
                  {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month) => {
                    const ret = selected.monthlyReturns[month];
                    const color = ret >= 0
                      ? ret > 5 ? 'bg-green-500' : ret > 2 ? 'bg-green-600' : ret > 0 ? 'bg-green-700' : 'bg-gray-700'
                      : ret < -5 ? 'bg-red-500' : ret < -2 ? 'bg-red-600' : 'bg-red-700';
                    return (
                      <div key={month} className="text-center">
                        <div className={`h-8 rounded ${color} flex items-center justify-center text-[10px] font-bold text-white`}>
                          {ret ? `${ret.toFixed(1)}%` : '-'}
                        </div>
                        <div className="text-[9px] text-gray-600 mt-1">{month}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Period Info */}
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Period: {selected.period}</span>
                <span>Strategy: {selected.strategy}</span>
              </div>
            </motion.div>
          )}
        </>
      )}
    </section>
  );
}
