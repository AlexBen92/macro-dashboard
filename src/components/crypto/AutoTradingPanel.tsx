'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface TradingSignal {
  id: string;
  timestamp: number;
  symbol: string;
  action: 'BUY' | 'SELL';
  confidence: number;
  reason: string;
  size: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
}

interface Props {
  signals?: TradingSignal[];
  autoTradingEnabled?: boolean;
}

export default function AutoTradingPanel({ signals = [], autoTradingEnabled = false }: Props) {
  const [enabled, setEnabled] = useState(autoTradingEnabled);

  const toggleAutoTrading = () => {
    setEnabled(!enabled);
  };

  const generateMockSignals = (): TradingSignal[] => {
    return [
      {
        id: '1',
        timestamp: Date.now() - 300000,
        symbol: 'BTCUSDT',
        action: 'BUY',
        confidence: 85,
        reason: 'VIX < 20 + Strong support at $64K',
        size: 0.5,
        entryPrice: 64500,
        stopLoss: 63500,
        takeProfit: 67000,
      },
      {
        id: '2',
        timestamp: Date.now() - 600000,
        symbol: 'ETHUSDT',
        action: 'BUY',
        confidence: 78,
        reason: 'Funding rate negative + Whale accumulation',
        size: 5,
        entryPrice: 3450,
        stopLoss: 3350,
        takeProfit: 3700,
      },
    ];
  };

  const displaySignals = signals.length > 0 ? signals : generateMockSignals();

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            AUTO TRADING
          </span>
          <div className={`w-2 h-2 rounded-full ${enabled ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
        </div>
        <button
          onClick={toggleAutoTrading}
          className={`font-mono text-[0.58rem] px-3 py-1 rounded transition-colors ${
            enabled
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
          }`}
        >
          {enabled ? 'STOP' : 'START'}
        </button>
      </div>

      <div className="p-5">
        {displaySignals.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">🤖</div>
            <div className="font-mono text-sm text-[#8890a0]">
              {enabled ? 'Scanning for opportunities...' : 'Auto trading disabled'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {displaySignals.map((signal, i) => (
              <motion.div
                key={signal.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={`border-2 rounded-lg p-4 ${
                  signal.action === 'BUY'
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-rose-500/30 bg-rose-500/5'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className={`font-mono text-lg font-black ${
                          signal.action === 'BUY' ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {signal.action}
                      </span>
                      <span className="font-mono text-sm font-bold text-[#eaeef4]">
                        {signal.symbol}
                      </span>
                      <span className="font-mono text-[0.58rem] px-2 py-1 rounded bg-[#1e1e32] text-[#8890a0]">
                        {new Date(signal.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="font-mono text-[0.65rem] text-[#8890a0] mb-1">
                      Confidence: <span className="text-[#eaeef4]">{signal.confidence}%</span>
                    </div>
                    <div className="font-mono text-[0.65rem] text-[#8890a0]">
                      Reason: <span className="text-[#eaeef4]">{signal.reason}</span>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="font-mono text-xs text-[#5a6070] mb-1">Size</div>
                    <div className="font-mono text-lg font-bold text-[#eaeef4]">
                      {signal.size}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#1e1e32]">
                  <div>
                    <div className="font-mono text-[0.52rem] text-[#5a6070] uppercase">Entry</div>
                    <div className="font-mono text-sm font-bold text-[#eaeef4]">
                      ${signal.entryPrice.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[0.52rem] text-[#5a6070] uppercase">Stop Loss</div>
                    <div className="font-mono text-sm font-bold text-rose-400">
                      ${signal.stopLoss.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[0.52rem] text-[#5a6070] uppercase">Take Profit</div>
                    <div className="font-mono text-sm font-bold text-emerald-400">
                      ${signal.takeProfit.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="font-mono text-[0.52rem] text-[#5a6070]">
                    Risk/Reward:{' '}
                    <span className="text-[#eaeef4]">
                      {Math.abs((signal.takeProfit - signal.entryPrice) / (signal.stopLoss - signal.entryPrice)).toFixed(2)}x
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button className="font-mono text-[0.58rem] px-3 py-1 rounded bg-[#1a1a2e] text-[#5a6070] hover:text-[#eaeef4] transition-colors">
                      SKIP
                    </button>
                    <button className={`font-mono text-[0.58rem] px-3 py-1 rounded ${
                      signal.action === 'BUY'
                        ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                        : 'bg-rose-500 text-white hover:bg-rose-400'
                    } transition-colors`}>
                      EXECUTE
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!enabled && (
          <div className="mt-6 p-4 rounded-lg border-2 border-dashed border-[#1e1e32] text-center">
            <div className="font-mono text-sm text-[#8890a0] mb-2">
              Auto trading is disabled
            </div>
            <div className="font-mono text-[0.58rem] text-[#5a6070]">
              Enable to start automated trading based on signals
            </div>
          </div>
        )}

        {enabled && (
          <div className="mt-6 p-4 rounded-lg bg-[#0e0e1a] border border-[#1e1e32]">
            <div className="font-mono text-[0.65rem] text-[#8890a0] uppercase mb-2">
              🤖 Auto Trading Status
            </div>
            <div className="space-y-1 font-mono text-[0.58rem]">
              <div className="flex items-center justify-between">
                <span className="text-[#5a6070]">Status</span>
                <span className="text-emerald-400">Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5a6070]">Mode</span>
                <span className="text-[#eaeef4]">Conservative</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5a6070]">Max Positions</span>
                <span className="text-[#eaeef4]">3</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#5a6070]">Risk Per Trade</span>
                <span className="text-[#eaeef4]">1%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
