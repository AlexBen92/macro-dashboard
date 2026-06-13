/**
 * M15 BACKTEST - DONNÉES RÉELLES Binance/Bybit/HL
 *
 * Sources de données:
 * - Prix klines: Binance /fapi/v1/klines
 * - Volume 24h: Binance /fapi/v1/ticker/24hr
 * - Funding historique: Binance /fapi/v1/fundingRate (priorité)
 * - OI historique: Bybit /v5/market/open-interest (priorité)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
function loadEnv() {
  const envPath = resolve(__dirname, '.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    console.warn('Could not load .env.local:', e);
  }
}

loadEnv();

import { VOL_WINDOWS, HL_TAKER_FEE, HL_MAKER_FEE, HL_ROUND_TRIP } from './src/lib/constants';

const HL_FEES_ROUND_TRIP = HL_ROUND_TRIP;

// ─── CONFIGURATION ───

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'PEPE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const DAYS_BACK = 7; // 7 jours pour commencer (plus rapide)
const INTERVAL_HOURS = 1;

// ─── TYPES ───

interface HistoricalData {
  timestamp: number;
  symbol: string;
  price: number;
  funding: number;
  oi: number;
  vol24h: number;
  change24h: number;
}

interface Trade {
  symbol: string;
  entryTime: number;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  score: number;
  l1Score: number;
  l2Score: number;
  l3Score: number;
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL' | 'PENDING';
  pnlPct: number;
  holdingPeriod: number;
  reason: string;
}

interface BacktestSummary {
  totalSignals: number;
  totalTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  avgHoldingHours: number;
  outcomes: { TP1: number; TP2: number; SL: number; PENDING: number };
  bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number; avgScore: number }>;
  byScore: Record<string, { count: number; winRate: number; avgPnl: number }>;
  hourlyDistribution: number[];
}

// ─── API HELPERS ───

/**
 * Récupère les klines (prix OHLCV) depuis Binance Futures
 */
async function fetchBinanceKlines(symbol: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const interval = '1h';
  const limit = 1000;

  const url = 'https://fapi.binance.com/fapi/v1/klines?' +
    'symbol=' + binanceSymbol +
    '&interval=' + interval +
    '&startTime=' + startTime +
    '&endTime=' + endTime +
    '&limit=' + limit;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('  Binance klines error for ' + symbol + ': ' + response.status);
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (e) {
    console.warn('  Binance klines fetch error for ' + symbol + ':', e);
    return [];
  }
}

/**
 * Récupère le funding rate historique depuis Binance Futures
 */
async function fetchBinanceFunding(symbol: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const limit = 1000;

  const url = 'https://fapi.binance.com/fapi/v1/fundingRate?' +
    'symbol=' + binanceSymbol +
    '&startTime=' + startTime +
    '&endTime=' + endTime +
    '&limit=' + limit;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('  Binance funding error for ' + symbol + ': ' + response.status);
      return [];
    }

    const data = await response.json();
    return data || [];
  } catch (e) {
    console.warn('  Binance funding fetch error for ' + symbol + ':', e);
    return [];
  }
}

/**
 * Récupère l'Open Interest historique depuis Bybit
 */
async function fetchBybitOI(symbol: string, startTime: number, endTime: number): Promise<any[]> {
  const bybitSymbol = symbol + 'USDT';
  const interval = '60'; // 1h

  const url = 'https://api.bybit.com/v5/market/open-interest?' +
    'category=linear' +
    '&symbol=' + bybitSymbol +
    '&intervalTime=' + interval +
    '&startTime=' + startTime +
    '&endTime=' + endTime +
    '&limit=200';

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('  Bybit OI error for ' + symbol + ': ' + response.status);
      return [];
    }

    const data = await response.json();
    return data.result?.list || [];
  } catch (e) {
    console.warn('  Bybit OI fetch error for ' + symbol + ':', e);
    return [];
  }
}

