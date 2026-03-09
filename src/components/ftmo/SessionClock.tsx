'use client';
import { useState, useEffect } from 'react';
import { SESSIONS, STRATEGY_WINDOWS, MACRO_EVENTS } from '@/lib/ftmo/constants';
import { fmtCD } from '@/lib/format';

export default function SessionClock() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const int = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(int);
  }, []);

  const hourUTC = now.getUTCHours() + now.getUTCMinutes() / 60;

  // Active sessions
  const activeSessions = SESSIONS.filter(s => hourUTC >= s.start && hourUTC < s.end);
  const activeStrategies = STRATEGY_WINDOWS.filter(s => {
    if (s.start > s.end) return hourUTC >= s.start || hourUTC < s.end; // overnight
    return hourUTC >= s.start && hourUTC < s.end;
  });

  // Next macro event
  let nextEvent: { name: string; ms: number } | null = null;
  for (const e of MACRO_EVENTS) {
    const t = new Date(e.d + 'T18:00:00Z').getTime();
    if (t > Date.now()) { nextEvent = { name: e.n, ms: t - Date.now() }; break; }
  }

  // 24h timeline bar
  const pctNow = (hourUTC / 24) * 100;

  return (
    <div className="space-y-2.5">
      {/* Current time */}
      <div className="flex items-center justify-between font-mono text-[0.82rem]">
        <span className="text-[#e8e8f0] font-bold text-[1rem]">
          {now.toUTCString().slice(17, 25)} UTC
        </span>
        <span className="text-[#556680]">
          {now.toLocaleDateString('en-US', { weekday: 'short' })}
        </span>
      </div>

      {/* 24h timeline */}
      <div className="relative h-5 bg-[#08080f] rounded overflow-hidden">
        {SESSIONS.map((s, i) => (
          <div
            key={i}
            className="absolute top-0 h-full opacity-20 rounded"
            style={{
              left: `${(s.start / 24) * 100}%`,
              width: `${((s.end - s.start) / 24) * 100}%`,
              background: s.color,
            }}
          />
        ))}
        {/* Now indicator */}
        <div
          className="absolute top-0 w-0.5 h-full bg-white"
          style={{ left: `${pctNow}%` }}
        />
        {/* Hour markers */}
        {[0, 6, 12, 18].map(h => (
          <div
            key={h}
            className="absolute top-0 w-px h-full bg-[#1a1a30] opacity-50"
            style={{ left: `${(h / 24) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[0.58rem] text-[#556680]">
        <span>00</span><span>06</span><span>12</span><span>18</span><span>24</span>
      </div>

      {/* Active sessions */}
      <div className="space-y-1">
        {activeSessions.length > 0 ? (
          activeSessions.map((s, i) => (
            <div key={i} className="flex items-center gap-2 font-mono text-[0.75rem]">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
              <span style={{ color: s.color }}>{s.name}</span>
              <span className="text-[#4ade80]">✓ active</span>
            </div>
          ))
        ) : (
          <div className="font-mono text-[0.75rem] text-[#ff3355]">Hors session — prudence</div>
        )}
      </div>

      {/* Active strategy windows */}
      {activeStrategies.length > 0 && (
        <div className="border-t border-[#1a1a30] pt-1.5 space-y-1">
          <div className="font-mono text-[0.62rem] text-[#556680] tracking-wider">FENETRES ACTIVES</div>
          {activeStrategies.map((s, i) => (
            <div key={i} className="flex items-center gap-2 font-mono text-[0.72rem]">
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span style={{ color: s.color }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Next event */}
      {nextEvent && (
        <div className="border-t border-[#1a1a30] pt-1.5 font-mono text-[0.75rem]">
          <span className="text-[#556680]">Prochain: </span>
          <span className={nextEvent.ms < 86400000 ? 'text-[#ff3355]' : nextEvent.ms < 259200000 ? 'text-[#ffaa00]' : 'text-[#4ade80]'}>
            {nextEvent.name} {fmtCD(nextEvent.ms)}
          </span>
        </div>
      )}
    </div>
  );
}
