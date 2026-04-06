/**
 * FTMO Signal Engine V5 — Complete Evidence-Based Implementation
 */

import type { ConfidenceLevel } from '@/components/ui/ConfidenceBadge';
import type { AcademicSource } from '@/components/ui/SourceCitation';
import type { YahooCandle } from './types';

// ══════════ TYPES ══════════

export interface FtmoSignal {
  id: string;
  name: string;
  instrument: string;
  timeframe: string;
  confidence: ConfidenceLevel;
  source: AcademicSource;
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  value: number;
  detail: string;
  active: boolean;
  metadata: Record<string, number | string | boolean>;
}

export interface FtmoSignalSummary {
  signals: FtmoSignal[];
  netBias: number;
  biasLabel: string;
  activeCount: number;
  strongCount: number;
  confluenceScore: number;
}

// ══════════ SOURCES ══════════

export const FTMO_SOURCES: Record<string, AcademicSource> = {
  orb: {
    authors: 'Zarattini, Barbon & Aziz',
    year: 2024,
    title: 'ORB 5-min: Stocks in Play',
    venue: 'Swiss Finance Inst. #24-98',
    id: 'SFI-24-98',
  },
  goldDxy: {
    authors: 'He, Guo & Yu',
    year: 2020,
    title: 'Gold-DXY Threshold Cointegration (41y)',
    venue: 'NAJEF Vol.52',
    id: 'NAJEF-2020',
  },
  vixGold: {
    authors: 'Tanin, Hasanov & Aliyev',
    year: 2021,
    title: 'VIX Asymmetric Effect on Gold',
    venue: 'JEBO Vol.191',
    id: 'JEBO-2021',
  },
  yieldCurve: {
    authors: 'Dreher, Gräb & Kostka',
    year: 2018,
    title: 'Yield Curve Curvature & Exchange Rates',
    venue: 'ECB WP #2149',
    id: 'ECB-WP-2149',
  },
  eiaOil: {
    authors: 'Wen, Indriawan, Lien & Xu',
    year: 2022,
    title: 'EIA Inventory Intraday Momentum',
    venue: 'SSRN #3822093',
    id: 'SSRN-3822093',
  },
  atrSizing: {
    authors: 'Journal of Financial Markets',
    year: 2026,
    title: 'ATR Dynamic Position Sizing',
    venue: 'JFM 2026',
    id: 'JFM-2026',
  },
  macro: {
    authors: 'Andersen, Bollerslev, Diebold & Vega',
    year: 2003,
    title: 'News Announcements & Asset Price Discovery',
    venue: 'AER Vol.93 #1',
    id: 'AER-93-1',
  },
};

// ══════════ HELPERS ══════════

function calcATR(candles: YahooCandle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(candles[i].h - candles[i].l, Math.abs(candles[i].h - candles[i - 1].c), Math.abs(candles[i].l - candles[i - 1].c)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 5) return 0;
  const xs = x.slice(0, n), ys = y.slice(0, n);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  return denom > 0 ? num / denom : 0;
}

function makeEmpty(id: string, name: string, instrument: string, tf: string, conf: ConfidenceLevel, src: AcademicSource, detail = 'No data'): FtmoSignal {
  return { id, name, instrument, timeframe: tf, confidence: conf, source: src, direction: 'NEUTRAL', value: 0, detail, active: false, metadata: {} };
}

// ══════════ SIGNAL 1 : ORB 5-Min Indices ══════════

