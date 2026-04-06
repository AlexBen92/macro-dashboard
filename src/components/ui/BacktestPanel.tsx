'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBacktest } from '@/hooks/useBacktest';
import EquityCurve from './EquityCurve';
import type { BacktestResult } from '@/lib/backtest';
import { INITIAL_CAPITAL } from '@/lib/backtest';

function fmt(n: number, d = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtSign(n: number, d = 2): string {
  return (n >= 0 ? '+' : '') + fmt(n, d);
}
function metricColor(type: string, val: number): string {
  switch (type) {
    case 'winRate': return val >= 55 ? '#4ade80' : val >= 45 ? '#ffaa00' : '#ff3355';
    case 'pf': return val >= 1.5 ? '#4ade80' : val >= 1.0 ? '#ffaa00' : '#ff3355';
    case 'sharpe': return val >= 1.5 ? '#4ade80' : val >= 0.5 ? '#ffaa00' : '#ff3355';
    case 'dd': return val <= 10 ? '#4ade80' : val <= 20 ? '#ffaa00' : '#ff3355';
    case 'pnl': return val >= 0 ? '#4ade80' : '#ff3355';
    default: return '#eaeef4';
  }
}

function CoinResult({ r }: { r: BacktestResult }) {
  const [showTrades, setShowTrades] = useState(false);
  const pnlColor = metricColor('pnl', r.totalPnl);

  return (
    <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="font-mono text-[0.9rem] font-bold text-[#eaeef4]">{r.coin}</span>
            <span className="font-mono text-[0.6rem] text-[#5a6070] tracking-[2px]">
              {new Date(r.candleFrom).toLocaleDateString('fr-FR')} → {new Date(r.candleTo).toLocaleDateString('fr-FR')}
            </span>
            <span className="font-mono text-[0.6rem] text-[#5a6070]">{r.totalCandles} bougies H1</span>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[1.6rem] font-bold" style={{ color: pnlColor }}>
              {fmtSign(r.totalPnl)}$
            </span>
            <span className="font-mono text-[0.85rem] font-bold" style={{ color: pnlColor }}>
              ({fmtSign(r.totalPnlPct, 1)}%)
            </span>
            <span className="font-mono text-[0.7rem] text-[#5a6070]">
              sur ${fmt(INITIAL_CAPITAL, 0)} · frais: ${fmt(r.totalFees)}
            </span>
          </div>
        </div>
        <div className="font-mono text-[0.65rem] text-[#5a6070] text-right">
          <div>{r.totalTrades} trades · {r.wins}W / {r.losses}L</div>
          <div className="text-[0.58rem] mt-0.5">Mise à jour toutes les 24h</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-5 pb-4 grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: 'Win Rate', val: r.winRate.toFixed(1) + '%', type: 'winRate', raw: r.winRate },
          { label: 'Profit Factor', val: r.profitFactor === 999 ? '∞' : r.profitFactor.toFixed(2), type: 'pf', raw: r.profitFactor },
          { label: 'Expectancy', val: fmtSign(r.expectancyUsd) + '$', type: 'pnl', raw: r.expectancyUsd },
          { label: 'Sharpe', val: r.sharpe.toFixed(2), type: 'sharpe', raw: r.sharpe },
          { label: 'Max DD', val: r.maxDrawdownPct.toFixed(1) + '%', type: 'dd', raw: r.maxDrawdownPct },
          { label: 'Avg Win', val: '+' + fmt(r.avgWinUsd) + '$', type: 'pnl', raw: r.avgWinUsd },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-[#1e1e32] px-3 py-2 text-center">
            <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase">{s.label}</div>
            <div className="font-mono text-[0.8rem] font-bold mt-0.5" style={{ color: metricColor(s.type, s.raw) }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Equity curve */}
      {r.equityCurve.length > 1 && (
        <div className="px-3 pb-3">
          <EquityCurve equityCurve={r.equityCurve} drawdownCurve={r.drawdownCurve} unit="$" />
        </div>
      )}

      {/* Signal accuracy heatmap */}
      <div className="px-5 pb-4">
        <div className="font-mono text-[0.6rem] text-[#5a6070] tracking-[2px] uppercase mb-2">PRÉCISION DES SIGNAUX</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            { label: 'MACD BULL', stat: r.signalAccuracy.multiTF_bull ?? { wins: 0, total: 0 } },
            { label: 'MACD BEAR', stat: r.signalAccuracy.multiTF_bear ?? { wins: 0, total: 0 } },
            { label: 'MACD CROSS', stat: r.signalAccuracy.macd_cross ?? { wins: 0, total: 0 } },
            { label: 'VWTSMOM ↑', stat: r.signalAccuracy.vwtsmom_pos ?? { wins: 0, total: 0 } },
            { label: 'VWTSMOM ↓', stat: r.signalAccuracy.vwtsmom_neg ?? { wins: 0, total: 0 } },
            { label: 'MOMENTUM', stat: r.signalAccuracy.regime_momentum ?? { wins: 0, total: 0 } },
          ].map(({ label, stat }) => {
            const wr = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
            const color = wr >= 55 ? '#4ade80' : wr >= 45 ? '#ffaa00' : '#ff3355';
            return (
              <div key={label} className="rounded-lg border border-[#1e1e32] px-3 py-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[0.62rem] text-[#a0a8b8]">{label}</span>
                  <span className="font-mono text-[0.72rem] font-bold" style={{ color }}>
                    {stat.total > 0 ? wr.toFixed(0) + '%' : 'N/A'}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[#1e1e32] overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${wr}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </div>
                <div className="font-mono text-[0.55rem] text-[#5a6070] mt-1">{stat.wins}/{stat.total} trades</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trade list toggle */}
      <div className="px-5 pb-4">
        <button
          onClick={() => setShowTrades(v => !v)}
          className="font-mono text-[0.65rem] text-[#5a6070] hover:text-[#aa66ff] transition-colors border border-[#1e1e32] px-3 py-1.5 rounded-lg"
        >
          {showTrades ? '▲ Masquer' : '▼ Voir'} les {r.totalTrades} trades
        </button>
        <AnimatePresence>
          {showTrades && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mt-3"
            >
              <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                {[...r.trades].reverse().map(t => (
                  <div key={t.id} className="rounded-lg border border-[#1e1e32] px-3 py-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.outcome === 'WIN' ? 'bg-[#4ade80]' : t.outcome === 'LOSS' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
                        <span className="font-mono text-[0.65rem] text-[#5a6070]">{new Date(t.entryTime).toLocaleDateString('fr-FR')}</span>
                        <span className={`font-mono text-[0.7rem] font-bold ${t.direction === 'LONG' ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>{t.direction}</span>
                        <span className="font-mono text-[0.62rem] text-[#8890a0]">@{t.entryPrice.toFixed(t.entryPrice < 10 ? 4 : 0)} → {t.exitPrice.toFixed(t.exitPrice < 10 ? 4 : 0)}</span>
                      </div>
                      <span className={`font-mono text-[0.75rem] font-bold ${t.pnlNet >= 0 ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>
                        {t.pnlNet >= 0 ? '+' : ''}{fmt(t.pnlNet)}$ ({t.pnlR >= 0 ? '+' : ''}{t.pnlR.toFixed(2)}R)
                      </span>
                    </div>
                    {/* Strategy label */}
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[0.58rem] text-[#aa66ff] bg-[#aa66ff]/08 px-2 py-0.5 rounded">
                        {t.strategyLabel ?? '—'}
                      </span>
                      <span className="font-mono text-[0.55rem] text-[#5a6070]">
                        confl:{t.confluenceScore}% · frais:${fmt(t.feeEntry + t.feeExit)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function BacktestPanel({ mode = 'crypto' }: { mode?: 'crypto' | 'ftmo' }) {
  const { results, loading, error, fetchedAt, fromCache, refresh } = useBacktest(mode);

  const nextRefresh = fetchedAt
    ? new Date(new Date(fetchedAt).getTime() + 24 * 60 * 60 * 1000)
    : null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase">
            WALK-FORWARD BACKTEST — 1 000 BOUGIES H1 · FRAIS 0.04%×2
            {mode === 'ftmo' ? ' · XAU/USD · NAS100 · EUR/USD · GBP/USD' : ' · BTC/USD · ETH/USD'}
          </div>
          {fetchedAt && (
            <div className="font-mono text-[0.6rem] text-[#5a6070] mt-0.5">
              {fromCache ? '📦 Cache' : '🔄 Fraîchement calculé'} · {new Date(fetchedAt).toLocaleString('fr-FR')}
              {nextRefresh && ` · Prochain refresh: ${nextRefresh.toLocaleString('fr-FR')}`}
            </div>
          )}
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="font-mono text-[0.65rem] tracking-[2px] uppercase px-4 py-2 rounded-lg border border-[#1e1e32] text-[#8890a0] hover:border-[#aa66ff] hover:text-[#aa66ff] transition-colors disabled:opacity-50"
        >
          {loading ? '⏳ Calcul...' : '↻ FORCER REFRESH'}
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-10 text-center">
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="font-mono text-[0.85rem] text-[#aa66ff]"
          >
            Fetch 1 000 candles Binance + replay signaux V3...
          </motion.div>
          <div className="font-mono text-[0.65rem] text-[#5a6070] mt-2">BTC/USD · ETH/USD · ~5 secondes</div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-[#ff3355]/30 bg-[#ff3355]/05 p-4 font-mono text-[0.75rem] text-[#ff3355]">
          ⚠ Erreur backtest: {error}
          <button onClick={refresh} className="ml-3 underline hover:no-underline">Réessayer</button>
        </div>
      )}

      {/* Results */}
      {!loading && results.map(r => (
        <CoinResult key={r.coin} r={r} />
      ))}

      {/* Empty state */}
      {!loading && !error && results.length === 0 && (
        <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-10 text-center font-mono text-[0.75rem] text-[#5a6070]">
          Cliquez sur "FORCER REFRESH" pour lancer le backtest.
        </div>
      )}

      {/* Methodology note */}
      <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-4">
        <div className="font-mono text-[0.6rem] text-[#5a6070] tracking-[2px] uppercase mb-2">MÉTHODOLOGIE</div>
        <div className="font-mono text-[0.65rem] text-[#5a6070] space-y-1">
          <div>• <span className="text-[#a0a8b8]">Données:</span> 1 000 bougies H1 Binance (≈ 42 jours glissants) — actualisées toutes les 24h</div>
          <div>• <span className="text-[#a0a8b8]">Entrée:</span> Confluence ≥ 65% LONG / ≤ 35% SHORT (MACD + VWTSMOM + Regime, poids 0.6)</div>
          <div>• <span className="text-[#a0a8b8]">Sortie:</span> Stop = 2×ATR(14), TP = 3×ATR(14) → R:R 1:1.5 · 1 trade à la fois</div>
          <div>• <span className="text-[#a0a8b8]">Sizing:</span> 1% du capital risqué par trade (compte 10 000$)</div>
          <div>• <span className="text-[#a0a8b8]">Frais:</span> 0.04% entrée + 0.04% sortie (maker crypto)</div>
          <div>• <span className="text-[#a0a8b8]">Walk-forward:</span> signaux recalculés sur chaque nouvelle bougie (pas de lookahead bias)</div>
          <div>• <span className="text-[#a0a8b8]">Persistence:</span> résultats gardés 24h en localStorage — historique des trades préservé</div>
        </div>
      </div>
    </div>
  );
}
