/**
 * TRADE JOURNAL v8.1
 * Log rapide de trades directement depuis le dashboard.
 * Calcule automatiquement PnL, win rate session, daily summary.
 * Données persistées dans localStorage — clé distincte par timeframe
 * (M15 scalping vs H1/H4 swing) pour éviter la dérive des règles de risk.
 */
'use client';

import { useState, useEffect } from 'react';

const DEFAULT_STORAGE_KEY = 'hermes_trade_journal_v2';

interface TradeForm {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  size: string;
  equity: string;
}

interface Trade {
  id: number;
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entry: string;
  sl: string;
  tp1: string;
  tp2: string;
  size: string;
  openTime: string;
  exitPrice: string | null;
  pnl: string | null;
  closeTime?: string;
}

const emptyForm: TradeForm = { symbol: '', direction: 'LONG', entry: '', sl: '', tp1: '', tp2: '', size: '', equity: '1000' };

function computeRR(form: TradeForm): string | null {
  const e = parseFloat(form.entry), sl = parseFloat(form.sl), tp2 = parseFloat(form.tp2);
  if (!e || !sl || !tp2) return null;
  const slDist = Math.abs(e - sl) / e;
  const tp2Dist = Math.abs(tp2 - e) / e;
  return (tp2Dist / slDist).toFixed(2);
}

function computePnL(trade: Trade): string | null {
  if (!trade.exitPrice) return null;
  const dir = trade.direction === 'LONG' ? 1 : -1;
  const entryPct = parseFloat(trade.entry);
  const exitPct  = parseFloat(trade.exitPrice);
  const sizePct  = parseFloat(trade.size);
  const pnl = dir * (exitPct - entryPct) / entryPct * sizePct;
  // Fees: maker in + taker out
  const fees = sizePct * (0.0002 + 0.0005);
  return (pnl - fees).toFixed(2);
}