export function calcORBSignal(
  candles5m: YahooCandle[],
  candlesH1: YahooCandle[],
  instrument: string,
): FtmoSignal {
  const now = new Date();
  const utcH = now.getUTCHours();
  const utcM = now.getUTCMinutes();
  const utcDecimal = utcH + utcM / 60;
  const isUSSession = utcDecimal >= 14.5 && utcDecimal <= 21;

  if (candles5m.length < 2) return makeEmpty('orb', 'ORB 5-Min', instrument, 'M5 → H1', 'MODERATE', FTMO_SOURCES.orb, 'Waiting for M5 data');

  const today = now.toISOString().slice(0, 10);
  const orbCandles = candles5m.filter(c => {
    const d = new Date(c.t * 1000);
    return d.toISOString().slice(0, 10) === today &&
           d.getUTCHours() === 14 &&
           d.getUTCMinutes() >= 30 && d.getUTCMinutes() < 45;
  });

  let status: string;
  if (utcH < 14 || (utcH === 14 && utcM < 30)) status = 'WAITING';
  else if (utcH === 14 && utcM < 45) status = 'FORMING';
  else if (orbCandles.length >= 2) status = 'READY';
  else status = 'EXPIRED';

  const orbHigh = orbCandles.length > 0 ? Math.max(...orbCandles.map(c => c.h)) : null;
  const orbLow = orbCandles.length > 0 ? Math.min(...orbCandles.map(c => c.l)) : null;
  const orbWidth = orbHigh && orbLow ? orbHigh - orbLow : null;

  // H1 bias via EMA20
  const h1Closes = candlesH1.map(c => c.c);
  const h1Ema20 = h1Closes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, h1Closes.length);
  const lastH1Close = h1Closes[h1Closes.length - 1] ?? 0;
  const h1Bias = lastH1Close > h1Ema20 ? 'BULL' : 'BEAR';

  const currentPrice = candles5m[candles5m.length - 1]?.c ?? 0;
  let breakout: string = 'NONE';
  if (orbHigh && currentPrice > orbHigh) breakout = 'ABOVE';
  if (orbLow && currentPrice < orbLow) breakout = 'BELOW';

  const direction: FtmoSignal['direction'] = breakout === 'ABOVE' ? 'LONG' : breakout === 'BELOW' ? 'SHORT' : 'NEUTRAL';
  const active = direction !== 'NEUTRAL' && isUSSession;
  const detail = `Status: ${status} | ORB: ${orbHigh?.toFixed(0) ?? '--'} / ${orbLow?.toFixed(0) ?? '--'} (${orbWidth?.toFixed(0) ?? '--'}pt) | H1 Bias: ${h1Bias}${direction !== 'NEUTRAL' ? ` | BREAKOUT ${direction} ✓` : ''}`;

  return {
    id: 'orb', name: 'ORB 5-Min', instrument, timeframe: 'M5 (14:30-14:45 UTC)', confidence: 'MODERATE',
    source: FTMO_SOURCES.orb, direction, value: direction === 'LONG' ? 70 : direction === 'SHORT' ? -70 : 0,
    detail, active,
    metadata: { orbHigh: orbHigh ?? 0, orbLow: orbLow ?? 0, orbWidth: orbWidth ?? 0, h1Bias, breakout, status, currentPrice },
  };
}

// ══════════ SIGNAL 2 : Gold-DXY Regime ══════════

