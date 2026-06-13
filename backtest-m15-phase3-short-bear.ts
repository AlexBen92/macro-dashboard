/**
 * M15 BACKTEST - PHASE 3: SHORT EN RÉGIME BEAR
 *
 * Idée 6: Mirror Strategy - SHORT quand marché BEAR
 * - LONG si funding < -0.5 bps + prix baisse + BULL regime
 * - SHORT si funding > +0.5 bps + prix monte + BEAR regime
 *
 * Objectif: Neutraliser la dépendance au régime
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

// ─── CONFIGURATION ───

const ALL_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const DAYS_BACK = 365;

const MIN_FUNDING_BPS_LONG = -0.5;
const MIN_FUNDING_BPS_SHORT = 0.5;
const MIN_SCORE = 60;
const SL_MULTIPLIER = 1.5;
const SLIPPAGE_BPS = 5;

// ─── TYPES ───

interface HistoricalData {
  timestamp: number;
  symbol: string;
  price: number;
  funding: number;
  vol24h: number;
  change24h: number;
  atr14?: number;
  sma50?: number;
  sma200?: number;
  regime?: 'BULL' | 'BEAR' | 'SIDEWAYS';
}

interface Trade {
  symbol: string;
  entryTime: number;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  slDist: number;
  tp1Dist: number;
  tp2Dist: number;
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL';
  pnlPct: number;
  holdingPeriod: number;
  regime?: 'BULL' | 'BEAR' | 'SIDEWAYS';
}

interface MirrorResult {
  regime: 'BULL' | 'BEAR' | 'SIDEWAYS' | 'ALL';
  longTrades: number;
  shortTrades: number;
  totalTrades: number;
  longPnl: number;
  shortPnl: number;
  totalPnl: number;
  winRate: number;
  sharpe: number;
  profitFactor: number;
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
  const map: Record<string, number> = { '1h': 60*60*1000, '4h': 4*60*60*1000 };
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

function calculateATR14(prices: number[]): number {
  if (prices.length < 14) return 0;
  let sum = 0;
  for (let i = Math.max(0, prices.length - 14); i < prices.length; i++) {
    const high = prices[i] * 1.01;
    const low = prices[i] * 0.99;
    const prevClose = i > 0 ? prices[i - 1] : prices[i];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    sum += tr;
  }
  return sum / 14;
}

function calculateSMA(data: number[], period: number): number {
  if (data.length < period) return 0;
  return data.slice(-period).reduce((a, b) => a + b, 0) / period;
}

async function buildHistoricalData(symbol: string, daysBack: number): Promise<HistoricalData[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;

  const klines1h = await fetchBinanceKlines(symbol, '1h', startTime, now);
  const klines4h = await fetchBinanceKlines(symbol, '4h', startTime, now);

  if (klines1h.length === 0) return [];

  const fundingHistory = await fetchBinanceFunding(symbol, startTime, now);
  const currentVol24h = await fetchBinanceTicker24h(symbol);

  const data: HistoricalData[] = [];
  const prices: number[] = [];

  for (let i = 0; i < klines1h.length; i++) {
    const kline = klines1h[i];
    const timestamp = kline[0];
    const close = parseFloat(kline[4]);
    const volume = parseFloat(kline[5]);
    const open = parseFloat(kline[1]);

    prices.push(close);

    const fundingEntry = fundingHistory.find((f: any) => Math.abs((f.fundingTime || f.time) - timestamp) < 8 * 60 * 60 * 1000);
    const funding = fundingEntry ? parseFloat(fundingEntry.fundingRate || '0') : 0;

    const change24h = ((close - open) / open) * 100;
    const vol24h = volume * 24 || currentVol24h;

    // Calculate SMA50/200 from 4H data
    const closes4h = klines4h.map(k => parseFloat(k[4]));
    const sma50 = calculateSMA(closes4h.slice(0, Math.floor(i / 4)), 50);
    const sma200 = calculateSMA(closes4h.slice(0, Math.floor(i / 4)), 200);

    // Determine regime
    let regime: 'BULL' | 'BEAR' | 'SIDEWAYS' = 'SIDEWAYS';
    if (sma50 > 0 && sma200 > 0) {
      const diffPct = ((sma50 - sma200) / sma200) * 100;
      if (diffPct > 1) regime = 'BULL';
      else if (diffPct < -1) regime = 'BEAR';
    }

    data.push({
      timestamp,
      symbol,
      price: close,
      funding,
      vol24h,
      change24h,
      atr14: calculateATR14(prices),
      sma50,
      sma200,
      regime,
    });
  }

  return data;
}

function computeM15Score(data: HistoricalData, sessionScore: number): {
  final: number;
  isLongSignal: boolean;
  isShortSignal: boolean;
} {
  let l1Score = 0, l2Score = 0, l3Score = 0;

  l1Score += Math.min(sessionScore, 100) * 0.25;
  if (data.vol24h >= 10_000_000) l1Score += 20; else if (data.vol24h >= 2_000_000) l1Score += 10;
  l1Score += 40;

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

  const momScore = absChange >= 2 ? 80 : absChange >= 1 ? 65 : absChange >= 0.3 ? 55 : 50;
  l3Score += momScore * 0.30;
  l3Score += (absChange >= 1 ? 70 : 50) * 0.25;
  l3Score += (Math.abs(fundingBps) >= 2 ? 75 : 50) * 0.25;
  l3Score += (absChange >= 2 ? 75 : absChange >= 1 ? 60 : 50) * 0.10;
  l3Score += 50 * 0.10;

  const final = Math.round(l1Score * 0.30 + l2Score * 0.40 + l3Score * 0.30);

  // LONG signal: funding négatif + prix baisse
  const isLongSignal = final >= MIN_SCORE && fundingBps < MIN_FUNDING_BPS_LONG && data.change24h < 0;

  // SHORT signal: funding positif + prix monte (mirror)
  const isShortSignal = final >= MIN_SCORE && fundingBps > MIN_FUNDING_BPS_SHORT && data.change24h > 0;

  return { final, isLongSignal, isShortSignal };
}

function getSessionScore(timestamp: number): number {
  const h = new Date(timestamp).getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

async function simulateTrade(trade: Trade, historicalData: HistoricalData[]): Promise<Trade> {
  const entryData = historicalData.find(d => d.timestamp === trade.entryTime);
  if (!entryData) return trade;

  const slPrice = trade.direction === 'LONG'
    ? entryData.price * (1 - trade.slDist)
    : entryData.price * (1 + trade.slDist);
  const tp1Price = trade.direction === 'LONG'
    ? entryData.price * (1 + trade.tp1Dist)
    : entryData.price * (1 - trade.tp1Dist);
  const tp2Price = trade.direction === 'LONG'
    ? entryData.price * (1 + trade.tp2Dist)
    : entryData.price * (1 - trade.tp2Dist);

  for (let i = 1; i <= 4; i++) {
    const nextTime = trade.entryTime + i * 60 * 60 * 1000;
    const nextData = historicalData.find(d => d.timestamp === nextTime);
    if (!nextData) continue;

    const price = nextData.price;

    const hitSL = trade.direction === 'LONG' ? price <= slPrice : price >= slPrice;
    const hitTP1 = trade.direction === 'LONG' ? price >= tp1Price : price <= tp1Price;
    const hitTP2 = trade.direction === 'LONG' ? price >= tp2Price : price <= tp2Price;

    if (hitSL) {
      const pnlNoSlip = trade.direction === 'LONG'
        ? (slPrice - entryData.price) / entryData.price
        : (entryData.price - slPrice) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: slPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: i };
    }

    if (hitTP2) {
      const pnlNoSlip = trade.direction === 'LONG'
        ? (tp2Price - entryData.price) / entryData.price
        : (entryData.price - tp2Price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp2Price, outcome: 'TP2', pnlPct: pnlPct * 100, holdingPeriod: i };
    }

    if (hitTP1) {
      const pnlNoSlip = trade.direction === 'LONG'
        ? (tp1Price - entryData.price) / entryData.price
        : (entryData.price - tp1Price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp1Price, outcome: 'TP1', pnlPct: pnlPct * 100, holdingPeriod: i };
    }
  }

  const exitTime = trade.entryTime + 4 * 60 * 60 * 1000;
  const exitData = historicalData.find(d => d.timestamp === exitTime);
  const exitPrice = exitData ? exitData.price : entryData.price;
  const pnlNoSlip = trade.direction === 'LONG'
    ? (exitPrice - entryData.price) / entryData.price
    : (entryData.price - exitPrice) / entryData.price;
  const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);

  return { ...trade, exitTime, exitPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: 4 };
}

async function runMirrorStrategy(): Promise<{
  byRegime: Record<string, MirrorResult>;
  total: MirrorResult;
}> {
  const allData: Map<string, HistoricalData[]> = new Map();

  console.log('\n[FETCH] Données 12 mois avec régimes...');
  for (const symbol of ALL_TOKENS) {
    console.log('  ' + symbol);
    const data = await buildHistoricalData(symbol, DAYS_BACK);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const tradesByRegime: Record<string, Trade[]> = {
    BULL: [],
    BEAR: [],
    SIDEWAYS: [],
  };

  for (const [symbol, data] of allData) {
    for (const point of data) {
      if (!point.regime) continue;

      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      const atr = point.atr14 || point.price * 0.005;
      const atrPct = atr / point.price;
      const slDist = Math.max(0.004, atrPct * SL_MULTIPLIER);
      const tp1Dist = slDist;
      const tp2Dist = slDist * 2;

      // LONG en BULL
      if (point.regime === 'BULL' && score.isLongSignal) {
        tradesByRegime.BULL.push({
          symbol,
          entryTime: point.timestamp,
          entryPrice: point.price,
          direction: 'LONG',
          slDist,
          tp1Dist,
          tp2Dist,
          exitTime: null,
          exitPrice: null,
          outcome: 'SL',
          pnlPct: 0,
          holdingPeriod: 0,
          regime: point.regime,
        });
      }

      // SHORT en BEAR
      if (point.regime === 'BEAR' && score.isShortSignal) {
        tradesByRegime.BEAR.push({
          symbol,
          entryTime: point.timestamp,
          entryPrice: point.price,
          direction: 'SHORT',
          slDist,
          tp1Dist,
          tp2Dist,
          exitTime: null,
          exitPrice: null,
          outcome: 'SL',
          pnlPct: 0,
          holdingPeriod: 0,
          regime: point.regime,
        });
      }
    }
  }

  console.log('[TRADES] BULL (LONG): ' + tradesByRegime.BULL.length + ', BEAR (SHORT): ' + tradesByRegime.BEAR.length);

  // Simulate trades
  const completed: Record<string, Trade[]> = { BULL: [], BEAR: [], SIDEWAYS: [] };

  for (const regime of ['BULL', 'BEAR', 'SIDEWAYS'] as const) {
    for (const trade of tradesByRegime[regime]) {
      const data = allData.get(trade.symbol) ?? [];
      const result = await simulateTrade(trade, data);
      completed[regime].push(result);
    }
  }

  // Calculate stats
  function calcStats(trades: Trade[], regime: string): MirrorResult {
    const longs = trades.filter(t => t.direction === 'LONG');
    const shorts = trades.filter(t => t.direction === 'SHORT');

    const longsCompleted = longs.filter(t => t.outcome !== 'SL' || t.pnlPct !== 0);
    const shortsCompleted = shorts.filter(t => t.outcome !== 'SL' || t.pnlPct !== 0);

    const longPnl = longsCompleted.reduce((sum, t) => sum + t.pnlPct, 0);
    const shortPnl = shortsCompleted.reduce((sum, t) => sum + t.pnlPct, 0);

    const allCompleted = [...longsCompleted, ...shortsCompleted];
    const totalTrades = allCompleted.length;

    if (totalTrades === 0) {
      return {
        regime: regime as any,
        longTrades: longsCompleted.length,
        shortTrades: shortsCompleted.length,
        totalTrades: 0,
        longPnl: 0,
        shortPnl: 0,
        totalPnl: 0,
        winRate: 0,
        sharpe: 0,
        profitFactor: 0,
      };
    }

    const wins = allCompleted.filter(t => t.outcome !== 'SL');
    const winRate = (wins.length / totalTrades) * 100;

    const pnlValues = allCompleted.map(t => t.pnlPct);
    const avgPnl = pnlValues.reduce((a, b) => a + b, 0) / totalTrades;
    const totalPnl = pnlValues.reduce((a, b) => a + b, 0);

    const mean = avgPnl;
    const variance = pnlValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / totalTrades;
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

    const grossProfit = wins.reduce((sum, t) => sum + t.pnlPct, 0);
    const grossLoss = Math.abs(allCompleted.filter(t => t.outcome === 'SL').reduce((sum, t) => sum + t.pnlPct, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    return {
      regime: regime as any,
      longTrades: longsCompleted.length,
      shortTrades: shortsCompleted.length,
      totalTrades,
      longPnl,
      shortPnl,
      totalPnl,
      winRate,
      sharpe,
      profitFactor,
    };
  }

  const byRegime: Record<string, MirrorResult> = {};
  for (const regime of ['BULL', 'BEAR', 'SIDEWAYS']) {
    byRegime[regime] = calcStats(completed[regime], regime);
  }

  // Total
  const allTrades = [...completed.BULL, ...completed.BEAR];
  const total = calcStats(allTrades, 'ALL');

  return { byRegime, total };
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

function formatMirrorMessage(results: { byRegime: Record<string, MirrorResult>; total: MirrorResult }): string {
  let m = '📊 <b>M15 BACKTEST - PHASE 3: MIRROR STRATEGY</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += '<b>CONFIG:</b>\n';
  m += '• Timeframe: 1H\n';
  m += '• Période: 12 mois\n';
  m += '• SL: 1.5x ATR\n\n';

  m += '<b>MIRROR LOGIC:</b>\n';
  m += '• <b>BULL</b>: LONG si funding &lt; -0.5 bps\n';
  m += '• <b>BEAR</b>: SHORT si funding &gt; +0.5 bps\n';
  m += '• <b>SIDEWAYS</b>: Pas de trade\n\n';

  // Results by regime
  for (const regime of ['BULL', 'BEAR', 'SIDEWAYS']) {
    const r = results.byRegime[regime];
    const pnlStr = r.totalPnl >= 0 ? '+' : '';
    const emoji = r.totalPnl >= 0 ? '🟢' : '🔴';

    m += '<b>━━━ ' + regime + ' ━━━</b>\n';

    if (regime === 'SIDEWAYS') {
      m += '⛔ Pas de trading en SIDEWAYS\n\n';
      continue;
    }

    m += emoji + ' PNL: ' + pnlStr + r.totalPnl.toFixed(2) + '%\n';
    m += 'Trades: ' + r.totalTrades;

    if (regime === 'BULL') {
      m += ' (LONG)\n';
    } else {
      m += ' (SHORT)\n';
    }

    m += 'Win Rate: ' + r.winRate.toFixed(1) + '%\n';
    m += 'Sharpe: ' + r.sharpe.toFixed(2) + '\n';
    m += 'PF: ' + r.profitFactor.toFixed(2) + '\n\n';
  }

  // Total
  m += '<b>━━━ TOTAL (12 mois) ━━━</b>\n';
  const totalPnlStr = results.total.totalPnl >= 0 ? '+' : '';
  const totalEmoji = results.total.totalPnl >= 0 ? '🟢' : '🔴';
  m += totalEmoji + ' PNL: ' + totalPnlStr + results.total.totalPnl.toFixed(2) + '%\n';
  m += 'Trades: ' + results.total.totalTrades + '\n';
  m += 'Win Rate: ' + results.total.winRate.toFixed(1) + '%\n';
  m += 'Sharpe: ' + results.total.sharpe.toFixed(2) + '\n';
  m += 'PF: ' + results.total.profitFactor.toFixed(2) + '\n\n';

  // Validation
  m += '<b>━━━ VALIDATION ━━━</b>\n';

  if (results.total.totalPnl > 0 && results.total.sharpe > 0.5) {
    m += '✅ <b>STRATÉGIE VALIDÉE</b>\n';
    m += '   Mirror strategy neutralise la dépendance au régime!\n\n';
  } else if (results.total.totalPnl > 0) {
    m += '⚠️ <b>POSITIF MAIS FAIBLE</b>\n';
    m += '   PNL positif mais Sharpe &lt; 0.5\n\n';
  } else {
    m += '❌ <b>STRATÉGIE INVALIDE</b>\n';
    m += '   Mirror strategy n\'améliore pas les résultats.\n\n';
  }

  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - PHASE 3: MIRROR STRATEGY');
  console.log('==========================================');

  const results = await runMirrorStrategy();

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  console.log('BULL (LONG): ' + results.byRegime.BULL.totalTrades + ' trades, PNL ' + results.byRegime.BULL.totalPnl.toFixed(2) + '%');
  console.log('BEAR (SHORT): ' + results.byRegime.BEAR.totalTrades + ' trades, PNL ' + results.byRegime.BEAR.totalPnl.toFixed(2) + '%');
  console.log('TOTAL: ' + results.total.totalTrades + ' trades, PNL ' + results.total.totalPnl.toFixed(2) + '%');
  console.log('==========================================');

  const message = formatMirrorMessage(results);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
