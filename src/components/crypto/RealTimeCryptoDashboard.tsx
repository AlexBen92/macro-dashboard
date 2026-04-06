'use client';
import { motion } from 'framer-motion';
import { useCoinGlass } from '@/hooks/api/useCoinGlass';
import { useHyperliquidWebSocket } from '@/hooks/api/useHyperliquidWebSocket';

export default function RealTimeCryptoDashboard() {
  const coinglass = useCoinGlass('funding_rate');
  const { data: wsData, connected: wsConnected } = useHyperliquidWebSocket(['BTC', 'ETH', 'SOL']);

  return (
    <div className="space-y-4">
      {/* Connection Status */}
      <div className="flex items-center justify-between bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="font-mono text-[0.72rem] text-[#8890a0] uppercase">
            Hyperliquid WebSocket
          </span>
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
        </div>
      </div>

      {/* Real-time Prices from WebSocket */}
      {Object.keys(wsData).length > 0 && (
        <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1e1e32]">
            <span className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-wider">
              TEMPS RÉEL WEBSOCKET
            </span>
          </div>
          <div className="p-4 grid grid-cols-3 gap-3">
            {Object.entries(wsData).map(([symbol, data]) => (
              <motion.div
                key={symbol}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-3 text-center"
              >
                <div className="font-mono text-xs font-bold text-[#eaeef4] mb-1">{symbol}</div>
                <div className="font-mono text-lg font-black text-emerald-400">
                  ${data.markPx.toLocaleString()}
                </div>
                <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
                  Funding: {(data.funding24h * 100).toFixed(3)}%
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* CoinGlass Data */}
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-wider">
              COINGLASS API
            </span>
            <div className={`w-2 h-2 rounded-full ${coinglass.loading ? 'bg-rose-500' : 'bg-emerald-500'}`} />
          </div>
          <div className="font-mono text-[0.58rem] text-[#5a6070]">
            {coinglass.loading ? 'Loading...' : `✅ ${coinglass.data.length} markets`}
          </div>
        </div>

        <div className="p-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1e1e32]">
                <th className="text-left px-3 py-2 font-mono text-[0.62rem] text-[#5a6070]">Symbol</th>
                <th className="text-right px-3 py-2 font-mono text-[0.62rem] text-[#5a6070]">Price</th>
                <th className="text-right px-3 py-2 font-mono text-[0.62rem] text-[#5a6070]">24h Change</th>
                <th className="text-right px-3 py-2 font-mono text-[0.62rem] text-[#5a6070]">Funding</th>
                <th className="text-right px-3 py-2 font-mono text-[0.62rem] text-[#5a6070]">OI</th>
              </tr>
            </thead>
            <tbody>
              {coinglass.data.slice(0, 10).map((market, i) => (
                <tr key={market.symbol} className="border-b border-[#1e1e32]/50 hover:bg-[#0e0e1a]">
                  <td className="px-3 py-2 font-mono text-xs font-bold text-[#eaeef4]">
                    {market.symbol}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-sm text-[#eaeef4]">
                    ${market.price.toLocaleString()}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-sm ${
                    market.price_change_24h >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>
                    {market.price_change_24h >= 0 ? '+' : ''}{market.price_change_24h.toFixed(2)}%
                  </td>
                  <td className={`px-3 py-2 text-right font-mono text-sm ${
                    market.funding_rate > 0.01 ? 'text-rose-400' : market.funding_rate < -0.01 ? 'text-emerald-400' : 'text-[#eaeef4]'
                  }`}>
                    {(market.funding_rate * 100).toFixed(3)}%
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-xs text-[#8890a0]">
                    ${(market.open_interest / 1e9).toFixed(2)}B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Status Messages */}
      {coinglass.error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
          <div className="font-mono text-[0.65rem] text-rose-400">
            ⚠️ CoinGlass API: {coinglass.error}
          </div>
        </div>
      )}
    </div>
  );
}
