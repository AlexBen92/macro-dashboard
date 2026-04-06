'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';

interface MarketContext {
  vix: number;
  realizedVol24h: number;
  regime: 'TREND' | 'RANGE' | 'SQUEEZE' | 'VOLATILE';
  fundingRate: number;
  openInterestChange: number;
  sessionActive: boolean;
}

interface FtmoRiskContext {
  drawdownUsed: number; // percentage
  drawdownRemaining: number; // percentage
  dailyLossUsed: number; // percentage
  accountBalance: number;
}

interface Props {
  marketContext?: MarketContext;
  ftmoContext?: FtmoRiskContext;
  loading?: boolean;
}

const DEFAULT_MARKET: MarketContext = {
  vix: 18.5,
  realizedVol24h: 12.3,
  regime: 'TREND',
  fundingRate: 0.01,
  openInterestChange: 5.2,
  sessionActive: true,
};

const DEFAULT_FTMO: FtmoRiskContext = {
  drawdownUsed: 38, // 38% of max drawdown used
  drawdownRemaining: 6.2, // 6.2% remaining
  dailyLossUsed: 24, // 24% of daily loss used
  accountBalance: 100000,
};

function getRegimeColor(regime: MarketContext['regime']): { bg: string; text: string; border: string } {
  const colors = {
    TREND: { bg: '#4ade8020', text: '#4ade80', border: '#4ade80' },
    RANGE: { bg: '#ffaa0020', text: '#ffaa00', border: '#ffaa00' },
    SQUEEZE: { bg: '#ff335520', text: '#ff3355', border: '#ff3355' },
    VOLATILE: { bg: '#aa66ff20', text: '#aa66ff', border: '#aa66ff' },
  };
  return colors[regime];
}

function calculatePositionRecommendation(
  market: MarketContext,
  ftmo: FtmoRiskContext
): {
  verdict: 'GO' | 'NO-GO' | 'CAUTION';
  riskPercent: number;
  maxPositionSize: number;
  reasoning: string[];
  confidence: number;
} {
  const reasons: string[] = [];
  let riskMultiplier = 1.0;
  let score = 0;

  // VIX impact
  if (market.vix < 15) {
    reasons.push('VIX faible (< 15) : volatilité basse ✅');
    score += 2;
  } else if (market.vix < 20) {
    reasons.push('VIX modéré (15-20) : volatilité acceptable ✅');
    score += 1;
  } else if (market.vix < 25) {
    reasons.push('VIX élevé (20-25) : réduire la taille ⚠️');
    score -= 1;
    riskMultiplier *= 0.7;
  } else {
    reasons.push('VIX très élevé (> 25) : volatilité dangereuse ❌');
    score -= 2;
    riskMultiplier *= 0.5;
  }

  // Realized vol impact
  if (market.realizedVol24h < 10) {
    reasons.push('Vol réalisée 24h faible : conditions favorables ✅');
    score += 1;
  } else if (market.realizedVol24h < 15) {
    reasons.push('Vol réalisée 24h modérée : acceptable ✅');
    score += 0;
  } else {
    reasons.push('Vol réalisée 24h élevée : attention aux mouvements brusques ⚠️');
    score -= 1;
    riskMultiplier *= 0.8;
  }

  // Regime impact
  if (market.regime === 'TREND') {
    reasons.push('Régime de tendance : conditions favorables au suivi ✅');
    score += 2;
  } else if (market.regime === 'RANGE') {
    reasons.push('Régime de range : éviter les breakout trades ⚠️');
    score -= 1;
    riskMultiplier *= 0.7;
  } else if (market.regime === 'SQUEEZE') {
    reasons.push('Régime de squeeze : risque de squeeze à contrario ⚠️');
    score -= 1;
    riskMultiplier *= 0.6;
  } else {
    reasons.push('Régime volatile : conditions chaotiques ❌');
    score -= 3;
    riskMultiplier *= 0.4;
  }

  // Session impact
  if (market.sessionActive) {
    reasons.push('Session active : liquidité optimale ✅');
    score += 1;
  } else {
    reasons.push('Session inactive : faible liquidité ⚠️');
    score -= 1;
    riskMultiplier *= 0.6;
  }

  // FTMO drawdown impact
  if (ftmo.drawdownUsed < 30) {
    reasons.push('Drawdown utilisé < 30% : marge confortable ✅');
    score += 2;
  } else if (ftmo.drawdownUsed < 50) {
    reasons.push('Drawdown utilisé 30-50% : rester prudent ⚠️');
    score += 0;
    riskMultiplier *= 0.8;
  } else if (ftmo.drawdownUsed < 70) {
    reasons.push('Drawdown utilisé 50-70% : réduire la taille ⚠️⚠️');
    score -= 2;
    riskMultiplier *= 0.5;
  } else {
    reasons.push('Drawdown utilisé > 70% : risque de breach ❌');
    score -= 3;
    riskMultiplier *= 0.3;
  }

  // Funding rate impact
  if (Math.abs(market.fundingRate) > 0.05) {
    reasons.push(`Funding extrême (${market.fundingRate.toFixed(3)}%) : risque de squeeze ⚠️`);
    score -= 1;
    riskMultiplier *= 0.7;
  }

  // Calculate final risk percent
  const baseRisk = 1.0; // 1% base risk per trade
  const riskPercent = Math.max(0.1, Math.min(2.0, baseRisk * riskMultiplier));

  // Calculate verdict
  let verdict: 'GO' | 'NO-GO' | 'CAUTION';
  if (score >= 4) {
    verdict = 'GO';
  } else if (score >= 1) {
    verdict = 'CAUTION';
  } else {
    verdict = 'NO-GO';
  }

  const maxPositionSize = (ftmo.accountBalance * riskPercent) / 100;

  return {
    verdict,
    riskPercent,
    maxPositionSize,
    reasoning: reasons,
    confidence: Math.min(100, Math.max(0, 50 + score * 10)),
  };
}

