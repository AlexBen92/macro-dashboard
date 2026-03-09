import type { FlowEdge } from './types';

export const FTMO_ACCOUNT = 100_000;
export const DEFAULT_RISK_PCT = 0.5;

export const PIP_VALUES: Record<string, number> = {
  XAUUSD: 100,    // $100 per $1 move per 1.0 lot (Gold)
  EURUSD: 10,
  GBPUSD: 10,
  USDJPY: 7.5,
  USDCHF: 10.5,
  AUDUSD: 10,
  USDCAD: 7.5,
  EURGBP: 12.5,
  NAS100: 1,      // $1 per point per 0.01 lot
  US30: 1,
  CL: 10,
};

// Yahoo symbols for each instrument
export const YAHOO_SYMBOLS: Record<string, string> = {
  XAUUSD: 'GC=F',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'USDJPY=X',
  USDCHF: 'USDCHF=X',
  AUDUSD: 'AUDUSD=X',
  USDCAD: 'USDCAD=X',
  EURGBP: 'EURGBP=X',
  NAS100: 'NQ=F',
  US30: 'YM=F',
  OIL: 'CL=F',
  BRENT: 'BZ=F',
  DXY: 'DX-Y.NYB',
  VIX: '%5EVIX',
  '10Y': '%5ETNX',
  SPX: '%5EGSPC',
};

// Flow Map node positions (centered layout, DXY in center)
// SVG viewport: 600 x 400
export const FLOW_NODE_POSITIONS: Record<string, { x: number; y: number; size: number }> = {
  DXY:    { x: 300, y: 200, size: 28 },
  VIX:    { x: 480, y: 340, size: 20 },
  '10Y':  { x: 300, y: 50,  size: 20 },
  GOLD:   { x: 300, y: 350, size: 24 },
  OIL:    { x: 480, y: 140, size: 20 },
  EURUSD: { x: 140, y: 300, size: 22 },
  GBPUSD: { x: 80,  y: 180, size: 22 },
  USDJPY: { x: 460, y: 60,  size: 22 },
  USDCHF: { x: 500, y: 230, size: 18 },
  AUDUSD: { x: 160, y: 120, size: 18 },
  USDCAD: { x: 120, y: 50,  size: 18 },
};

export const BASE_CORRELATIONS: Omit<FlowEdge, 'isActive' | 'strength'>[] = [
  // DXY pivot
  { from: 'DXY', to: 'GOLD',   correlation: -0.72, causalDirection: 'negative', lagMinutes: 15 },
  { from: 'DXY', to: 'EURUSD', correlation: -0.95, causalDirection: 'negative', lagMinutes: 2 },
  { from: 'DXY', to: 'GBPUSD', correlation: -0.88, causalDirection: 'negative', lagMinutes: 5 },
  { from: 'DXY', to: 'USDJPY', correlation: 0.62,  causalDirection: 'positive', lagMinutes: 10 },
  { from: 'DXY', to: 'USDCHF', correlation: 0.85,  causalDirection: 'positive', lagMinutes: 5 },
  { from: 'DXY', to: 'OIL',    correlation: -0.25, causalDirection: 'negative', lagMinutes: 30 },
  // VIX = risk
  { from: 'VIX', to: 'GOLD',   correlation: 0.35,  causalDirection: 'positive', lagMinutes: 10 },
  { from: 'VIX', to: 'USDJPY', correlation: -0.40, causalDirection: 'negative', lagMinutes: 15 },
  { from: 'VIX', to: 'OIL',    correlation: -0.30, causalDirection: 'negative', lagMinutes: 20 },
  // Yields
  { from: '10Y', to: 'DXY',    correlation: 0.55,  causalDirection: 'positive', lagMinutes: 5 },
  { from: '10Y', to: 'GOLD',   correlation: -0.45, causalDirection: 'negative', lagMinutes: 20 },
  { from: '10Y', to: 'USDJPY', correlation: 0.60,  causalDirection: 'positive', lagMinutes: 10 },
  // Cross-forex
  { from: 'EURUSD', to: 'GBPUSD', correlation: 0.82, causalDirection: 'positive', lagMinutes: 2 },
  // Oil
  { from: 'OIL', to: 'USDCAD', correlation: -0.50, causalDirection: 'negative', lagMinutes: 15 },
];

export const SESSIONS = [
  { name: 'Tokyo',      start: 0,    end: 9,    color: '#ff8800' },
  { name: 'London',     start: 7,    end: 16,   color: '#4488ff' },
  { name: 'New York',   start: 13,   end: 22,   color: '#4ade80' },
  { name: 'Overlap L/NY', start: 13, end: 16,   color: '#00e5ff' },
] as const;

export const STRATEGY_WINDOWS = [
  { name: 'Gold Asian Range', start: 22, end: 12, color: '#d4a017', formation: { start: 22, end: 7 } },
  { name: 'Gold Scalp',       start: 13, end: 16.5, color: '#ffaa00' },
  { name: 'London BO',        start: 7,  end: 12, color: '#2980b9', formation: { start: 0, end: 7 } },
  { name: 'Mean Rev H4',      start: 0,  end: 24, color: '#aa66ff' },
  { name: 'ORB Indices',      start: 14.5, end: 16.5, color: '#4ade80', formation: { start: 14.5, end: 14.75 } },
] as const;

export const MACRO_EVENTS = [
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
  {d:'2026-09-16',n:'FOMC'},{d:'2026-10-28',n:'FOMC'},{d:'2026-12-16',n:'FOMC'},
];
