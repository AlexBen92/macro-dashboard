'use client';
import { useState, useEffect } from 'react';
import { SCORE_WEIGHTS, BIAS_COLOR, TIER_LABEL } from '@/lib/constants';

interface FuturesData {
  symbol: string;
  score: number;
  bias: 'LONG' | 'SHORT' | 'NEUTRAL';
  funding: number;
  oi: number;
  volume24h: number;
  edgeVsFees: number;
  signals: string[];
}

// Mock data — replace with real API call
const MOCK_FUTURES: FuturesData[] = [
  {
    symbol: 'BTC',
    score: 72,
    bias: 'LONG',
    funding: 0.0001,
    oi: 28.5e9,
    volume24h: 1.8e9,
    edgeVsFees: 1.4,
    signals: ['Whale Accumulation', 'Funding Positive', 'OI Rising'],
  },
  {
    symbol: 'ETH',
    score: 68,
    bias: 'LONG',
    funding: 0.0002,
    oi: 12.3e9,
    volume24h: 920e6,
    edgeVsFees: 1.2,
    signals: ['Whale Accumulation', 'Volatility Breakout'],
  },
  {
    symbol: 'SOL',
    score: 58,
    bias: 'NEUTRAL',
    funding: -0.0003,
    oi: 3.2e9,
    volume24h: 380e6,
    edgeVsFees: 0.9,
    signals: ['Funding Negative', 'OI Stable'],
  },
  {
    symbol: 'BNB',
    score: 45,
    bias: 'NEUTRAL',
    funding: 0.0001,
    oi: 1.8e9,
    volume24h: 180e6,
    edgeVsFees: 0.7,
    signals: ['Low Volatility'],
  },
  {
    symbol: 'DOGE',
    score: 82,
    bias: 'LONG',
    funding: 0.0005,
    oi: 890e6,
    volume24h: 420e6,
    edgeVsFees: 2.1,
    signals: ['Whale Accumulation', 'Funding Positive', 'Volume Surge', 'OI Rising'],
  },
];

export default function TradeSheet() {
  const [futuresData, setFuturesData] = useState<FuturesData[]>(MOCK_FUTURES);
  const [sortField, setSortField] = useState<keyof FuturesData>('score');
  const [sortDesc, setSortDesc] = useState(true);

  const sortedData = [...futuresData].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    if (typeof aVal === 'string') return sortDesc ? aVal.localeCompare(bVal as string) : -(aVal.localeCompare(bVal as string));
    return sortDesc ? (aVal as number) - (bVal as number) : -(aVal as number) + (bVal as number);
  });

  const handleSort = (field: keyof FuturesData) => {
    if (sortField === field) {
      setSortDesc(!sortDesc);
    } else {
      setSortField(field);
      setSortDesc(true);
    }
  };

  return (
    <section className="mb-6 p-4 rounded-xl border bg-[#0d0d1a] border-[#1a1a30]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white tracking-wide">
          ?? FUTURES TRADE SHEET
        </h2>
        <span className="text-xs text-gray-500">Top 5 par score</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] text-gray-500 uppercase tracking-wider border-b border-[#1a1a30]">
        <div className="col-span-2">Symbol</div>
        <div className="col-span-1 text-center">Score</div>
        <div className="col-span-1">Bias</div>
        <div className="col-span-2 text-right">Funding</div>
        <div className="col-span-2 text-right">OI</div>
        <div className="col-span-2 text-right">Volume</div>
        <div className="col-span-2 text-right">Edge/Fees</div>
      </div>

      {/* Rows */}
      <div className="divide-y divide-[#1a1a30]">
        {sortedData.map((t) => (
          <div
            key={t.symbol}
            className="grid grid-cols-12 gap-2 px-3 py-3 items-center hover:bg-[#12122a] transition-colors"
          >
            {/* Symbol */}
            <div className="col-span-2">
              <div className="font-bold text-white">{t.symbol}</div>
              <div className="text-[9px] text-gray-600">{TIER_LABEL(t.score)}</div>
            </div>

            {/* Score */}
            <div className="col-span-1 flex justify-center">
              <div
                className="w-10 h-10 rounded-full border-2 flex items-center justify-center"
                style={{ borderColor: t.score >= 65 ? '#00ff88' : t.score >= 50 ? '#ffcc00' : '#555' }}
              >
                <span className="text-sm font-bold text-white">{t.score}</span>
              </div>
            </div>

            {/* Bias */}
            <div className="col-span-1">
              <span
                className="text-[10px] px-2 py-1 rounded-full font-semibold"
                style={{ background: BIAS_COLOR[t.bias] + '22', color: BIAS_COLOR[t.bias] }}
              >
                {t.bias}
              </span>
            </div>

            {/* Funding */}
            <div className="col-span-2 text-right">
              <span className={`text-sm font-mono ${t.funding >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {t.funding >= 0 ? '+' : ''}{(t.funding * 100).toFixed(4)}%
              </span>
            </div>

            {/* OI */}
            <div className="col-span-2 text-right">
              <span className="text-sm font-mono text-white">
                ${(t.oi / 1e9).toFixed(2)}B
              </span>
            </div>

            {/* Volume */}
            <div className="col-span-2 text-right">
              <span className="text-sm font-mono text-white">
                ${(t.volume24h / 1e6).toFixed(0)}M
              </span>
            </div>

            {/* Edge vs Fees */}
            <div className="col-span-2 text-right">
              <span
                className={`text-sm font-mono font-bold ${t.edgeVsFees >= 1 ? 'text-green-400' : 'text-red-400'}`}
              >
                {t.edgeVsFees.toFixed(2)}×
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Score weights legend */}
      <div className="mt-4 pt-4 border-t border-[#1a1a30]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Poids du score</div>
        <div className="flex flex-wrap gap-2 text-[9px]">
          {Object.entries(SCORE_WEIGHTS).map(([k, w]) => (
            <span key={k} className="px-2 py-1 rounded bg-gray-800 text-gray-400">
              {k.replace('_', ' ')}: {(w * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      </div>

      {/* Strategy note */}
      <div className="mt-4 p-3 bg-blue-950/40 border border-blue-800/30 rounded-lg text-xs text-blue-300">
        <b>Stratégie M15/M30 :</b> Enter uniquement si score ≥ 65 + Edge/Fees ≥ 1× + fenêtre vol active.
        Stop = 2× l'ATR M15. Target = 3:1 R/R. Maker ALO obligatoire pour capturer le rebate.
      </div>
    </section>
  );
}
