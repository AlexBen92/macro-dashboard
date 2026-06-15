/**
 * OFI ENGINE HOOK — Bridges L2 WebSocket data to OFI autocorrelation engine
 * Provides real-time OFI signals for the TopTokenScanner
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOFIEngine, ACFResult, RVResult, DepthFeatures, L2Snapshot } from '@/lib/ofi-autocorr';

// ─── TYPES ───

export interface OFISignal {
  asset: string;
  acf: ACFResult | null;
  rv: RVResult;
  depth: DepthFeatures | null;
  ofiScore: number;       // composite OFI score 0..100 for dashboard
  autoCorr: number;       // ACF persistence score 0..100
  timestamp: number;
}

export interface UseOFIEngineResult {
  signal: OFISignal | null;
  pushL2Update: (rawMessage: MessageEvent | any, asset?: string) => void;
  reset: () => void;
}

// ─── HOOK ───

export function useOFIEngine(asset: string): UseOFIEngineResult {
  const [signal, setSignal] = useState<OFISignal | null>(null);
  const updateIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const engineRef = useRef(getOFIEngine(asset));

  const processL2Update = useCallback((rawMessage: MessageEvent | any, targetAsset?: string) => {
    try {
      const engine = engineRef.current;
      const symbol = targetAsset || asset;

      // Handle different message formats
      let data: any;
      if (rawMessage instanceof MessageEvent) {
        data = JSON.parse(rawMessage.data);
      } else {
        data = rawMessage;
      }

      // Adapt to Hyperliquid L2 book format or Binance depth format
      // Hyperliquid: { levels: [[{px, sz, n}], [{px, sz, n}]], coin, time }
      // Binance: { bids: [[px, sz], ...], asks: [[px, sz], ...], lastUpdateId }

      let bids: [number, number][] = [];
      let asks: [number, number][] = [];
      let timestamp: number;

      if (data.levels && Array.isArray(data.levels)) {
        // Hyperliquid format
        bids = (data.levels[0] ?? []).map((lvl: any) => [
          parseFloat(lvl.px ?? lvl[0]),
          parseFloat(lvl.sz ?? lvl[1])
        ]);
        asks = (data.levels[1] ?? []).map((lvl: any) => [
          parseFloat(lvl.px ?? lvl[0]),
          parseFloat(lvl.sz ?? lvl[1])
        ]);
        timestamp = data.time ?? Date.now();
      } else if (data.bids && data.asks) {
        // Binance / standard format
        bids = data.bids.map((b: [string, string] | { price: string, quantity: string }) =>
          Array.isArray(b) ? [parseFloat(b[0]), parseFloat(b[1])]
                             : [parseFloat(b.price), parseFloat(b.quantity)]
        );
        asks = data.asks.map((a: [string, string] | { price: string, quantity: string }) =>
          Array.isArray(a) ? [parseFloat(a[0]), parseFloat(a[1])]
                             : [parseFloat(a.price), parseFloat(a.quantity)]
        );
        timestamp = data.E ?? data.time ?? Date.now();
      } else {
        return; // Unrecognized format
      }

      if (bids.length === 0 || asks.length === 0) return;

      const snap: L2Snapshot = { bids, asks, timestamp };
      engine.update(snap);

    } catch (e) {
      // Silent fail on parse errors
    }
  }, [asset]);

  // Compute ACF + RV periodically and push to state
  useEffect(() => {
    const engine = engineRef.current;

    updateIntervalRef.current = setInterval(() => {
      const acf = engine.computeACF();
      const rv = engine.computeRV();
      const depth = engine.getLastDepth();

      // Composite OFI score 0..100
      let ofiScore = 50;
      if (acf) {
        const dirBonus   = acf.direction === 'BUY' ? 15 : acf.direction === 'SELL' ? -15 : 0;
        const persBonus  = (acf.persistence - 0.5) * 40; // -20..+20
        const acfBonus   = Math.min(acf.sumACF * 15, 20);
        ofiScore = Math.max(0, Math.min(100, 50 + dirBonus + persBonus + acfBonus));
      }

      // Autocorr score: how "trended" OFI is
      const autoCorr = acf
        ? Math.max(0, Math.min(100, 50 + acf.sumACF * 50 + (acf.persistence - 0.5) * 60))
        : 50;

      setSignal({
        asset,
        acf,
        rv,
        depth,
        ofiScore,
        autoCorr,
        timestamp: Date.now(),
      });
    }, 500); // Update every 500ms

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current);
    };
  }, [asset]);

  const reset = useCallback(() => {
    engineRef.current.reset();
    setSignal(null);
  }, []);

  return { signal, pushL2Update: processL2Update, reset };
}

// ─── MULTI-ASSET HOOK ───

/**
 * Hook for managing OFI engines for multiple assets simultaneously
 * Useful for TopTokenScanner which monitors 20+ tokens
 */
