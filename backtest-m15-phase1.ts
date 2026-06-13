/**
 * M15 BACKTEST - PHASE 1 AMÉLIORATIONS
 *
 * CHANGEMENTS APPLIQUÉS:
 * ✅ Idée 3: Régime filter BULL only (SMA50 > SMA200)
 * ✅ Idée 1: Lock 1H timeframe
 * ✅ Idée 7: Whitelist LINK + BTC uniquement
 * ✅ Idée 10: Session filter (EU Open + EU/US overlap only)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  } catch (e) {}
}

loadEnv();

import { VOL_WINDOWS, HL_ROUND_TRIP } from './src/lib/constants';

const HL_FEES_ROUND_TRIP = HL_ROUND_TRIP;

// ─── CONFIGURATION PHASE 1 ───

// Idée 7: Whitelist LINK + BTC uniquement
const WHITELIST_TOKENS = ['LINK', 'BTC'];

const DAYS_BACK = 90;

// Idée 1: Lock 1H timeframe
const TIMEFRAMES = [
  { name: '1h', interval: '1h', binanceInterval: '1h', maxHolding: 4 },
];

const SLIPPAGE_BPS = 5;

// ─── FILTRES ───

const MIN_FUNDING_BPS = -2; // Garder pour l'instant (Idée 2 sera Phase 2)
const MIN_SCORE = 60; // Idée 8 sera Phase 2
const LONG_ONLY = true;

// Idée 10: Session filter - EU Open + EU/US overlap ONLY
const ALLOWED_SESSIONS = [
  { name: 'EU_OPEN', start: 7, end: 10 },   // 07h00-10h00 UTC
  { name: 'EU_US_OVERLAP', start: 13, end: 16 }, // 13h00-16h00 UTC
];

// Idée 3: Régime filter - BULL only (SMA50 > SMA200 sur BTC 4H)
let REGIME_STATE: 'BULL' | 'BEAR' | 'SIDEWAYS' = 'SIDEWAYS';

// ─── TYPES ───

interface HistoricalData {
  timestamp: number;
  symbol: string;
  price: number;
  funding: number;
  vol24h: number;
  change24h: number;
  sma50?: number;
  sma200?: number;
}

interface Trade {
  symbol: string;
  timeframe: string;
  entryTime: number;
  entryPrice: number;
  direction: 'LONG';
  score: number;
  fundingBps: number;
  change24h: number;
  slDist: number;
  tp1Dist: number;
  tp2Dist: number;
  maxHolding: number;
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL' | 'PENDING';
  pnlPct: number;
  holdingPeriod: number;
  session?: string;
}

interface BacktestSummary {
  timeframe: string;
  totalSignals: number;
  longSignals: number;
  filteredByRegime: number;
  filteredBySession: number;
  filteredByWhitelist: number;
  totalTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  profitFactor: number;
  avgHoldingHours: number;
  outcomes: { TP1: number; TP2: number; SL: number };
  bySession: Record<string, { trades: number; winRate: number; totalPnl: number }>;
  bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }>;
}

// ─── API HELPERS ───

async function fetchBinanceKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const allKlines: any[] = [];
  let currentStart = startTime;

  while (currentStart < endTime) {
    const url = 'https://fapi.binance.com/fapi/v1/klines?symbol=' + binanceSymbol +
      '&interval=' + interval + '&startTime=' + currentStart + '&endTime=' + endTime + '&limit=1000';

    try {
      const response = await fetch(url);
      if (!response.ok) break;
      const data = await response.json();
      if (data.length === 0) break;
      allKlines.push(...data);
      currentStart = data[data.length - 1][0] + getIntervalMs(interval);
      if (data.length < 1000) break;
    } catch (e) {
      break;
    }
  }
  return allKlines;
}

function getIntervalMs(interval: string): number {
  const map: Record<string, number> = {
    '1h': 60*60*1000,
    '4h': 4*60*60*1000,
    '1d': 24*60*60*1000,
  };
  return map[interval] || 60*60*1000;
}

async function fetchBinanceFunding(symbol: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const url = 'https://fapi.binance.com/fapi/v1/fundingRate?symbol=' + binanceSymbol +
    '&startTime=' + startTime + '&endTime=' + endTime + '&limit=1000';
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json() || [];
  } catch (e) {
    return [];
  }
}

async function fetchBinanceTicker24h(symbol: string): Promise<number> {
  const binanceSymbol = symbol + 'USDT';
  try {
    const response = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=' + binanceSymbol);
    if (!response.ok) return 0;
    const data = await response.json();
    return parseFloat(data.quoteVolume || '0');
  } catch (e) {
    return 0;
  }
}

// ─── RÉGIME DÉTECTION (Idée 3) ───

async function detectRegime(): Promise<'BULL' | 'BEAR' | 'SIDEWAYS'> {
  const now = Date.now();
  const startTime = now - 200 * 24 * 60 * 60 * 1000; // 200 jours pour SMA200

  try {
    const klines = await fetchBinanceKlines('BTC', '4h', startTime, now);
    if (klines.length < 200) return 'SIDEWAYS';

    const closes = klines.map(k => parseFloat(k[4]));

    // Calculer SMA50 et SMA200
    const sma50 = closes.slice(-50).reduce((a, b) => a + b, 0) / 50;
    const sma200 = closes.slice(-200).reduce((a, b) => a + b, 0) / 200;

    const diffPct = ((sma50 - sma200) / sma200) * 100;

    console.log('[REGIME] BTC 4H SMA50: ' + sma50.toFixed(2) + ', SMA200: ' + sma200.toFixed(2));
    console.log('[REGIME] Diff: ' + diffPct.toFixed(2) + '%');

    if (diffPct > 1) return 'BULL';
    if (diffPct < -1) return 'BEAR';
    return 'SIDEWAYS';
  } catch (e) {
    console.error('[REGIME] Error detecting regime:', e);
    return 'SIDEWAYS';
  }
}

// ─── SESSION FILTER (Idée 10) ───

function isInAllowedSession(timestamp: number): string | null {
  const hour = new Date(timestamp).getUTCHours();

  for (const session of ALLOWED_SESSIONS) {
    if (hour >= session.start && hour < session.end) {
      return session.name;
    }
  }
  return null;
}

// ─── HISTORICAL DATA ───

async function buildHistoricalData(symbol: string, daysBack: number, interval: string): Promise<HistoricalData[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;

  console.log('  [FETCH] ' + symbol + ' (' + interval + ')');
  const klines = await fetchBinanceKlines(symbol, interval, startTime, now);
  if (klines.length === 0) return [];

  const fundingHistory = await fetchBinanceFunding(symbol, startTime, now);
  const currentVol24h = await fetchBinanceTicker24h(symbol);

  const data: HistoricalData[] = [];

  for (const kline of klines) {
    const timestamp = kline[0];
    const close = parseFloat(kline[4]);
    const volume = parseFloat(kline[5]);
    const open = parseFloat(kline[1]);

    const fundingEntry = fundingHistory.find((f: any) => Math.abs((f.fundingTime || f.time) - timestamp) < 8 * 60 * 60 * 1000);
    const funding = fundingEntry ? parseFloat(fundingEntry.fundingRate || '0') : 0;

    const change24h = ((close - open) / open) * 100;
    const vol24h = volume * (24 / getIntervalHours(interval)) || currentVol24h;

    data.push({ timestamp, symbol, price: close, funding, vol24h, change24h });
  }

  console.log('  -> ' + data.length + ' points');
  return data;
}

function getIntervalHours(interval: string): number {
  const map: Record<string, number> = { '1h': 1, '4h': 4, '1d': 24 };
  return map[interval] || 1;
}

// ─── M15 SCORING ───

function computeM15Score(data: HistoricalData, sessionScore: number): { final: number; isLongSignal: boolean } {
  let l1Score = 0, l2Score = 0, l3Score = 0;

  // L1
  l1Score += Math.min(sessionScore, 100) * 0.25;
  if (data.vol24h >= 10_000_000) l1Score += 20; else if (data.vol24h >= 2_000_000) l1Score += 10;
  l1Score += 40;

  // L2
  const fundingBps = data.funding * 10000;
  let fundingScore = fundingBps <= -2 ? 100 : fundingBps <= -1 ? 70 : fundingBps <= -0.5 ? 50 : 30;
  l2Score += fundingScore * 0.25;

  const absChange = Math.abs(data.change24h);
  const oiScore = data.vol24h >= 100_000_000 ? 80 : data.vol24h >= 50_000_000 ? 65 : 50;
  l2Score += oiScore * 0.15;

  const volScore = absChange >= 3 ? 90 : absChange >= 1.5 ? 75 : absChange >= 0.5 ? 60 : 50;
  l2Score += volScore * 0.15;

  const flowScore = Math.abs(fundingBps) >= 2 ? 80 : 50;
  l2Score += flowScore * 0.15;

  let trendScore = 50;
  if (data.change24h < -0.5 && fundingBps < -2) trendScore = 100;
  else if (data.change24h < -1 && fundingBps < -1) trendScore = 80;
  else if (data.change24h < -0.3 && fundingBps < -1) trendScore = 70;
  l2Score += trendScore * 0.10;
  l2Score += 60 * 0.20;

  // L3
  const momScore = absChange >= 2 ? 80 : absChange >= 1 ? 65 : absChange >= 0.3 ? 55 : 50;
  l3Score += momScore * 0.30;
  l3Score += (absChange >= 1 ? 70 : 50) * 0.25;
  l3Score += (Math.abs(fundingBps) >= 2 ? 75 : 50) * 0.25;
  l3Score += (absChange >= 2 ? 75 : absChange >= 1 ? 60 : 50) * 0.10;
  l3Score += 50 * 0.10;

  const final = Math.round(l1Score * 0.30 + l2Score * 0.40 + l3Score * 0.30);

  const fundingBpsCheck = fundingBps < MIN_FUNDING_BPS;
  const contrarianCheck = data.change24h < 0;
  const isLongSignal = final >= MIN_SCORE && fundingBpsCheck && contrarianCheck;

  return { final, isLongSignal };
}

function getSessionScore(timestamp: number): number {
  const h = new Date(timestamp).getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

// ─── SIMULATE TRADES ───

async function simulateTrade(trade: Trade, historicalData: HistoricalData[]): Promise<Trade> {
  const entryData = historicalData.find(d => d.timestamp === trade.entryTime);
  if (!entryData) return trade;

  const slPrice = entryData.price * (1 - trade.slDist);
  const tp1Price = entryData.price * (1 + trade.tp1Dist);
  const tp2Price = entryData.price * (1 + trade.tp2Dist);

  for (let i = 1; i <= trade.maxHolding; i++) {
    const nextTime = trade.entryTime + i * 60 * 60 * 1000;
    const nextData = historicalData.find(d => d.timestamp === nextTime);

    if (!nextData) continue;

    const price = nextData.price;

    if (price <= slPrice) {
      const pnlNoSlip = (slPrice - entryData.price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: slPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: i };
    }

    if (price >= tp2Price) {
      const pnlNoSlip = (tp2Price - entryData.price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp2Price, outcome: 'TP2', pnlPct: pnlPct * 100, holdingPeriod: i };
    }

    if (price >= tp1Price) {
      const pnlNoSlip = (tp1Price - entryData.price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp1Price, outcome: 'TP1', pnlPct: pnlPct * 100, holdingPeriod: i };
    }
  }

  const exitTime = trade.entryTime + trade.maxHolding * 60 * 60 * 1000;
  const exitData = historicalData.find(d => d.timestamp === exitTime);
  const exitPrice = exitData ? exitData.price : entryData.price;

  const pnlNoSlip = (exitPrice - entryData.price) / entryData.price;
  const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);

  return { ...trade, exitTime, exitPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: trade.maxHolding };
}

// ─── BACKTEST ───

async function runBacktest(tf: typeof TIMEFRAMES[0]): Promise<BacktestSummary> {
  console.log('\n==========================================');
  console.log('TIMEFRAME: ' + tf.name);
  console.log('==========================================');

  const allData: Map<string, HistoricalData[]> = new Map();
  const bySession: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};
  const bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};

  // Idée 3: Detect regime
  REGIME_STATE = await detectRegime();
  console.log('[REGIME] Current: ' + REGIME_STATE);

  if (REGIME_STATE !== 'BULL') {
    console.log('[REGIME] NOT BULL - NO TRADING ALLOWED');
    return {
      timeframe: tf.name,
      totalSignals: 0,
      longSignals: 0,
      filteredByRegime: 0,
      filteredBySession: 0,
      filteredByWhitelist: 0,
      totalTrades: 0,
      winRate: 0,
      avgPnlPct: 0,
      totalPnlPct: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      profitFactor: 0,
      avgHoldingHours: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0 },
      bySession: {},
      bySymbol: {},
    };
  }

  // Fetch data for whitelisted tokens only
  for (const symbol of WHITELIST_TOKENS) {
    const data = await buildHistoricalData(symbol, DAYS_BACK, tf.binanceInterval);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const trades: Trade[] = [];
  let totalSignals = 0, longSignals = 0;
  let filteredByRegime = 0, filteredBySession = 0, filteredByWhitelist = 0;
  let maxScore = 0;

  for (const [symbol, data] of allData) {
    for (const point of data) {
      totalSignals++;

      // Idée 10: Session filter
      const session = isInAllowedSession(point.timestamp);
      if (!session) {
        filteredBySession++;
        continue;
      }

      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      maxScore = Math.max(maxScore, score.final);

      if (!score.isLongSignal) {
        continue;
      }

      longSignals++;

      const atrProxy = point.price * 0.005;
      const slDist = Math.max(0.004, atrProxy * 0.75);
      const tp1Dist = slDist;
      const tp2Dist = slDist * 2;

      trades.push({
        symbol,
        timeframe: tf.name,
        entryTime: point.timestamp,
        entryPrice: point.price,
        direction: 'LONG',
        score: score.final,
        fundingBps: point.funding * 10000,
        change24h: point.change24h,
        slDist,
        tp1Dist,
        tp2Dist,
        maxHolding: tf.maxHolding,
        exitTime: null,
        exitPrice: null,
        outcome: 'PENDING',
        pnlPct: 0,
        holdingPeriod: 0,
        session,
      });
    }
  }

  filteredByWhitelist = totalSignals - (WHITELIST_TOKENS.length * (allData.get('BTC')?.length || 0));

  console.log('[SIGNALS] Total: ' + totalSignals);
  console.log('[FILTERS] Session: ' + filteredBySession + ', Whitelist: ' + filteredByWhitelist);
  console.log('[TRADES] Generated: ' + trades.length + ' (max score: ' + maxScore + ')');

  // Simulate trades
  const completedTrades: Trade[] = [];
  for (const trade of trades) {
    const data = allData.get(trade.symbol) ?? [];
    const result = await simulateTrade(trade, data);
    completedTrades.push(result);
  }

  const completed = completedTrades.filter(t => t.outcome !== 'PENDING');
  const totalTrades = completed.length;

  if (totalTrades === 0) {
    return {
      timeframe: tf.name,
      totalSignals,
      longSignals,
      filteredByRegime,
      filteredBySession,
      filteredByWhitelist,
      totalTrades: 0,
      winRate: 0,
      avgPnlPct: 0,
      totalPnlPct: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      profitFactor: 0,
      avgHoldingHours: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0 },
      bySession: {},
      bySymbol: {},
    };
  }

  const wins = completed.filter(t => t.outcome !== 'SL');
  const winRate = (wins.length / totalTrades) * 100;

  const pnlValues = completed.map(t => t.pnlPct);
  const avgPnlPct = pnlValues.reduce((a, b) => a + b, 0) / totalTrades;
  const totalPnlPct = pnlValues.reduce((a, b) => a + b, 0);

  let maxDD = 0, peak = 0, cumulative = 0;
  for (const t of completed) {
    cumulative += t.pnlPct;
    peak = Math.max(peak, cumulative);
    maxDD = Math.max(maxDD, peak - cumulative);
  }

  const mean = avgPnlPct;
  const variance = pnlValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / totalTrades;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  const grossProfit = wins.reduce((sum, t) => sum + t.pnlPct, 0);
  const grossLoss = Math.abs(completed.filter(t => t.outcome === 'SL').reduce((sum, t) => sum + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const outcomes = {
    TP1: completed.filter(t => t.outcome === 'TP1').length,
    TP2: completed.filter(t => t.outcome === 'TP2').length,
    SL: completed.filter(t => t.outcome === 'SL').length,
  };

  const avgHolding = completed.reduce((sum, t) => sum + t.holdingPeriod, 0) / totalTrades;

  // By session
  for (const t of completed) {
    if (!bySession[t.session || 'unknown']) {
      bySession[t.session || 'unknown'] = { trades: 0, winRate: 0, totalPnl: 0 };
    }
    bySession[t.session || 'unknown'].trades++;
    bySession[t.session || 'unknown'].totalPnl += t.pnlPct;
  }
  for (const s in bySession) {
    const sessionTrades = completed.filter(t => (t.session || 'unknown') === s);
    const sessionWins = sessionTrades.filter(t => t.outcome !== 'SL').length;
    bySession[s].winRate = (sessionWins / sessionTrades.length) * 100;
  }

  // By symbol
  for (const t of completed) {
    if (!bySymbol[t.symbol]) {
      bySymbol[t.symbol] = { trades: 0, winRate: 0, totalPnl: 0 };
    }
    bySymbol[t.symbol].trades++;
    bySymbol[t.symbol].totalPnl += t.pnlPct;
  }
  for (const s in bySymbol) {
    const symbolTrades = completed.filter(t => t.symbol === s);
    const symbolWins = symbolTrades.filter(t => t.outcome !== 'SL').length;
    bySymbol[s].winRate = (symbolWins / symbolTrades.length) * 100;
  }

  return {
    timeframe: tf.name,
    totalSignals,
    longSignals,
    filteredByRegime,
    filteredBySession,
    filteredByWhitelist,
    totalTrades,
    winRate,
    avgPnlPct,
    totalPnlPct,
    maxDrawdownPct: maxDD,
    sharpe,
    profitFactor,
    avgHoldingHours: avgHolding,
    outcomes,
    bySession,
    bySymbol,
  };
}

// ─── TELEGRAM ───

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
      console.error('Telegram error:', data.description);
      return false;
    }
    console.log('Sent to Telegram');
    return true;
  } catch (e) {
    console.error('Error sending:', e);
    return false;
  }
}

function formatMessage(results: BacktestSummary[]): string {
  let m = '📊 <b>M15 BACKTEST - PHASE 1 RÉSULTATS</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += '<b>🔧 AMÉLIORATIONS PHASE 1:</b>\n';
  m += '✅ Régime filter BULL only\n';
  m += '✅ Lock 1H timeframe\n';
  m += '✅ Whitelist LINK + BTC\n';
  m += '✅ Session filter EU/US only\n\n';

  for (const r of results) {
    m += '<b>▶️ ' + r.timeframe + '</b>\n';
    m += 'Régime actuel: ' + REGIME_STATE + '\n\n';

    if (REGIME_STATE !== 'BULL') {
      m += '⛔ <b>TRADING BLOQUÉ</b> - Régime ≠ BULL\n\n';
      break;
    }

    m += 'Signaux: ' + r.totalSignals + ' → Trades: ' + r.totalTrades + '\n';
    m += 'Filtrés: Session(' + r.filteredBySession + ') Whitelist(' + r.filteredByWhitelist + ')\n\n';

    if (r.totalTrades > 0) {
      const pnlStr = r.totalPnlPct >= 0 ? '+' : '';
      m += 'Win Rate: <b>' + r.winRate.toFixed(1) + '%</b>\n';
      m += 'PNL: ' + pnlStr + r.totalPnlPct.toFixed(2) + '% (avg: ' + r.avgPnlPct.toFixed(3) + '%)\n';
      m += 'Sharpe: ' + r.sharpe.toFixed(2) + ' | PF: ' + r.profitFactor.toFixed(2) + '\n';
      m += 'TP1/TP2/SL: ' + r.outcomes.TP1 + '/' + r.outcomes.TP2 + '/' + r.outcomes.SL + '\n\n';

      m += '<b>Par session:</b>\n';
      for (const [session, data] of Object.entries(r.bySession)) {
        const pnlStr = data.totalPnl >= 0 ? '+' : '';
        m += '  ' + session + ': ' + pnlStr + data.totalPnl.toFixed(2) + '% (' + data.trades + ' trades, WR ' + data.winRate.toFixed(0) + '%)\n';
      }
      m += '\n';

      m += '<b>Par symbole:</b>\n';
      for (const [symbol, data] of Object.entries(r.bySymbol)) {
        const pnlStr = data.totalPnl >= 0 ? '+' : '';
        m += '  ' + symbol + ': ' + pnlStr + data.totalPnl.toFixed(2) + '% (' + data.trades + ' trades, WR ' + data.winRate.toFixed(0) + '%)\n';
      }
    } else {
      m += '⚠️ Aucun trade généré\n';
    }
    m += '\n';
  }

  m += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - PHASE 1');
  console.log('==========================================');
  console.log('Début: ' + new Date().toISOString());

  const results: BacktestSummary[] = [];

  for (const tf of TIMEFRAMES) {
    const summary = await runBacktest(tf);
    results.push(summary);
  }

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  for (const r of results) {
    console.log(r.timeframe + ': ' + r.totalTrades + ' trades, WR ' + r.winRate.toFixed(1) + '%, PNL ' + r.totalPnlPct.toFixed(2) + '%');
  }
  console.log('==========================================');

  const message = formatMessage(results);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
