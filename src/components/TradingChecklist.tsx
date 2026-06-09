'use client';

import { useState, useEffect } from 'react';
import { VOL_WINDOWS } from '@/lib/constants';

type ChecklistItem = {
  id: string;
  label: string;
  done: boolean;
  critical: boolean;
};

type SessionPhase = 'pre-session' | 'window-open' | 'trading' | 'post-session' | 'off';

export default function TradingChecklist() {
  const [phase, setPhase] = useState<SessionPhase>('off');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [sessionName, setSessionName] = useState('');
  const [sessionScore, setSessionScore] = useState(0);

  useEffect(() => {
    const h = new Date().getUTCHours();
    const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);

    if (win) {
      setSessionName(win.label);
      setSessionScore(win.score);

      if (win.score >= 0.7) {
        setPhase('window-open');
        setChecklist([
          { id: '1', label: '✅ Vérifier heatmap verte/jaune', done: false, critical: true },
          { id: '2', label: '✅ Top 3 pairs avec edge ≥0.10%', done: false, critical: true },
          { id: '3', label: '✅ Funding aligné (Carry Long/Short)', done: false, critical: true },
          { id: '4', label: '⏳ Attendre setup M15 sur zone H4', done: false, critical: false },
          { id: '5', label: '⏳ Signal Engine ≥60% confluence', done: false, critical: false },
          { id: '6', label: '⏳ SL = max(0.4%, 0.75×ATR) placé', done: false, critical: true },
          { id: '7', label: '⏳ TP1 (1R) + TP2 (2R) définis', done: false, critical: true },
          { id: '8', label: '⏳ Entrée MAKER si possible', done: false, critical: false },
        ]);
      } else {
        setPhase('window-open');
        setChecklist([
          { id: '1', label: '⚠️ Vol faible — réduire sizing', done: false, critical: true },
          { id: '2', label: '⏳ Attendre vol plus élevée', done: false, critical: false },
        ]);
      }
    } else if (h >= 6 && h < 7) {
      setPhase('pre-session');
      setSessionName('Pré-session EU Open');
      setChecklist([
        { id: '1', label: '📍 Scanner H4/H1 sur Top 5 pairs', done: false, critical: false },
        { id: '2', label: '📍 Marquer zones S/R clés', done: false, critical: false },
        { id: '3', label: '📍 Vérifier APIs Hyperliquid OK', done: false, critical: false },
        { id: '4', label: '📍 Capital disponible: ____ USDT', done: false, critical: false },
      ]);
    } else {
      setPhase('off');
      setSessionName('Off-session');
      setChecklist([
        { id: '1', label: '😴 Pas de trade M15 prévu', done: false, critical: false },
        { id: '2', label: '⏳ Prochaine fenêtre: EU Open 7h UTC', done: false, critical: false },
      ]);
    }
  }, []);

  const toggle = (id: string) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, done: !item.done } : item
    ));
  };

  const reset = () => {
    setChecklist(prev => prev.map(item => ({ ...item, done: false })));
  };

  const criticalDone = checklist.filter(i => i.critical && i.done).length;
  const criticalTotal = checklist.filter(i => i.critical).length;
  const allDone = checklist.length > 0 && checklist.every(i => i.done);

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-lg font-bold text-white tracking-widest uppercase">
            📋 Trading Checklist
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Routine M15 scalping · {sessionName} · Score {(sessionScore * 100).toFixed(0)}/100
          </p>
        </div>
        <button
          onClick={reset}
          className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition"
        >
          Reset
        </button>
      </div>

      {/* Status banner */}
      <div className={`mb-4 px-3 py-2 rounded-lg text-xs border ${
        phase === 'window-open' && sessionScore >= 0.7
          ? 'border-green-700/40 bg-green-950/20 text-green-300'
          : phase === 'window-open' && sessionScore < 0.7
          ? 'border-yellow-700/40 bg-yellow-950/20 text-yellow-300'
          : phase === 'pre-session'
          ? 'border-blue-700/40 bg-blue-950/20 text-blue-300'
          : 'border-gray-700 bg-gray-900/30 text-gray-500'
      }`}>
        {phase === 'window-open' && sessionScore >= 0.7 && (
          <span>✅ Fenêtre active — Critiques: {criticalDone}/{criticalTotal} validés</span>
        )}
        {phase === 'window-open' && sessionScore < 0.7 && (
          <span>⚠️ Vol sous-optimale — Attendre fenêtre EU/US Core</span>
        )}
        {phase === 'pre-session' && (
          <span>🔵 Pré-session — Prépare tes niveaux</span>
        )}
        {phase === 'off' && (
          <span>⬜ Off-session — Reviens plus tard</span>
        )}
      </div>

      {/* Checklist items */}
      <div className="space-y-2">
        {checklist.map(item => (
          <div
            key={item.id}
            onClick={() => toggle(item.id)}
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
              item.done
                ? 'bg-green-950/20 border-green-700/30'
                : item.critical
                ? 'bg-gray-900/60 border-red-900/30 hover:border-red-700/50'
                : 'bg-gray-900/40 border-gray-800 hover:border-gray-700'
            }`}
          >
            <div className={`w-5 h-5 rounded flex items-center justify-center border ${
              item.done
                ? 'bg-green-500 border-green-500 text-white'
                : item.critical
                ? 'border-red-800'
                : 'border-gray-600'
            }`}>
              {item.done && <span className="text-xs">✓</span>}
            </div>
            <span className={`text-sm ${item.done ? 'text-green-400 line-through' : 'text-gray-300'}`}>
              {item.label}
            </span>
            {item.critical && !item.done && (
              <span className="ml-auto text-[10px] px-1.5 py-0.5 bg-red-950/50 text-red-400 rounded">
                CRITICAL
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Ready to trade banner */}
      {phase === 'window-open' && sessionScore >= 0.7 && allDone && (
        <div className="mt-4 p-3 rounded-lg bg-green-950/30 border border-green-700/50">
          <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
            <span>✅</span>
            <span>READY TO TRADE</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Tous les critères sont validés. Tu peux chercher ton setup M15.
          </p>
        </div>
      )}

      {/* Quick rules */}
      <div className="mt-4 p-3 rounded-lg bg-gray-900/40 border border-gray-800">
        <div className="text-xs text-gray-500 mb-2">Règles de risk M15:</div>
        <div className="space-y-1 text-xs text-gray-400">
          <div>• SL = max(0.4%, 0.75×ATR) — stop journalier 0.5%</div>
          <div>• TP1 = 1R (sortir 50%) · TP2 = 2R (reste)</div>
          <div>• Taille = 0.15–0.20% equity par trade</div>
          <div>• Max 3–5 setups/jour — Pas de revenge trade</div>
        </div>
      </div>
    </section>
  );
}
