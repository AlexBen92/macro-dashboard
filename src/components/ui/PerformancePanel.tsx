'use client';
import { useMemo } from 'react';
import { usePerformance } from '@/hooks/usePerformance';
import MetricCard from './MetricCard';
import EquityCurve from './EquityCurve';
import TradeLogger from './TradeLogger';
import SignalHeatmap from './SignalHeatmap';

export default function PerformancePanel() {
  const { trades, metrics, addTrade, closeTrade, deleteTrade, clearAll } = usePerformance();

  // Build signal stats from trade records
  const signalStats = useMemo(() => {
    const map = new Map<string, { signalId: string; signalName: string; wins: number; total: number }>();
    for (const t of trades) {
      if (!t.signals || t.status === 'OPEN') continue;
      for (const sig of t.signals) {
        if (!map.has(sig)) map.set(sig, { signalId: sig, signalName: sig, wins: 0, total: 0 });
        const entry = map.get(sig)!;
        entry.total++;
        if (t.status === 'WIN') entry.wins++;
      }
    }
    return Array.from(map.values());
  }, [trades]);

  const streakLabel = metrics.currentStreak > 0
    ? `${metrics.currentStreak} WIN de suite`
    : metrics.currentStreak < 0
    ? `${Math.abs(metrics.currentStreak)} LOSS de suite`
    : '—';

  return (
    <div className="space-y-5">
      {/* Metrics grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="Win Rate"
          value={metrics.winRate}
          unit="%"
          type="winRate"
          tooltip="≥55% excellent, 45-55% acceptable, <45% à revoir"
          sub={`${metrics.wins}W / ${metrics.losses}L / ${metrics.breakEven}BE`}
        />
        <MetricCard
          label="Profit Factor"
          value={metrics.profitFactor === 999 ? '∞' : metrics.profitFactor}
          type="profitFactor"
          tooltip="Gains bruts / Pertes brutes. ≥1.5 cible pro"
          sub={`Avg W: +${metrics.avgWin.toFixed(2)}R  L: -${metrics.avgLoss.toFixed(2)}R`}
        />
        <MetricCard
          label="Expectancy"
          value={metrics.expectancy}
          unit="R"
          type="expectancy"
          tooltip="Gain moyen par trade en R. ≥0.5R = edge solide"
          sub={`Sur ${metrics.totalTrades} trades`}
        />
        <MetricCard
          label="Sharpe (20T)"
          value={metrics.sharpeRolling}
          type="sharpe"
          tooltip="Sharpe annualisé sur 20 derniers trades. ≥1.5 excellent"
          sub="Annualisé ×√250"
        />
        <MetricCard
          label="Max Drawdown"
          value={metrics.maxDrawdownPct}
          unit="%"
          type="maxDD"
          tooltip="% de drawdown max depuis le pic d'equity. ≤10% excellent"
          sub={`${metrics.maxDrawdown.toFixed(2)}R absolu`}
        />
        <MetricCard
          label="Calmar Ratio"
          value={metrics.calmarRatio}
          type="calmar"
          tooltip="Rendement annualisé / Max Drawdown. ≥2 excellent"
          sub="Return/Drawdown"
        />
        <MetricCard
          label="Streak"
          value={streakLabel}
          type="streak"
          tooltip="Série de gains ou de pertes consécutifs actuels"
        />
        <MetricCard
          label="Total Trades"
          value={metrics.totalTrades}
          type="neutral"
          sub={`${metrics.wins} wins · ${metrics.losses} losses`}
        />
      </div>

      {/* Equity curve */}
      <EquityCurve
        equityCurve={metrics.equityCurve}
        drawdownCurve={metrics.drawdownCurve}
      />

      {/* Signal heatmap */}
      {signalStats.length > 0 && (
        <SignalHeatmap stats={signalStats} />
      )}

      {/* Trade logger */}
      <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-5">
        <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-4">JOURNAL DE TRADES</div>
        <TradeLogger
          trades={trades}
          onAdd={addTrade}
          onClose={closeTrade}
          onDelete={deleteTrade}
          onClear={clearAll}
        />
      </div>
    </div>
  );
}
