'use client';

/**
 * Gold — Donchian Breakout systematic (MQL5, FTMO).
 * Système réel hors dashboard: aucun feed branché — panneau statut
 * manuel (actif/pause) + fiche performance OOS. Statut persisté en
 * localStorage.
 */
import { useEffect, useState } from 'react';

const STATUS_KEY = 'gold_donchian_status_v1';

type RunStatus = 'active' | 'paused' | 'paper';

export default function GoldDonchianPanel() {
  const [status, setStatus] = useState<RunStatus>('active');
  const [note, setNote] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATUS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { status?: RunStatus; note?: string; updated?: string };
        if (saved.status) setStatus(saved.status);
        if (saved.note) setNote(saved.note);
      }
    } catch {}
  }, []);

  const persist = (s: RunStatus, n: string) => {
    setStatus(s);
    setNote(n);
    try {
      localStorage.setItem(
        STATUS_KEY,
        JSON.stringify({ status: s, note: n, updated: new Date().toISOString() }),
      );
    } catch {}
    setEditing(false);
  };

  const statusColor =
    status === 'active' ? 'var(--bull)' : status === 'paper' ? 'var(--caution)' : 'var(--muted)';
  const statusLabel = status === 'active' ? 'ACTIF' : status === 'paper' ? 'PAPER' : 'EN PAUSE';

  return (
    <div className="bg-[var(--bg2)] border border-[var(--border)] rounded-[4px] p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-mono text-[0.72rem] text-[var(--label)] tracking-[3px] uppercase">
            GOLD · DONCHIAN BREAKOUT SYSTEMATIC
          </div>
          <div className="font-mono text-[0.55rem] text-[var(--dim)] mt-0.5 uppercase tracking-[1px]">
            XAUUSD · MQL5 · compte FTMO — run hors dashboard
          </div>
        </div>
        <span
          className="px-2 py-0.5 rounded-[2px] font-mono text-[0.6rem] uppercase tracking-[2px] border"
          style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}14` }}
        >
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {[
          { label: 'OOS Sharpe', value: '1.77' },
          { label: 'Système', value: 'Donchian breakout' },
          { label: 'Timeframe', value: 'D1 · MQL5' },
          { label: 'Feed dashboard', value: 'aucun — manuel' },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[var(--bg)] border border-[var(--border)] rounded-[3px] px-2 py-1.5"
          >
            <div className="font-mono text-[0.7rem] text-[var(--text)] tabular-nums">{s.value}</div>
            <div className="font-mono text-[0.5rem] text-[var(--muted)] uppercase tracking-[1px]">
              {s.label}
            </div>
          </div>
        ))}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            {(['active', 'paper', 'paused'] as RunStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => persist(s, note)}
                className={`px-2.5 py-1 rounded-[3px] font-mono text-[0.55rem] uppercase tracking-[1px] border ${
                  status === s
                    ? 'border-[var(--text)] text-[var(--text)]'
                    : 'border-[var(--border)] text-[var(--muted)]'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note perf / dernière session (optionnel)"
            className="bg-[var(--bg)] border border-[var(--border)] rounded-[3px] px-2 py-1 font-mono text-[0.6rem] text-[var(--text)]"
          />
          <button
            onClick={() => persist(status, note)}
            className="self-start px-3 py-1 rounded-[3px] font-mono text-[0.55rem] uppercase tracking-[1px] bg-[var(--bg3)] text-[var(--label)] border border-[var(--border)]"
          >
            sauver
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="font-mono text-[0.55rem] text-[var(--muted)] hover:text-[var(--text)] uppercase tracking-[1px]"
        >
          {note ? `note: ${note}` : 'mettre à jour statut / note ▸'}
        </button>
      )}
    </div>
  );
}
