'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';

interface DayTrade {
  date: string;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  notes?: string;
  strategy?: string;
  emotion?: 'NEUTRAL' | 'CONFIDENT' | 'REVENGE' | 'FEARFUL';
}

interface Props {
  trades?: DayTrade[];
  loading?: boolean;
}

// Generate sample data for demonstration
const generateSampleData = (): DayTrade[] => {
  const data: DayTrade[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) {
      continue;
    }

    const isWinning = Math.random() > 0.45;
    const pnl = isWinning
      ? Math.random() * 800 + 100
      : -(Math.random() * 400 + 50);
    const pnlPercent = (pnl / 100000) * 100;

    data.push({
      date: date.toISOString(),
      pnl,
      pnlPercent,
      trades: Math.floor(Math.random() * 8) + 1,
      winRate: Math.floor(Math.random() * 40) + 40,
      notes: Math.random() > 0.7 ? 'Setup ICT H1' : undefined,
      strategy: ['Scalp', 'Swing', 'ICT', 'SMC'][Math.floor(Math.random() * 4)],
      emotion: ['NEUTRAL', 'CONFIDENT', 'REVENGE', 'FEARFUL'][Math.floor(Math.random() * 4)] as any,
    });
  }

  return data;
};

function getPnLColor(pnl: number): { bg: string; text: string; intensity: number } {
  const absPnl = Math.abs(pnl);
  const intensity = Math.min(1, absPnl / 800); // Cap at $800

  if (pnl > 0) {
    // Green scale
    const lightness = 85 - intensity * 35; // 85% -> 50%
    return {
      bg: `hsl(142, 76%, ${lightness}%)`,
      text: intensity > 0.6 ? '#166534' : '#15803d',
      intensity,
    };
  } else {
    // Red scale
    const lightness = 85 - intensity * 35;
    return {
      bg: `hsl(0, 84%, ${lightness}%)`,
      text: intensity > 0.6 ? '#991b1b' : '#b91c1c',
      intensity,
    };
  }
}

function getEmotionEmoji(emotion?: string): string {
  const emojis = {
    NEUTRAL: '😐',
    CONFIDENT: '😤',
    REVENGE: '😡',
    FEARFUL: '😰',
  };
  return emotion ? emojis[emotion as keyof typeof emojis] || '😐' : '';
}

