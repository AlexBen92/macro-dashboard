'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { YahooCandle, AsianRangeState, ScalpState, LondonBOState, MeanRevState, ORBState, CurrencyStrength, FtmoScoreResult, FtmoTrade } from '@/lib/ftmo/types';
import { calcAsianRange, calcScalp, calcLondonBO, calcMeanRev, calcORB, calcCurrencyStrength } from '@/lib/ftmo/strategies';
import { calcFtmoScore } from '@/lib/ftmo/scoring';
import { calculateLotSize } from '@/lib/ftmo/risk';
import { MACRO_EVENTS } from '@/lib/ftmo/constants';
import { fmtCD } from '@/lib/format';

interface RawData {
  [key: string]: { candles: YahooCandle[]; price: number; change24h: number };
}

interface FtmoDataReturn {
  raw: RawData;
  // Instrument data
  instruments: Record<string, { price: number; change24h: number; candles1h: YahooCandle[] }>;
  // Strategies
  asianRange: AsianRangeState;
  scalp: ScalpState;
  londonBOEUR: LondonBOState;
  londonBOGBP: LondonBOState;
  meanRevEUR: MeanRevState;
  meanRevEURGBP: MeanRevState;
  orbNAS: ORBState;
  orbUS30: ORBState;
  // Derived
  currencyStrength: CurrencyStrength[];
  score: FtmoScoreResult;
  trades: FtmoTrade[];
  // VIX/DXY
  vix: number;
  dxyPrice: number;
  dxyChange: number;
  yield10y: number;
  // Meta
  loading: boolean;
  countdown: number;
  latency: number;
  // Session
  nextEvent: { name: string; countdown: string; hoursLeft: number } | null;
}

const REFRESH = 30_000;