export default function GoNoGoPanel({
  marketContext = DEFAULT_MARKET,
  ftmoContext = DEFAULT_FTMO,
  loading,
}: Props) {
  const [recommendation, setRecommendation] = useState(
    calculatePositionRecommendation(DEFAULT_MARKET, DEFAULT_FTMO)
  );

  useEffect(() => {
    setRecommendation(calculatePositionRecommendation(marketContext, ftmoContext));
  }, [marketContext, ftmoContext]);

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING GO/NO-GO ENGINE...
        </motion.div>
      </div>
    );
  }

  const verdictColors = {
    GO: { bg: '#4ade8020', text: '#4ade80', border: '#4ade80', emoji: '🟢' },
    CAUTION: { bg: '#ffaa0020', text: '#ffaa00', border: '#ffaa00', emoji: '🟡' },
    'NO-GO': { bg: '#ff335520', text: '#ff3355', border: '#ff3355', emoji: '🔴' },
  };

  const colors = verdictColors[recommendation.verdict];
  const regimeColors = getRegimeColor(marketContext.regime);

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            GO / NO-GO TRADE
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          Contexte marché × Règles FTMO
        </div>
      </div>

      <div className="p-5">
        {/* Main verdict */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-6 p-6 rounded-xl border-2 text-center"
          style={{
            background: colors.bg,
            borderColor: colors.border,
          }}
        >
          <div className="text-5xl mb-3">{colors.emoji}</div>
          <div
            className="font-mono text-2xl font-black mb-2 tracking-[3px]"
            style={{ color: colors.text }}
          >
            {recommendation.verdict}
          </div>
          <div className="font-mono text-[0.72rem] text-[#8890a0] mb-3">
            Confiance : {recommendation.confidence}%
          </div>
          <div className="w-full h-2 bg-[#1a1a2e] rounded-full overflow-hidden mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${recommendation.confidence}%` }}
              transition={{ duration: 0.8 }}
              className="h-full rounded-full"
              style={{ background: colors.text }}
            />
          </div>
        </motion.div>

        {/* Position size recommendation */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4">
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase mb-1">
              Taille de position recommandée
            </div>
            <div className="font-mono text-3xl font-black text-[#eaeef4]">
              {recommendation.riskPercent.toFixed(1)}%
            </div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
              par trade max
            </div>
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4">
            <div className="font-mono text-[0.62rem] text-[#5a6070] uppercase mb-1">
              Montant max
            </div>
            <div className="font-mono text-3xl font-black text-[#eaeef4]">
              ${recommendation.maxPositionSize.toFixed(0)}
            </div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
              sur ${ftmoContext.accountBalance.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Market context */}
        <div className="mb-6">
          <div className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-[3px] mb-3">
            Contexte de marché
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
              <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">VIX</div>
              <div className={`font-mono text-lg font-bold ${marketContext.vix > 20 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {marketContext.vix.toFixed(1)}
              </div>
            </div>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
              <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">VOL 24H</div>
              <div className="font-mono text-lg font-bold text-[#eaeef4]">
                {marketContext.realizedVol24h.toFixed(1)}%
              </div>
            </div>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
              <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">RÉGIME</div>
              <div
                className="font-mono text-xs font-bold px-2 py-1 rounded inline-block"
                style={{
                  background: regimeColors.bg,
                  color: regimeColors.text,
                  border: `1px solid ${regimeColors.border}`,
                }}
              >
                {marketContext.regime}
              </div>
            </div>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
              <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">SESSION</div>
              <div className={`font-mono text-sm font-bold ${marketContext.sessionActive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {marketContext.sessionActive ? 'ACTIVE' : 'INACTIVE'}
              </div>
            </div>
          </div>
        </div>

        {/* FTMO risk context */}
        <div className="mb-6">
          <div className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-[3px] mb-3">
            Contexte de risque FTMO
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[0.58rem] text-[#5a6070]">DRAWDOWN UTILISÉ</span>
                <span className={`font-mono text-sm font-bold ${ftmoContext.drawdownUsed > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {ftmoContext.drawdownUsed}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ftmoContext.drawdownUsed > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${ftmoContext.drawdownUsed}%` }}
                />
              </div>
            </div>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[0.58rem] text-[#5a6070]">DAILY LOSS UTILISÉ</span>
                <span className={`font-mono text-sm font-bold ${ftmoContext.dailyLossUsed > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {ftmoContext.dailyLossUsed}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ftmoContext.dailyLossUsed > 50 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                  style={{ width: `${ftmoContext.dailyLossUsed}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Reasoning */}
        <div>
          <div className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-[3px] mb-3">
            Analyse détaillée
          </div>
          <div className="space-y-2">
            {recommendation.reasoning.map((reason, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg px-4 py-2 font-mono text-[0.65rem] flex items-center gap-3"
              >
                <span className="text-[#5a6070]">•</span>
                <span className="text-[#eaeef4]">{reason}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
