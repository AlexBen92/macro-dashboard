'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface CorrelationData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  correlationBTC: number;
  score: number; // -100 to 100
  signal: 'bullish' | 'bearish' | 'neutral';
  confidence: number; // 0-100
  category: 'macro' | 'tech' | 'miner' | 'crypto';
}

interface MacroCorrelationsData {
  assets: CorrelationData[];
  overallSentiment: 'bullish' | 'bearish' | 'neutral';
  compositeScore: number;
  regime: string;
}

export default function MacroCorrelationsPanel() {
  const [data, setData] = useState<MacroCorrelationsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCorrelations = async () => {
      try {
        const res = await fetch('/api/correlations');
        if (res.ok) {
          const json = await res.json();
          setData(json);
        } else {
          setData(getMockData());
        }
      } catch (e) {
        console.error('Correlations fetch error:', e);
        setData(getMockData());
      } finally {
        setLoading(false);
      }
    };

    fetchCorrelations();
    const id = setInterval(fetchCorrelations, 300000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-gray-800 bg-gray-900/40">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-800 rounded w-1/3" />
          <div className="h-24 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const renderCorrelationCard = (item: CorrelationData, delay: number = 0) => {
    const signalColor = item.signal === 'bullish' ? 'text-green-400' :
                       item.signal === 'bearish' ? 'text-red-400' : 'text-gray-400';
    const borderColor = item.signal === 'bullish' ? 'border-green-800/50' :
                      item.signal === 'bearish' ? 'border-red-800/50' : 'border-gray-800';
    const bgColor = item.signal === 'bullish' ? 'bg-gradient-to-br from-green-950/30 to-green-900/10' :
                   item.signal === 'bearish' ? 'bg-gradient-to-br from-red-950/30 to-red-900/10' :
                   'bg-gradient-to-br from-gray-900/60 to-gray-800/30';

    const corrColor = item.correlationBTC > 0.6 ? 'text-green-400' :
                     item.correlationBTC < -0.3 ? 'text-red-400' : 'text-gray-400';

    const categoryIcon = {
      macro: '🏛️',
      tech: '📈',
      miner: '⛏️',
      crypto: '🪙',
    }[item.category];

    return (
      <motion.div
        key={item.symbol}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay }}
        className={`p-2.5 rounded-lg border ${borderColor} ${bgColor} hover:border-opacity-60 transition-all`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{categoryIcon}</span>
            <div>
              <div className="text-sm font-bold text-white leading-tight">{item.symbol}</div>
              <div className="text-[9px] text-gray-500">{item.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-white leading-tight">
              {item.price ? `$${item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
            </div>
            <div className={`text-[10px] ${item.change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {item.change24h >= 0 ? '+' : ''}{item.change24h?.toFixed(2) ?? '--'}%
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between text-[9px] text-gray-400 mb-1">
          <span>BTC Corr:</span>
          <span className={corrColor}>{item.correlationBTC?.toFixed(2) ?? '--'}</span>
          <span>Score:</span>
          <span className={signalColor}>{item.score >= 0 ? '+' : ''}{item.score}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-[10px] uppercase font-bold tracking-wider ${signalColor}`}>
            {item.signal}
          </span>
          <div className="flex items-center gap-1">
            <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.signal === 'bullish' ? 'bg-green-400' : item.signal === 'bearish' ? 'bg-red-400' : 'bg-gray-500'}`}
                style={{ width: `${item.confidence}%` }}
              />
            </div>
            <span className="text-[9px] text-gray-500">{item.confidence}%</span>
          </div>
        </div>
      </motion.div>
    );
  };

  // Group assets by category
  const macroAssets = data.assets.filter(a => a.category === 'macro');
  const techAssets = data.assets.filter(a => a.category === 'tech');
  const minerAssets = data.assets.filter(a => a.category === 'miner');
  const cryptoAssets = data.assets.filter(a => a.category === 'crypto');

  const sentimentColor = data.overallSentiment === 'bullish' ? 'border-green-800/50 bg-green-950/30' :
                       data.overallSentiment === 'bearish' ? 'border-red-800/50 bg-red-950/30' :
                       'border-gray-800 bg-gray-900/60';
  const sentimentEmoji = data.overallSentiment === 'bullish' ? '🟢' :
                        data.overallSentiment === 'bearish' ? '🔴' : '⚪';

  // Score color
  const scoreColor = data.compositeScore > 50 ? 'text-green-400' :
                    data.compositeScore > 0 ? 'text-green-300' :
                    data.compositeScore < -50 ? 'text-red-400' :
                    data.compositeScore < 0 ? 'text-red-300' : 'text-gray-400';

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            🔗 Macro Correlations
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Tech · Miners · Crypto · Macro Correlation Analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1 rounded-lg border ${sentimentColor}`}>
            <span className="text-sm font-bold text-white">
              {sentimentEmoji} {data.overallSentiment.toUpperCase()}
            </span>
          </div>
          <div className="px-3 py-1 rounded-lg border border-gray-800 bg-gray-900/60">
            <span className={`text-sm font-bold ${scoreColor}`}>
              Score: {data.compositeScore >= 0 ? '+' : ''}{data.compositeScore}
            </span>
          </div>
        </div>
      </div>

      <div className="text-[10px] text-gray-500 mb-2 px-1">
        <span className="font-semibold">Regime:</span> {data.regime}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Macro Indicators */}
        {macroAssets.map((item, idx) => renderCorrelationCard(item, idx * 0.03))}

        {/* Tech Equities */}
        {techAssets.map((item, idx) => renderCorrelationCard(item, idx * 0.03))}

        {/* Bitcoin Miners */}
        {minerAssets.map((item, idx) => renderCorrelationCard(item, idx * 0.03))}

        {/* Crypto Assets */}
        {cryptoAssets.map((item, idx) => renderCorrelationCard(item, idx * 0.03))}
      </div>

      {/* Correlation Legend */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mt-2 p-2 rounded-lg border border-gray-800 bg-gray-900/40 text-[9px] text-gray-500"
      >
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <span>BTC Correlation:</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> High (+0.6)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" /> Inv (-0.3)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> Neutral
          </span>
          <span className="flex-1" />
          <span>Score range: -100 to +100</span>
        </div>
      </motion.div>
    </section>
  );
}

// Mock data with comprehensive asset list
function getMockData(): MacroCorrelationsData {
  const assets: CorrelationData[] = [
    // Macro Indicators
    { symbol: 'DXY', name: 'Dollar Index', price: 105.42, change24h: -0.15, correlationBTC: -0.35, score: -25, signal: 'bearish', confidence: 72, category: 'macro' },
    { symbol: 'US30Y', name: '30Y Yield', price: 4.52, change24h: 0.08, correlationBTC: -0.28, score: -15, signal: 'neutral', confidence: 65, category: 'macro' },
    { symbol: 'VIX', name: 'Volatility Index', price: 14.25, change24h: -0.82, correlationBTC: -0.42, score: 20, signal: 'bullish', confidence: 78, category: 'macro' },
    { symbol: 'UNRATE', name: 'Unemployment Rate', price: 4.1, change24h: 0.0, correlationBTC: -0.15, score: -10, signal: 'neutral', confidence: 60, category: 'macro' },
    { symbol: 'M2SL', name: 'M2 Money Stock', price: 20981, change24h: 0.02, correlationBTC: 0.18, score: 5, signal: 'neutral', confidence: 55, category: 'macro' },

    // Tech Equities
    { symbol: 'NVDA', name: 'NVIDIA', price: 1250.50, change24h: 2.35, correlationBTC: 0.62, score: 78, signal: 'bullish', confidence: 85, category: 'tech' },
    { symbol: 'MSTR', name: 'MicroStrategy', price: 1680.20, change24h: 4.12, correlationBTC: 0.92, score: 88, signal: 'bullish', confidence: 92, category: 'tech' },
    { symbol: 'N100', name: 'Euronext 100', price: 19850.00, change24h: 1.18, correlationBTC: 0.48, score: 52, signal: 'bullish', confidence: 70, category: 'tech' },
    { symbol: 'SPX', name: 'S&P 500', price: 5450.20, change24h: 0.85, correlationBTC: 0.45, score: 42, signal: 'bullish', confidence: 68, category: 'tech' },

    // Bitcoin Miners
    { symbol: 'MARA', name: 'Marathon Digital', price: 25.40, change24h: 5.25, correlationBTC: 0.88, score: 85, signal: 'bullish', confidence: 90, category: 'miner' },
    { symbol: 'RIOT', name: 'Riot Platforms', price: 15.20, change24h: 4.82, correlationBTC: 0.86, score: 82, signal: 'bullish', confidence: 88, category: 'miner' },
    { symbol: 'CLSK', name: 'CleanSpark', price: 18.45, change24h: 6.12, correlationBTC: 0.84, score: 87, signal: 'bullish', confidence: 89, category: 'miner' },
    { symbol: 'COIN', name: 'Coinbase', price: 250.30, change24h: 3.45, correlationBTC: 0.78, score: 72, signal: 'bullish', confidence: 84, category: 'miner' },

    // Crypto Assets
    { symbol: 'BTC', name: 'Bitcoin', price: 67500.00, change24h: 2.85, correlationBTC: 1.00, score: 80, signal: 'bullish', confidence: 95, category: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', price: 3480.50, change24h: 2.12, correlationBTC: 0.82, score: 68, signal: 'bullish', confidence: 82, category: 'crypto' },
    { symbol: 'SOL', name: 'Solana', price: 172.30, change24h: 4.25, correlationBTC: 0.75, score: 75, signal: 'bullish', confidence: 80, category: 'crypto' },
    { symbol: 'HYPE', name: 'Hype', price: 0.00042, change24h: 12.5, correlationBTC: 0.35, score: 65, signal: 'bullish', confidence: 72, category: 'crypto' },
    { symbol: 'PUMP', name: 'Pump', price: 0.00085, change24h: 8.3, correlationBTC: 0.42, score: 58, signal: 'bullish', confidence: 68, category: 'crypto' },
    { symbol: 'PEPE', name: 'Pepe', price: 0.000018, change24h: 15.2, correlationBTC: 0.28, score: 62, signal: 'bullish', confidence: 65, category: 'crypto' },
    { symbol: 'HMSTR', name: 'Hamster', price: 0.000035, change24h: -5.8, correlationBTC: 0.15, score: -35, signal: 'bearish', confidence: 58, category: 'crypto' },
  ];

  const compositeScore = Math.round(
    assets.reduce((sum, a) => sum + a.score, 0) / assets.length
  );

  const overallSentiment = compositeScore > 30 ? 'bullish' :
                         compositeScore < -30 ? 'bearish' : 'neutral';

  const regime = compositeScore > 50 ? 'STRONG BULLISH — Risk-On Environment' :
                compositeScore > 20 ? 'MODERATE BULLISH — Constructive Macro' :
                compositeScore > -20 ? 'NEUTRAL — Mixed Signals' :
                compositeScore > -50 ? 'MODERATE BEARISH — Caution Advised' :
                'STRONG BEARISH — Risk-Off Environment';

  return { assets, overallSentiment, compositeScore, regime };
}
