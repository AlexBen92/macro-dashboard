/**
 * HYPERLIQUID L2 WEBSOCKET — Real-time order book data for OFI Engine
 * Subscribes to l2Book channel to get bid/ask depth updates
 * Format: { channel: 'l2Book', data: { coin, time, levels: [[{px,sz,n}], ...] } }
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getOFIEngine, type L2Snapshot } from '@/lib/ofi-autocorr';

interface L2BookLevel {
  px: string;  // price
  sz: string;  // size
  n: number;   // number of orders at this level
}

interface L2BookData {
  coin: string;
  time: number;
  levels: [
    L2BookLevel[],  // bids [0]
    L2BookLevel[]   // asks [1]
  ];
}

interface L2BookMessage {
  channel: string;
  data?: L2BookData;
  subscription?: string;
}

export function useHyperliquidL2WebSocket(symbols: string[] = ['BTC', 'ETH', 'SOL']) {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Record<string, number>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const ofiEnginesRef = useRef<Record<string, ReturnType<typeof getOFIEngine>>>({});
  const symbolsRef = useRef(symbols); // Store symbols in ref to avoid stale closures

  // Initialize OFI engines for each symbol
  useEffect(() => {
    // Update symbols ref
    symbolsRef.current = symbols;

    symbols.forEach(symbol => {
      if (!ofiEnginesRef.current[symbol]) {
        ofiEnginesRef.current[symbol] = getOFIEngine(symbol);
      }
    });
  }, [symbols]);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Guard: only connect in browser
    if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
      console.error('[HyperliquidL2] WebSocket not available in this environment');
      setError('WebSocket not available');
      return;
    }

    try {
      const ws = new WebSocket('wss://api.hyperliquid.xyz/ws');

      ws.onopen = () => {
        console.log('[HyperliquidL2] Connected to l2Book');
        reconnectAttemptsRef.current = 0;
        setConnected(true);
        setError(null);

        // Subscribe to l2Book for all symbols
        symbolsRef.current.forEach(symbol => {
          try {
            const msg = {
              method: 'subscribe',
              subscription: {
                type: 'l2Book',
                coin: symbol,
              },
            };
            ws.send(JSON.stringify(msg));
            console.log(`[HyperliquidL2] Subscribed to l2Book for ${symbol}`);
          } catch (err) {
            console.error(`[HyperliquidL2] Failed to subscribe to ${symbol}:`, err);
          }
        });
      };

      ws.onmessage = (event) => {
        try {
          const message: L2BookMessage = JSON.parse(event.data);

          // Check if this is an l2Book message with data
          if (message.channel === 'l2Book' && message.data) {
            const { coin, time, levels } = message.data;
            const engine = ofiEnginesRef.current[coin];

            if (engine && levels && levels.length >= 2) {
              // Convert Hyperliquid format to L2Snapshot
              const bids: [number, number][] = (levels[0] ?? []).map((lvl: L2BookLevel) => [
                parseFloat(lvl.px),
                parseFloat(lvl.sz),
              ]);
              const asks: [number, number][] = (levels[1] ?? []).map((lvl: L2BookLevel) => [
                parseFloat(lvl.px),
                parseFloat(lvl.sz),
              ]);

              if (bids.length > 0 && asks.length > 0) {
                const snap: L2Snapshot = {
                  bids,
                  asks,
                  timestamp: time ?? Date.now(),
                };

                // Update OFI engine
                engine.update(snap);

                // Update last update timestamp
                setLastUpdate(prev => ({ ...prev, [coin]: Date.now() }));
              }
            }
          }
        } catch (err) {
          console.error('[HyperliquidL2] Parse error:', err);
        }
      };

      ws.onerror = (err) => {
        console.error('[HyperliquidL2] WebSocket error:', err);
        setError('WebSocket connection error');
        setConnected(false);
      };

      ws.onclose = () => {
        console.log('[HyperliquidL2] Disconnected, reconnecting...');
        setConnected(false);
        reconnectAttemptsRef.current++;

        // Exponential backoff: 2s, 4s, 8s, max 30s
        const delay = Math.min(30000, Math.pow(2, reconnectAttemptsRef.current) * 1000);
        console.log(`[HyperliquidL2] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('[HyperliquidL2] Error creating WebSocket:', err);
      setError('Failed to create WebSocket connection');
    }
  }, []); // No dependencies - use refs instead

  // Cleanup on unmount - connect only once on mount
  useEffect(() => {
    // Small delay to ensure we're in browser environment
    const timer = setTimeout(() => {
      connect();
    }, 100);

    return () => {
      clearTimeout(timer);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []); // Run only once on mount

  return {
    connected,
    error,
    lastUpdate,
    // Expose method to get OFI signals for a symbol
    getOFISignal: (symbol: string) => {
      const engine = ofiEnginesRef.current[symbol];
      if (!engine) return null;

      const acf = engine.computeACF();
      const rv = engine.computeRV();
      const depth = engine.getLastDepth();

      return { acf, rv, depth, bufferLength: engine.getBufferLength() };
    },
  };
}

/**
 * Multi-asset L2 WebSocket hook for TopTokenScanner
 * Connects to l2Book for all top tokens and updates OFI engines
 */
export function useMultiAssetL2WebSocket(assets: string[]) {
  const l2State = useHyperliquidL2WebSocket(assets);
  const [ofiSignals, setOfiSignals] = useState<Record<string, {
    ofiScore: number;
    autoCorr: number;
    acfDirection: 'BUY' | 'SELL' | 'NEUTRAL';
    acfStrength: 'STRONG' | 'MODERATE' | 'WEAK';
    pContinuation: number;
    rvRegime: 'LOW' | 'NORMAL' | 'HIGH' | 'EXPLOSIVE';
    depthImbalance: number;
    spreadBps: number;
    acfLags: number[];
  }>>({});

  // Update OFI signals every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      const signals: Record<string, any> = {};

      assets.forEach(asset => {
        const signal = l2State.getOFISignal(asset);
        if (!signal || !signal.acf || signal.bufferLength < 30) {
          // Not enough data yet - use defaults
          signals[asset] = {
            ofiScore: 50,
            autoCorr: 0,
            acfDirection: 'NEUTRAL',
            acfStrength: 'WEAK',
            pContinuation: 0.5,
            rvRegime: 'NORMAL',
            depthImbalance: 0,
            spreadBps: 0,
            acfLags: [],
          };
          return;
        }

        const { acf, rv, depth } = signal;

        // Compute OFI score
        const ofiScore = Math.max(0, Math.min(100,
          50 +
          (acf.direction === 'BUY' ? 15 : acf.direction === 'SELL' ? -15 : 0) +
          (acf.persistence - 0.5) * 40 +
          Math.min(acf.sumACF * 15, 20)
        ));

        const autoCorr = Math.max(0, Math.min(100,
          50 + acf.sumACF * 50 + (acf.persistence - 0.5) * 60
        ));

        signals[asset] = {
          ofiScore,
          autoCorr,
          acfDirection: acf.direction,
          acfStrength: acf.strength,
          pContinuation: acf.pContinuation,
          rvRegime: rv.regime,
          depthImbalance: depth?.depthImbalance ?? 0,
          spreadBps: depth?.spreadBps ?? 0,
          acfLags: acf.lags,
        };
      });

      setOfiSignals(signals);
    }, 500);

    return () => clearInterval(interval);
  }, [assets, l2State]);

  return {
    ...l2State,
    ofiSignals,
  };
}