export function useFtmoData(): FtmoDataReturn {
  const [raw, setRaw] = useState<RawData>({});
  const [loading, setLoading] = useState(true);
  const [countdown, setCountdown] = useState(REFRESH / 1000);
  const [latency, setLatency] = useState(0);
  const balanceRef = useRef(100_000);
  const riskRef = useRef(0.5);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const b = localStorage.getItem('ftmo_balance');
      if (b) balanceRef.current = parseFloat(b);
      const r = localStorage.getItem('ftmo_risk');
      if (r) riskRef.current = parseFloat(r);
    } catch { /* skip */ }
  }, []);

  const fetchData = useCallback(async () => {
    const t0 = performance.now();
    setLoading(true);
    try {
      const res = await fetch('/api/ftmo-data');
      const json = await res.json();
      setRaw(json.data || {});
      setLatency(Math.round(performance.now() - t0));
    } catch { /* skip */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const int = setInterval(fetchData, REFRESH);
    return () => clearInterval(int);
  }, [fetchData]);

  useEffect(() => {
    setCountdown(REFRESH / 1000);
    const int = setInterval(() => setCountdown(c => (c <= 0 ? REFRESH / 1000 : c - 1)), 1000);
    return () => clearInterval(int);
  }, []);

  // Derive instruments
  const instruments: Record<string, { price: number; change24h: number; candles1h: YahooCandle[] }> = {};
  const mapping: Record<string, string> = {
    XAUUSD: 'XAUUSD_1h', EURUSD: 'EURUSD_1h', GBPUSD: 'GBPUSD_1h', USDJPY: 'USDJPY_1h',
    USDCHF: 'USDCHF_1h', AUDUSD: 'AUDUSD_1h', USDCAD: 'USDCAD_1h', OIL: 'OIL_1h',
    DXY: 'DXY_1h', GOLD: 'XAUUSD_1h', '10Y': '10Y', VIX: 'VIX',
  };
  for (const [inst, key] of Object.entries(mapping)) {
    if (raw[key]) {
      instruments[inst] = { price: raw[key].price, change24h: raw[key].change24h, candles1h: raw[key].candles };
    }
  }

  // Strategies
  const goldH1 = raw['XAUUSD_1h']?.candles ?? [];
  const goldM15 = raw['XAUUSD_15m']?.candles ?? [];
  const goldDaily = raw['XAUUSD_daily']?.candles ?? [];
  const eurH1 = raw['EURUSD_1h']?.candles ?? [];
  const gbpH1 = raw['GBPUSD_1h']?.candles ?? [];
  const eurH4 = raw['EURUSD_4h']?.candles ?? [];
  const eurgbpH4 = raw['EURGBP_4h']?.candles ?? [];
  const nas5m = raw['NAS100_5m']?.candles ?? [];
  const nasH1 = raw['NAS100_1h']?.candles ?? [];
  const us305m = raw['US30_5m']?.candles ?? [];

  const asianRange = calcAsianRange(goldH1, goldDaily);
  const scalp = calcScalp(goldM15, goldDaily);
  const londonBOEUR = calcLondonBO(eurH1, 'EURUSD');
  const londonBOGBP = calcLondonBO(gbpH1, 'GBPUSD');
  const meanRevEUR = calcMeanRev(eurH4, 'EURUSD');
  const meanRevEURGBP = calcMeanRev(eurgbpH4, 'EURGBP');
  const orbNAS = calcORB(nas5m, nasH1, 'NAS100');
  const orbUS30 = calcORB(us305m, nasH1, 'US30');

  // Currency strength
  const currencyStrength = calcCurrencyStrength(instruments);

  // VIX/DXY
  const vix = raw['VIX']?.price ?? 20;
  const dxyPrice = raw['DXY_1h']?.price ?? 104;
  const dxyCandles = raw['DXY_1h']?.candles ?? [];
  const dxyChange = dxyCandles.length >= 2 ? ((dxyCandles[dxyCandles.length - 1].c - dxyCandles[dxyCandles.length - 2].c) / dxyCandles[dxyCandles.length - 2].c) * 100 : 0;
  const yield10y = raw['10Y']?.price ?? 4.3;

  // Next macro event
  let nextEvent: FtmoDataReturn['nextEvent'] = null;
  for (const e of MACRO_EVENTS) {
    const t = new Date(e.d + 'T18:00:00Z').getTime();
    if (t > Date.now()) {
      const ms = t - Date.now();
      nextEvent = { name: e.n, countdown: fmtCD(ms), hoursLeft: ms / 36e5 };
      break;
    }
  }

  // Session
  const nowH = new Date().getUTCHours() + new Date().getUTCMinutes() / 60;
  const sessionActive = (nowH >= 7 && nowH <= 16) || (nowH >= 13 && nowH <= 22);

  // Score
  const score = calcFtmoScore(instruments, asianRange, meanRevEUR, londonBOEUR, orbNAS, vix, dxyChange, sessionActive, nextEvent?.hoursLeft ?? 999);

  // Generate trades
  const trades: FtmoTrade[] = [];
  const bal = balanceRef.current;
  const rp = riskRef.current;

  if (asianRange.status === 'TRIGGERED' && asianRange.entry && asianRange.stop) {
    const stopPips = Math.abs(asianRange.entry - asianRange.stop);
    const { lots, riskUsd, riskPct } = calculateLotSize('XAUUSD', stopPips, bal, rp);
    trades.push({
      instrument: 'XAUUSD', direction: asianRange.breakoutDirection === 'ABOVE' ? 'LONG' : 'SHORT',
      strategy: 'Gold Asian Range', entry: asianRange.entry, stop: asianRange.stop,
      tp1: asianRange.tp1!, tp2: asianRange.tp2!, stopPips, lots, riskUsd, riskPct,
      rrRatio: asianRange.tp1 ? Math.abs(asianRange.tp1 - asianRange.entry) / stopPips : 2,
      reasons: [`Range $${asianRange.rangeWidth.toFixed(0)}`, `H4 Trend ${asianRange.h4Trend}`, 'H1 breakout confirmed'],
      confidence: asianRange.h4Trend !== 'RANGE' ? 4 : 3,
    });
  }

  if (scalp.status === 'SETUP' && scalp.entry && scalp.stop && scalp.direction) {
    const stopPips = Math.abs(scalp.entry - scalp.stop);
    const { lots, riskUsd, riskPct } = calculateLotSize('XAUUSD', stopPips, bal, rp);
    trades.push({
      instrument: 'XAUUSD', direction: scalp.direction, strategy: 'Gold Scalp',
      entry: scalp.entry, stop: scalp.stop, tp1: scalp.tp!, stopPips, lots, riskUsd, riskPct,
      rrRatio: scalp.tp ? Math.abs(scalp.tp - scalp.entry) / stopPips : 2,
      reasons: [`EMA ${scalp.emaTrend}`, `Pullback to EMA20`, `ATR pctile ${scalp.atrPercentile}%`],
      confidence: scalp.emaTrend !== 'FLAT' ? 3 : 2,
    });
  }

  if (meanRevEUR.signalType !== 'NONE') {
    const stopPips = Math.abs(meanRevEUR.bbUpper - meanRevEUR.bbLower) * 10000 * 0.3;
    const { lots, riskUsd, riskPct } = calculateLotSize('EURUSD', stopPips, bal, rp);
    trades.push({
      instrument: 'EURUSD', direction: meanRevEUR.signalType === 'BUY' ? 'LONG' : 'SHORT',
      strategy: 'Mean Rev RSI/BB', entry: meanRevEUR.currentPrice,
      stop: meanRevEUR.signalType === 'BUY' ? meanRevEUR.bbLower : meanRevEUR.bbUpper,
      tp1: meanRevEUR.bbMiddle, stopPips, lots, riskUsd, riskPct,
      rrRatio: 1.5,
      reasons: [`RSI ${meanRevEUR.rsi14.toFixed(0)}`, `ADX ${meanRevEUR.adx.toFixed(0)} (< 25 OK)`, `Price at BB ${meanRevEUR.priceVsBB}`],
      confidence: 3,
    });
  }

  trades.sort((a, b) => b.confidence - a.confidence);

  return {
    raw, instruments, asianRange, scalp, londonBOEUR, londonBOGBP,
    meanRevEUR, meanRevEURGBP, orbNAS, orbUS30, currencyStrength,
    score, trades, vix, dxyPrice, dxyChange, yield10y, loading, countdown, latency, nextEvent,
  };
}
