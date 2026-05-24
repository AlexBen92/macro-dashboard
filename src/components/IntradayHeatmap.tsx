'use client';
import { HOURLY_VOL_INDEX, DAILY_VOL_INDEX, VOL_WINDOWS } from '@/lib/constants';

const DAYS = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];

function volColor(v: number) {
  if (v >= 0.90) return '#00ff88';
  if (v >= 0.75) return '#55ff55';
  if (v >= 0.60) return '#ffcc00';
  if (v >= 0.45) return '#ff8800';
  return '#ff4466';
}

export default function IntradayHeatmap() {
  const nowH  = new Date().getUTCHours();
  const today = new Date().getUTCDay();
  const win   = VOL_WINDOWS.find(w => nowH >= w.start && nowH < w.end);

  // Heure de Paris pour affichage
  const parisTime = new Date().toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  });

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-bold text-white tracking-widest uppercase">
          🔥 Heatmap Volatilité Intraday
        </h2>
        <div className="text-xs text-gray-400 font-mono">
          {parisTime} · UTC {nowH}h
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        BTC/ETH historique · Colonne courante en surbrillance · Ne trader qu'en vert/jaune
      </p>

      {/* Hourly bars */}
      <div className="mb-5">
        <div className="text-xs text-gray-500 mb-2">Vol par heure UTC</div>
        <div className="flex gap-[3px] items-end h-14">
          {HOURLY_VOL_INDEX.map((v, h) => (
            <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className="w-full rounded-t-sm transition-all"
                style={{
                  height: `${Math.round(v * 48)}px`,
                  background: volColor(v),
                  opacity: h === nowH ? 1 : 0.45,
                  boxShadow: h === nowH ? `0 0 8px ${volColor(v)}` : 'none',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-[3px] mt-1">
          {HOURLY_VOL_INDEX.map((_, h) => (
            <div key={h} className="flex-1 text-center"
              style={{ fontSize: '8px', color: h === nowH ? '#fff' : '#444', fontWeight: h === nowH ? 700 : 400 }}>
              {h % 3 === 0 ? h : ''}
            </div>
          ))}
        </div>
      </div>

      {/* Daily bars */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-2">Vol par jour (Mercredi = peak · Samedi = creux)</div>
        <div className="flex gap-2 items-end h-10">
          {DAILY_VOL_INDEX.map((v, d) => (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-t-sm"
                style={{
                  height: `${Math.round(v * 32)}px`,
                  background: volColor(v),
                  opacity: d === today ? 1 : 0.45,
                  boxShadow: d === today ? `0 0 8px ${volColor(v)}` : 'none',
                }} />
              <span className="text-[10px]" style={{ color: d === today ? '#fff' : '#555', fontWeight: d === today ? 700 : 400 }}>
                {DAYS[d]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Windows legend */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        {VOL_WINDOWS.map(w => (
          <div key={w.label}
            className={`px-2 py-1.5 rounded text-xs border transition-all ${
              win?.label === w.label
                ? 'border-green-500/60 bg-green-950/30 text-green-300'
                : 'border-gray-700 bg-gray-900/30 text-gray-500'
            }`}>
            <div className="font-semibold">{w.label}</div>
            <div className="text-[10px] opacity-70">{w.start}h–{w.end}h UTC</div>
            <div style={{ color: volColor(w.score) }}>{(w.score * 100).toFixed(0)}/100</div>
          </div>
        ))}
      </div>

      {/* Current status */}
      <div className={`p-3 rounded-lg border text-sm ${
        win && win.score >= 0.7
          ? 'border-green-700/40 bg-green-950/20 text-green-300'
          : win
          ? 'border-yellow-700/40 bg-yellow-950/20 text-yellow-300'
          : 'border-gray-700 bg-gray-900/30 text-gray-500'
      }`}>
        {win ? (
          <>
            <span className="font-bold">{win.label}</span>
            <span className="ml-2 text-xs opacity-70">{win.start}h–{win.end}h UTC</span>
            {win.score >= 0.7
              ? <span className="ml-3 text-green-400">✅ Trading M15/M30 recommandé</span>
              : <span className="ml-3 text-yellow-400">⚠️ Vol sous-optimale — réduire sizing</span>}
          </>
        ) : (
          <span>⬜ Off-hours ({nowH}h UTC) — Pas de setup M15/M30 · Prochaine fenêtre : EU Open 7h UTC</span>
        )}
      </div>
    </section>
  );
}
