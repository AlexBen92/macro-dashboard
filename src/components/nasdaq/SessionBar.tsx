'use client';

import { useEffect, useState } from 'react';

import {
  PHASE_LABEL,
  feedSlow,
  horloges,
  nextBoundary,
  sessionPhaseLocal,
  type NasdaqEvent,
  type NasdaqSessionCal,
  type NasdaqStatus,
} from '@/lib/nasdaq';

/**
 * Barre de session (spec V3 §4) : horloges NY/Paris, phase + compte à rebours,
 * retard du flux, jour macro, badge NO-GO. Sticky haut (mobile-bottom : incrément
 * layout §3). Chiffres tabulaires, aucune info par la seule couleur (§12).
 */
export default function SessionBar({
  status,
  sessionCal,
  events,
  goBadge,
}: {
  status?: NasdaqStatus;
  sessionCal?: NasdaqSessionCal;
  events?: NasdaqEvent[];
  goBadge?: string;
}) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const todayIso = now?.toISOString().slice(0, 10) ?? '';
  const todaySession = sessionCal?.next_sessions.find((s) => s.date === todayIso);
  const halfDay = todaySession?.half_day ?? status?.session?.half_day ?? false;
  // calendrier absent (export manquant) → phase du collecteur, sinon calcul local
  const phase = now
    ? sessionCal
      ? sessionPhaseLocal(now, sessionCal)
      : { phase: status?.session?.phase ?? 'closed', nextOpen: null }
    : null;
  const h = now ? horloges(now) : null;
  const delay = status?.feed?.delay_s ?? null;
  const nyTime = h?.ny ?? '00:00';
  const macroToday = (events ?? []).filter((e) => e.date === todayIso);

  const countdown = (() => {
    if (!now || !phase) return null;
    if (phase.phase === 'closed' && phase.nextOpen) {
      const ms = Date.parse(phase.nextOpen) - now.getTime();
      if (ms > 0) {
        const hh = Math.floor(ms / 3_600_000);
        const mm = Math.round((ms % 3_600_000) / 60_000);
        return `ouverture dans ${hh} h ${String(mm).padStart(2, '0')} min`;
      }
      return null;
    }
    const et = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false, timeZone: 'America/New_York',
    }).format(now);
    const [hh, mm, ss] = et.split(':').map(Number);
    const cur = hh * 3600 + mm * 60 + ss;
    const next = nextBoundary(halfDay).find((b) => b.min * 60 > cur);
    if (!next) return null;
    const rest = next.min * 60 - cur;
    const hRest = Math.floor(rest / 3600);
    const mRest = Math.floor((rest % 3600) / 60);
    return `${next.label} dans ${hRest > 0 ? `${hRest} h ` : ''}${String(mRest).padStart(2, '0')} min`;
  })();

  const badgeCls = (tone: 'ok' | 'warn' | 'alert') =>
    tone === 'warn'
      ? 'rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
      : tone === 'alert'
        ? 'rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-800 dark:bg-red-900/40 dark:text-red-300'
        : 'rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400';

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-neutral-200 bg-white/95 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-mono tabular-nums" suppressHydrationWarning>
          NY {h?.ny ?? '—:—'} · Paris {h?.paris ?? '—:—'}
          {h && h.ecartH !== 6 ? (
            <span className={badgeCls('warn')}> écart {h.ecartH} h</span>
          ) : null}
        </span>
        <span className="font-semibold" suppressHydrationWarning>
          {phase ? PHASE_LABEL[phase.phase] ?? phase.phase : '—'}
        </span>
        {countdown ? (
          <span className="font-mono text-xs tabular-nums text-neutral-500" suppressHydrationWarning>
            {countdown}
          </span>
        ) : null}
        <span className={badgeCls(feedSlow(delay, nyTime) ? 'warn' : 'ok')}>
          flux {status?.feed?.source ?? 'yahoo'}
          {delay !== null ? ` · retard ${delay} s` : ' · retard —'}
          {feedSlow(delay, nyTime) ? ' — ne pas trader sur ce prix' : ''}
        </span>
        {macroToday.length ? (
          <span className={badgeCls('warn')}>
            macro : {macroToday.map((e) => e.label).slice(0, 2).join(', ')}
          </span>
        ) : null}
        {goBadge ? <span className={badgeCls('alert')}>{goBadge}</span> : null}
      </div>
    </div>
  );
}
