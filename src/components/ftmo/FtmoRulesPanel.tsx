'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface FtmoAccount {
  balance: number;
  equity: number;
  dailyLoss: number;
  dailyLossLimit: number;
  maxDrawdown: number;
  maxDrawdownLimit: number;
  profit: number;
  profitTarget: number;
  daysTraded: number;
  minimumDays: number;
  lastReset?: string;
}

interface Props {
  account?: FtmoAccount;
  loading?: boolean;
}

const DEFAULT_ACCOUNT: FtmoAccount = {
  balance: 100000,
  equity: 100000,
  dailyLoss: -1200, // 1.2% loss today
  dailyLossLimit: -5000, // 5%
  maxDrawdown: -3800, // 3.8% total
  maxDrawdownLimit: -10000, // 10%
  profit: 6400, // 6.4%
  profitTarget: 10000, // 10%
  daysTraded: 3,
  minimumDays: 4,
};

function getStatusColor(pctUsed: number): { bg: string; text: string; border: string } {
  if (pctUsed >= 90) return { bg: '#ff335520', text: '#ff3355', border: '#ff3355' };
  if (pctUsed >= 70) return { bg: '#ffaa0020', text: '#ffaa00', border: '#ffaa00' };
  return { bg: '#4ade8020', text: '#4ade80', border: '#4ade80' };
}

function getTrafficLight(pctUsed: number, isInverted = false): { emoji: string; label: string; color: string } {
  const threshold = isInverted ? 100 - pctUsed : pctUsed;
  if (threshold >= 90) return { emoji: '🟢', label: 'SAFE', color: '#4ade80' };
  if (threshold >= 70) return { emoji: '🟡', label: 'EN COURS', color: '#ffaa00' };
  return { emoji: '🔴', label: 'RISQUE', color: '#ff3355' };
}

