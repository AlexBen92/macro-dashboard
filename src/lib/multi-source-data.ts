/**
 * MULTI-SOURCE DATA SERVICE
 * Fetches market data from Binance, Bybit, and Hyperliquid
 * Implements caching, error handling, and rate limiting
 */

// ─── TYPES ───

export interface HyperliquidMeta {
  name: string;
  markPx: string;
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
  prevDayPx: string;
}

export interface HyperliquidCtx {
  markPx: string;
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
  prevDayPx: string;
  funding1h?: string;
}

export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
}

export interface BinanceOrderBook {
  lastUpdateId: number;
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
}

export interface BybitOrderBook {
  result: {
    b: [string, string, string, number, number][]; // bid: [price, size, ...]
    s: [string, string, string, number, number][]; // ask
    u: number; // update ID
    ts: number; // timestamp
  };
}

export interface TradeData {
  sz: string;
  px: string;
  side: 'B' | 'S';
  time: number;
}

// ─── CACHE ───

const CACHE_TTL = {
  PRICE: 2000,          // 2s
  ORDERBOOK: 5000,      // 5s
  KLINES: 30000,        // 30s
  TRADES: 10000,        // 10s
  META: 15000,          // 15s
} as const;

const cache = new Map<string, { data: unknown; expiry: number }>();

function getCache<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown, ttl: number): void {
  cache.set(key, { data, expiry: Date.now() + ttl });
}

// ─── API CLIENTS ───

async function binanceFetch<T>(endpoint: string): Promise<T | null> {
  const url = `https://fapi.binance.com${endpoint}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`Binance API error:`, e);
    return null;
  }
}

async function bybitFetch<T>(endpoint: string): Promise<T | null> {
  const url = `https://api.bybit.com${endpoint}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.retCode !== 0) throw new Error(`Bybit error: ${data.retMsg}`);
    return data;
  } catch (e) {
    console.error(`Bybit API error:`, e);
    return null;
  }
}

async function hlPost<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch('https://api.hyperliquid.xyz/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error(`Hyperliquid API error:`, e);
    return null;
  }
}

// ─── HYPERLIQUID DATA ───

export async function fetchHLMeta(): Promise<{ meta: HyperliquidMeta[]; ctxs: HyperliquidCtx[] } | null> {
  const cacheKey = 'hl:meta';
  const cached = getCache<{ meta: HyperliquidMeta[]; ctxs: HyperliquidCtx[] }>(cacheKey);
  if (cached) return cached;

  const data = await hlPost<[unknown[], unknown[]]>({ type: 'metaAndAssetCtxs' });
  if (!data || !Array.isArray(data) || data.length < 2) return null;

  const meta = (data[0] as { universe?: HyperliquidMeta[] })?.universe ?? [];
  const ctxs = data[1] as HyperliquidCtx[];

  setCache(cacheKey, { meta, ctxs }, CACHE_TTL.META);
  return { meta, ctxs };
}

export async function fetchHLTrades(coin: string, limit: number = 500): Promise<TradeData[]> {
  const cacheKey = `hl:trades:${coin}`;
  const cached = getCache<TradeData[]>(cacheKey);
  if (cached) return cached;

  const trades = await hlPost<TradeData[]>({ type: 'trades', coin });
  if (!trades) return [];

  const recent = trades.slice(-limit);
  setCache(cacheKey, recent, CACHE_TTL.TRADES);
  return recent;
}

export async function fetchHLCandles(coin: string, interval: '1m' | '5m' | '15m' | '1h', limit: number = 100): Promise<BinanceKline[]> {
  const cacheKey = `hl:candles:${coin}:${interval}`;
  const cached = getCache<BinanceKline[]>(cacheKey);
  if (cached) return cached;

  const now = Date.now();
  const start = now - limit * intervalToMs(interval);

  const data = await hlPost<BinanceKline[]>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime: start, endTime: now },
  });

  if (!data) return [];

  setCache(cacheKey, data, CACHE_TTL.KLINES);
  return data;
}

function intervalToMs(interval: string): number {
  const map: Record<string, number> = { '1m': 60000, '5m': 300000, '15m': 900000, '1h': 3600000 };
  return map[interval] ?? 60000;
}

// ─── BINANCE DATA ───