export default function PnLCalendar({ trades = generateSampleData(), loading }: Props) {
  const [selectedDay, setSelectedDay] = useState<DayTrade | null>(null);

  if (loading) {
    return (
      <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl p-8 text-center">
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="font-mono text-sm text-[#8890a0]"
        >
          LOADING PNL CALENDAR...
        </motion.div>
      </div>
    );
  }

  // Calculate stats
  const totalPnL = trades.reduce((sum, t) => sum + t.pnl, 0);
  const winningDays = trades.filter(t => t.pnl > 0).length;
  const losingDays = trades.filter(t => t.pnl < 0).length;
  const avgWin = trades.filter(t => t.pnl > 0).reduce((sum, t) => sum + t.pnl, 0) / (winningDays || 1);
  const avgLoss = trades.filter(t => t.pnl < 0).reduce((sum, t) => sum + t.pnl, 0) / (losingDays || 1);
  const winRate = (winningDays / trades.length) * 100;

  // Group by week for better display
  const weeks: DayTrade[][] = [];
  let currentWeek: DayTrade[] = [];

  trades.forEach(trade => {
    const date = new Date(trade.date);
    const dayOfWeek = date.getDay();

    currentWeek.push(trade);

    if (dayOfWeek === 5 || currentWeek.length === 5) {
      weeks.push([...currentWeek]);
      currentWeek = [];
    }
  });

  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  return (
    <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3 border-b border-[#1e1e32] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[0.72rem] font-bold uppercase tracking-[3px] text-[#8890a0]">
            PNL CALENDAR
          </span>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div className="font-mono text-[0.58rem] text-[#5a6070]">
          {trades.length} jours de trading
        </div>
      </div>

      <div className="p-5">
        {/* Stats summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Total P&L</div>
            <div className={`font-mono text-lg font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(0)}
            </div>
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Win Rate</div>
            <div className="font-mono text-lg font-bold text-[#eaeef4]">{winRate.toFixed(0)}%</div>
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Avg Win</div>
            <div className="font-mono text-lg font-bold text-emerald-400">
              +${avgWin.toFixed(0)}
            </div>
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Avg Loss</div>
            <div className="font-mono text-lg font-bold text-rose-400">
              ${avgLoss.toFixed(0)}
            </div>
          </div>
          <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3 text-center">
            <div className="font-mono text-[0.58rem] text-[#5a6070] uppercase mb-1">Profit Factor</div>
            <div className="font-mono text-lg font-bold text-[#eaeef4]">
              {(Math.abs(avgWin * winningDays) / Math.abs(avgLoss * losingDays)).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="flex gap-2">
              {week.map((day, dayIndex) => {
                const colors = getPnLColor(day.pnl);
                const date = new Date(day.date);
                const dayName = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

                return (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (weekIndex * 5 + dayIndex) * 0.02 }}
                    className="flex-1 min-w-[60px] h-20 rounded-lg cursor-pointer border-2 transition-all hover:scale-105 hover:z-10 relative overflow-hidden group"
                    style={{
                      background: colors.bg,
                      borderColor: colors.intensity > 0.6 ? colors.text : 'transparent',
                    }}
                    onClick={() => setSelectedDay(day)}
                  >
                    {/* Date */}
                    <div className="absolute top-1 left-2 font-mono text-[0.58rem] text-[#0a0a14] font-bold">
                      {dayName}
                    </div>

                    {/* P&L */}
                    <div className="absolute bottom-1 left-2 right-2">
                      <div className={`font-mono text-xs font-bold ${colors.text}`}>
                        {day.pnl >= 0 ? '+' : ''}${day.pnl.toFixed(0)}
                      </div>
                      <div className="font-mono text-[0.5rem] text-[#0a0a14] opacity-80">
                        {day.pnlPercent >= 0 ? '+' : ''}{day.pnlPercent.toFixed(2)}%
                      </div>
                    </div>

                    {/* Emotion emoji */}
                    {day.emotion && day.emotion !== 'NEUTRAL' && (
                      <div className="absolute top-1 right-2 text-lg opacity-60">
                        {getEmotionEmoji(day.emotion)}
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-20 transition-opacity" />
                  </motion.div>
                );
              })}

              {/* Fill empty days in week */}
              {Array.from({ length: 5 - week.length }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="flex-1 min-w-[60px] h-20 rounded-lg bg-[#1a1a2e] border border-dashed border-[#2a2a3e] flex items-center justify-center"
                >
                  <span className="font-mono text-[0.58rem] text-[#3a4050]">—</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 font-mono text-[0.58rem] text-[#5a6070]">
          <span>Intensity:</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-emerald-200" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-emerald-500" />
            <span>High</span>
          </div>
          <div className="w-px h-4 bg-[#2a2a3e]" />
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-rose-200" />
            <span>Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-rose-500" />
            <span>High</span>
          </div>
        </div>
      </div>

      {/* Detail panel */}
      {selectedDay && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-[#1e1e32] bg-[#0e0e1a]"
        >
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="font-mono text-[0.72rem] font-bold text-[#8890a0]">
                  {new Date(selectedDay.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>
              <button
                onClick={() => setSelectedDay(null)}
                className="font-mono text-[0.58rem] text-[#5a6070] hover:text-[#eaeef4] transition-colors"
              >
                ✕ FERMER
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
                <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">P&L</div>
                <div className={`font-mono text-xl font-bold ${selectedDay.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {selectedDay.pnl >= 0 ? '+' : ''}${selectedDay.pnl.toFixed(2)}
                </div>
              </div>
              <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
                <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">Trades</div>
                <div className="font-mono text-xl font-bold text-[#eaeef4]">{selectedDay.trades}</div>
              </div>
              <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
                <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">Win Rate</div>
                <div className="font-mono text-xl font-bold text-[#eaeef4]">{selectedDay.winRate}%</div>
              </div>
              <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
                <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">Stratégie</div>
                <div className="font-mono text-sm font-bold text-[#eaeef4]">{selectedDay.strategy || 'N/A'}</div>
              </div>
            </div>

            {selectedDay.notes && (
              <div className="bg-[#0a0a14] border border-[#1e1e32] rounded-lg p-3">
                <div className="font-mono text-[0.58rem] text-[#5a6070] mb-1">Notes</div>
                <div className="font-mono text-sm text-[#eaeef4]">{selectedDay.notes}</div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
