'use client';
import { VOL_WINDOWS_UTC } from '@/lib/constants';

// Données basées sur études BTC/ETH (Winrate, CryptoHash, Forbes Digital Assets)
// Vol relative moyenne par heure UTC (0–23), index normalisé 0–1
const HOURLY_VOL = [
  0.45, 0.40, 0.35, 0.30, 0.30, 0.35,  // 0h-5h : Asia nuit
  0.50, 0.60, 0.75, 0.80, 0.85, 0.88,  // 6h-11h : EU open
  0.90, 0.95, 1.00, 0.98, 0.95, 0.90,  // 12h-17h : EU/US overlap (PEAK)
  0.85, 0.80, 0.75, 0.70, 0.60, 0.50,  // 18h-23h : US extend → decay
];

// Vol par jour (0=dimanche, merc=3 le plus haut, sam=6 le plus bas)
const DAILY_VOL = [0.75, 0.88, 0.92, 1.00, 0.95, 0.85, 0.65];
const DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

function volColor(v: number): string {
  if (v >= 0.9) return '#00ff88';
  if (v >= 0.75) return '#88ff44';
  if (v >= 0.60) return '#ffcc00';
  if (v >= 0.45) return '#ff8800';
  return '#ff4444';
}

export default function IntradayHeatmap() {
  const nowUTC = new Date().getUTCHours();
  const today = new Date().getUTCDay();
  const parisOffset = 2; // UTC+2 (été), adapter en hiver à +1

  return (
    <section className="mb-6 p-4 rounded-xl border bg-[#0d0d1a] border-[#1a1a30]">
      <h2 className="text-lg font-bold text-white tracking-wide mb-1">
        ?? HEATMAP VOLATILITÉ INTRADAY
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Basé sur data historique BTC/ETH — ne trader qu'en zone verte/jaune
      </p>

      {/* Hourly strip */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">Vol par heure UTC (Paris = UTC+{parisOffset})</div>
        <div className="flex gap-0.5 overflow-x-auto pb-1">
          {HOURLY_VOL.map((v, h) => (
            <div key={h} className="flex-shrink-0 flex flex-col items-center gap-0.5">
              <div
                className="w-6 rounded-sm transition-all"
                style={{
                  height: `${Math.round(v * 48)}px`,
                  background: volColor(v),
                  opacity: h === nowUTC ? 1 : 0.6,
                  boxShadow: h === nowUTC ? `0 0 6px ${volColor(v)}` : 'none',
                }}
              />
              <span className={`text-[9px] ${h === nowUTC ? 'text-white font-bold' : 'text-gray-600'}`}>
                {h}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-0.5 mt-1 text-[10px] text-gray-500">
          <span className="text-green-400">■</span> High vol (trader)
          <span className="text-yellow-400 ml-3">■</span> Med vol
          <span className="text-red-500 ml-3">■</span> Low vol (éviter)
        </div>
      </div>

      {/* Daily bar */}
      <div className="mb-4">
        <div className="text-xs text-gray-500 mb-1">Vol par jour (mercredi = peak, samedi = creux)</div>
        <div className="flex gap-2">
          {DAILY_VOL.map((v, d) => (
            <div key={d} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-sm"
                style={{
                  height: `${Math.round(v * 40)}px`,
                  background: volColor(v),
                  opacity: d === today ? 1 : 0.55,
                  boxShadow: d === today ? `0 0 8px ${volColor(v)}` : 'none',
                }}
              />
              <span className={`text-[10px] ${d === today ? 'text-white font-bold' : 'text-gray-500'}`}>
                {DAYS[d]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Current window status */}
      {(() => {
        const win = VOL_WINDOWS_UTC.find(w => nowUTC >= w.start && nowUTC < w.end);
        return (
          <div className="p-3 rounded-lg border text-sm"
            style={{
              borderColor: win ? volColor(win.score) + '66' : '#444',
              background: win ? volColor(win.score) + '11' : '#111',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-500 uppercase">Fenêtre actuelle</div>
                <div className="font-bold text-white">{win?.name ?? 'Hors session'}</div>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${win && win.score >= 0.8 ? 'text-green-400' : win && win.score >= 0.6 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {win ? `${(win.score * 100).toFixed(0)}%` : '--'}
                </div>
                <div className="text-[10px] text-gray-500">Score vol</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Trading windows summary */}
      <div className="mt-4 pt-4 border-t border-[#1a1a30]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Sessions optimales</div>
        <div className="grid grid-cols-2 gap-2">
          {VOL_WINDOWS_UTC.filter(w => w.score >= 0.7).map(w => (
            <div key={w.name} className="flex items-center justify-between p-2 rounded bg-gray-800/50">
              <span className="text-xs text-white">{w.name}</span>
              <span className="text-xs font-mono text-green-400">{w.start}:00-{w.end}:00 UTC</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