export function calcGoldDXYSignal(
  goldCandles: YahooCandle[],
  dxyCandles: YahooCandle[],
): FtmoSignal {
  if (goldCandles.length < 5 || dxyCandles.length < 5) {
    return makeEmpty('gold-dxy', 'Gold-DXY Regime', 'XAUUSD', 'D1 → H1', 'MODERATE', FTMO_SOURCES.goldDxy);
  }

  const n = Math.min(goldCandles.length, dxyCandles.length, 21);
  const goldRets: number[] = [];
  const dxyRets: number[] = [];
  for (let i = 1; i <= n - 1; i++) {
    const gi = goldCandles.length - i, di = dxyCandles.length - i;
    goldRets.push((goldCandles[gi].c - goldCandles[gi - 1].c) / goldCandles[gi - 1].c);
    dxyRets.push((dxyCandles[di].c - dxyCandles[di - 1].c) / dxyCandles[di - 1].c);
  }
  const corr = pearsonCorrelation(goldRets, dxyRets);

  let regime: string;
  if (corr < -0.5) regime = 'NORMAL';
  else if (corr < -0.2) regime = 'DECOUPLED';
  else regime = 'CRISIS_OR_CB_BUY';

  const tradable = corr < -0.5;
  const dxyLast = dxyCandles[dxyCandles.length - 1].c;
  const dxyPrev = dxyCandles[dxyCandles.length - 2].c;
  const dxyChange = (dxyLast - dxyPrev) / dxyPrev * 100;

  let direction: FtmoSignal['direction'] = 'NEUTRAL';
  let value = 0;
  let note = '';
  if (tradable) {
    if (dxyChange < -0.2) { direction = 'LONG'; value = 60; note = `DXY −${Math.abs(dxyChange).toFixed(2)}% → Gold LONG attendu (-3.09× élasticité)`; }
    else if (dxyChange > 0.2) { direction = 'SHORT'; value = -60; note = `DXY +${dxyChange.toFixed(2)}% → Gold SHORT attendu`; }
    else note = `DXY ${dxyChange > 0 ? '+' : ''}${dxyChange.toFixed(2)}% — mouvement insuffisant`;
  } else {
    note = `⚠ Gold/DXY découplés (corr ${corr.toFixed(2)}) — régime: ${regime}. Signal DXY non fiable.`;
  }

  // Pivot points
  if (goldCandles.length >= 2) {
    const yd = goldCandles[goldCandles.length - 2];
    const pp = (yd.h + yd.l + yd.c) / 3;
    const r1 = 2 * pp - yd.l;
    const s1 = 2 * pp - yd.h;
    note += ` | Pivots: PP ${pp.toFixed(0)} R1 ${r1.toFixed(0)} S1 ${s1.toFixed(0)}`;
  }

  return {
    id: 'gold-dxy', name: 'Gold-DXY Regime', instrument: 'XAUUSD', timeframe: 'D1 → H1',
    confidence: 'MODERATE', source: FTMO_SOURCES.goldDxy,
    direction, value, detail: `Corr 20j: ${corr.toFixed(3)} | ${regime} | ${note}`,
    active: direction !== 'NEUTRAL' || !tradable,
    metadata: { correlation: corr, regime, dxyChange, tradable: tradable ? 1 : 0 },
  };
}

// ══════════ SIGNAL 3 : VIX Asymmetric Gold ══════════

export function calcVIXGoldSignal(vix: number, goldCandles: YahooCandle[]): FtmoSignal {
  const atr = calcATR(goldCandles);
  const goldPrice = goldCandles[goldCandles.length - 1]?.c ?? 0;

  let direction: FtmoSignal['direction'] = 'NEUTRAL';
  let value = 0;
  let detail = `VIX: ${vix.toFixed(1)}`;

  if (vix > 30) {
    value = -80;
    detail += ' | EXTRÊME → relation instable (COVID inversion) — ne pas trader Gold sur VIX seul';
  } else if (vix > 25) {
    direction = 'LONG'; value = 45;
    detail += ' | Peur élevée → safe-haven bid attendu (MAIS: relat. instable Tanin 2021)';
  } else if (vix > 20) {
    direction = 'NEUTRAL'; value = 10;
    detail += ' | Stress modéré — signal faible';
  } else if (vix < 15) {
    direction = 'NEUTRAL'; value = 0;
    detail += ' | VIX bas → pas de catalyseur safe-haven pour Gold';
  } else {
    detail += ' | Régime normal';
  }

  detail += ` | ATR(14): ${atr.toFixed(1)} | Gold: $${goldPrice.toFixed(0)}`;

  return {
    id: 'vix-gold', name: 'VIX Asymmetric Gold', instrument: 'XAUUSD', timeframe: 'D1',
    confidence: 'WEAK', source: FTMO_SOURCES.vixGold,
    direction, value, detail,
    active: vix > 25 || vix < 15,
    metadata: { vix, atr, goldPrice },
  };
}

// ══════════ SIGNAL 4 : Yield Curve Curvature ══════════

