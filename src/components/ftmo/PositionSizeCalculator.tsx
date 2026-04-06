'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface FtmoRiskParams {
  accountBalance: number;
  dailyLossUsed: number; // percentage
  dailyLossLimit: number; // percentage
  maxDrawdownUsed: number; // percentage
  maxDrawdownLimit: number; // percentage
}

interface Props {
  ftmoParams?: FtmoRiskParams;
}

const DEFAULT_PARAMS: FtmoRiskParams = {
  accountBalance: 100000,
  dailyLossUsed: 24, // 24%
  dailyLossLimit: 5, // 5%
  maxDrawdownUsed: 38, // 38%
  maxDrawdownLimit: 10, // 10%
};

export default function PositionSizeCalculator({ ftmoParams = DEFAULT_PARAMS }: Props) {
  const [balance, setBalance] = useState(ftmoParams.accountBalance);
  const [riskPercent, setRiskPercent] = useState(1.0);
  const [stopLoss, setStopLoss] = useState(20); // pips
  const [pair, setPair] = useState('EURUSD');

  // Calculate remaining margins
  const dailyLossRemaining = ((1 - ftmoParams.dailyLossUsed / 100) * ftmoParams.dailyLossLimit * balance) / 100;
  const drawdownRemaining = ((1 - ftmoParams.maxDrawdownUsed / 100) * ftmoParams.maxDrawdownLimit * balance) / 100;

  // Adjust risk based on proximity to limits
  const getAdjustedRisk = () => {
    let risk = riskPercent;

    // Reduce risk if close to daily loss limit
    if (ftmoParams.dailyLossUsed > 70) {
      risk *= 0.3;
    } else if (ftmoParams.dailyLossUsed > 50) {
      risk *= 0.5;
    }

    // Reduce risk if close to max drawdown
    if (ftmoParams.maxDrawdownUsed > 70) {
      risk *= 0.3;
    } else if (ftmoParams.maxDrawdownUsed > 50) {
      risk *= 0.5;
    }

    return Math.max(0.1, risk);
  };

  const adjustedRisk = getAdjustedRisk();

  // Calculate position size
  const riskAmount = (balance * adjustedRisk) / 100;
  const pipValue = 10; // Standard lot pip value for EURUSD
  const positionSize = riskAmount / (stopLoss * pipValue);

  // Calculate max allowable loss
  const maxAllowableLoss = Math.min(dailyLossRemaining, drawdownRemaining);
  const canAffordTrade = riskAmount <= maxAllowableLoss * 0.5; // Use max 50% of remaining margin

  // Pip values for different pairs (approximate)
  const pipValues: Record<string, number> = {
    EURUSD: 10,
    GBPUSD: 10,
    USDJPY: 9.09, // Approximate
    GOLD: 10,
    US30: 10,
  };

  const getPipValue = () => {
    return pipValues[pair] || 10;
  };

  const calculatePositionSize = () => {
    const pv = getPipValue();
    return (balance * (adjustedRisk / 100)) / (stopLoss * pv);
  };

  const finalPositionSize = calculatePositionSize();
  const actualRiskAmount = (finalPositionSize * stopLoss * getPipValue());

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            POSITION SIZE CALCULATOR
          </span>
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          FTMO-aware risk management
        </div>
      </div>

      <div className="p-5">
        {/* Input parameters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {/* Account Balance */}
          <div>
            <label className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2 block">
              Balance du compte ($)
            </label>
            <input
              type="number"
              value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="w-full bg-[#0a0a14] border border-[#1e1e32] rounded-lg px-4 py-3 font-mono text-[#eaeef4] focus:outline-none focus:border-[#4ade80] transition-colors"
              placeholder="100000"
            />
          </div>

          {/* Risk Percentage */}
          <div>
            <label className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2 block">
              Risque par trade (%)
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.1"
                value={riskPercent}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full bg-[#0a0a14] border border-[#1e1e32] rounded-lg px-4 py-3 font-mono text-[#eaeef4] focus:outline-none focus:border-[#4ade80] transition-colors"
                placeholder="1.0"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono text-[#5a6070]">%</span>
            </div>
          </div>

          {/* Stop Loss (pips) */}
          <div>
            <label className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2 block">
              Stop Loss (pips)
            </label>
            <input
              type="number"
              value={stopLoss}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="w-full bg-[#0a0a14] border border-[#1e1e32] rounded-lg px-4 py-3 font-mono text-[#eaeef4] focus:outline-none focus:border-[#4ade80] transition-colors"
              placeholder="20"
            />
          </div>

          {/* Pair */}
          <div>
            <label className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2 block">
              Paire de devises
            </label>
            <select
              value={pair}
              onChange={(e) => setPair(e.target.value)}
              className="w-full bg-[#0a0a14] border border-[#1e1e32] rounded-lg px-4 py-3 font-mono text-[#eaeef4] focus:outline-none focus:border-[#4ade80] transition-colors"
            >
              <option value="EURUSD">EURUSD</option>
              <option value="GBPUSD">GBPUSD</option>
              <option value="USDJPY">USDJPY</option>
              <option value="GOLD">GOLD (XAUUSD)</option>
              <option value="US30">US30 (DJIA)</option>
            </select>
          </div>
        </div>

        {/* Risk adjustment warning */}
        {adjustedRisk < riskPercent && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg border-2 border-[#ffaa00] bg-[#ffaa0010]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-mono text-[0.65rem] font-bold text-[#ffaa00] uppercase mb-1">
                  Risque ajusté automatiquement
                </div>
                <div className="font-mono text-[0.58rem] text-[#eaeef4]">
                  Votre proximité des limites FTMO a réduit le risque de {riskPercent.toFixed(1)}% à{' '}
                  <span className="text-[#ffaa00] font-bold">{adjustedRisk.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Position Size */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2">Taille de position</div>
            <motion.div
              key={finalPositionSize}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono text-3xl font-black text-[#4ade80]"
            >
              {finalPositionSize.toFixed(2)}
            </motion.div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">lots standard</div>
          </div>

          {/* Risk Amount */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2">Risque absolu</div>
            <motion.div
              key={actualRiskAmount}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="font-mono text-3xl font-black text-[#eaeef4]"
            >
              ${actualRiskAmount.toFixed(2)}
            </motion.div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
              {adjustedRisk.toFixed(2)}% du compte
            </div>
          </div>

          {/* Status */}
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2">Statut</div>
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`font-mono text-2xl font-black ${canAffordTrade ? 'text-emerald-400' : 'text-rose-400'}`}
            >
              {canAffordTrade ? '✅ OK' : '❌ RISQUE'}
            </motion.div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] mt-1">
              {canAffordTrade ? 'Dans les limites' : 'Trop risqué'}
            </div>
          </div>
        </div>

        {/* Remaining margins */}
        <div className="mb-6">
          <div className="font-mono text-[0.72rem] text-[#8890a0] uppercase tracking-[3px] mb-3">
            Marges restantes FTMO
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[0.58rem] text-[#5a6070]">Daily Loss</span>
                <span className="font-mono text-sm font-bold text-[#4ade80]">
                  ${dailyLossRemaining.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(1 - ftmoParams.dailyLossUsed / 100) * 100}%` }}
                />
              </div>
              <div className="font-mono text-[0.5rem] text-[#5a6070] mt-1">
                {ftmoParams.dailyLossUsed}% utilisé
              </div>
            </div>
            <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[0.58rem] text-[#5a6070]">Max Drawdown</span>
                <span className="font-mono text-sm font-bold text-[#4ade80]">
                  ${drawdownRemaining.toFixed(2)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${(1 - ftmoParams.maxDrawdownUsed / 100) * 100}%` }}
                />
              </div>
              <div className="font-mono text-[0.5rem] text-[#5a6070] mt-1">
                {ftmoParams.maxDrawdownUsed}% utilisé
              </div>
            </div>
          </div>
        </div>

        {/* Safety tips */}
        <div className="bg-[#0e0e1a] border border-[#1e1e32] rounded-lg p-4">
          <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-2">
            💡 Conseils de sécurité
          </div>
          <ul className="space-y-1 font-mono text-[0.58rem] text-[#8890a0]">
            <li>• Ne risquez jamais plus de 50% de votre marge restante sur un trade</li>
            <li>• Réduisez la taille si vous approchez des limites FTMO</li>
            <li>• Ajustez le stop loss selon la volatilité actuelle (VIX)</li>
            <li>• Gardez une marge de sécurité pour les frais de swap/commission</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