export async function fetchBinanceKlines(symbol: string, interval: '1m' | '5m' | '15m' | '1h', limit: number = 100): Promise<BinanceKline[]> {
  const cacheKey = `binance:klines:${symbol}:${interval}`;
  const cached = getCache<BinanceKline[]>(cacheKey);
  if (cached) return cached;

  const data = await binanceFetch<{ result: unknown[][] }>(
    `/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!data) return [];

  const formatted = data.result.map((k: unknown[]) => ({
    openTime: Number(k[0]),
    open: String(k[1]),
    high: String(k[2]),
    low: String(k[3]),
    close: String(k[4]),
    volume: String(k[5]),
    closeTime: Number(k[6]),
    quoteVolume: String(k[7]),
    trades: Number(k[8]),
  }));

  setCache(cacheKey, formatted, CACHE_TTL.KLINES);
  return formatted;
}

export async function fetchBinanceOrderBook(symbol: string, limit: number = 20): Promise<BinanceOrderBook | null> {
  const cacheKey = `binance:ob:${symbol}`;
  const cached = getCache<BinanceOrderBook>(cacheKey);
  if (cached) return cached;

  const data = await binanceFetch<BinanceOrderBook>(
    `/fapi/v1/depth?symbol=${symbol}&limit=${limit}`
  );

  if (data) setCache(cacheKey, data, CACHE_TTL.ORDERBOOK);
  return data;
}

export async function fetchBinancePremiumIndex(symbol: string): Promise<{ markPrice: string; indexPrice: string; lastFundingRate: string } | null> {
  const cacheKey = `binance:premium:${symbol}`;
  const cached = getCache<{ markPrice: string; indexPrice: string; lastFundingRate: string }>(cacheKey);
  if (cached) return cached;

  const data = await binanceFetch<{ markPrice: string; indexPrice: string; lastFundingRate: string; nextFundingTime: number }>(
    `/fapi/v1/premiumIndex?symbol=${symbol}`
  );

  if (data) setCache(cacheKey, data, CACHE_TTL.PRICE);
  return data;
}

export async function fetchBinanceOpenInterest(symbol: string): Promise<{ openInterest: string; time: number } | null> {
  const cacheKey = `binance:oi:${symbol}`;
  const cached = getCache<{ openInterest: string; time: number }>(cacheKey);
  if (cached) return cached;

  const data = await binanceFetch<{ openInterest: string; time: number }>(
    `/fapi/v1/openInterest?symbol=${symbol}`
  );

  if (data) setCache(cacheKey, data, CACHE_TTL.META);
  return data;
}

// ─── BYBIT DATA ───

export async function fetchBybitOrderBook(symbol: string, limit: number = 25): Promise<BybitOrderBook | null> {
  const cacheKey = `bybit:ob:${symbol}`;
  const cached = getCache<BybitOrderBook>(cacheKey);
  if (cached) return cached;

  const data = await bybitFetch<BybitOrderBook>(
    `/v5/market/orderbook?category=linear&symbol=${symbol}&limit=${limit}`
  );

  if (data) setCache(cacheKey, data, CACHE_TTL.ORDERBOOK);
  return data;
}

export async function fetchBybitKlines(symbol: string, interval: number, limit: number = 100): Promise<BinanceKline[]> {
  // Bybit interval: 1, 3, 5, 15, 30, 60, 120, 240, 360, 720, D, W, M
  const cacheKey = `bybit:klines:${symbol}:${interval}`;
  const cached = getCache<BinanceKline[]>(cacheKey);
  if (cached) return cached;

  const data = await bybitFetch<{ result: { list: string[][] } }>(
    `/v5/market/kline?category=linear&symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  if (!data || !data.result?.list) return [];

  const formatted = data.result.list.map(k => ({
    openTime: Number(k[0]),
    open: k[1],
    high: k[2],
    low: k[3],
    close: k[4],
    volume: k[5],
    closeTime: Number(k[0]) + interval * 60000,
    quoteVolume: '0',
    trades: 0,
  }));

  setCache(cacheKey, formatted, CACHE_TTL.KLINES);
  return formatted;
}

// ─── COMPUTED METRICS ───

export interface ComputedMetrics {
  atr: number;
  vwap: number;
  cvd: { buyVol: number; sellVol: number; buyPct: number };
  orderBookImbalance: number;
  spread: number;
  slippageEst: number;
}

export function computeMetricsFromKlines(klines: BinanceKline[]): {
  atr: number;
  vwap: number;
  high: number;
  low: number;
  volume: number;
} {
  if (klines.length === 0) return { atr: 0, vwap: 0, high: 0, low: 0, volume: 0 };

  let high = 0, low = Infinity, totalVolPrice = 0, totalVol = 0;
  const trueRanges: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    const k = klines[i];
    const h = parseFloat(k.high);
    const l = parseFloat(k.low);
    const c = parseFloat(k.close);
    const v = parseFloat(k.volume);

    high = Math.max(high, h);
    low = Math.min(low, l);
    totalVolPrice += c * v;
    totalVol += v;

    // True Range
    const prevC = i > 0 ? parseFloat(klines[i - 1].close) : c;
    const tr = Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));
    trueRanges.push(tr);
  }

  const atr = trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
  const vwap = totalVol > 0 ? totalVolPrice / totalVol : 0;

  return { atr, vwap, high, low, volume: totalVol };
}

