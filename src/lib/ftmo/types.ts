// ══════════ FLOW MAP ══════════
export interface FlowNode {
  id: string;
  label: string;
  price: number;
  change24h: number;
  changeSession: number;
  x: number;
  y: number;
  size: number;
  pulseIntensity: number;
  category: 'currency' | 'commodity' | 'index' | 'macro';
}

export interface FlowEdge {
  from: string;
  to: string;
  correlation: number;
  causalDirection: 'positive' | 'negative';
  lagMinutes: number;
  isActive: boolean;
  strength: 'strong' | 'moderate' | 'weak';
}

// ══════════ CANDLES ══════════
export interface YahooCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

// ══════════ STRATEGY STATES ══════════
export interface AsianRangeState {
  rangeHigh: number;
  rangeLow: number;
  rangeWidth: number;
  h4Trend: 'UP' | 'DOWN' | 'RANGE';
  breakoutDirection: 'ABOVE' | 'BELOW' | 'NONE';
  h1ClosedAbove: boolean;
  h1ClosedBelow: boolean;
  status: 'FORMING' | 'READY' | 'TRIGGERED' | 'EXPIRED';
  entry: number | null;
  stop: number | null;
  tp1: number | null;
  tp2: number | null;
}

export interface ScalpState {
  isOverlapActive: boolean;
  ema20: number;
  ema50: number;
  emaTrend: 'BULL' | 'BEAR' | 'FLAT';
  pullbackToEMA: boolean;
  atrCurrent: number;
  atrPercentile: number;
  status: 'INACTIVE' | 'WATCHING' | 'SETUP' | 'ACTIVE';
  direction: 'LONG' | 'SHORT' | null;
  entry: number | null;
  stop: number | null;
  tp: number | null;
}

export interface LondonBOState {
  pair: string;
  asianRangeHigh: number;
  asianRangeLow: number;
  rangeWidthPips: number;
  tooWide: boolean;
  buyStop: number | null;
  sellStop: number | null;
  tpDistance: number;
  eaStatus: 'OFF' | 'PLACING' | 'LIVE' | 'TRIGGERED' | 'DONE';
}

export interface MeanRevState {
  pair: string;
  timeframe: 'H4';
  rsi14: number;
  bbUpper: number;
  bbLower: number;
  bbMiddle: number;
  priceVsBB: 'ABOVE_UPPER' | 'BELOW_LOWER' | 'INSIDE';
  adx: number;
  adxFilter: boolean;
  signalType: 'BUY' | 'SELL' | 'NONE';
  eaStatus: 'OFF' | 'SCANNING' | 'SIGNAL' | 'IN_TRADE';
  currentPrice: number;
  nextCloseIn: string;
}

export interface ORBState {
  instrument: string;
  orbHigh: number | null;
  orbLow: number | null;
  orbWidthPoints: number | null;
  h1Bias: 'BULL' | 'BEAR' | 'NEUTRAL';
  breakoutDirection: 'ABOVE' | 'BELOW' | 'NONE';
  status: 'WAITING' | 'FORMING' | 'READY' | 'TRIGGERED' | 'EXPIRED';
  minutesUntilOpen: number;
}

// ══════════ CURRENCY STRENGTH ══════════
export interface CurrencyStrength {
  currency: string;
  strength: number; // -100 to +100
  change24h: number;
}

// ══════════ FTMO DATA ══════════
export interface FtmoInstrumentData {
  symbol: string;
  candles1h: YahooCandle[];
  candles15m?: YahooCandle[];
  candles5m?: YahooCandle[];
  candles4h?: YahooCandle[];
  candlesDaily?: YahooCandle[];
  price: number;
  change24h: number;
}

export interface FtmoApiResponse {
  instruments: Record<string, FtmoInstrumentData>;
  timestamp: number;
}

// ══════════ TRADE CARD ══════════
export interface FtmoTrade {
  instrument: string;
  direction: 'LONG' | 'SHORT';
  strategy: string;
  entry: number;
  stop: number;
  tp1: number;
  tp2?: number;
  stopPips: number;
  lots: number;
  riskUsd: number;
  riskPct: number;
  rrRatio: number;
  reasons: string[];
  confidence: number; // 1-5
}

// ══════════ SCORING ══════════
export interface FtmoScoreResult {
  score: number;
  signal: string;
  breakdown: { k: string; l: string; pts: number; w: number }[];
}
