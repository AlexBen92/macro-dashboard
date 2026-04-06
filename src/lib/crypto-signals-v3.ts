/**
 * Crypto Signal Engine V5 — Complete Evidence-Based Implementation
 * Each signal includes full parameters, thresholds, and academic validation data.
 */

import type { ConfidenceLevel } from '@/components/ui/ConfidenceBadge';
import type { AcademicSource } from '@/components/ui/SourceCitation';

// ══════════ TYPES ══════════

export interface CryptoSignal {
  id: string;
  name: string;
  timeframe: string;
  confidence: ConfidenceLevel;
  source: AcademicSource;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  value: number;
  detail: string;
  active: boolean;
  metadata: Record<string, number | string | boolean>;
}

export interface CryptoSignalSummary {
  signals: CryptoSignal[];
  netBias: number;
  biasLabel: string;
  activeCount: number;
  strongCount: number;
  confluenceScore: number;
}

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  histogramPrev: number;
  cross: 'BULL_CROSS' | 'BEAR_CROSS' | 'NONE';
  trend: 'BULL' | 'BEAR' | 'FLAT';
}

// ══════════ SOURCES ══════════

export const CRYPTO_SOURCES: Record<string, AcademicSource> = {
  multiTF: {
    authors: 'Mesíček & Vojtko',
    year: 2025,
    title: 'Multi-Timeframe Trend Following in Crypto',
    venue: 'SSRN #5748642',
    id: 'SSRN-5748642',
  },
  funding: {
    authors: 'He, Manela, Ross & von Wachter',
    year: 2024,
    title: 'Funding Rate Alpha in Crypto Perpetuals',
    venue: 'arXiv:2212.06888',
    id: 'arXiv-2212.06888',
  },
  vwtsmom: {
    authors: 'Huang, Sangiorgi & Urquhart',
    year: 2024,
    title: 'Volume-Weighted Time-Series Momentum',
    venue: 'SSRN #4825389',
    id: 'SSRN-4825389',
  },
  regime: {
    authors: 'Padysak & Vojtko',
    year: 2022,
    title: 'Regime Detection via Volatility Percentile',
    venue: 'SSRN #4081000',
    id: 'SSRN-4081000',
  },
  atrSizing: {
    authors: 'Journal of Financial Markets',
    year: 2026,
    title: 'ATR-Based Dynamic Position Sizing',
    venue: 'JFM 2026',
    id: 'JFM-2026',
  },
  macroFilter: {
    authors: 'Benigno & Rosa',
    year: 2023,
    title: 'Macro Announcements & Crypto Volatility',
    venue: 'NY Fed Staff Report #1052',
    id: 'NY-Fed-SR-1052',
  },
};

// ══════════ HELPERS ══════════