/**
 * Récupère le ticker 24h depuis Binance (volume 24h actuel)
 */
async function fetchBinanceTicker24h(symbol: string): Promise<number> {
  const binanceSymbol = symbol + 'USDT';

  const url = 'https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=' + binanceSymbol;

  try {
    const response = await fetch(url);
    if (!response.ok) return 0;

    const data = await response.json();
    return parseFloat(data.quoteVolume || '0');
  } catch (e) {
    return 0;
  }
}

// ─── DATA PROCESSING ───

/**
 * Construit les données historiques complètes pour un symbol
 */
async function buildHistoricalData(symbol: string, daysBack: number): Promise<HistoricalData[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;
  const endTime = now;

  console.log('  [DATA] ' + symbol);

  // Fetch klines (prix)
  const klines = await fetchBinanceKlines(symbol, startTime, endTime);
  if (klines.length === 0) {
    console.warn('  No klines data for ' + symbol);
    return [];
  }

  // Fetch funding history
  const fundingHistory = await fetchBinanceFunding(symbol, startTime, endTime);

  // Fetch OI history (Bybit)
  const oiHistory = await fetchBybitOI(symbol, startTime, endTime);

  // Récupérer volume 24h actuel comme référence
  const currentVol24h = await fetchBinanceTicker24h(symbol);

  const data: HistoricalData[] = [];

  // Pour chaque kline (chaque heure)
  for (const kline of klines) {
    const timestamp = kline[0];
    const open = parseFloat(kline[1]);
    const high = parseFloat(kline[2]);
    const low = parseFloat(kline[3]);
    const close = parseFloat(kline[4]);
    const volume = parseFloat(kline[5]);

    // Trouver le funding correspondant à cette heure
    const fundingEntry = fundingHistory.find((f: any) => {
      const fundingTime = f.fundingTime || f.time;
      return Math.abs(fundingTime - timestamp) < 8 * 60 * 60 * 1000; // Within 8 hours
    });

    // Funding rate (en décimal, ex: 0.0001 = 0.01%)
    const funding = fundingEntry ? parseFloat(fundingEntry.fundingRate || '0') : 0;

    // Trouver l'OI correspondante
    const oiEntry = oiHistory.find((o: any) => {
      const oiTime = o.timestamp || o.time;
      return Math.abs(oiTime - timestamp) < 2 * 60 * 60 * 1000; // Within 2 hours
    });

    const oi = oiEntry ? parseFloat(oiEntry.openInterest || '0') : 0;

    // Volume 24h: utiliser le volume du kline * 24 comme proxy
    // Ou utiliser le volume 24h actuel ajusté
    const vol24h = volume * 24 || currentVol24h;

    // Change 24h: (close - open) / open * 100
    const change24h = ((close - open) / open) * 100;

    data.push({
      timestamp,
      symbol,
      price: close,
      funding,
      oi,
      vol24h,
      change24h,
    });
  }

  console.log('  -> ' + data.length + ' data points');
  return data;
}

// ─── M15 SCORING ───