export function computeCVD(trades: TradeData[]): { buyVol: number; sellVol: number; buyPct: number } {
  let buyVol = 0, sellVol = 0;

  for (const t of trades) {
    const sz = Math.abs(parseFloat(t.sz ?? '0')) * parseFloat(t.px ?? '0');
    if (t.side === 'B') buyVol += sz;
    else sellVol += sz;
  }

  const total = buyVol + sellVol;
  return {
    buyVol,
    sellVol,
    buyPct: total > 0 ? (buyVol / total) * 100 : 50,
  };
}

export function computeOrderBookImbalance(ob: BinanceOrderBook | BybitOrderBook): {
  imbalance5: number;
  imbalance10: number;
  depth5: number;
  depth10: number;
  spread: number;
} {
  let bids: [string, string][], asks: [string, string][];

  if ('result' in ob) {
    // Bybit format
    const rawBids = (ob as BybitOrderBook).result?.b ?? [];
    const rawAsks = (ob as BybitOrderBook).result?.s ?? [];
    bids = rawBids.map(b => [b[0], b[1]]);
    asks = rawAsks.map(a => [a[0], a[1]]);
  } else {
    // Binance format
    bids = (ob as BinanceOrderBook).bids;
    asks = (ob as BinanceOrderBook).asks;
  }

  if (!bids?.length || !asks?.length) {
    return { imbalance5: 50, imbalance10: 50, depth5: 0, depth10: 0, spread: 0 };
  }

  const bidPrice5 = parseFloat(bids[Math.min(4, bids.length - 1)][0]);
  const askPrice5 = parseFloat(asks[Math.min(4, asks.length - 1)][0]);
  const spread = askPrice5 > 0 ? ((askPrice5 - bidPrice5) / bidPrice5) * 100 : 0;

  // Top 5 bid/ask volumes
  let bidVol5 = 0, askVol5 = 0;
  for (let i = 0; i < 5; i++) {
    if (i < bids.length) bidVol5 += parseFloat(bids[i][1]) * parseFloat(bids[i][0]);
    if (i < asks.length) askVol5 += parseFloat(asks[i][1]) * parseFloat(asks[i][0]);
  }

  // Top 10
  let bidVol10 = bidVol5, askVol10 = askVol5;
  for (let i = 5; i < 10; i++) {
    if (i < bids.length) bidVol10 += parseFloat(bids[i][1]) * parseFloat(bids[i][0]);
    if (i < asks.length) askVol10 += parseFloat(asks[i][1]) * parseFloat(asks[i][0]);
  }

  const total5 = bidVol5 + askVol5;
  const total10 = bidVol10 + askVol10;

  return {
    imbalance5: total5 > 0 ? (bidVol5 / total5) * 100 : 50,
    imbalance10: total10 > 0 ? (bidVol10 / total10) * 100 : 50,
    depth5: total5,
    depth10: total10,
    spread,
  };
}

// ─── SYMBOL MAPPING ───

export function mapHLToBinance(symbol: string): string {
  const map: Record<string, string> = {
    'BTC': 'BTCUSDT',
    'ETH': 'ETHUSDT',
    'SOL': 'SOLUSDT',
    'BNB': 'BNBUSDT',
    'DOGE': 'DOGEUSDT',
    'AVAX': 'AVAXUSDT',
    'SUI': 'SUIUSDT',
    'ARB': 'ARBUSDT',
    'OP': 'OPUSDT',
    'LINK': 'LINKUSDT',
    'WIF': 'WIFUSDT',
    'PEPE': 'PEPEUSDT',
    'INJ': 'INJUSDT',
    'TIA': 'TIAUSDT',
    'SEI': 'SEIUSDT',
    'JUP': 'JUPUSDT',
    'NEAR': 'NEARUSDT',
    'APT': 'APTUSDT',
    'HYPE': 'HYPEUSDT',
    'PENDLE': 'PENDLEUSDT',
  };
  return map[symbol] ?? `${symbol}USDT`;
}

export function mapHLToBybit(symbol: string): string {
  const map: Record<string, string> = {
    'BTC': 'BTCUSDT',
    'ETH': 'ETHUSDT',
    'SOL': 'SOLUSDT',
    'BNB': 'BNBUSDT',
    'DOGE': 'DOGEUSDT',
    'AVAX': 'AVAXUSDT',
    'SUI': 'SUIUSDT',
    'ARB': 'ARBUSDT',
    'OP': 'OPUSDT',
    'LINK': 'LINKUSDT',
    'WIF': 'WIFUSDT',
    'PEPE': 'PEPEUSDT',
    'INJ': 'INJUSDT',
    'TIA': 'TIAUSDT',
    'SEI': 'SEIUSDT',
    'JUP': 'JUPUSDT',
    'NEAR': 'NEARUSDT',
    'APT': 'APTUSDT',
    'HYPE': 'HYPEUSDT',
    'PENDLE': 'PENDLEUSDT',
  };
  return map[symbol] ?? `${symbol}USDT`;
}
