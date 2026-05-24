import type { MacroEvent } from './types';

export const ASSETS = ['BTC', 'ETH', 'SOL', 'BNB'] as const;

export const TOP_COINS = [
  'BTC','ETH','SOL','BNB','DOGE','AVAX','SUI','ARB','OP','LINK',
  'WIF','PEPE','INJ','TIA','SEI','JUP','NEAR','APT','HYPE','PENDLE'
] as const;

export const WEIGHTS: Record<string, number> = {
  btc_24h: .10, btc_7d: .05, eth_btc: .05, vol: .05, dom: .05,
  fund_div: .08, fund_ext: .07, oi: .05, ls: .05, whale: .05,
  fg: .08, fg_trend: .04, macro: .03, dxy: .03, vix: .02, cbbi: .05,
};

export const MACRO_EVENTS: MacroEvent[] = [
  {d:'2025-03-19',n:'FOMC'},{d:'2025-04-04',n:'NFP'},{d:'2025-04-10',n:'CPI'},
  {d:'2025-05-02',n:'NFP'},{d:'2025-05-07',n:'FOMC'},{d:'2025-05-13',n:'CPI'},{d:'2025-06-06',n:'NFP'},
  {d:'2025-06-11',n:'CPI'},{d:'2025-06-18',n:'FOMC'},{d:'2025-07-03',n:'NFP'},{d:'2025-07-10',n:'CPI'},
  {d:'2025-07-30',n:'FOMC'},{d:'2025-08-01',n:'NFP'},{d:'2025-08-12',n:'CPI'},{d:'2025-09-05',n:'NFP'},
  {d:'2025-09-10',n:'CPI'},{d:'2025-09-17',n:'FOMC'},{d:'2025-10-03',n:'NFP'},{d:'2025-10-14',n:'CPI'},
  {d:'2025-10-29',n:'FOMC'},{d:'2025-11-07',n:'NFP'},{d:'2025-11-12',n:'CPI'},{d:'2025-12-05',n:'NFP'},
  {d:'2025-12-10',n:'FOMC/CPI'},{d:'2026-01-09',n:'NFP'},{d:'2026-01-13',n:'CPI'},{d:'2026-01-28',n:'FOMC'},
  {d:'2026-02-06',n:'NFP'},{d:'2026-02-11',n:'CPI'},{d:'2026-03-06',n:'NFP'},{d:'2026-03-11',n:'CPI'},
  {d:'2026-03-18',n:'FOMC'},{d:'2026-04-03',n:'NFP'},{d:'2026-04-14',n:'CPI'},{d:'2026-04-29',n:'FOMC'},
  {d:'2026-05-12',n:'CPI'},{d:'2026-06-10',n:'CPI'},{d:'2026-06-17',n:'FOMC'},{d:'2026-07-29',n:'FOMC'},
  {d:'2026-09-16',n:'FOMC'},{d:'2026-10-28',n:'FOMC'},{d:'2026-12-16',n:'FOMC'}
];

export const SESSIONS = [
  { s: 8, e: 10, n: 'London', good: true },
  { s: 13.5, e: 16, n: 'NY Overlap', good: true },
  { s: 20, e: 22, n: 'Crypto', good: true },
  { s: 5, e: 7, n: 'Dead zone', good: false },
  { s: 12, e: 13.5, n: 'Lunch gap', good: false },
];

export const COLORS = {
  bg: '#08080f',
  bgCard: '#0d0d1a',
  bgHover: '#12122a',
  border: '#1a1a30',
  border2: '#252540',
  cyan: '#00e5ff',
  magenta: '#ff006e',
  green: '#4ade80',
  red: '#ff3355',
  yellow: '#ffaa00',
  orange: '#ff8800',
  blue: '#4488ff',
  purple: '#aa66ff',
  text: '#e8e8f0',
  dim: '#a0a0b8',
  muted: '#556680',
} as const;

export const REFRESH_MS = 60000;
export const WHALE_REFRESH_MS = 600000;
export const WS_REFRESH_MS = 120000;

// Volatility windows for intraday trading (UTC hours)
export const VOL_WINDOWS_UTC = [
  { name: 'Asia Open', start: 0, end: 6, score: 0.40 },
  { name: 'EU Open', start: 6, end: 9, score: 0.70 },
  { name: 'EU Peak', start: 9, end: 12, score: 0.85 },
  { name: 'EU/US Overlap', start: 12, end: 17, score: 1.00 },
  { name: 'US Afternoon', start: 17, end: 21, score: 0.75 },
  { name: 'Crypto Night', start: 21, end: 24, score: 0.50 },
] as const;

// Score weights for trade sheet calculation
export const SCORE_WEIGHTS = {
  funding_rate: 0.25,
  open_interest: 0.20,
  volume_24h: 0.15,
  whale_activity: 0.15,
  volatility: 0.15,
  edge_vs_fees: 0.10,
} as const;

// Bias color mapping
export const BIAS_COLOR = {
  LONG: '#00ff88',
  SHORT: '#ff4466',
  NEUTRAL: '#ffcc00',
} as const;

// Tier label function
export const TIER_LABEL = (score: number): string => {
  if (score >= 75) return 'S-TIER';
  if (score >= 65) return 'A-TIER';
  if (score >= 50) return 'B-TIER';
  if (score >= 35) return 'C-TIER';
  return 'D-TIER';
};