function RuleRow({
  label,
  currentValue,
  limitValue,
  targetValue,
  isInverted = false, // true for losses (closer to 0 is better), false for profits (higher is better)
  unit = '%',
  subtitle,
}: {
  label: string;
  currentValue: number;
  limitValue: number;
  targetValue?: number;
  isInverted?: boolean;
  unit?: string;
  subtitle?: string;
}) {
  const pctUsed = Math.abs((currentValue / limitValue) * 100);
  const pctTarget = targetValue ? Math.abs((currentValue / targetValue) * 100) : 0;
  const colors = getStatusColor(pctUsed);
  const trafficLight = getTrafficLight(pctTarget || pctUsed, isInverted);

  const remaining = isInverted
    ? Math.abs(limitValue - currentValue)
    : targetValue
    ? targetValue - currentValue
    : Math.abs(limitValue - currentValue);

  const remainingPct = isInverted
    ? ((remaining / Math.abs(limitValue)) * 100).toFixed(1)
    : targetValue
    ? ((remaining / targetValue) * 100).toFixed(1)
    : ((remaining / Math.abs(limitValue)) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-4"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{trafficLight.emoji}</span>
          <div>
            <div className="font-mono text-[0.72rem] font-bold text-[#8890a0] uppercase tracking-wider">
              {label}
            </div>
            {subtitle && (
              <div className="font-mono text-[0.58rem] text-[#5a6070]">{subtitle}</div>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-bold" style={{ color: colors.text }}>
            {currentValue > 0 ? '+' : ''}{currentValue.toFixed(2)}{unit}
          </div>
          <div className="font-mono text-[0.58rem] text-[#5a6070]">
            Limite: {limitValue > 0 ? '+' : ''}{limitValue}{unit}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[0.58rem] text-[#5a6070]">
            {isInverted ? 'Utilisé' : 'Progression'}
          </span>
          <span className="font-mono text-[0.58rem]" style={{ color: colors.text }}>
            {isInverted ? pctUsed.toFixed(1) : pctTarget.toFixed(1)}%
          </span>
        </div>
        <div className="w-full h-2 bg-[#1a1a2e] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${isInverted ? pctUsed : pctTarget}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full relative"
            style={{
              background: isInverted
                ? `linear-gradient(90deg, ${colors.text}40 0%, ${colors.text} 100%)`
                : `linear-gradient(90deg, #4ade8040 0%, ${colors.text} 100%)`,
            }}
          >
            {/* Warning stripes when close to limit */}
            {pctUsed >= 70 && (
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, #000 5px, #000 10px)',
                }}
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* Remaining margin */}
      <div className="flex items-center justify-between font-mono text-[0.62rem]">
        <span className="text-[#5a6070]">
          Marge restante: <span className="text-[#eaeef4] font-bold">${remaining.toFixed(2)}</span>
        </span>
        <span className="text-[#5a6070]">({remainingPct}%)</span>
      </div>

      {/* Alert thresholds */}
      <div className="mt-2 flex gap-2">
        {pctUsed >= 50 && (
          <div className={`px-2 py-1 rounded text-[0.52rem] font-mono font-bold ${pctUsed >= 90 ? 'bg-[#ff3355] text-white' : 'bg-[#1e1e32] text-[#5a6070]'}`}>
            50% ⚠️
          </div>
        )}
        {pctUsed >= 75 && (
          <div className={`px-2 py-1 rounded text-[0.52rem] font-mono font-bold ${pctUsed >= 90 ? 'bg-[#ff3355] text-white' : 'bg-[#1e1e32] text-[#5a6070]'}`}>
            75% ⚠️⚠️
          </div>
        )}
        {pctUsed >= 90 && (
          <div className="px-2 py-1 rounded bg-[#ff3355] text-white text-[0.52rem] font-mono font-bold animate-pulse">
            90% 🚨
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function FtmoRulesPanel({ account = DEFAULT_ACCOUNT, loading }: Props) {
  const [timeUntilReset, setTimeUntilReset] = useState('');

  useEffect(() => {
    // Calculate time until daily reset (midnight CET/CEST)
    const calculateReset = () => {
      const now = new Date();
      const cet = now.toLocaleString('en-US', { timeZone: 'Europe/Paris' });
      const cetDate = new Date(cet);
      const tomorrow = new Date(cetDate);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const diff = tomorrow.getTime() - cetDate.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeUntilReset(`${hours}h ${minutes}m ${seconds}s`);
    };

    calculateReset();
    const interval = setInterval(calculateReset, 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING FTMO RULES...
        </motion.div>
      </div>
    );
  }

  // Calculate percentages
  const dailyLossPct = (account.dailyLoss / account.dailyLossLimit) * 100;
  const drawdownPct = (account.maxDrawdown / account.maxDrawdownLimit) * 100;
  const profitPct = (account.profit / account.profitTarget) * 100;
  const daysPct = (account.daysTraded / account.minimumDays) * 100;

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            FTMO RULES
          </span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-[0.58rem] text-[#4ade80]">LIVE</span>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[0.58rem] text-[#5a6070]">Reset quotidien</div>
          <div className="font-mono text-[0.65rem] text-[#eaeef4]">{timeUntilReset}</div>
        </div>
      </div>

      {/* Rules grid */}
      <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <RuleRow
          label="MAX DAILY LOSS"
          subtitle="Recalculé à minuit CET"
          currentValue={account.dailyLoss}
          limitValue={account.dailyLossLimit}
          isInverted={true}
          unit="%"
        />
        <RuleRow
          label="MAX DRAWDOWN"
          subtitle="Drawdown total depuis le départ"
          currentValue={account.maxDrawdown}
          limitValue={account.maxDrawdownLimit}
          isInverted={true}
          unit="%"
        />
        <RuleRow
          label="PROFIT TARGET"
          subtitle="Objectif de profit"
          currentValue={account.profit}
          limitValue={account.profitTarget}
          targetValue={account.profitTarget}
          isInverted={false}
          unit="%"
        />
        <RuleRow
          label="JOURS TRADÉS"
          subtitle="Minimum 4 jours requis"
          currentValue={account.daysTraded}
          limitValue={account.minimumDays}
          targetValue={account.minimumDays}
          isInverted={false}
          unit=""
        />
      </div>

      {/* Summary footer */}
      <div className="px-5 py-3 border-t border-[#1e1e32] bg-[#0e0e1a]">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase">Balance</div>
            <div className="font-mono text-lg font-bold text-[#eaeef4]">${account.balance.toLocaleString()}</div>
          </div>
          <div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase">Equity</div>
            <div className={`font-mono text-lg font-bold ${account.equity >= account.balance ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${account.equity.toLocaleString()}
            </div>
          </div>
          <div>
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase">P&L Flottant</div>
            <div className={`font-mono text-lg font-bold ${(account.equity - account.balance) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(account.equity - account.balance) >= 0 ? '+' : ''}{((account.equity - account.balance) / account.balance * 100).toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* Best Day Rule indicator (for 1-Step) */}
      {account.daysTraded > 0 && (
        <div className="px-5 py-3 border-t border-[#1e1e32] bg-[#0a0a14]">
          <div className="flex items-center justify-between">
            <div className="font-mono text-[0.62rem] text-[#5a6070]">
              BEST DAY RULE (1-Step)
            </div>
            <div className="font-mono text-[0.62rem] text-[#4ade80]">
              Meilleur jour ≤ 50% du profit total: ✅
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
