'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVirtualAccount } from '@/hooks/useVirtualAccount';
import EquityCurve from './EquityCurve';
import type { AccountType } from '@/lib/virtualAccount';
import { calcQty, INITIAL_BALANCE } from '@/lib/virtualAccount';

interface VirtualAccountPanelProps {
  accountType: AccountType;
  instruments: string[];          // liste des instruments dispo
  livePrices: Record<string, number>; // { 'BTC/USD': 95000, ... }
}

const defaultForm = {
  instrument: '',
  direction: 'LONG' as 'LONG' | 'SHORT',
  entry: '',
  stop: '',
  tp: '',
  riskPct: '1',
};

function fmt(n: number, decimals = 2): string {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtSign(n: number): string {
  return (n >= 0 ? '+' : '') + fmt(n);
}

export default function VirtualAccountPanel({ accountType, instruments, livePrices }: VirtualAccountPanelProps) {
  const { account, metrics, openTrade, closeTrade, deleteTrade, resetAccount, autoClose } = useVirtualAccount(accountType, livePrices);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...defaultForm, instrument: instruments[0] ?? '' });
  const [closeTarget, setCloseTarget] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState('');

  const openTrades = account.trades.filter(t => t.status === 'OPEN');
  const closedTrades = [...account.trades.filter(t => t.status !== 'OPEN')].reverse().slice(0, 15);

  const totalPnlColor = metrics.totalPnl >= 0 ? 'text-[#4ade80]' : 'text-[#ff3355]';
  const balancePct = ((account.balance / INITIAL_BALANCE) - 1) * 100;

  // Preview sizing
  const entryNum = parseFloat(form.entry);
  const stopNum = parseFloat(form.stop);
  const tpNum = parseFloat(form.tp);
  const riskNum = Math.max(0.1, Math.min(5, parseFloat(form.riskPct) || 1));
  const preview = (entryNum > 0 && stopNum > 0 && !isNaN(entryNum) && !isNaN(stopNum))
    ? calcQty(account.balance, entryNum, stopNum, riskNum / 100)
    : null;
  const previewRR = (preview && tpNum > 0 && stopNum > 0)
    ? Math.abs(tpNum - entryNum) / Math.abs(stopNum - entryNum)
    : null;

  function handleOpen() {
    if (!form.instrument || !entryNum || !stopNum || !tpNum) return;
    openTrade({
      instrument: form.instrument,
      direction: form.direction,
      entry: entryNum,
      stop: stopNum,
      tp: tpNum,
      riskPct: riskNum / 100,
    });
    setShowForm(false);
    setForm(f => ({ ...f, entry: '', stop: '', tp: '' }));
  }

  function handleCloseConfirm() {
    if (!closeTarget) return;
    const px = parseFloat(closePrice);
    if (!isNaN(px) && px > 0) closeTrade(closeTarget, px);
    setCloseTarget(null);
    setClosePrice('');
  }

  function fillLivePrice() {
    const lp = livePrices[form.instrument];
    if (lp) setForm(f => ({ ...f, entry: String(lp) }));
  }

  // Live unrealised P&L for an open trade
  function liveUnrealised(t: typeof openTrades[0]): number {
    const lp = livePrices[t.instrument];
    if (!lp) return 0;
    const diff = t.direction === 'LONG' ? lp - t.entry : t.entry - lp;
    return Math.round((diff * t.qty - t.qty * lp * 0.0004) * 100) / 100;
  }

  // Equity curve: use $ values
  const eqCurve = metrics.equityCurveUsd;
  // Convert to R-like for EquityCurve component (just use $ directly)
  const eqForChart = eqCurve;
  const ddForChart = metrics.drawdownCurveUsd;

  return (
    <div className="space-y-5">
      {/* Account header */}
      <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="font-mono text-[0.6rem] text-[#5a6070] tracking-[2px] uppercase mb-1">
              COMPTE VIRTUEL — {accountType?.toUpperCase?.() ?? 'FTMO'} DEMO
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[2rem] font-bold text-[#eaeef4]">${fmt(account.balance)}</span>
              <span className={`font-mono text-[0.9rem] font-bold ${totalPnlColor}`}>
                {fmtSign(metrics.totalPnl)}$ ({fmtSign(balancePct)}%)
              </span>
            </div>
            <div className="font-mono text-[0.68rem] text-[#5a6070] mt-1">
              Equity: <span className="text-[#a0a8b8]">${fmt(account.equity)}</span>
              &nbsp;·&nbsp;Frais payés: <span className="text-[#ffaa00]">${fmt(metrics.totalFees)}</span>
              &nbsp;·&nbsp;Capital initial: ${fmt(INITIAL_BALANCE)}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowForm(v => !v)}
              className="font-mono text-[0.72rem] tracking-[2px] uppercase px-4 py-2 rounded-lg border border-[#aa66ff] text-[#aa66ff] hover:bg-[#aa66ff]/10 transition-colors"
            >
              + TRADE
            </button>
            <button
              onClick={() => { if (confirm('Réinitialiser le compte à 10 000$ ?')) resetAccount(); }}
              className="font-mono text-[0.65rem] text-[#5a6070] hover:text-[#ff3355] transition-colors border border-[#1e1e32] px-3 py-2 rounded-lg"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Mini stats row */}
        <div className="mt-4 grid grid-cols-4 md:grid-cols-6 gap-2">
          {[
            { label: 'Trades', val: metrics.totalTrades },
            { label: 'Win Rate', val: metrics.winRate.toFixed(1) + '%', color: metrics.winRate >= 55 ? '#4ade80' : metrics.winRate >= 45 ? '#ffaa00' : '#ff3355' },
            { label: 'Profit Factor', val: metrics.profitFactor === 999 ? '∞' : metrics.profitFactor.toFixed(2), color: metrics.profitFactor >= 1.5 ? '#4ade80' : metrics.profitFactor >= 1 ? '#ffaa00' : '#ff3355' },
            { label: 'Expectancy', val: fmtSign(metrics.expectancyUsd) + '$', color: metrics.expectancyUsd >= 0 ? '#4ade80' : '#ff3355' },
            { label: 'Max DD', val: metrics.maxDrawdownPct.toFixed(1) + '%', color: metrics.maxDrawdownPct <= 10 ? '#4ade80' : metrics.maxDrawdownPct <= 20 ? '#ffaa00' : '#ff3355' },
            { label: 'Sharpe', val: metrics.sharpeRolling.toFixed(2), color: metrics.sharpeRolling >= 1.5 ? '#4ade80' : metrics.sharpeRolling >= 0.5 ? '#ffaa00' : '#ff3355' },
          ].map(s => (
            <div key={s.label} className="rounded-lg border border-[#1e1e32] px-3 py-2 text-center">
              <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase tracking-[1px]">{s.label}</div>
              <div className="font-mono text-[0.8rem] font-bold mt-0.5" style={{ color: s.color ?? '#eaeef4' }}>{s.val}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Open trade form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-[#aa66ff]/30 bg-[#0e0e1a] p-5 space-y-4">
              <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase">NOUVEAU TRADE — FRAIS 0.04% × 2</div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Instrument</label>
                  <select
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    value={form.instrument}
                    onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}
                  >
                    {instruments.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Direction</label>
                  <div className="flex gap-2">
                    {(['LONG', 'SHORT'] as const).map(d => (
                      <button
                        key={d}
                        onClick={() => setForm(f => ({ ...f, direction: d }))}
                        className={`flex-1 py-2 rounded-lg font-mono text-[0.75rem] font-bold border transition-colors ${form.direction === d
                          ? d === 'LONG' ? 'bg-[#4ade80]/20 border-[#4ade80] text-[#4ade80]' : 'bg-[#ff3355]/20 border-[#ff3355] text-[#ff3355]'
                          : 'border-[#1e1e32] text-[#5a6070]'}`}
                      >{d}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">
                    Risque %
                  </label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    type="number" min="0.1" max="5" step="0.1"
                    value={form.riskPct}
                    onChange={e => setForm(f => ({ ...f, riskPct: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1 flex items-center gap-2">
                    Entrée
                    {livePrices[form.instrument] && (
                      <button onClick={fillLivePrice} className="text-[#aa66ff] hover:underline">live: {livePrices[form.instrument]}</button>
                    )}
                  </label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    type="number" value={form.entry}
                    onChange={e => setForm(f => ({ ...f, entry: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Stop Loss</label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    type="number" value={form.stop}
                    onChange={e => setForm(f => ({ ...f, stop: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Take Profit</label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    type="number" value={form.tp}
                    onChange={e => setForm(f => ({ ...f, tp: e.target.value }))}
                  />
                </div>
              </div>

              {/* Preview */}
              {preview && (
                <div className="rounded-lg bg-[#12121e] border border-[#1e1e32] px-4 py-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase">Quantité</div>
                    <div className="font-mono text-[0.85rem] text-[#eaeef4] font-bold">{preview.qty}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase">Risque $</div>
                    <div className="font-mono text-[0.85rem] text-[#ff3355] font-bold">${fmt(preview.riskUsd)}</div>
                  </div>
                  <div>
                    <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase">Frais entrée</div>
                    <div className="font-mono text-[0.85rem] text-[#ffaa00] font-bold">${fmt(preview.feeEntry)}</div>
                  </div>
                  {previewRR && (
                    <div>
                      <div className="font-mono text-[0.55rem] text-[#5a6070] uppercase">R:R ratio</div>
                      <div className={`font-mono text-[0.85rem] font-bold ${previewRR >= 1.5 ? 'text-[#4ade80]' : previewRR >= 1 ? 'text-[#ffaa00]' : 'text-[#ff3355]'}`}>
                        1:{previewRR.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleOpen}
                  className="font-mono text-[0.72rem] tracking-[2px] uppercase px-5 py-2 rounded-lg bg-[#aa66ff] text-white hover:bg-[#9955ee] transition-colors"
                >
                  OUVRIR TRADE
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="font-mono text-[0.72rem] text-[#5a6070] hover:text-[#eaeef4] px-3"
                >
                  Annuler
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Close trade modal */}
      <AnimatePresence>
        {closeTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setCloseTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-[#0e0e1a] border border-[#1e1e32] rounded-xl p-6 w-80 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              {(() => {
                const t = account.trades.find(tr => tr.id === closeTarget);
                const lp = t ? livePrices[t.instrument] : null;
                return (
                  <>
                    <div className="font-mono text-[0.72rem] text-[#5a6070] tracking-[2px] uppercase">CLÔTURER — {t?.instrument}</div>
                    {lp && (
                      <div className="text-center">
                        <button
                          onClick={() => setClosePrice(String(lp))}
                          className="font-mono text-[0.7rem] text-[#aa66ff] border border-[#aa66ff]/30 px-3 py-1.5 rounded hover:bg-[#aa66ff]/10 transition-colors"
                        >
                          Prix live: {lp}
                        </button>
                      </div>
                    )}
                    <div>
                      <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Prix de sortie</label>
                      <input
                        className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#4ade80]"
                        type="number" value={closePrice}
                        onChange={e => setClosePrice(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleCloseConfirm} className="flex-1 font-mono text-[0.72rem] tracking-[2px] uppercase py-2 rounded-lg bg-[#4ade80] text-[#08080f] font-bold hover:bg-[#3bc96e] transition-colors">
                        CONFIRMER
                      </button>
                      <button onClick={() => setCloseTarget(null)} className="font-mono text-[0.72rem] text-[#5a6070] hover:text-[#eaeef4] px-3">
                        Annuler
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open positions */}
      {openTrades.length > 0 && (
        <div>
          <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-2">
            POSITIONS OUVERTES ({openTrades.length})
          </div>
          <div className="space-y-2">
            {openTrades.map(t => {
              const unreal = liveUnrealised(t);
              const unrealColor = unreal >= 0 ? 'text-[#4ade80]' : 'text-[#ff3355]';
              const lp = livePrices[t.instrument];
              return (
                <motion.div
                  key={t.id}
                  layout
                  className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] px-4 py-3"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-[0.65rem] font-bold px-2 py-0.5 rounded ${t.direction === 'LONG' ? 'bg-[#4ade80]/15 text-[#4ade80]' : 'bg-[#ff3355]/15 text-[#ff3355]'}`}>
                        {t.direction}
                      </span>
                      <span className="font-mono text-[0.85rem] text-[#eaeef4] font-bold">{t.instrument}</span>
                      <span className="font-mono text-[0.65rem] text-[#5a6070]">
                        qty: {t.qty} · @{t.entry} · SL:{t.stop} · TP:{t.tp}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className={`font-mono text-[0.85rem] font-bold ${unrealColor}`}>
                          {unreal >= 0 ? '+' : ''}{fmt(unreal)}$
                        </div>
                        {lp && <div className="font-mono text-[0.6rem] text-[#5a6070]">live: {lp}</div>}
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => { setCloseTarget(t.id); setClosePrice(lp ? String(lp) : ''); }}
                          className="font-mono text-[0.62rem] text-[#4ade80] border border-[#4ade80]/30 px-2 py-1 rounded hover:bg-[#4ade80]/10 transition-colors"
                        >
                          CLÔT.
                        </button>
                        <button onClick={() => deleteTrade(t.id)} className="font-mono text-[0.62rem] text-[#5a6070] hover:text-[#ff3355] px-1.5 py-1 rounded border border-[#1e1e32]">✕</button>
                      </div>
                    </div>
                  </div>
                  {/* P&L bar — proportion of TP reached */}
                  {lp && t.entry && t.tp && t.stop && (
                    <div className="mt-2">
                      <div className="h-1 rounded-full bg-[#1e1e32] overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${unreal >= 0 ? 'bg-[#4ade80]' : 'bg-[#ff3355]'}`}
                          style={{
                            width: (() => {
                              const range = Math.abs(t.tp - t.entry);
                              const progress = t.direction === 'LONG'
                                ? (lp - t.entry) / range
                                : (t.entry - lp) / range;
                              return `${Math.max(0, Math.min(100, progress * 100))}%`;
                            })(),
                          }}
                          animate={{ opacity: [0.6, 1, 0.6] }}
                          transition={{ repeat: Infinity, duration: 2 }}
                        />
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Equity curve */}
      {eqCurve.length > 1 && (
        <EquityCurve
          equityCurve={eqForChart}
          drawdownCurve={ddForChart}
          unit="$"
        />
      )}

      {/* Closed trades history */}
      {closedTrades.length > 0 && (
        <div>
          <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-2">HISTORIQUE ({account.trades.filter(t => t.status !== 'OPEN').length} trades)</div>
          <div className="space-y-1.5">
            {closedTrades.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1e1e32] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${t.status === 'WIN' ? 'bg-[#4ade80]' : t.status === 'LOSS' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
                  <span className="font-mono text-[0.75rem] text-[#eaeef4]">{t.instrument}</span>
                  <span className={`font-mono text-[0.65rem] ${t.direction === 'LONG' ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>{t.direction}</span>
                  <span className="font-mono text-[0.6rem] text-[#5a6070]">@{t.entry} → {t.exit}</span>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className={`font-mono text-[0.85rem] font-bold ${(t.pnlNet ?? 0) >= 0 ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>
                      {(t.pnlNet ?? 0) >= 0 ? '+' : ''}{fmt(t.pnlNet ?? 0)}$
                    </div>
                    <div className="font-mono text-[0.58rem] text-[#5a6070]">
                      {(t.pnlR ?? 0) >= 0 ? '+' : ''}{(t.pnlR ?? 0).toFixed(2)}R · frais: -{fmt(t.feeEntry + (t.feeExit ?? 0))}$
                    </div>
                  </div>
                  <button onClick={() => deleteTrade(t.id)} className="text-[#5a6070] hover:text-[#ff3355] transition-colors text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {account.trades.length === 0 && !showForm && (
        <div className="text-center py-10 font-mono text-[0.75rem] text-[#5a6070] border-2 border-dashed border-[#1e1e32] rounded-xl">
          Compte virtuel vide — cliquez sur "+ TRADE" pour simuler votre premier trade.
          <div className="mt-1 text-[0.65rem]">Capital: ${fmt(INITIAL_BALANCE)} · Frais: 0.04% entrée + 0.04% sortie</div>
        </div>
      )}
    </div>
  );
}