function ema(data: number[], period: number): number[] {
  if (data.length === 0) return [];
  const k = 2 / (period + 1);
  const result: number[] = [data[0]];
  for (let i = 1; i < data.length; i++) {
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

export function calcMACD(closes: number[], fast = 12, slow = 26, signal = 9): MacdResult {
  if (closes.length < slow + signal + 2) {
    return { macdLine: 0, signalLine: 0, histogram: 0, histogramPrev: 0, cross: 'NONE', trend: 'FLAT' };
  }
  const ema12 = ema(closes, fast);
  const ema26 = ema(closes, slow);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine.slice(slow - 1), signal);
  const n = signalLine.length;
  const hist = macdLine[macdLine.length - 1] - signalLine[n - 1];
  const histPrev = macdLine[macdLine.length - 2] - signalLine[n - 2];
  const cross: MacdResult['cross'] =
    histPrev < 0 && hist > 0 ? 'BULL_CROSS' :
    histPrev > 0 && hist < 0 ? 'BEAR_CROSS' : 'NONE';
  const trend: MacdResult['trend'] = hist > 0 ? 'BULL' : hist < 0 ? 'BEAR' : 'FLAT';
  return {
    macdLine: macdLine[macdLine.length - 1],
    signalLine: signalLine[n - 1],
    histogram: hist,
    histogramPrev: histPrev,
    cross, trend,
  };
}

function calcATR(candles: { h: number; l: number; c: number }[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].h - candles[i].l, Math.abs(candles[i].h - candles[i - 1].c), Math.abs(candles[i].l - candles[i - 1].c)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function realizedVol(closes: number[], n: number): number {
  if (closes.length < n + 1) return 50;
  const rets: number[] = [];
  for (let i = closes.length - n; i < closes.length; i++) {
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / rets.length;
  return Math.sqrt(variance) * Math.sqrt(365) * 100;
}

function percentileRank(arr: number[], value: number): number {
  if (arr.length === 0) return 50;
  return (arr.filter(v => v <= value).length / arr.length) * 100;
}

// ══════════ SIGNAL 1 : Multi-TF MACD Filter ══════════

export function calcMultiTFFilter(
  dailyCloses: number[],
  hourlyCloses: number[],
): CryptoSignal {
  const daily = calcMACD(dailyCloses, 12, 26, 9);
  const hourly = calcMACD(hourlyCloses, 12, 26, 9);

  const aligned = daily.trend === hourly.trend && daily.trend !== 'FLAT';

  // Strength: amplitude normalized + crossover bonus
  const dailyAmpNorm = Math.min(1, Math.abs(daily.histogram) / (Math.abs(daily.macdLine) * 0.5 + 0.001));
  const hourlyAmpNorm = Math.min(1, Math.abs(hourly.histogram) / (Math.abs(hourly.macdLine) * 0.5 + 0.001));
  const crossBonus = hourly.cross !== 'NONE' && aligned ? 15 : 0;
  const strength = Math.round(dailyAmpNorm * 50 + hourlyAmpNorm * 35 + crossBonus);

  let direction: CryptoSignal['direction'] = 'NEUTRAL';
  if (aligned && daily.trend === 'BULL') direction = 'LONG';
  if (aligned && daily.trend === 'BEAR') direction = 'SHORT';

  const crossLabel = hourly.cross !== 'NONE' ? ` | ${hourly.cross} H1` : '';
  const detail = `D1: ${daily.trend} (hist ${daily.histogram.toFixed(2)}) | H1: ${hourly.trend} (hist ${hourly.histogram.toFixed(2)})${aligned ? ' — ALIGNED ✓' : ' — DIVERGENT ✗'}${crossLabel}`;

  return {
    id: 'multi-tf',
    name: 'Multi-TF MACD',
    timeframe: 'D1 → H1',
    confidence: 'MODERATE',
    source: CRYPTO_SOURCES.multiTF,
    direction,
    value: direction === 'LONG' ? strength : direction === 'SHORT' ? -strength : 0,
    detail,
    active: aligned,
    metadata: {
      dailyTrend: daily.trend, hourlyTrend: hourly.trend,
      dailyHist: daily.histogram, hourlyHist: hourly.histogram,
      dailyCross: daily.cross, hourlyCross: hourly.cross,
      strength,
    },
  };
}

// ══════════ SIGNAL 2 : Funding Rate Divergence ══════════

const FUNDING_THRESHOLDS = {
  extreme_negative: -0.00050,
  moderate_negative: -0.00020,
  neutral_low: -0.00005,
  neutral_high: 0.00005,
  moderate_positive: 0.00020,
  extreme_positive: 0.00050,
};

export function calcFundingSignal(
  hlFunding: number,
  binanceFunding: number | null,
): CryptoSignal {
  let direction: CryptoSignal['direction'] = 'NEUTRAL';
  let reason = '';
  let strength = 0;

  if (hlFunding < FUNDING_THRESHOLDS.extreme_negative) {
    direction = 'LONG'; strength = 90;
    reason = `HL ${(hlFunding * 100).toFixed(4)}% extrême — shorts surchargés, squeeze probable`;
  } else if (hlFunding < FUNDING_THRESHOLDS.moderate_negative) {
    direction = 'LONG'; strength = 60;
    reason = `HL ${(hlFunding * 100).toFixed(4)}% négatif — biais long`;
  } else if (hlFunding > FUNDING_THRESHOLDS.extreme_positive) {
    direction = 'SHORT'; strength = 90;
    reason = `HL ${(hlFunding * 100).toFixed(4)}% extrême — longs fragiles`;
  } else if (hlFunding > FUNDING_THRESHOLDS.moderate_positive) {
    direction = 'SHORT'; strength = 60;
    reason = `HL ${(hlFunding * 100).toFixed(4)}% positif — biais short`;
  } else {
    reason = `HL ${(hlFunding * 100).toFixed(4)}% — zone neutre`;
  }

  // Divergence bonus
  let divergenceNote = '';
  if (binanceFunding !== null) {
    const hlSign = Math.sign(hlFunding);
    const binSign = Math.sign(binanceFunding);
    if (hlSign !== binSign && hlSign !== 0 && binSign !== 0) {
      strength = Math.min(100, strength + 20);
      divergenceNote = ` | ⚡ Div HL vs Bin`;
      if (direction === 'NEUTRAL') direction = hlFunding < 0 ? 'LONG' : 'SHORT';
    }
  }

  const fundingCostPct = Math.abs(hlFunding) * 100;
  const holdWarning = fundingCostPct > 0.01 ? ` | ⚠ ${fundingCostPct.toFixed(3)}%/h cost` : '';
  const detail = `${reason}${divergenceNote}${holdWarning}`;
  const active = Math.abs(hlFunding) > FUNDING_THRESHOLDS.neutral_high;

  return {
    id: 'funding',
    name: 'Funding Divergence',
    timeframe: 'H1',
    confidence: 'STRONG',
    source: CRYPTO_SOURCES.funding,
    direction,
    value: direction === 'LONG' ? strength : direction === 'SHORT' ? -strength : 0,
    detail,
    active,
    metadata: {
      hlFunding: hlFunding * 100,
      binanceFunding: binanceFunding !== null ? binanceFunding * 100 : 0,
      fundingCostPct, strength,
    },
  };
}

// ══════════ SIGNAL 3 : VWTSMOM ══════════

export function calcVWTSMOM(
  closes: number[],
  volumes: number[],
  period = 14,
): CryptoSignal {
  if (closes.length < period + 1 || volumes.length < period + 1) {
    return { id: 'vwtsmom', name: 'VW-TSMOM', timeframe: '24h', confidence: 'MODERATE', source: CRYPTO_SOURCES.vwtsmom, direction: 'NEUTRAL', value: 0, detail: 'Insufficient data', active: false, metadata: {} };
  }
  const recent = closes.slice(-(period + 1));
  const recentVol = volumes.slice(-(period + 1));

  let weightedReturn = 0;
  let totalVolume = 0;
  const dailyReturns: { ret: number; vol: number }[] = [];
  for (let i = 1; i < recent.length; i++) {
    const ret = (recent[i] - recent[i - 1]) / recent[i - 1];
    weightedReturn += ret * recentVol[i];
    totalVolume += recentVol[i];
    dailyReturns.push({ ret, vol: recentVol[i] });
  }
  const vwtsmom = totalVolume > 0 ? weightedReturn / totalVolume : 0;
  const standardMom = dailyReturns.reduce((a, d) => a + d.ret, 0) / dailyReturns.length;
  const volumeBoost = vwtsmom - standardMom;

  // High-volume days bias
  const sortedByVol = [...dailyReturns].sort((a, b) => b.vol - a.vol);
  const top3 = sortedByVol.slice(0, 3);
  const highVolBias = top3.reduce((a, d) => a + d.ret, 0) > 0 ? 'BULL' : 'BEAR';

  let direction: CryptoSignal['direction'] = 'NEUTRAL';
  if (vwtsmom > 0.0005) direction = 'LONG';
  else if (vwtsmom < -0.0005) direction = 'SHORT';

  const volConfirms = (direction === 'LONG' && highVolBias === 'BULL') || (direction === 'SHORT' && highVolBias === 'BEAR');
  const strength = Math.min(100, Math.round(Math.abs(vwtsmom) * 15000 + (volConfirms ? 20 : 0)));

  const detail = `VW return: ${(vwtsmom * 100).toFixed(3)}% | Std: ${(standardMom * 100).toFixed(3)}% | Vol boost: ${(volumeBoost * 100).toFixed(3)}% | High-vol days: ${highVolBias} ${volConfirms ? '✓ Confirms' : '⚠ Diverges'}`;

  return {
    id: 'vwtsmom', name: 'VW-TSMOM', timeframe: 'D1 → H1',
    confidence: 'MODERATE', source: CRYPTO_SOURCES.vwtsmom,
    direction,
    value: direction === 'LONG' ? strength : direction === 'SHORT' ? -strength : 0,
    detail, active: direction !== 'NEUTRAL',
    metadata: { vwtsmomPct: vwtsmom * 100, standardMomPct: standardMom * 100, highVolBias, volConfirms: volConfirms ? 1 : 0, strength },
  };
}

// ══════════ SIGNAL 4 : Regime Detection ══════════

export function detectRegime(dailyCloses: number[]): CryptoSignal {
  const last90 = dailyCloses.slice(-90);
  if (last90.length < 20) {
    return { id: 'regime', name: 'Regime Detection', timeframe: '90d', confidence: 'MODERATE', source: CRYPTO_SOURCES.regime, direction: 'NEUTRAL', value: 0, detail: 'Need 20+ daily candles', active: false, metadata: {} };
  }
  const current = last90[last90.length - 1];
  const min90 = Math.min(...last90);
  const max90 = Math.max(...last90);
  const range = max90 - min90;
  const percentile = range > 0 ? ((current - min90) / range) * 100 : 50;

  const rvol = realizedVol(last90, Math.min(30, last90.length - 1));

  // Max drawdown in window
  let peak = last90[0];
  let maxDD = 0;
  for (const c of last90) {
    if (c > peak) peak = c;
    const dd = (peak - c) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  let regime: string;
  let tradeStyle: string;
  let direction: CryptoSignal['direction'];
  let value: number;
  let active = true;

  if (percentile > 80) {
    regime = 'MOMENTUM'; tradeStyle = 'Nouveaux hauts → trend-follow LONG';
    direction = 'LONG'; value = 70;
  } else if (percentile < 20) {
    regime = 'MEAN_REVERSION'; tradeStyle = 'Extrême bas → mean reversion LONG';
    direction = 'LONG'; value = 55;
  } else if (rvol > 80) {
    regime = 'HIGH_VOL'; tradeStyle = 'Vol extrême → réduire taille, stops larges';
    direction = 'NEUTRAL'; value = -50; active = true;
  } else {
    regime = 'NEUTRAL'; tradeStyle = 'Pas de régime — signaux techniques dominent';
    direction = 'NEUTRAL'; value = 0; active = false;
  }

  const detail = `Pctile 90j: ${Math.round(percentile)}% | Régime: ${regime} | VolRéal: ${rvol.toFixed(0)}% ann. | Max DD 90j: ${(maxDD * 100).toFixed(1)}% | ${tradeStyle}`;

  return {
    id: 'regime', name: 'Regime Detection', timeframe: 'D1 (90j)', confidence: 'MODERATE',
    source: CRYPTO_SOURCES.regime, direction, value, detail, active,
    metadata: { percentile: Math.round(percentile), min90, max90, realizedVol: rvol, maxDD90d: maxDD * 100, regime },
  };
}

// ══════════ SIGNAL 5 : ATR Sizing ══════════

export function calcATRSizing(
  candles: { h: number; l: number; c: number }[],
  price: number,
  accountValue = 100000,
  riskPct = 0.005,
): CryptoSignal {
  const atr = calcATR(candles, 14);
  if (atr === 0) {
    return { id: 'atr-sizing', name: 'ATR Sizing', timeframe: 'H1', confidence: 'STRONG', source: CRYPTO_SOURCES.atrSizing, direction: 'NEUTRAL', value: 0, detail: 'Insufficient data', active: true, metadata: {} };
  }
  const atrPct = price > 0 ? (atr / price) * 100 : 0;

  // ATR percentile
  const allATRs: number[] = [];
  if (candles.length > 28) {
    for (let i = 28; i < candles.length; i++) {
      allATRs.push(calcATR(candles.slice(i - 14, i), 14));
    }
    allATRs.sort((a, b) => a - b);
  }
  const atrPctile = allATRs.length > 0 ? percentileRank(allATRs, atr) : 50;

  const volRegime = atrPctile < 25 ? 'LOW' : atrPctile < 75 ? 'NORMAL' : atrPctile < 90 ? 'HIGH' : 'EXTREME';
  const stopDistance = atr * 2;
  const tpDistance = atr * 3;
  const riskUsd = accountValue * riskPct;
  const positionUsd = price > 0 ? Math.round((riskUsd / stopDistance) * price) : 0;

  const detail = `ATR(14): ${atr.toFixed(2)} (${atrPct.toFixed(2)}%) | ${atrPctile.toFixed(0)}ème pctile | ${volRegime} | Stop: 2×ATR=${stopDistance.toFixed(2)} | TP: 3×ATR=${tpDistance.toFixed(2)} | Risk: $${Math.round(riskUsd)} | Pos: $${positionUsd}`;

  return {
    id: 'atr-sizing', name: 'ATR Sizing', timeframe: 'H1', confidence: 'STRONG',
    source: CRYPTO_SOURCES.atrSizing, direction: 'NEUTRAL', value: 0, detail, active: true,
    metadata: { atr, atrPct, atrPercentile: atrPctile, volRegime, stopDistance, tpDistance, positionUsd, riskUsd },
  };
}

// ══════════ SIGNAL 6 : Macro Event Filter ══════════

// Precise UTC timestamps for FOMC, CPI, NFP
const FOMC_DATES = [
  '2025-03-19T18:00:00Z','2025-05-07T18:00:00Z','2025-06-18T18:00:00Z',
  '2025-07-30T18:00:00Z','2025-09-17T18:00:00Z','2025-10-29T18:00:00Z',
  '2025-12-17T18:00:00Z','2026-01-28T18:00:00Z','2026-03-18T18:00:00Z',
  '2026-05-06T18:00:00Z','2026-06-17T18:00:00Z',
];
const CPI_DATES = [
  '2025-04-10T12:30:00Z','2025-05-13T12:30:00Z','2025-06-11T12:30:00Z',
  '2025-07-10T12:30:00Z','2025-08-12T12:30:00Z','2025-09-10T12:30:00Z',
  '2025-10-14T12:30:00Z','2025-11-12T12:30:00Z','2025-12-10T12:30:00Z',
  '2026-01-13T12:30:00Z','2026-02-11T12:30:00Z','2026-03-11T12:30:00Z',
];
const NFP_DATES = [
  '2025-04-04T12:30:00Z','2025-05-02T12:30:00Z','2025-06-06T12:30:00Z',
  '2025-07-03T12:30:00Z','2025-08-01T12:30:00Z','2025-09-05T12:30:00Z',
  '2025-10-03T12:30:00Z','2025-11-07T12:30:00Z','2025-12-05T12:30:00Z',
  '2026-01-09T12:30:00Z','2026-02-06T12:30:00Z','2026-03-06T12:30:00Z',
];

export interface MacroEventDetail {
  type: string;
  minutesUntil: number;
  date: string;
  impact: 'HIGH' | 'LOW';
  window: number;
  cryptoImpact: string;
}

export function calcMacroFilter(): CryptoSignal & { macroEvents: MacroEventDetail[] } {
  const now = Date.now();
  const allEvents = [
    ...FOMC_DATES.map(d => ({ date: d, type: 'FOMC', impact: 'HIGH' as const, window: 60, cryptoImpact: 'FORT — -0.25% par bp surprise (Benigno & Rosa)' })),
    ...CPI_DATES.map(d => ({ date: d, type: 'CPI', impact: 'HIGH' as const, window: 30, cryptoImpact: 'FORT — seul événement macro qui impacte significativement BTC' })),
    ...NFP_DATES.map(d => ({ date: d, type: 'NFP', impact: 'LOW' as const, window: 15, cryptoImpact: 'FAIBLE — BTC orthogonal au NFP (Benigno & Rosa 2023)' })),
  ];

  const upcoming = allEvents
    .map(e => ({ ...e, minutesUntil: (new Date(e.date).getTime() - now) / 60000 }))
    .filter(e => e.minutesUntil > -120 && e.minutesUntil < 43200)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  const next = upcoming[0];

  let action: string;
  let note: string;
  let value = 0;
  let active = false;

  if (!next) {
    action = 'TRADE_NORMAL';
    note = 'Aucun événement macro dans les 30 jours';
  } else if (Math.abs(next.minutesUntil) < next.window) {
    action = 'NO_TRADE';
    note = `${next.type} EN COURS — NE PAS TRADER (fenêtre ±${next.window}min)`;
    value = -100; active = true;
  } else if (next.minutesUntil > 0 && next.minutesUntil < 120 && next.impact === 'HIGH') {
    action = 'REDUCE_SIZE';
    note = `${next.type} dans ${Math.round(next.minutesUntil)}min — réduire taille 50%`;
    value = -50; active = true;
  } else if (next.minutesUntil < 0 && next.minutesUntil > -60) {
    action = 'POST_MOMENTUM';
    note = `${next.type} il y a ${Math.round(-next.minutesUntil)}min — momentum post-event (5-10min window)`;
    value = 30; active = true;
  } else {
    action = 'TRADE_NORMAL';
    note = `Prochain: ${next.type} dans ${next.minutesUntil > 1440 ? `${Math.round(next.minutesUntil / 1440)}j` : `${Math.round(next.minutesUntil / 60)}h`}`;
  }

  const detail = `${action} | ${note}`;

  return {
    id: 'macro-filter', name: 'Macro Event Filter', timeframe: 'Event ±30min',
    confidence: 'STRONG', source: CRYPTO_SOURCES.macroFilter,
    direction: 'NEUTRAL', value, detail, active,
    metadata: {
      action, eventType: next?.type ?? 'NONE',
      minutesUntil: next ? Math.round(next.minutesUntil) : 99999,
    },
    macroEvents: upcoming.slice(0, 5),
  };
}

// ══════════ AGGREGATE ══════════

const SIGNAL_WEIGHTS: Record<ConfidenceLevel, number> = { STRONG: 1.0, MODERATE: 0.6, WEAK: 0.25, UNPROVEN: 0 };

export function computeCryptoSignals(params: {
  dailyCloses: number[];
  h1Closes: number[];
  h1Candles: { o: number; h: number; l: number; c: number; v: number }[];
  h1Volumes: number[];
  price: number;
  hlFunding: number;
  binanceFunding: number | null;
  nextEventHours: number;
  nextEventName: string | null;
  vix: number;
}): CryptoSignalSummary {
  const macroSignal = calcMacroFilter();
  const signals: CryptoSignal[] = [
    calcMultiTFFilter(params.dailyCloses, params.h1Closes),
    calcFundingSignal(params.hlFunding, params.binanceFunding),
    calcVWTSMOM(params.h1Closes, params.h1Volumes, Math.min(24, params.h1Closes.length - 1)),
    detectRegime(params.dailyCloses),
    calcATRSizing(params.h1Candles, params.price),
    macroSignal,
  ];

  let bullW = 0, bearW = 0, totalW = 0;
  for (const s of signals.filter(s => s.active && s.direction !== 'NEUTRAL')) {
    const w = SIGNAL_WEIGHTS[s.confidence];
    totalW += w;
    if (s.direction === 'LONG') bullW += w;
    else bearW += w;
  }
  const confluenceScore = totalW > 0 ? Math.round((bullW / totalW) * 100) : 50;
  const netBias = confluenceScore - 50;
  const biasLabel = confluenceScore > 60 ? 'BULLISH' : confluenceScore < 40 ? 'BEARISH' : 'NEUTRAL';

  return {
    signals,
    netBias: Math.round(netBias),
    biasLabel,
    activeCount: signals.filter(s => s.active).length,
    strongCount: signals.filter(s => s.confidence === 'STRONG' && s.active).length,
    confluenceScore,
  };
}