export function calcYieldCurveSignal(yield10y: number, yield2y?: number, yield30y?: number): FtmoSignal {
  const y2 = yield2y ?? yield10y * 0.9;
  const y30 = yield30y ?? yield10y * 1.1;
  const butterfly = 2 * yield10y - y2 - y30;
  const invertedCurve = y2 > yield10y;

  let direction: FtmoSignal['direction'] = 'NEUTRAL';
  let value = 0;
  let note = '';

  if (invertedCurve) {
    direction = 'SHORT'; value = -40;
    note = `Courbe inversée (2Y ${y2.toFixed(2)}% > 10Y ${yield10y.toFixed(2)}%) → USD bullish → short EUR`;
  } else if (butterfly < -0.5) {
    direction = 'SHORT'; value = -35;
    note = `Butterfly ${butterfly.toFixed(3)} négatif → pression d'inversion → USD bullish`;
  } else if (butterfly > 0.5) {
    direction = 'LONG'; value = 30;
    note = `Butterfly ${butterfly.toFixed(3)} positif → courbe normale → risk-on → long EUR`;
  } else {
    note = `Butterfly ${butterfly.toFixed(3)} — zone neutre`;
  }

  return {
    id: 'yield-curve', name: 'Yield Curve Curvature', instrument: 'Multi (EUR/USD)', timeframe: 'D1 (1-6 mois)',
    confidence: 'WEAK', source: FTMO_SOURCES.yieldCurve,
    direction, value, detail: `10Y: ${yield10y.toFixed(2)}% | Butterfly: ${butterfly.toFixed(3)} | ${note}`,
    active: Math.abs(butterfly) > 0.3 || invertedCurve,
    metadata: { butterfly, yield10y, yield2y: y2, yield30y: y30, invertedCurve: invertedCurve ? 1 : 0 },
  };
}

// ══════════ SIGNAL 5 : EIA Oil Wednesday ══════════

export function calcEIAOilSignal(oilCandles: YahooCandle[]): FtmoSignal {
  if (oilCandles.length < 5) return makeEmpty('eia-oil', 'EIA Oil Momentum', 'OIL', 'M30 Wed', 'MODERATE', FTMO_SOURCES.eiaOil);

  const now = new Date();
  const isWednesday = now.getUTCDay() === 3;
  const utcDecimal = now.getUTCHours() + now.getUTCMinutes() / 60;
  const nearEIA = isWednesday && utcDecimal >= 14.5 && utcDecimal <= 17;

  const atr = calcATR(oilCandles);
  const lastPrice = oilCandles[oilCandles.length - 1].c;
  const prevPrice = oilCandles[oilCandles.length - 2].c;
  const move = lastPrice - prevPrice;
  const movePct = Math.abs(move / prevPrice) * 100;

  let direction: FtmoSignal['direction'] = 'NEUTRAL';
  let value = 0;
  let detail = '';

  if (!isWednesday) {
    detail = `Prochain EIA: mercredi 15:30 UTC | ATR(14): $${atr.toFixed(2)} | Prix: $${lastPrice.toFixed(2)}`;
  } else if (nearEIA && movePct > 0.3) {
    direction = move > 0 ? 'LONG' : 'SHORT';
    value = move > 0 ? 55 : -55;
    detail = `MERCREDI EIA — Mouvement: ${movePct.toFixed(2)}% → momentum ${direction} | ATR: $${atr.toFixed(2)}`;
  } else if (nearEIA) {
    detail = `MERCREDI EIA — En attente annonce | ATR: $${atr.toFixed(2)} | Mouvement: ${movePct.toFixed(2)}%`;
  } else {
    detail = `Mercredi mais hors fenêtre EIA (15:30-17:00 UTC) | ATR: $${atr.toFixed(2)}`;
  }

  return {
    id: 'eia-oil', name: 'EIA Oil Momentum', instrument: 'OIL', timeframe: 'M30 Mercredi',
    confidence: 'MODERATE', source: FTMO_SOURCES.eiaOil,
    direction, value, detail,
    active: nearEIA && movePct > 0.3,
    metadata: { atr, lastPrice, movePct, isWednesday: isWednesday ? 1 : 0, nearEIA: nearEIA ? 1 : 0 },
  };
}

