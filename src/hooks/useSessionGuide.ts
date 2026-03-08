'use client';
import { useState, useEffect } from 'react';
import type { SessionInfo } from '@/lib/types';
import { SESSIONS, MACRO_EVENTS } from '@/lib/constants';
import { fmtCD } from '@/lib/format';

interface UseSessionGuideReturn {
  session: SessionInfo;
  nextEvent: { name: string; countdown: string; hoursLeft: number } | null;
}

export function useSessionGuide(): UseSessionGuideReturn {
  const [session, setSession] = useState<SessionInfo>({ active: null, dead: false, hour: 0, isSunday: false });
  const [nextEvent, setNextEvent] = useState<{ name: string; countdown: string; hoursLeft: number } | null>(null);

  useEffect(() => {
    function update() {
      const now = new Date();
      const h = now.getUTCHours() + now.getUTCMinutes() / 60;
      const isSunday = now.getUTCDay() === 0;
      let active: string | null = null;
      let dead = false;

      for (const s of SESSIONS) {
        if (h >= s.s && h < s.e) {
          if (s.good) active = s.n;
          else dead = true;
        }
      }

      setSession({ active, dead: dead || isSunday, hour: h, isSunday });

      // Next macro event
      let best: { t: number; n: string } | null = null;
      for (const e of MACRO_EVENTS) {
        const t = new Date(e.d + 'T18:00:00Z').getTime();
        if (t > Date.now() && (!best || t < best.t)) best = { t, n: e.n };
      }
      if (best) {
        const ms = best.t - Date.now();
        setNextEvent({ name: best.n, countdown: fmtCD(ms), hoursLeft: ms / 36e5 });
      } else {
        setNextEvent(null);
      }
    }

    update();
    const int = setInterval(update, 10000);
    return () => clearInterval(int);
  }, []);

  return { session, nextEvent };
}
