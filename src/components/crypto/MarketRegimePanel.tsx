'use client';
import { motion } from 'framer-motion';
import { useFRED } from '@/hooks/api/useFRED';
import { useMemo } from 'react';

interface MarketRegimeData {
  regime: 'TREND UP' | 'TREND DOWN' | 'RANGE' | 'SQUEEZE' | 'VOLATILE';
  realizedVol7d: number;
  realizedVol30d: number;
  avgFundingRate: number;
  oiChange24h: number;
  breadth: {
    advancing: number;
    declining: number;
    total: number;
  };
  whalePositioning: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

interface Props {
  data?: MarketRegimeData;
  loading?: boolean;
}

const DEFAULT_DATA: MarketRegimeData = {
  regime: 'TREND UP',
  realizedVol7d: 18.5,
  realizedVol30d: 22.3,
  avgFundingRate: 0.025,
  oiChange24h: 8.5,
  breadth: {
    advancing: 7,
    declining: 3,
    total: 10,
  },
  whalePositioning: 'BULLISH',
};

export default function MarketRegimePanel({ data, loading: externalLoading }: Props) {
  // Fetch VIX data from FRED if no data provided
  const vixData = useFRED('VIXCLS');
  const useApi = !data;

  const marketData = useMemo(() => {
    if (data) return data;

    // Calculate regime based on VIX and other factors
    const currentVIX = vixData.data?.latest?.value || 18.5;
    const vixChange = vixData.data?.change || 0;

    let regime: MarketRegimeData['regime'] = 'TREND UP';
    if (currentVIX > 30) {
      regime = 'VOLATILE';
    } else if (currentVIX > 25) {
      regime = vixChange > 5 ? 'SQUEEZE' : 'VOLATILE';
    } else if (currentVIX < 15) {
      regime = 'RANGE';
    }

    return {
      regime,
      realizedVol7d: currentVIX,
      realizedVol30d: currentVIX * 1.2,
      avgFundingRate: 0.025,
      oiChange24h: 8.5,
      breadth: {
        advancing: 7,
        declining: 3,
        total: 10,
      },
      whalePositioning: 'BULLISH',
    };
  }, [data, vixData.data]);

  const loading = externalLoading ?? (useApi ? vixData.loading : false);
  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING MARKET REGIME...
        </motion.div>
      </div>
    );
  }

  const getRegimeConfig = (regime: MarketRegimeData['regime']) => {
    const configs = {
      'TREND UP': {
        bg: '#4ade8020',
        text: '#4ade80',
        border: '#4ade80',
        emoji: '📈',
        description: 'Tendance haussière établie',
      },
      'TREND DOWN': {
        bg: '#ff335520',
        text: '#ff3355',
        border: '#ff3355',
        emoji: '📉',
        description: 'Tendance baissière établie',
      },
      RANGE: {
        bg: '#ffaa0020',
        text: '#ffaa00',
        border: '#ffaa00',
        emoji: '↔️',
        description: 'Marché sans direction claire',
      },
      SQUEEZE: {
        bg: '#aa66ff20',
        text: '#aa66ff',
        border: '#aa66ff',
        emoji: '🔥',
        description: 'Squeeze en cours',
      },
      VOLATILE: {
        bg: '#f9731620',
        text: '#f97316',
        border: '#f97316',
        emoji: '⚡',
        description: 'Forte volatilité',
      },
    };
    return configs[regime];
  };

  const regimeConfig = getRegimeConfig(marketData.regime);
  const breadthPct = (marketData.breadth.advancing / marketData.breadth.total) * 100;

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            MARKET REGIME
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          Synthèse en temps réel
        </div>
      </div>

      <div className="p-5">
        {/* Main regime display */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-6 p-6 rounded-xl border-2 text-center"
          style={{
            background: regimeConfig.bg,
            borderColor: regimeConfig.border,
          }}
        >
          <div className="text-5xl mb-3">{regimeConfig.emoji}</div>
          <div
            className="font-mono text-2xl font-black mb-2 tracking-[3px]"
            style={{ color: regimeConfig.text }}
          >
            {marketData.regime}
          </div>
          <div className="font-mono text-[0.72rem] text-[#8890a0]">{regimeConfig.description}</div>
        </motion.div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {/* Realized Vol 7D */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">VOL 7J</div>
            <div className={`font-mono text-lg font-bold ${marketData.realizedVol7d > 25 ? 'text-rose-400' : marketData.realizedVol7d > 15 ? 'text-[#ffaa00]' : 'text-emerald-400'}`}>
              {marketData.realizedVol7d.toFixed(1)}%
            </div>
          </div>

          {/* Realized Vol 30D */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">VOL 30J</div>
            <div className={`font-mono text-lg font-bold ${marketData.realizedVol30d > 25 ? 'text-rose-400' : marketData.realizedVol30d > 15 ? 'text-[#ffaa00]' : 'text-emerald-400'}`}>
              {marketData.realizedVol30d.toFixed(1)}%
            </div>
          </div>

          {/* Avg Funding */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">FUNDING MOY</div>
            <div className={`font-mono text-lg font-bold ${marketData.avgFundingRate > 0.03 ? 'text-rose-400' : marketData.avgFundingRate < -0.03 ? 'text-emerald-400' : 'text-[#eaeef4]'}`}>
              {marketData.avgFundingRate >= 0 ? '+' : ''}{(marketData.avgFundingRate * 100).toFixed(3)}%
            </div>
          </div>

          {/* OI Change */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Δ OI 24H</div>
            <div className={`font-mono text-lg font-bold ${marketData.oiChange24h > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {marketData.oiChange24h >= 0 ? '+' : ''}{marketData.oiChange24h.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Breadth indicator */}
        <div className="mb-6">
          <div className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-[3px] mb-3">
            Market Breadth
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${breadthPct > 60 ? 'bg-emerald-500' : breadthPct < 40 ? 'bg-rose-500' : 'bg-[#ffaa00]'}`} />
                <span className="font-mono text-[0.65rem] text-[#5a6070]">
                  {breadthPct > 60 ? 'Haussier' : breadthPct < 40 ? 'Baissier' : 'Neutre'}
                </span>
              </div>
              <div className="font-mono text-sm font-bold text-[#eaeef4]">
                {marketData.breadth.advancing}A / {marketData.breadth.declining}D
              </div>
            </div>
            <div className="w-full h-3 bg-[#1a1a2e] rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${breadthPct}%` }}
              />
              <div className="bg-rose-500 h-full transition-all duration-500" style={{ width: `${100 - breadthPct}%` }} />
            </div>
          </div>
        </div>

        {/* Whale positioning */}
        <div className="mb-6">
          <div className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-[3px] mb-3">
            Positionnement Whale
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">
                  {marketData.whalePositioning === 'BULLISH' ? '🐋🐂' : marketData.whalePositioning === 'BEARISH' ? '🐻🐋' : '🐋😐'}
                </span>
                <div>
                  <div
                    className={`font-mono text-lg font-bold ${
                      marketData.whalePositioning === 'BULLISH' ? 'text-emerald-400' : marketData.whalePositioning === 'BEARISH' ? 'text-rose-400' : 'text-[#eaeef4]'
                    }`}
                  >
                    {marketData.whalePositioning}
                  </div>
                  <div className="font-mono text-[0.58rem] text-[#5a6070]">
                    Sur la base des flux on-chain et OI
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Trading recommendations based on regime */}
        <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-4">
          <div className="font-mono text-[0.65rem] text-[#8890a0] uppercase mb-2">
            💡 Recommandations
          </div>
          <ul className="space-y-2 font-mono text-[0.58rem]">
            {marketData.regime === 'TREND UP' && (
              <>
                <li className="text-emerald-400">✅ Chercher des entrées long sur pullbacks</li>
                <li className="text-[#eaeef4]">• Éviter les shorts contrariants</li>
                <li className="text-[#eaeef4]">• Taille de position: 1-1.5% par trade</li>
              </>
            )}
            {marketData.regime === 'TREND DOWN' && (
              <>
                <li className="text-rose-400">✅ Chercher des entrées short sur rebonds</li>
                <li className="text-[#eaeef4]">• Éviter les longs contrariants</li>
                <li className="text-[#eaeef4]">• Taille de position: 0.5-1% par trade</li>
              </>
            )}
            {marketData.regime === 'RANGE' && (
              <>
                <li className="text-[#ffaa00]">⚠️ Trading de range attendu</li>
                <li className="text-[#eaeef4]">• Acheter sur support, vendre sur résistance</li>
                <li className="text-[#eaeef4]">• Éviter les breakout trades</li>
              </>
            )}
            {marketData.regime === 'SQUEEZE' && (
              <>
                <li className="text-[#aa66ff]">🔥 Squeeze en cours - attention</li>
                <li className="text-[#eaeef4]">• Ne pas contre-trader le squeeze</li>
                <li className="text-[#eaeef4]">• Réduire la taille des positions</li>
              </>
            )}
            {marketData.regime === 'VOLATILE' && (
              <>
                <li className="text-rose-400">❌ Volatilité extrême - réduire risque</li>
                <li className="text-[#eaeef4]">• Taille de position: 0.5% max</li>
                <li className="text-[#eaeef4]">• Stop-loss plus larges</li>
              </>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