export default function TradeJournal({
  storageKey = DEFAULT_STORAGE_KEY,
  scopeLabel = 'M15',
}: {
  storageKey?: string;
  scopeLabel?: string;
}) {
  const [trades, setTrades]   = useState<Trade[]>([]);
  const [form, setForm]       = useState<TradeForm>(emptyForm);
  const [closing, setClosing] = useState<number | null>(null);
  const [exitPx, setExitPx]   = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(storageKey);
        if (saved) setTrades(JSON.parse(saved));
      }
    } catch {}
  }, [storageKey]);

  const save = (t: Trade[]) => {
    setTrades(t);
    try { if (typeof window !== 'undefined') localStorage.setItem(storageKey, JSON.stringify(t)); } catch {}
  };

  const addTrade = () => {
    if (!form.symbol || !form.entry || !form.sl) return;
    const t: Trade = { ...form, id: Date.now(), openTime: new Date().toISOString(), exitPrice: null, pnl: null };
    save([t, ...trades]);
    setForm(emptyForm);
  };

  const closeTrade = (id: number) => {
    if (!exitPx) return;
    const updated = trades.map(t => {
      if (t.id !== id) return t;
      const pnl = computePnL({ ...t, exitPrice: exitPx });
      return { ...t, exitPrice: exitPx, pnl, closeTime: new Date().toISOString() };
    });
    save(updated);
    setClosing(null);
    setExitPx('');
  };

  const deleteTrade = (id: number) => save(trades.filter(t => t.id !== id));
  const clearAll    = () => { if (confirm('Effacer tout le journal?')) save([]); };

  // Stats
  const closed  = trades.filter(t => t.exitPrice);
  const wins    = closed.filter(t => parseFloat(t.pnl || '0') > 0);
  const losses  = closed.filter(t => parseFloat(t.pnl || '0') <= 0);
  const totalPnL = closed.reduce((s, t) => s + parseFloat(t.pnl || '0'), 0);
  const wr = closed.length > 0 ? (wins.length / closed.length * 100).toFixed(1) : '0';
  const totalLoss = losses.reduce((s, t) => s + Math.abs(parseFloat(t.pnl || '0')), 0);
  const totalWin = wins.reduce((s, t) => s + parseFloat(t.pnl || '0'), 0);
  const pf = totalLoss > 0 ? (totalWin / totalLoss).toFixed(2) : '∞';
  const rr = computeRR(form);

  const displayTrades = showAll ? trades : trades.slice(0, 8);

  return (
    <div style={{ background: '#0a0f1a', border: '1px solid #1e3a5f', borderRadius: 12, padding: 16, fontFamily: 'monospace' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ color: '#60a5fa', margin: 0, fontSize: 15, fontWeight: 700 }}>📔 TRADE JOURNAL · {scopeLabel}</h3>
        <button onClick={clearAll} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#64748b', padding: '3px 8px', fontSize: 11, cursor: 'pointer' }}>🗑 Clear</button>
      </div>

      {/* Stats rapides */}
      {closed.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {[
            { label: 'Win Rate', value: `${wr}%`, color: parseFloat(wr) >= 40 ? '#22c55e' : '#f87171' },
            { label: 'Total PnL', value: `$${totalPnL.toFixed(2)}`, color: totalPnL >= 0 ? '#4ade80' : '#f87171' },
            { label: 'Profit Factor', value: pf, color: parseFloat(pf) >= 1.3 ? '#22c55e' : '#f87171' },
            { label: 'Trades', value: `${wins.length}W / ${losses.length}L`, color: '#94a3b8' },
          ].map(s => (
            <div key={s.label} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, padding: '6px 8px', textAlign: 'center' }}>
              <div style={{ color: s.color, fontWeight: 700, fontSize: 14 }}>{s.value}</div>
              <div style={{ color: '#475569', fontSize: 10 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Form */}
      <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div style={{ color: '#94a3b8', fontSize: 11, marginBottom: 8, fontWeight: 600 }}>+ Nouveau trade</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          {[
            { key: 'symbol',  ph: 'LINKUSDT', label: 'Symbole' },
            { key: 'entry',   ph: 'Prix entrée', label: 'Entrée' },
            { key: 'sl',      ph: 'Stop Loss', label: 'SL' },
            { key: 'tp1',     ph: 'TP1', label: 'TP1' },
            { key: 'tp2',     ph: 'TP2', label: 'TP2' },
            { key: 'size',    ph: 'Taille USDT', label: 'Size' },
          ].map(f => (
            <div key={f.key}>
              <div style={{ color: '#475569', fontSize: 10, marginBottom: 2 }}>{f.label}</div>
              <input
                value={(form as any)[f.key]}
                onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                placeholder={f.ph}
                style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', padding: '4px 8px', fontSize: 12, boxSizing: 'border-box' }}
              />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {(['LONG', 'SHORT'] as const).map(d => (
            <button key={d} onClick={() => setForm({ ...form, direction: d })}
              style={{ background: form.direction === d ? (d === 'LONG' ? '#16a34a33' : '#dc262633') : '#1e293b', border: `1px solid ${form.direction === d ? (d === 'LONG' ? '#22c55e' : '#f87171') : '#334155'}`, borderRadius: 4, color: form.direction === d ? (d === 'LONG' ? '#4ade80' : '#f87171') : '#64748b', padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: form.direction === d ? 700 : 400 }}>
              {d === 'LONG' ? '📈 LONG' : '📉 SHORT'}
            </button>
          ))}
          {rr && <span style={{ color: '#84cc16', fontSize: 12, marginLeft: 8 }}>R:R → {rr}× </span>}
          <button onClick={addTrade} style={{ marginLeft: 'auto', background: '#1e3a5f', border: '1px solid #3b82f6', borderRadius: 6, color: '#60a5fa', padding: '5px 16px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
            ➕ Logger
          </button>
        </div>
      </div>

      {/* Liste des trades */}
      <div style={{ maxHeight: 300, overflowY: 'auto' }}>
        {displayTrades.length === 0 ? (
          <div style={{ color: '#475569', textAlign: 'center', padding: 20, fontSize: 12 }}>
            Aucun trade loggé. Commence à trader et enregistre ici.
          </div>
        ) : displayTrades.map(t => {
          const isOpen = !t.exitPrice;
          const pnl    = t.pnl ? parseFloat(t.pnl) : null;
          const time   = new Date(t.openTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={t.id} style={{ background: '#0f172a', border: `1px solid ${isOpen ? '#1e3a5f' : pnl !== null && pnl > 0 ? '#16a34a44' : '#dc262644'}`, borderRadius: 6, padding: '8px 12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#475569', fontSize: 10 }}>{time}</span>
              <span style={{ color: t.direction === 'LONG' ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 12 }}>{t.direction === 'LONG' ? '▲' : '▼'}</span>
              <span style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 12 }}>{t.symbol}</span>
              <span style={{ color: '#64748b', fontSize: 11 }}>@{t.entry} → SL:{t.sl}</span>
              <span style={{ color: '#475569', fontSize: 11 }}>${t.size}</span>
              {isOpen ? (
                closing === t.id ? (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <input value={exitPx} onChange={e => setExitPx(e.target.value)} placeholder="Prix sortie" style={{ width: 90, background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#e2e8f0', padding: '2px 6px', fontSize: 11 }} />
                    <button onClick={() => closeTrade(t.id)} style={{ background: '#16a34a33', border: '1px solid #22c55e', borderRadius: 4, color: '#4ade80', padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>✓</button>
                    <button onClick={() => setClosing(null)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#64748b', padding: '2px 6px', fontSize: 11, cursor: 'pointer' }}>✗</button>
                  </div>
                ) : (
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    <span style={{ color: '#eab308', fontSize: 10, border: '1px solid #eab30844', borderRadius: 3, padding: '1px 5px' }}>OPEN</span>
                    <button onClick={() => setClosing(t.id)} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4, color: '#94a3b8', padding: '2px 8px', fontSize: 11, cursor: 'pointer' }}>Clôturer</button>
                    <button onClick={() => deleteTrade(t.id)} style={{ background: 'transparent', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12 }}>✗</button>
                  </div>
                )
              ) : (
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ color: pnl !== null && pnl > 0 ? '#4ade80' : '#f87171', fontWeight: 700, fontSize: 13 }}>
                    {pnl !== null && pnl > 0 ? '+' : ''}${pnl?.toFixed(2)}
                  </span>
                  <button onClick={() => deleteTrade(t.id)} style={{ background: 'transparent', border: 'none', color: '#334155', cursor: 'pointer', fontSize: 12 }}>✗</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {trades.length > 8 && (
        <button onClick={() => setShowAll(!showAll)} style={{ width: '100%', background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, color: '#475569', padding: '6px', fontSize: 11, cursor: 'pointer', marginTop: 6 }}>
          {showAll ? 'Afficher moins ▲' : `Afficher tous (${trades.length}) ▼`}
        </button>
      )}
    </div>
  );
}
