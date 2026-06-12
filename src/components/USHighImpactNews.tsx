/**
 * US HIGH IMPACT NEWS BANNER
 * Affiche les événements économiques USD à fort impact.
 * Couleurs: rouge < 2h, orange 2-24h, neutre > 24h.
 */
'use client';

import { useState, useEffect } from 'react';

interface EconomicEvent {
  name: string;
  impact: string;
  hoursLeft: number;
  date: string;
}

interface MacroData {
  upcomingEvents?: EconomicEvent[];
  nextEvent?: EconomicEvent | null;
}

export default function USHighImpactNews() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch('/api/macro');
        const data: MacroData = await res.json();
        // Filter for high impact events only
        const highImpact = (data.upcomingEvents || []).filter(e => e.impact === 'high');
        setEvents(highImpact.slice(0, 3)); // Top 3 events
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
    const interval = setInterval(fetchEvents, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  const getEventColor = (hoursLeft: number): string => {
    if (hoursLeft < 2) return '#ef4444'; // Red
    if (hoursLeft < 24) return '#f97316'; // Orange
    return '#64748b'; // Gray
  };

  const getEventBadge = (hoursLeft: number): string => {
    if (hoursLeft < 2) return '🔴 IMMINENT';
    if (hoursLeft < 24) return '🟠 APPROCHING';
    return '⚪ UPCOMING';
  };

  const formatTimeLeft = (hours: number): string => {
    if (hours < 1) return `${Math.round(hours * 60)}min`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  // Overall status
  const overallStatus = events.length > 0 && events[0].hoursLeft < 2 ? 'critical' :
                        events.length > 0 && events[0].hoursLeft < 24 ? 'warning' : 'normal';

  const statusBanner = overallStatus === 'critical' ? { bg: '#ef444422', border: '#ef4444', text: '⚠️ HIGH IMPACT EVENT IMMINENT' } :
                       overallStatus === 'warning' ? { bg: '#f9731622', border: '#f97316', text: '📊 HIGH IMPACT EVENT APPROACHING' } :
                       { bg: '#1e293b', border: '#64748b', text: '📅 NO CRITICAL EVENTS (24H)' };

  return (
    <div className="w-full">
      {/* Status Banner */}
      <div
        className="px-4 py-2 rounded-lg border font-mono text-xs font-semibold flex items-center justify-between"
        style={{
          background: statusBanner.bg,
          borderColor: statusBanner.border,
          color: overallStatus === 'normal' ? '#94a3b8' : '#fff',
        }}
      >
        <span>{statusBanner.text}</span>
        <span className="text-[10px] opacity-70">US HIGH IMPACT NEWS</span>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="mt-2 text-center text-gray-500 text-xs py-2">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="mt-2 text-center text-gray-500 text-xs py-2">
          No upcoming events
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2">
          {events.map((event, idx) => {
            const color = getEventColor(event.hoursLeft);
            const badge = getEventBadge(event.hoursLeft);
            const eventDate = new Date(event.date);
            const timeStr = eventDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC';
            const dateStr = eventDate.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });

            return (
              <div
                key={idx}
                className="px-3 py-2 rounded-lg border font-mono"
                style={{
                  background: color + '11',
                  borderColor: color + '44',
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold" style={{ color }}>
                    {badge}
                  </span>
                  <span className="text-[9px] text-gray-500">{formatTimeLeft(event.hoursLeft)}</span>
                </div>
                <div className="text-sm font-semibold text-white mb-1">{event.name}</div>
                <div className="text-[10px] text-gray-400">{dateStr} · {timeStr}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
