'use client';
import { useMemo } from 'react';
import { MACRO_EVENTS } from '@/lib/constants';
import type { MacroEvent } from '@/lib/types';

interface MacroCalendarProps {
  upcomingCount?: number;
}

function getHoursUntil(dateStr: string): number {
  const eventDate = new Date(dateStr + 'T08:30:00Z'); // Assume 8:30 AM ET for releases
  const now = new Date();
  const diff = eventDate.getTime() - now.getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60)));
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return days[date.getDay()];
}

export default function MacroCalendar({ upcomingCount = 5 }: MacroCalendarProps) {
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return MACRO_EVENTS
      .filter(e => new Date(e.d) >= now)
      .slice(0, upcomingCount)
      .map(e => ({ ...e, hoursLeft: getHoursUntil(e.d), dayName: getDayName(e.d) }));
  }, [upcomingCount]);

  const nextEvent = upcomingEvents[0];

  return (
    <section className="mb-6 p-4 rounded-xl border bg-[#0d0d1a] border-[#1a1a30]">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-white tracking-wide">
          ?? CALENDRIER MACRO
        </h2>
        <span className="text-xs px-2 py-1 rounded-full bg-blue-900/30 text-blue-400">
          US Markets
        </span>
      </div>

      {/* Next event highlight */}
      {nextEvent && (
        <div className="mb-4 p-3 rounded-lg bg-blue-950/40 border border-blue-800/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] text-blue-400 uppercase tracking-wider">Prochain événement</div>
              <div className="text-xl font-bold text-white">{nextEvent.n}</div>
              <div className="text-xs text-gray-400">
                {nextEvent.dayName} {nextEvent.d} • {nextEvent.hoursLeft > 48
                  ? `${Math.floor(nextEvent.hoursLeft / 24)}j`
                  : `${nextEvent.hoursLeft}h`
                }
              </div>
            </div>
            <div className="text-right">
              <div className={`text-3xl font-bold ${nextEvent.hoursLeft < 24 ? 'text-red-400' : nextEvent.hoursLeft < 48 ? 'text-yellow-400' : 'text-green-400'}`}>
                {nextEvent.hoursLeft > 48
                  ? `${Math.floor(nextEvent.hoursLeft / 24)}d`
                  : `${nextEvent.hoursLeft}h`
                }
              </div>
              <div className="text-[10px] text-gray-500">restantes</div>
            </div>
          </div>
        </div>
      )}

      {/* Event list */}
      <div className="space-y-2">
        {upcomingEvents.slice(1).map((event, idx) => (
          <div key={event.d} className="flex items-center justify-between p-2 rounded-lg hover:bg-[#12122a] transition-colors">
            <div className="flex items-center gap-3">
              <span className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-800 text-[10px] text-gray-400">
                {idx + 2}
              </span>
              <div>
                <div className="text-sm font-medium text-white">{event.n}</div>
                <div className="text-[10px] text-gray-500">{event.dayName} {event.d}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs font-mono text-gray-300">
                {event.hoursLeft > 48
                  ? `${Math.floor(event.hoursLeft / 24)}j`
                  : `${event.hoursLeft}h`
                }
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Risk zones */}
      <div className="mt-4 pt-4 border-t border-[#1a1a30]">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2">Zones de risque</div>
        <div className="flex gap-2 text-[9px]">
          <span className="px-2 py-1 rounded bg-red-900/30 text-red-400">24h avant</span>
          <span className="px-2 py-1 rounded bg-yellow-900/30 text-yellow-400">48h avant</span>
          <span className="px-2 py-1 rounded bg-green-900/30 text-green-400">après 72h</span>
        </div>
      </div>
    </section>
  );
}
