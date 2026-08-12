'use client';

import { useEffect, useRef } from 'react';
import type { DecisionStatusPayload, EntryState } from './types';

const ALERT_THROTTLE_KEY = 'decision_alert_throttle_v1';

interface ThrottleEntry {
  key: string;
  fired_at: number;
}

function loadThrottle(): ThrottleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(ALERT_THROTTLE_KEY);
    return raw ? (JSON.parse(raw) as ThrottleEntry[]) : [];
  } catch {
    return [];
  }
}

function saveThrottle(entries: ThrottleEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(ALERT_THROTTLE_KEY, JSON.stringify(entries));
  } catch {
    /* sessionStorage may be unavailable */
  }
}

/**
 * Hook that watches decision status transitions and POSTs an alert when
 * ARMED → TRIGGERED occurs on a LONG or SHORT verdict.
 *
 * Throttled: max 1 alert per (symbol × setupKind) per 15min M15 candle window.
 */
export function useDecisionAlerts(payload: DecisionStatusPayload | null) {
  const prevStatesRef = useRef<Record<string, EntryState | undefined>>({});
  const alertedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!payload) return;
    const now = Date.now();
    const window_min = 15;
    const cutoff = now - window_min * 60 * 1000;

    const throttle = loadThrottle().filter((e) => e.fired_at >= cutoff);
    const throttleKeys = new Set(throttle.map((e) => e.key));

    for (const asset of [payload.btc, payload.eth]) {
      const prev = prevStatesRef.current[asset.symbol];
      const cur = asset.entry.state;
      prevStatesRef.current[asset.symbol] = cur;

      if (!prev || prev === cur) continue;

      // ARMED → TRIGGERED on LONG/SHORT verdicts only
      if (prev === 'ARMED' && cur === 'TRIGGERED'
          && (asset.verdict === 'LONG' || asset.verdict === 'SHORT')) {
        const key = `${asset.symbol}:${asset.setup.kind}:${payload.as_of}`;
        if (throttleKeys.has(key) || alertedRef.current.has(key)) continue;

        throttleKeys.add(key);
        throttle.push({ key, fired_at: now });
        alertedRef.current.add(key);

        const body = {
          type: 'decision_trigger',
          symbol: asset.symbol,
          verdict: asset.verdict,
          setup_kind: asset.setup.kind,
          entry_state: cur,
          score: asset.score,
          confidence: asset.confidence,
          entry_price: asset.entry.price,
          stop: asset.stop.price,
          tp1: asset.tp.tp1,
          tp2: asset.tp.tp2,
          tp3: asset.tp.tp3,
          rr_tp1: asset.tp.rr_tp1,
          data_quality: asset.data_quality.score,
          triggered_at: payload.as_of,
        };

        fetch('/api/m15-alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).catch(() => {
          /* non-blocking: alert failures must not break UI */
        });
      }
    }

    saveThrottle(throttle);
  }, [payload]);
}
