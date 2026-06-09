/**
 * SESSION COUNTDOWN v8.0
 * Compte à rebours précis vers la prochaine session de trading.
 * Progress bar de la session en cours.
 */
'use client';

import { useState, useEffect } from 'react';

interface Session {
  name: string;
  start: number;
  end: number;
  score: number;
  color: string;
  tf: string;
}

const SESSIONS: Session[] = [
  { name: 'EU Open',    start: 7,  end: 9,  score: 80,  color: '#22c55e', tf: 'M15/M30' },
  { name: 'EU/US Core', start: 13, end: 17, score: 100, color: '#16a34a', tf: 'M15' },
  { name: 'US Extend',  start: 17, end: 20, score: 70,  color: '#84cc16', tf: 'M15/M30' },
  { name: 'Asia',       start: 1,  end: 4,  score: 35,  color: '#eab308', tf: 'Éviter' },
];

interface SessionState {
  current: Session | null;
  next: Session | null;
  remaining: number;
  phase: 'active' | 'off';
  progress: number;
}

function getSessionState(): SessionState {
  const now = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;

  for (const s of SESSIONS) {
    if (utcH >= s.start && utcH < s.end) {
      const elapsed  = utcH - s.start;
      const duration = s.end - s.start;
      const progress = (elapsed / duration) * 100;
      const remaining = (s.end - utcH) * 3600;
      return { current: s, progress, remaining, phase: 'active', next: null };
    }
  }

  // Trouver la prochaine session
  let next = null, minDiff = 24;
  for (const s of SESSIONS) {
    let diff = s.start - utcH;
    if (diff < 0) diff += 24;
    if (diff < minDiff) { minDiff = diff; next = s; }
  }

  return { current: null, next, remaining: minDiff * 3600, phase: 'off', progress: 0 };
}

function formatTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}h ${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
  return `${m.toString().padStart(2,'0')}m ${s.toString().padStart(2,'0')}s`;
}

export default function SessionCountdown() {
  const [state, setState] = useState(getSessionState);

  useEffect(() => {
    const id = setInterval(() => setState(getSessionState()), 1000);
    return () => clearInterval(id);
  }, []);

  const { current, next, remaining, phase, progress } = state;
  const sess = phase === 'active' ? current : next;

  return (
    <div style={{ background: '#0a0f1a', border: `1px solid ${sess?.color || '#1e3a5f'}33`, borderRadius: 12, padding: 16, fontFamily: 'monospace' }}>
      <h3 style={{ color: '#60a5fa', margin: '0 0 12px', fontSize: 15, fontWeight: 700 }}>
        ⏱ SESSION CLOCK
      </h3>

      {/* Session en cours / prochaine */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: phase === 'active' ? (sess?.color || '#22c55e') : '#6b7280',
          boxShadow: phase === 'active' ? `0 0 8px ${sess?.color}` : 'none',
          animation: phase === 'active' ? 'pulse 2s infinite' : 'none',
        }} />
        <div>
          <div style={{ color: phase === 'active' ? (sess?.color || '#22c55e') : '#94a3b8', fontWeight: 700, fontSize: 14 }}>
            {phase === 'active' ? `🟢 ${sess?.name} ACTIVE` : `⏳ Off → ${sess?.name}`}
          </div>
          <div style={{ color: '#64748b', fontSize: 11 }}>
            {phase === 'active'
              ? `Se termine dans ${formatTime(remaining)} · ${sess?.tf}`
              : `Commence dans ${formatTime(remaining)} · ${sess?.tf}`
            }
          </div>
        </div>
        {sess && (
          <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
            <div style={{ color: sess.color, fontSize: 22, fontWeight: 700, letterSpacing: 2 }}>
              {formatTime(remaining)}
            </div>
            <div style={{ color: '#475569', fontSize: 10 }}>{sess.score}/100 · {sess.start}h–{sess.end}h UTC</div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {phase === 'active' && sess && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#64748b', marginBottom: 4 }}>
            <span>{sess.start}h UTC</span>
            <span style={{ color: '#94a3b8' }}>{progress.toFixed(1)}% écoulé</span>
            <span>{sess.end}h UTC</span>
          </div>
          <div style={{ height: 6, background: '#1e293b', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${sess.color}88, ${sess.color})`, borderRadius: 3, transition: 'width 1s linear' }} />
          </div>
        </div>
      )}

      {/* Toutes les sessions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {SESSIONS.map(s => {
          const utcH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
          const isActive = utcH >= s.start && utcH < s.end;
          return (
            <div key={s.name} style={{
              background: isActive ? s.color + '22' : '#0f172a',
              border: `1px solid ${isActive ? s.color : '#1e293b'}`,
              borderRadius: 6, padding: '6px 8px', textAlign: 'center',
            }}>
              <div style={{ color: isActive ? s.color : '#475569', fontSize: 11, fontWeight: isActive ? 700 : 400 }}>{s.name}</div>
              <div style={{ color: '#64748b', fontSize: 10 }}>{s.start}h–{s.end}h</div>
              <div style={{ color: isActive ? s.color : '#334155', fontSize: 12, fontWeight: 700 }}>{s.score}/100</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