export function useMultiAssetOFI(assets: string[]): Record<string, OFISignal | null> {
  const [signals, setSignals] = useState<Record<string, OFISignal | null>>(() =>
    Object.fromEntries(assets.map(a => [a, null]))
  );

  const enginesRef = useRef<Record<string, ReturnType<typeof getOFIEngine>>>({});

  // Initialize engines
  useEffect(() => {
    assets.forEach(asset => {
      if (!enginesRef.current[asset]) {
        enginesRef.current[asset] = getOFIEngine(asset);
      }
    });
  }, [assets]);

  // Periodic update for all assets
  useEffect(() => {
    const interval = setInterval(() => {
      const newSignals: Record<string, OFISignal | null> = {};

      assets.forEach(asset => {
        const engine = enginesRef.current[asset];
        if (!engine) {
          newSignals[asset] = null;
          return;
        }

        const acf = engine.computeACF();
        const rv = engine.computeRV();
        const depth = engine.getLastDepth();

        let ofiScore = 50;
        if (acf) {
          const dirBonus   = acf.direction === 'BUY' ? 15 : acf.direction === 'SELL' ? -15 : 0;
          const persBonus  = (acf.persistence - 0.5) * 40;
          const acfBonus   = Math.min(acf.sumACF * 15, 20);
          ofiScore = Math.max(0, Math.min(100, 50 + dirBonus + persBonus + acfBonus));
        }

        const autoCorr = acf
          ? Math.max(0, Math.min(100, 50 + acf.sumACF * 50 + (acf.persistence - 0.5) * 60))
          : 50;

        newSignals[asset] = {
          asset,
          acf,
          rv,
          depth,
          ofiScore,
          autoCorr,
          timestamp: Date.now(),
        };
      });

      setSignals(newSignals);
    }, 500);

    return () => clearInterval(interval);
  }, [assets]);

  // Push L2 update for a specific asset
  const pushUpdate = useCallback((asset: string, rawMessage: MessageEvent | any) => {
    const engine = enginesRef.current[asset];
    if (!engine) return;

    try {
      let data: any;
      if (rawMessage instanceof MessageEvent) {
        data = JSON.parse(rawMessage.data);
      } else {
        data = rawMessage;
      }

      let bids: [number, number][] = [];
      let asks: [number, number][] = [];
      let timestamp: number;

      if (data.levels && Array.isArray(data.levels)) {
        bids = (data.levels[0] ?? []).map((lvl: any) => [
          parseFloat(lvl.px ?? lvl[0]),
          parseFloat(lvl.sz ?? lvl[1])
        ]);
        asks = (data.levels[1] ?? []).map((lvl: any) => [
          parseFloat(lvl.px ?? lvl[0]),
          parseFloat(lvl.sz ?? lvl[1])
        ]);
        timestamp = data.time ?? Date.now();
      } else if (data.bids && data.asks) {
        bids = data.bids.map((b: [string, string] | { price: string, quantity: string }) =>
          Array.isArray(b) ? [parseFloat(b[0]), parseFloat(b[1])]
                             : [parseFloat(b.price), parseFloat(b.quantity)]
        );
        asks = data.asks.map((a: [string, string] | { price: string, quantity: string }) =>
          Array.isArray(a) ? [parseFloat(a[0]), parseFloat(a[1])]
                             : [parseFloat(a.price), parseFloat(a.quantity)]
        );
        timestamp = data.E ?? data.time ?? Date.now();
      } else {
        return;
      }

      if (bids.length === 0 || asks.length === 0) return;

      engine.update({ bids, asks, timestamp });
    } catch (e) {
      // Silent fail
    }
  }, []);

  return signals;
}