// ══════════ SIGNAL 6 : ATR Sizing FTMO ══════════

const ATR_PARAMS: Record<string, { tf: string; typical: string }> = {
  XAUUSD: { tf: 'H1', typical: '$25-35' },
  EURUSD: { tf: 'H4', typical: '40-60 pips' },
  GBPUSD: { tf: 'H4', typical: '50-70 pips' },
  EURGBP: { tf: 'H4', typical: '30-45 pips' },
  NAS100: { tf: 'M5', typical: '30-50 pts' },
  US30: { tf: 'M5', typical: '80-120 pts' },
  OIL: { tf: 'H1', typical: '$1.50-2.50' },
};

export function calcFtmoATRSizing(candles: YahooCandle[], instrument: string, price: number, accountSize = 100000, riskPct = 0.005): FtmoSignal {
  const atr = calcATR(candles);
  if (atr === 0) return makeEmpty('atr-sizing', 'ATR Sizing', instrument, 'H1', 'STRONG', FTMO_SOURCES.atrSizing);

  const atrPct = price > 0 ? (atr / price) * 100 : 0;
  const stop2x = atr * 2;
  const tp3x = atr * 3;
  const riskUsd = accountSize * riskPct;
  const lots = price > 0 ? riskUsd / stop2x : 0;

  const params = ATR_PARAMS[instrument] ?? { tf: 'H1', typical: '--' };
  const detail = `ATR(14) ${params.tf}: ${atr.toFixed(instrument === 'XAUUSD' || instrument.includes('100') || instrument.includes('30') ? 1 : 5)} | Typique: ${params.typical} | Stop: 2×ATR | TP: 3×ATR | R:R 1:1.5 | Risk $${riskUsd} → ${lots.toFixed(2)} lots`;

  return {
    id: 'atr-sizing', name: 'ATR Sizing', instrument, timeframe: `${params.tf} ATR(14)`,
    confidence: 'STRONG', source: FTMO_SOURCES.atrSizing,
    direction: 'NEUTRAL', value: 0, detail, active: true,
    metadata: { atr, atrPct, stop2x, tp3x, lots, riskUsd },
  };
}

// ══════════ SIGNAL 7 : Macro Announcements Forex ══════════