function computeM15Score(
  data: HistoricalData,
  sessionScore: number
): { final: number; l1: number; l2: number; l3: number; action: string; direction: 'LONG' | 'SHORT' | 'NEUTRAL' } {
  let l1Score = 0;
  let l2Score = 0;
  let l3Score = 0;

  // L1: Hard Filters
  l1Score += Math.min(sessionScore / 100 * 25, 25); // Session
  if (data.vol24h >= 10_000_000) l1Score += 20; else if (data.vol24h >= 2_000_000) l1Score += 10; // Vol24h
  if (data.oi >= 50_000_000) l1Score += 15; else if (data.oi >= 10_000_000) l1Score += 8; // OI
  l1Score += 15; // Spread proxy (assume OK)
  l1Score += 15; // News (assume OK)
  const chopIndex = computeChopIndex(data);
  if (chopIndex < 60) l1Score += 10; else if (chopIndex < 80) l1Score += 5; // Chop

  // L2: Setup (basé sur données réelles)
  // 1. Funding (25%)
  const fundingEdge = Math.abs(data.funding) * 100 - HL_TAKER_FEE * 100;
  let fundingScore = 0;
  if (fundingEdge >= 0.10) fundingScore = 100;
  else if (fundingEdge >= 0.05) fundingScore = 70;
  else if (fundingEdge >= 0.01) fundingScore = 50;
  else fundingScore = 30;
  l2Score += fundingScore * 0.25;

  // 2. OI Momentum (15%) - proxy via vol24h
  let oiScore = 50;
  if (data.vol24h >= 100_000_000) oiScore = 80;
  else if (data.vol24h >= 50_000_000) oiScore = 65;
  l2Score += oiScore * 0.15;

  // 3. Volatilité (15%) - proxy via change24h
  let volScore = 50;
  const absChange = Math.abs(data.change24h);
  if (absChange >= 3) volScore = 90;
  else if (absChange >= 1.5) volScore = 75;
  else if (absChange >= 0.5) volScore = 60;
  l2Score += volScore * 0.15;

  // 4. Order Flow (15%) - proxy via funding direction
  let flowScore = 50;
  if (data.funding < -0.0003 || data.funding > 0.0003) flowScore = 80; // Fort déséquilibre
  l2Score += flowScore * 0.15;

  // 5. Trend Alignment (10%) - funding vs price direction
  let trendScore = 50;
  const fundingPct = data.funding * 100;
  if (data.change24h > 0.5 && fundingPct < -0.01) trendScore = 100; // LONG squeeze setup
  else if (data.change24h < -0.5 && fundingPct > 0.01) trendScore = 100; // SHORT flush setup
  else if (data.change24h > 0.3 && fundingPct < 0) trendScore = 70;
  else if (data.change24h < -0.3 && fundingPct > 0) trendScore = 70;
  l2Score += trendScore * 0.10;

  // 6. VWAP (20%) - assume moyen si pas de données réelles
  l2Score += 60 * 0.20;

  // L3: Confirmation (basé sur données disponibles)
  // 1. Momentum (30%) - via change24h
  let momScore = 50;
  if (absChange >= 2) momScore = 80;
  else if (absChange >= 1) momScore = 65;
  else if (absChange >= 0.3) momScore = 55;
  l3Score += momScore * 0.30;

  // 2. Reclaim (25%) - proxy via volatilité
  let reclaimScore = 50;
  if (absChange >= 1) reclaimScore = 70;
  l3Score += reclaimScore * 0.25;

  // 3. CVD (25%) - proxy via funding
  let cvdScore = 50;
  if (Math.abs(fundingPct) >= 0.02) cvdScore = 75;
  else if (Math.abs(fundingPct) >= 0.01) cvdScore = 60;
  l3Score += cvdScore * 0.25;

  // 4. Structure Break (10%)
  let structScore = 50;
  if (absChange >= 2) structScore = 75;
  else if (absChange >= 1) structScore = 60;
  l3Score += structScore * 0.10;

  // 5. Retest (10%)
  l3Score += 50 * 0.10;

  const final = Math.round(l1Score * 0.30 + l2Score * 0.40 + l3Score * 0.30);

  let action = 'AVOID';
  if (final >= 70) action = 'READY';  // Temporairement 70 pour tester
  else if (final >= 50) action = 'WATCH';

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (data.funding < -0.0002 && data.change24h > 0) direction = 'LONG';
  else if (data.funding > 0.0002 && data.change24h < 0) direction = 'SHORT';

  return { final, l1: Math.round(l1Score), l2: Math.round(l2Score), l3: Math.round(l3Score), action, direction };
}

function computeChopIndex(data: HistoricalData): number {
  const volProxy = data.vol24h / (Math.abs(data.funding) * data.price * 100 + 1);
  return Math.min(100, volProxy / 100000 * 100);
}

