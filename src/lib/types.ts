export interface PriceData {
  p: number;
  ch: number;
  mc: number;
  vol?: number;
  btc?: number;
}

export interface MarketData {
  fng?: { v: number; c: string };
  fngH?: number[];
  prices?: Record<string, PriceData>;
  eurUsd?: number | null;
  global?: { mc: number; mcChg: number; dom: number };
  bFund: Record<string, number>;
  bMark: Record<string, number>;
  bOI: Record<string, number>;
  ls?: { r: number };
  hl: Record<string, { f: number; oi: number; mp: number }>;
  hlMids: Record<string, number>;
  cbbi?: {
    conf: number; mvrv: number; pi: number; puell: number;
    rhodl: number; rupl: number; rr: number; yma: number; woob: number;
  };
  vix?: { v: number | null; chg: number | null; src: string };
  dxy?: { v: number | null; prev: number | null; src: string };
  y10?: { v: number | null; src: string };
}

export interface ScoreBreakdown {
  k: string; l: string; r: number; w: number; pts: number;
}

export interface ScoreResult {
  score: number;
  bd: ScoreBreakdown[];
  signal: string;
}

export interface WhaleInfo {
  addr: string;
  av: number;
  pnl: number;
  sharpe: number | null;
  winRate: number | null;
  fills: number;
  posCount: number;
  custom?: boolean;
}

export interface WhalePosition {
  addr: string;
  coin: string;
  side: 'LONG' | 'SHORT';
  lev: string;
  not: number;
  entry: number;
  upnl: number;
  liq: number | null;
}

export interface WhaleByCoin {
  _totalLong: number;
  _totalShort: number;
  [coin: string]: number | { l: number; s: number; n: number };
}

export interface CoinData {
  coin: string;
  price?: number;
  sharpe?: number | null;
  var95?: number;
  vwap?: number | null;
  vwapD?: number | null;
  twap?: number | null;
  twapD?: number | null;
  funding?: number | null;
  oi?: number | null;
  whaleCount?: number;
  whaleLong?: number;
  whaleShort?: number;
  netBias?: number;
  sentiment?: string;
}

export interface TradeCandidate {
  coin: string;
  dir: string;
  score: number;
  reasons: string[];
  sizing: string;
  price: number;
  vwap: number | null;
  twap: number | null;
  sharpe: number | null;
  var95: number;
  funding: number | null;
  whaleCount: number;
  sentiment: string;
  vwapD: number | null;
  twapD: number | null;
}

export interface AlertItem {
  t: '' | 'danger' | 'info';
  m: string;
}

export type TrafficLightStatus = 'go' | 'caution' | 'stop';

export interface SessionInfo {
  active: string | null;
  dead: boolean;
  hour: number;
  isSunday: boolean;
}

export interface MacroEvent {
  d: string;
  n: string;
}

export interface WhaleDiscoveryResponse {
  whales: WhaleInfo[];
  positions: WhalePosition[];
  whaleByCoin: Record<string, { l: number; s: number; n: number }>;
  totalLong: number;
  totalShort: number;
  timestamp: number;
}

export interface MacroResponse {
  vix: { v: number | null; chg: number | null; src: string };
  dxy: { v: number | null; prev: number | null; src: string };
  yield10y: { v: number | null; src: string };
  timestamp: number;
}

export interface CBBIResponse {
  confidence: number;
  indicators: Record<string, number>;
  timestamp: number;
}