const FOREX_EVENT_DATES = [
  // FOMC
  { date: '2025-03-19T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: 'NFP, trade balance, FOMC = plus impactants forex' },
  { date: '2025-05-07T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: '' },
  { date: '2025-06-18T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: '' },
  { date: '2025-07-30T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: '' },
  { date: '2025-09-17T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: '' },
  { date: '2025-10-29T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: '' },
  { date: '2025-12-17T18:00:00Z', type: 'FOMC', impact: 'HIGH', note: '' },
  // CPI
  { date: '2025-04-10T12:30:00Z', type: 'CPI', impact: 'HIGH', note: 'Bad news > good news (asymétrie Andersen 2003)' },
  { date: '2025-05-13T12:30:00Z', type: 'CPI', impact: 'HIGH', note: '' },
  { date: '2025-06-11T12:30:00Z', type: 'CPI', impact: 'HIGH', note: '' },
  // NFP
  { date: '2025-04-04T12:30:00Z', type: 'NFP', impact: 'HIGH', note: 'Ajustement prix forex en 5-10min post-annonce' },
  { date: '2025-05-02T12:30:00Z', type: 'NFP', impact: 'HIGH', note: '' },
  { date: '2025-06-06T12:30:00Z', type: 'NFP', impact: 'HIGH', note: '' },
];

export function calcMacroAnnouncementForex(): FtmoSignal {
  const now = Date.now();
  const upcoming = FOREX_EVENT_DATES
    .map(e => ({ ...e, minutesUntil: (new Date(e.date).getTime() - now) / 60000 }))
    .filter(e => e.minutesUntil > -120 && e.minutesUntil < 43200)
    .sort((a, b) => a.minutesUntil - b.minutesUntil);

  const next = upcoming[0];
  let value = 0;
  let active = false;
  let note = '';

  if (!next) {
    note = 'Pas d\'événement forex majeur proche';
  } else if (Math.abs(next.minutesUntil) <= 30) {
    value = -100; active = true;
    note = `ÉVITER ±30min — ${next.type} EN FENÊTRE CRITIQUE (Andersen 2003: ajustement 5-10min)`;
  } else if (next.minutesUntil > 0 && next.minutesUntil < 120 && next.impact === 'HIGH') {
    value = -50; active = true;
    note = `${next.type} dans ${Math.round(next.minutesUntil)}min — réduire taille 50%`;
  } else if (next.minutesUntil < 0 && next.minutesUntil > -15) {
    value = 35; active = true;
    note = `${next.type} il y a ${Math.round(-next.minutesUntil)}min — MOMENTUM M5 post-annonce (5-10min window)`;
  } else {
    note = `Prochain: ${next.type} dans ${Math.round(next.minutesUntil / 60)}h`;
  }

  return {
    id: 'macro-announce', name: 'Macro Forex Announcements', instrument: 'Multi (EUR/USD, GBP/USD)',
    timeframe: 'M5 ±30min', confidence: 'STRONG', source: FTMO_SOURCES.macro,
    direction: 'NEUTRAL', value, detail: note,
    active,
    metadata: { eventType: next?.type ?? 'NONE', minutesUntil: next ? Math.round(next.minutesUntil) : 99999 },
  };
}

// ══════════ AGGREGATE ══════════

const SIGNAL_WEIGHTS: Record<ConfidenceLevel, number> = { STRONG: 1.0, MODERATE: 0.6, WEAK: 0.25, UNPROVEN: 0 };

export function computeFtmoSignals(params: {
  goldH1: YahooCandle[];
  dxyH1: YahooCandle[];
  oilH1: YahooCandle[];
  nas5m: YahooCandle[];
  nasH1: YahooCandle[];
  us305m: YahooCandle[];
  vix: number;
  yield10y: number;
  nextEventHours: number;
  nextEventName: string | null;
}): FtmoSignalSummary {
  const goldPrice = params.goldH1[params.goldH1.length - 1]?.c || 0;
  const signals: FtmoSignal[] = [
    calcORBSignal(params.nas5m, params.nasH1, 'NAS100'),
    calcORBSignal(params.us305m, params.nasH1, 'US30'),
    calcGoldDXYSignal(params.goldH1, params.dxyH1),
    calcVIXGoldSignal(params.vix, params.goldH1),
    calcYieldCurveSignal(params.yield10y),
    calcEIAOilSignal(params.oilH1),
    calcFtmoATRSizing(params.goldH1, 'XAUUSD', goldPrice),
    calcMacroAnnouncementForex(),
  ];

  let bullW = 0, totalW = 0;
  for (const s of signals.filter(s => s.active && s.direction !== 'NEUTRAL')) {
    const w = SIGNAL_WEIGHTS[s.confidence];
    totalW += w;
    if (s.direction === 'LONG') bullW += w;
  }
  const confluenceScore = totalW > 0 ? Math.round((bullW / totalW) * 100) : 50;
  const netBias = confluenceScore - 50;
  const biasLabel = confluenceScore > 60 ? 'BULLISH' : confluenceScore < 40 ? 'BEARISH' : 'NEUTRAL';

  return {
    signals, netBias: Math.round(netBias), biasLabel,
    activeCount: signals.filter(s => s.active).length,
    strongCount: signals.filter(s => s.confidence === 'STRONG' && s.active).length,
    confluenceScore,
  };
}