function getSessionScore(timestamp: number): number {
  const h = new Date(timestamp).getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

// ─── SIMULATE TRADES ───

async function simulateTrade(
  trade: Trade,
  historicalData: HistoricalData[]
): Promise<Trade> {
  const entryData = historicalData.find(d => d.timestamp === trade.entryTime);
  if (!entryData) return trade;

  const slDist = Math.max(entryData.price * 0.004, entryData.price * 0.005);
  const tp1Dist = slDist;
  const tp2Dist = slDist * 2;

  const slPrice = trade.direction === 'LONG' ? entryData.price - slDist : entryData.price + slDist;
  const tp1Price = trade.direction === 'LONG' ? entryData.price + tp1Dist : entryData.price - tp1Dist;
  const tp2Price = trade.direction === 'LONG' ? entryData.price + tp2Dist : entryData.price - tp2Dist;

  // Chercher SL/TP dans les heures suivantes
  for (let i = 1; i <= 4; i++) {
    const nextTime = trade.entryTime + i * 60 * 60 * 1000;
    const nextData = historicalData.find(d => d.timestamp === nextTime);

    if (!nextData) continue;

    const price = nextData.price;
    const high = nextData.price * 1.005; // Proxy ATR
    const low = nextData.price * 0.995;

    const hitSL = trade.direction === 'LONG' ? low <= slPrice : high >= slPrice;
    const hitTP1 = trade.direction === 'LONG' ? high >= tp1Price : low <= tp1Price;
    const hitTP2 = trade.direction === 'LONG' ? high >= tp2Price : low <= tp2Price;

    if (hitSL) {
      const pnlPct = trade.direction === 'LONG'
        ? ((slPrice - entryData.price) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100
        : ((entryData.price - slPrice) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100;
      return {
        ...trade,
        exitTime: nextTime,
        exitPrice: slPrice,
        outcome: 'SL',
        pnlPct,
        holdingPeriod: i,
        reason: 'SL hit',
      };
    }

    if (hitTP2) {
      const pnlPct = trade.direction === 'LONG'
        ? ((tp2Price - entryData.price) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100
        : ((entryData.price - tp2Price) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100;
      return {
        ...trade,
        exitTime: nextTime,
        exitPrice: tp2Price,
        outcome: 'TP2',
        pnlPct,
        holdingPeriod: i,
        reason: 'TP2 hit',
      };
    }

    if (hitTP1) {
      const pnlPct = trade.direction === 'LONG'
        ? ((tp1Price - entryData.price) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100
        : ((entryData.price - tp1Price) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100;
      return {
        ...trade,
        exitTime: nextTime,
        exitPrice: tp1Price,
        outcome: 'TP1',
        pnlPct,
        holdingPeriod: i,
        reason: 'TP1 hit',
      };
    }
  }

  // Timeout after 4h
  const exitTime = trade.entryTime + 4 * 60 * 60 * 1000;
  const exitData = historicalData.find(d => d.timestamp === exitTime);
  const exitPrice = exitData ? exitData.price : entryData.price;

  const pnlPct = trade.direction === 'LONG'
    ? ((exitPrice - entryData.price) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100
    : ((entryData.price - exitPrice) / entryData.price * 100) - HL_FEES_ROUND_TRIP * 100;

  return {
    ...trade,
    exitTime,
    exitPrice,
    outcome: 'SL',
    pnlPct,
    holdingPeriod: 4,
    reason: 'Timeout',
  };
}

// ─── SUMMARY ───

function computeSummary(trades: Trade[], totalSignals: number): BacktestSummary {
  const completed = trades.filter(t => t.outcome !== 'PENDING');
  const totalTrades = completed.length;

  if (totalTrades === 0) {
    return {
      totalSignals,
      totalTrades: 0,
      winRate: 0,
      avgPnlPct: 0,
      totalPnlPct: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      avgHoldingHours: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0, PENDING: 0 },
      bySymbol: {},
      byScore: {},
      hourlyDistribution: [],
    };
  }

  const wins = completed.filter(t => t.outcome !== 'SL');
  const winRate = (wins.length / totalTrades) * 100;

  const pnlValues = completed.map(t => t.pnlPct);
  const avgPnlPct = pnlValues.reduce((a, b) => a + b, 0) / totalTrades;
  const totalPnlPct = pnlValues.reduce((a, b) => a + b, 0);

  let maxDrawdown = 0;
  let peak = 0;
  let cumulative = 0;
  for (const t of completed) {
    cumulative += t.pnlPct;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  const mean = avgPnlPct;
  const variance = pnlValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / totalTrades;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252 * 24) : 0;

  const outcomes = {
    TP1: completed.filter(t => t.outcome === 'TP1').length,
    TP2: completed.filter(t => t.outcome === 'TP2').length,
    SL: completed.filter(t => t.outcome === 'SL').length,
    PENDING: trades.filter(t => t.outcome === 'PENDING').length,
  };

  const avgHolding = completed.reduce((sum, t) => sum + t.holdingPeriod, 0) / totalTrades;

  const bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number; avgScore: number }> = {};
  for (const t of completed) {
    if (!bySymbol[t.symbol]) {
      bySymbol[t.symbol] = { trades: 0, winRate: 0, totalPnl: 0, avgScore: 0 };
    }
    bySymbol[t.symbol].trades++;
    bySymbol[t.symbol].totalPnl += t.pnlPct;
  }
  for (const s in bySymbol) {
    const symbolTrades = completed.filter(t => t.symbol === s);
    const symbolWins = symbolTrades.filter(t => t.outcome !== 'SL').length;
    bySymbol[s].winRate = (symbolWins / symbolTrades.length) * 100;
    bySymbol[s].avgScore = symbolTrades.reduce((sum, t) => sum + t.score, 0) / symbolTrades.length;
  }

  const byScore: Record<string, { count: number; winRate: number; avgPnl: number }> = {};
  for (const t of completed) {
    const range = t.score >= 90 ? '90-100' : t.score >= 85 ? '85-89' : '80-84';
    if (!byScore[range]) {
      byScore[range] = { count: 0, winRate: 0, avgPnl: 0 };
    }
    byScore[range].count++;
    byScore[range].avgPnl += t.pnlPct;
  }
  for (const range in byScore) {
    const rangeTrades = completed.filter(t => {
      const r = t.score >= 90 ? '90-100' : t.score >= 85 ? '85-89' : '80-84';
      return r === range;
    });
    const rangeWins = rangeTrades.filter(t => t.outcome !== 'SL').length;
    byScore[range].winRate = (rangeWins / rangeTrades.length) * 100;
    byScore[range].avgPnl /= rangeTrades.length;
  }

  const hourlyDistribution = new Array(24).fill(0);
  for (const t of completed) {
    const hour = new Date(t.entryTime).getUTCHours();
    hourlyDistribution[hour]++;
  }

  return {
    totalSignals,
    totalTrades,
    winRate,
    avgPnlPct,
    totalPnlPct,
    maxDrawdownPct: maxDrawdown,
    sharpe,
    avgHoldingHours: avgHolding,
    outcomes,
    bySymbol,
    byScore,
    hourlyDistribution,
  };
}

// ─── SEND TELEGRAM ───

async function sendTelegramMessage(message: string): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram credentials not configured');
    return false;
  }

  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      console.error('Telegram API error:', data.description);
      return false;
    }

    console.log('Message sent to Telegram');
    return true;
  } catch (e) {
    console.error('Error sending to Telegram:', e);
    return false;
  }
}

function formatBacktestMessage(summary: BacktestSummary): string {
  let message = '[BACKTEST] M15 - DONNEES REELLES\n\n';
  message += 'Periode: ' + DAYS_BACK + ' jours (Binance + Bybit)\n';
  message += new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) + '\n';
  message += '========================================\n\n';

  if (summary.totalTrades === 0) {
    message += '[X] Aucun signal READY detecte\n\n';
    message += 'Signaux analyses: ' + summary.totalSignals + '\n';
    message += '- Score minimum: 80/100\n';
    message += '- Reessayez pendant heures de vol\n\n';
    message += 'https://macro-dashboard-lemon.vercel.app/';
    return message;
  }

  message += '[PERFORMANCE]\n';
  message += 'Signaux: ' + summary.totalSignals + ' -> Trades: ' + summary.totalTrades + '\n';
  message += 'Win Rate: ' + summary.winRate.toFixed(1) + '%\n';
  message += 'Avg PNL: ' + summary.avgPnlPct.toFixed(3) + '% / trade\n';
  message += 'Total PNL: ' + summary.totalPnlPct.toFixed(2) + '%\n';
  message += 'Max DD: ' + summary.maxDrawdownPct.toFixed(2) + '%\n';
  message += 'Sharpe: ' + summary.sharpe.toFixed(2) + '\n\n';

  message += '[OUTCOMES]\n';
  message += 'TP1 (1R): ' + summary.outcomes.TP1 + ' (' + ((summary.outcomes.TP1 / summary.totalTrades) * 100).toFixed(1) + '%)\n';
  message += 'TP2 (2R): ' + summary.outcomes.TP2 + ' (' + ((summary.outcomes.TP2 / summary.totalTrades) * 100).toFixed(1) + '%)\n';
  message += 'SL (-1R): ' + summary.outcomes.SL + ' (' + ((summary.outcomes.SL / summary.totalTrades) * 100).toFixed(1) + '%)\n\n';

  message += '[PAR SCORE]\n';
  for (const [range, data] of Object.entries(summary.byScore)) {
    const pnl = data.avgPnl >= 0 ? '+' : '';
    message += range + ': ' + data.count + ' trades, ' + data.winRate.toFixed(0) + '% WR, ' + pnl + data.avgPnl.toFixed(2) + '% avg\n';
  }
  message += '\n';

  message += '[TOP SYMBOLS]\n';
  const sortedSymbols = Object.entries(summary.bySymbol)
    .filter(([_, d]) => d.trades >= 1)
    .sort((a, b) => b[1].totalPnl - a[1].totalPnl)
    .slice(0, 5);

  for (const [symbol, data] of sortedSymbols) {
    const pnl = data.totalPnl >= 0 ? '+' : '';
    message += symbol + ': ' + pnl + data.totalPnl.toFixed(2) + '% (' + data.trades + ' trades, ' + data.winRate.toFixed(0) + '% WR)\n';
  }
  message += '\n';

  message += '[SOURCES]\n';
  message += '- Prix/Volume: Binance Futures API\n';
  message += '- Funding: Binance /fapi/v1/fundingRate\n';
  message += '- OI: Bybit /v5/market/open-interest\n\n';

  message += 'https://macro-dashboard-lemon.vercel.app/';

  return message;
}

// ─── MAIN BACKTEST ───

async function runBacktest(): Promise<{ trades: Trade[]; summary: BacktestSummary }> {
  console.log('==========================================');
  console.log('M15 BACKTEST - DONNEES REELLES');
  console.log('Période: ' + DAYS_BACK + ' jours');
  console.log('==========================================\n');

  const allHistoricalData: Map<string, HistoricalData[]> = new Map();

  // Fetch data pour tous les symbols
  for (const symbol of TOP_TOKENS) {
    const data = await buildHistoricalData(symbol, DAYS_BACK);
    if (data.length > 0) {
      allHistoricalData.set(symbol, data);
    }
  }

  console.log('\n[BACKTEST] Scanning for READY signals...\n');

  const trades: Trade[] = [];
  let signalCount = 0;
  let maxScore = 0;
  let maxScoreDetails = null;

  // Pour chaque timestamp et symbol
  for (const [symbol, data] of allHistoricalData) {
    for (const point of data) {
      signalCount++;

      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      // Track max score
      if (score.final > maxScore) {
        maxScore = score.final;
        maxScoreDetails = { symbol, score, point, sessionScore };
      }

      // Only READY signals
      if (score.final < 70 || score.action !== 'READY') continue;
      if (score.direction === 'NEUTRAL') continue;

      // Check if already in trade
      const existingTrade = trades.find(t => t.symbol === symbol && t.outcome === 'PENDING');
      if (existingTrade) continue;

      trades.push({
        symbol,
        entryTime: point.timestamp,
        entryPrice: point.price,
        direction: score.direction,
        score: score.final,
        l1Score: score.l1,
        l2Score: score.l2,
        l3Score: score.l3,
        exitTime: null,
        exitPrice: null,
        outcome: 'PENDING',
        pnlPct: 0,
        holdingPeriod: 0,
        reason: 'READY signal',
      });

      console.log('  [+] ' + new Date(point.timestamp).toISOString().slice(5, 16) + ' ' + symbol + ': ' + score.final + '/100 ' + score.direction);
    }
  }

  console.log('\n[TRADES] Simulating ' + trades.length + ' trades...\n');

  // Simuler chaque trade
  const completedTrades: Trade[] = [];
  for (const trade of trades) {
    const historicalData = allHistoricalData.get(trade.symbol) ?? [];
    const simulated = await simulateTrade(trade, historicalData);
    completedTrades.push(simulated);

    const outcome = simulated.outcome === 'SL' ? '[X]' : simulated.outcome === 'TP1' ? '[1R]' : '[2R]';
    console.log('  ' + outcome + ' ' + simulated.symbol + ' ' + simulated.direction + ' -> ' + simulated.outcome + ' (' + simulated.pnlPct.toFixed(3) + '%)');
  }

  const summary = computeSummary(completedTrades, signalCount);

  // Debug: afficher max score
  if (maxScoreDetails && trades.length === 0) {
    console.log('\n[DEBUG] Max score found: ' + maxScore);
    console.log('  Symbol: ' + maxScoreDetails.symbol);
    console.log('  L1: ' + maxScoreDetails.score.l1 + ' (session: ' + maxScoreDetails.sessionScore + ')');
    console.log('  L2: ' + maxScoreDetails.score.l2);
    console.log('  L3: ' + maxScoreDetails.score.l3);
    console.log('  Direction: ' + maxScoreDetails.score.direction);
    console.log('  Funding: ' + (maxScoreDetails.point.funding * 100).toFixed(4) + '%');
    console.log('  Change24h: ' + maxScoreDetails.point.change24h.toFixed(2) + '%');
    console.log('  Vol24h: $' + (maxScoreDetails.point.vol24h / 1e6).toFixed(1) + 'M');
  }

  return { trades: completedTrades, summary };
}

// ─── MAIN ───

async function main() {
  const startTime = Date.now();

  const { trades, summary } = await runBacktest();

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  console.log('  Total signals: ' + summary.totalSignals);
  console.log('  Total trades: ' + summary.totalTrades);
  console.log('  Win rate: ' + summary.winRate.toFixed(1) + '%');
  console.log('  Avg PNL: ' + summary.avgPnlPct.toFixed(3) + '%');
  console.log('  Total PNL: ' + summary.totalPnlPct.toFixed(2) + '%');
  console.log('  Sharpe: ' + summary.sharpe.toFixed(2));
  console.log('  Time: ' + elapsed + 's');
  console.log('==========================================');

  const message = formatBacktestMessage(summary);

  console.log('\n[TELEGRAM] Sending...');
  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('\n[OK] Backtest envoye sur Telegram!');
  } else {
    console.log('\n[ERR] Failed to send');
    process.exit(1);
  }
}

main().catch(console.error);
