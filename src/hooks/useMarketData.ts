'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { MarketData, ScoreResult, CoinData } from '@/lib/types';
import { fetchMarketData, fetchCoinCandles } from '@/lib/api-clients';
import { calcScore } from '@/lib/scoring';
import { calcReturns, calcSharpe, calcVaR95, calcVWAP, calcTWAP, classifySentiment } from '@/lib/quant';
import { TOP_COINS, REFRESH_MS, WS_REFRESH_MS } from '@/lib/constants';

interface UseMarketDataReturn {
  data: MarketData | null;
  score: ScoreResult | null;
  coinData: Record<string, CoinData>;
  loading: boolean;
  error: string | null;
  countdown: number;
  apiStatus: Record<string, 'ok' | 'er' | 'ld'>;
  latency: number;
}

export function useMarketData(
  whaleByCoin: Record<string, { l: number; s: number; n: number }>,
  totalLong: number,
  totalShort: number,
): UseMarketDataReturn {
  const [data, setData] = useState<MarketData | null>(null);
  const [score, setScore] = useState<ScoreResult | null>(null);
  const [coinData, setCoinData] = useState<Record<string, CoinData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_MS / 1000);
  const [apiStatus, setApiStatus] = useState<Record<string, string>>({ fng: 'ld', cg: 'ld', bin: 'ld', hl: 'ld', cbbi: 'ld', vix: 'ld' });
  const [latency, setLatency] = useState(0);

  const priceHistRef = useRef<number[]>([]);
  const fngHistRef = useRef<number[]>([]);

  const fetchMain = useCallback(async () => {
    const t0 = performance.now();
    setLoading(true);
    try {
      const D = await fetchMarketData();
      const lat = Math.round(performance.now() - t0);
      setLatency(lat);

      // Update API status
      const st: Record<string, string> = { fng: 'ld', cg: 'ld', bin: 'ld', hl: 'ld', cbbi: 'ld', vix: 'ld' };
      if (D.fng) st.fng = 'ok'; else st.fng = 'er';
      if (D.prices) st.cg = 'ok'; else st.cg = 'er';
      if (Object.keys(D.bFund).length > 0) st.bin = 'ok'; else st.bin = 'er';
      if (Object.keys(D.hl).length > 0) st.hl = 'ok'; else st.hl = 'er';

      // Fetch macro + CBBI from our server routes (no CORS issues)
      try {
        const [macroRes, cbbiRes] = await Promise.all([
          fetch('/api/macro').then(r => r.json()),
          fetch('/api/cbbi').then(r => r.json()),
        ]);
        if (macroRes.vix) { D.vix = macroRes.vix; st.vix = macroRes.vix.v != null ? 'ok' : 'er'; }
        if (macroRes.dxy) D.dxy = macroRes.dxy;
        if (macroRes.yield10y) D.y10 = macroRes.yield10y;
        if (cbbiRes.confidence != null) {
          D.cbbi = {
            conf: cbbiRes.confidence,
            mvrv: cbbiRes.indicators?.mvrv ?? 0,
            pi: cbbiRes.indicators?.pi ?? 0,
            puell: cbbiRes.indicators?.puell ?? 0,
            rhodl: cbbiRes.indicators?.rhodl ?? 0,
            rupl: cbbiRes.indicators?.rupl ?? 0,
            rr: cbbiRes.indicators?.rr ?? 0,
            yma: cbbiRes.indicators?.yma ?? 0,
            woob: cbbiRes.indicators?.woob ?? 0,
          };
          st.cbbi = 'ok';
        }
      } catch { /* skip */ }

      setApiStatus(st);

      // Price history
      if (D.prices?.BTC) {
        priceHistRef.current.push(D.prices.BTC.p);
        if (priceHistRef.current.length > 100) priceHistRef.current.shift();
      }
      if (D.fng) {
        fngHistRef.current.push(D.fng.v);
        if (fngHistRef.current.length > 100) fngHistRef.current.shift();
      }

      // Score
      const sc = calcScore(D, priceHistRef.current, fngHistRef.current, {
        _totalLong: totalLong,
        _totalShort: totalShort,
      });

      setData(D);
      setScore(sc);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [totalLong, totalShort]);

  const fetchCandles = useCallback(async () => {
    const results = await Promise.allSettled(
      TOP_COINS.map(coin => fetchCoinCandles(coin))
    );
    const newCoinData: Record<string, CoinData> = {};
    results.forEach((r, i) => {
      const coin = TOP_COINS[i];
      if (r.status !== 'fulfilled' || r.value.length < 24) {
        newCoinData[coin] = { coin };
        return;
      }
      const candles = r.value;
      const ret = calcReturns(candles);
      const sharpe = calcSharpe(ret);
      const var95 = calcVaR95(ret);
      const r24 = candles.slice(-24);
      const vwap = calcVWAP(r24);
      const twap = calcTWAP(r24);
      const price = candles[candles.length - 1].c;

      const wc = whaleByCoin[coin];
      const wCount = wc?.n ?? 0;
      const wl = wc?.l ?? 0;
      const ws = wc?.s ?? 0;
      const sentiment = classifySentiment(wl, ws);

      newCoinData[coin] = {
        coin, price, sharpe, var95,
        vwap, vwapD: vwap ? ((price - vwap) / vwap * 100) : null,
        twap, twapD: twap ? ((price - twap) / twap * 100) : null,
        whaleCount: wCount, whaleLong: wl, whaleShort: ws,
        netBias: (wl + ws) > 0 ? (wl - ws) / (wl + ws) : 0,
        sentiment,
      };
    });
    setCoinData(newCoinData);
  }, [whaleByCoin]);

  // Initial + interval
  useEffect(() => {
    fetchMain();
    const mainInt = setInterval(fetchMain, REFRESH_MS);
    return () => clearInterval(mainInt);
  }, [fetchMain]);

  // Candles
  useEffect(() => {
    fetchCandles();
    const wsInt = setInterval(fetchCandles, WS_REFRESH_MS);
    return () => clearInterval(wsInt);
  }, [fetchCandles]);

  // Countdown
  useEffect(() => {
    setCountdown(REFRESH_MS / 1000);
    const cdInt = setInterval(() => {
      setCountdown(c => (c <= 0 ? REFRESH_MS / 1000 : c - 1));
    }, 1000);
    return () => clearInterval(cdInt);
  }, []);

  return { data, score, coinData, loading, error, countdown, apiStatus: apiStatus as Record<string, 'ok' | 'er' | 'ld'>, latency };
}
