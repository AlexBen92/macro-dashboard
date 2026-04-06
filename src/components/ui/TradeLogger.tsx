'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TradeRecord } from '@/lib/performance';

interface TradeLoggerProps {
  trades: TradeRecord[];
  onAdd: (trade: Omit<TradeRecord, 'id'>) => void;
  onClose: (id: string, exit: number) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
}

const defaultForm = {
  instrument: '',
  direction: 'LONG' as 'LONG' | 'SHORT',
  entry: '',
  stop: '',
  tp: '',
};

export default function TradeLogger({ trades, onAdd, onClose, onDelete, onClear }: TradeLoggerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [closeId, setCloseId] = useState<string | null>(null);
  const [exitPrice, setExitPrice] = useState('');

  function handleAdd() {
    const e = parseFloat(form.entry);
    const s = parseFloat(form.stop);
    const t = parseFloat(form.tp);
    if (!form.instrument || isNaN(e) || isNaN(s) || isNaN(t)) return;
    onAdd({
      instrument: form.instrument.toUpperCase(),
      direction: form.direction,
      entry: e,
      stop: s,
      tp: t,
      exit: null,
      openedAt: new Date().toISOString(),
      closedAt: null,
      status: 'OPEN',
      pnlR: null,
    });
    setForm(defaultForm);
    setShowForm(false);
  }

  function handleClose() {
    if (!closeId) return;
    const ex = parseFloat(exitPrice);
    if (isNaN(ex)) return;
    onClose(closeId, ex);
    setCloseId(null);
    setExitPrice('');
  }

  const openTrades = trades.filter(t => t.status === 'OPEN');
  const closedTrades = trades.filter(t => t.status !== 'OPEN').slice(-10).reverse();

  return (
    <div className="space-y-4">
      {/* Add trade button */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowForm(v => !v)}
          className="font-mono text-[0.72rem] tracking-[2px] uppercase px-4 py-2 rounded-lg border border-[#aa66ff] text-[#aa66ff] hover:bg-[#aa66ff]/10 transition-colors"
        >
          + NOUVEAU TRADE
        </button>
        {trades.length > 0 && (
          <button
            onClick={() => { if (confirm('Effacer tous les trades?')) onClear(); }}
            className="font-mono text-[0.65rem] text-[#5a6070] hover:text-[#ff3355] transition-colors"
          >
            Tout effacer
          </button>
        )}
      </div>

      {/* Add trade form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-[#1e1e32] bg-[#0e0e1a] p-4 space-y-3">
              <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase">ENREGISTRER UN TRADE</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Instrument</label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    placeholder="BTC/USD"
                    value={form.instrument}
                    onChange={e => setForm(f => ({ ...f, instrument: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Direction</label>
                  <select
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    value={form.direction}
                    onChange={e => setForm(f => ({ ...f, direction: e.target.value as 'LONG' | 'SHORT' }))}
                  >
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Entry</label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    placeholder="45000"
                    type="number"
                    value={form.entry}
                    onChange={e => setForm(f => ({ ...f, entry: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Stop Loss</label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    placeholder="44000"
                    type="number"
                    value={form.stop}
                    onChange={e => setForm(f => ({ ...f, stop: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Take Profit</label>
                  <input
                    className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#aa66ff]"
                    placeholder="46500"
                    type="number"
                    value={form.tp}
                    onChange={e => setForm(f => ({ ...f, tp: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleAdd}
                  className="font-mono text-[0.72rem] tracking-[2px] uppercase px-5 py-2 rounded-lg bg-[#aa66ff] text-white hover:bg-[#9955ee] transition-colors"
                >
                  ENREGISTRER
                </button>
                <button
                  onClick={() => { setShowForm(false); setForm(defaultForm); }}
                  className="font-mono text-[0.72rem] text-[#5a6070] hover:text-[#eaeef4] transition-colors px-3"
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
        {closeId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setCloseId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0e0e1a] border border-[#1e1e32] rounded-xl p-6 w-80 space-y-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="font-mono text-[0.72rem] text-[#5a6070] tracking-[2px] uppercase">CLÔTURER LE TRADE</div>
              <div>
                <label className="font-mono text-[0.6rem] text-[#5a6070] uppercase block mb-1">Prix de sortie</label>
                <input
                  className="w-full bg-[#12121e] border border-[#1e1e32] rounded-lg px-3 py-2 font-mono text-[0.8rem] text-[#eaeef4] focus:outline-none focus:border-[#4ade80]"
                  placeholder="45800"
                  type="number"
                  value={exitPrice}
                  onChange={e => setExitPrice(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleClose}
                  className="font-mono text-[0.72rem] tracking-[2px] uppercase px-5 py-2 rounded-lg bg-[#4ade80] text-[#08080f] font-bold hover:bg-[#3bc96e] transition-colors"
                >
                  CONFIRMER
                </button>
                <button
                  onClick={() => setCloseId(null)}
                  className="font-mono text-[0.72rem] text-[#5a6070] hover:text-[#eaeef4] transition-colors px-3"
                >
                  Annuler
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Open trades */}
      {openTrades.length > 0 && (
        <div>
          <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-2">POSITIONS OUVERTES ({openTrades.length})</div>
          <div className="space-y-2">
            {openTrades.map(t => {
              const risk = Math.abs(t.entry - t.stop);
              const rr = risk > 0 ? ((t.tp - t.entry) / risk * (t.direction === 'LONG' ? 1 : -1)).toFixed(1) : '?';
              return (
                <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1e1e32] bg-[#0e0e1a] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono text-[0.65rem] font-bold px-2 py-0.5 rounded ${t.direction === 'LONG' ? 'bg-[#4ade80]/15 text-[#4ade80]' : 'bg-[#ff3355]/15 text-[#ff3355]'}`}>
                      {t.direction}
                    </span>
                    <span className="font-mono text-[0.8rem] text-[#eaeef4]">{t.instrument}</span>
                    <span className="font-mono text-[0.65rem] text-[#5a6070]">@{t.entry} → SL:{t.stop} TP:{t.tp}</span>
                    <span className="font-mono text-[0.65rem] text-[#ffaa00]">R:R {rr}R</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setCloseId(t.id); setExitPrice(''); }}
                      className="font-mono text-[0.62rem] text-[#4ade80] border border-[#4ade80]/30 px-2 py-1 rounded hover:bg-[#4ade80]/10 transition-colors"
                    >
                      CLÔTURER
                    </button>
                    <button
                      onClick={() => onDelete(t.id)}
                      className="font-mono text-[0.62rem] text-[#5a6070] hover:text-[#ff3355] transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent closed trades */}
      {closedTrades.length > 0 && (
        <div>
          <div className="font-mono text-[0.62rem] text-[#5a6070] tracking-[2px] uppercase mb-2">HISTORIQUE RÉCENT</div>
          <div className="space-y-1.5">
            {closedTrades.map(t => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-[#1e1e32] px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${t.status === 'WIN' ? 'bg-[#4ade80]' : t.status === 'LOSS' ? 'bg-[#ff3355]' : 'bg-[#ffaa00]'}`} />
                  <span className="font-mono text-[0.75rem] text-[#eaeef4]">{t.instrument}</span>
                  <span className={`font-mono text-[0.65rem] ${t.direction === 'LONG' ? 'text-[#4ade80]' : 'text-[#ff3355]'}`}>{t.direction}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`font-mono text-[0.85rem] font-bold ${(t.pnlR ?? 0) > 0 ? 'text-[#4ade80]' : (t.pnlR ?? 0) < 0 ? 'text-[#ff3355]' : 'text-[#ffaa00]'}`}>
                    {(t.pnlR ?? 0) > 0 ? '+' : ''}{t.pnlR?.toFixed(2) ?? '0'}R
                  </span>
                  <button onClick={() => onDelete(t.id)} className="text-[#5a6070] hover:text-[#ff3355] transition-colors text-xs">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {trades.length === 0 && !showForm && (
        <div className="text-center py-8 font-mono text-[0.75rem] text-[#5a6070]">
          Aucun trade enregistré. Cliquez sur "+ NOUVEAU TRADE" pour commencer.
        </div>
      )}
    </div>
  );
}
