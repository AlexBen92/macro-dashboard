'use client';

import { useEffect, useRef, useState } from 'react';
import { VOL_WINDOWS } from '@/lib/constants';

type AlertState = {
  lastSession: string | null;
  lastSignals: Map<string, { signal: string; strength: number; time: number }>;
  windowOpenNotified: boolean;
};

const CHECK_INTERVAL = 60000; // Check every minute

export function useTelegramAlerts() {
  const alertsRef = useRef<AlertState>({
    lastSession: null,
    lastSignals: new Map(),
    windowOpenNotified: false,
  });

  const sendAlert = async (alert: {
    type: 'WINDOW_OPEN' | 'STRONG_SIGNAL' | 'EDGE_CROSSING';
    data: Record<string, unknown>;
  }) => {
    try {
      await fetch('/api/telegram-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
      console.log('Alert sent:', alert.type);
    } catch (e) {
      console.error('Failed to send alert:', e);
    }
  };

  const checkWindowOpen = () => {
    const h = new Date().getUTCHours();
    const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);

    if (win && win.score >= 0.7) {
      const sessionKey = `${win.label}_${h}`;
      if (alertsRef.current.lastSession !== sessionKey && !alertsRef.current.windowOpenNotified) {
        sendAlert({
          type: 'WINDOW_OPEN',
          data: {
            timestamp: new Date().toISOString(),
            session: win.label,
            score: win.score,
          },
        });
        alertsRef.current.lastSession = sessionKey;
        alertsRef.current.windowOpenNotified = true;
      }
    } else {
      // Reset when outside window
      alertsRef.current.windowOpenNotified = false;
    }
  };

  const checkStrongSignals = async () => {
    try {
      const res = await fetch('https://api.hyperliquid.xyz/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      });
      const data = await res.json();
      const meta: Array<{ name: string }> = data[0]?.universe ?? [];
      const ctxs: Array<Record<string, string>> = data[1] ?? [];

      const win = VOL_WINDOWS.find(w => {
        const h = new Date().getUTCHours();
        return h >= w.start && h < w.end;
      });

      if (!win || win.score < 0.7) return;

      const now = Date.now();
      for (let i = 0; i < meta.length; i++) {
        const symbol = meta[i].name;
        const ctx = ctxs[i];

        if (!ctx || parseFloat(ctx.openInterest ?? '0') < 5e6) continue;

        const funding = parseFloat(ctx.funding ?? '0');
        const absFunding = Math.abs(funding);
        const edgePerM30 = absFunding / 16;
        const edgeNet = edgePerM30 - 0.0005; // HL taker fee

        // Calculate signal strength
        let strength = win.score * 40; // Session score
        const fundingRatio = edgeNet / 0.001; // vs MIN_EDGE
        if (fundingRatio >= 1) strength += 30;

        const bias = funding < -0.0002 ? 'LONG' : funding > 0.0002 ? 'SHORT' : 'NEUTRAL';
        if ((bias === 'LONG' && funding < -0.0003) || (bias === 'SHORT' && funding > 0.0003)) {
          strength += 10;
        }

        // Check for strong signal
        const signalType = strength >= 80 ? (bias === 'LONG' ? 'STRONG_LONG' : 'STRONG_SHORT') : null;
        if (signalType && strength >= 80) {
          const lastAlert = alertsRef.current.lastSignals.get(symbol);
          const alertCooldown = 30 * 60 * 1000; // 30 minutes

          if (!lastAlert || (now - lastAlert.time > alertCooldown && lastAlert.strength < strength)) {
            sendAlert({
              type: 'STRONG_SIGNAL',
              data: {
                timestamp: new Date().toISOString(),
                symbol,
                signalType,
                signalStrength: strength,
                edgeNet: edgeNet,
                price: parseFloat(ctx.markPx ?? '0'),
                slDist: 0.5,
                tp1: 0.5,
                tp2: 1.0,
              },
            });
            alertsRef.current.lastSignals.set(symbol, { signal: signalType, strength, time: now });
          }
        }
      }
    } catch (e) {
      console.error('Error checking signals:', e);
    }
  };

  useEffect(() => {
    // Initial check
    checkWindowOpen();

    // Set up interval
    const interval = setInterval(() => {
      checkWindowOpen();
      checkStrongSignals();
    }, CHECK_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return null;
}
