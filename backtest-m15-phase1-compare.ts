/**
 * M15 BACKTEST - PHASE 1 COMPARAISON
 *
 * Compare:
 * 1. Baseline (aucun filtre Phase 1)
 * 2. + Whitelist LINK+BTC
 * 3. + Session filter
 * 4. Tous filtres Phase 1
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
const WHITELIST_TOKENS = ['LINK', 'BTC'];
const DAYS_BACK = 90;
const SLIPPAGE_BPS = 5;

const MIN_FUNDING_BPS = -2;
const MIN_SCORE = 60;

// Session filter
const ALLOWED_SESSIONS = [
  { name: 'EU_OPEN', start: 7, end: 10 },
  { name: 'EU_US_OVERLAP', start: 13, end: 16 },
];

// ─── TYPES ───

interface HistoricalData {
  timestamp: number;
  symbol: string;
  price: number;
  funding: number;
  vol24h: number;
  change24h: number;
}

interface Trade {
  symbol: string;
  entryTime: number;
  entryPrice: number;
  slDist: number;
  tp1Dist: number;
  tp2Dist: number;
  maxHolding: number;
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL';
  pnlPct: number;
  session?: string;
}

interface ComparisonResult {
  name: string;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
  profitFactor: number;
  slHitRate: number;
  outcomes: { TP1: number; TP2: number; SL: number };
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
      currentStart = data[data.length - 1][0] + 60 * 60 * 1000;
      if (data.length < 1000) break;
    } catch (e) {
      break;
    }
  }
  return allKlines;
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

async function buildHistoricalData(symbol: string, daysBack: number): Promise<HistoricalData[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;

  const klines = await fetchBinanceKlines(symbol, '1h', startTime, now);
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
    const vol24h = volume * 24 || currentVol24h;

    data.push({ timestamp, symbol, price: close, funding, vol24h, change24h });
  }

  return data;
}

function isInAllowedSession(timestamp: number): string | null {
  const hour = new Date(timestamp).getUTCHours();
  for (const session of ALLOWED_SESSIONS) {
    if (hour >= session.start && hour < session.end) {
      return session.name;
    }
  }
  return null;
}

function computeM15Score(data: HistoricalData, sessionScore: number): { final: number; isLongSignal: boolean } {
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
      return { ...trade, exitTime: nextTime, exitPrice: slPrice, outcome: 'SL', pnlPct: pnlPct * 100 };
    }

    if (price >= tp2Price) {
      const pnlNoSlip = (tp2Price - entryData.price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp2Price, outcome: 'TP2', pnlPct: pnlPct * 100 };
    }

    if (price >= tp1Price) {
      const pnlNoSlip = (tp1Price - entryData.price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp1Price, outcome: 'TP1', pnlPct: pnlPct * 100 };
    }
  }

  const exitTime = trade.entryTime + trade.maxHolding * 60 * 60 * 1000;
  const exitData = historicalData.find(d => d.timestamp === exitTime);
  const exitPrice = exitData ? exitData.price : entryData.price;
  const pnlNoSlip = (exitPrice - entryData.price) / entryData.price;
  const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);

  return { ...trade, exitTime, exitPrice, outcome: 'SL', pnlPct: pnlPct * 100 };
}

async function runBacktestVariant(tokens: string[], useSessionFilter: boolean): Promise<ComparisonResult> {
  const allData: Map<string, HistoricalData[]> = new Map();

  for (const symbol of tokens) {
    const data = await buildHistoricalData(symbol, DAYS_BACK);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const trades: Trade[] = [];

  for (const [symbol, data] of allData) {
    for (const point of data) {
      const session = isInAllowedSession(point.timestamp);

      if (useSessionFilter && !session) continue;

      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      if (!score.isLongSignal) continue;

      const atrProxy = point.price * 0.005;
      const slDist = Math.max(0.004, atrProxy * 0.75);
      const tp1Dist = slDist;
      const tp2Dist = slDist * 2;

      trades.push({
        symbol,
        entryTime: point.timestamp,
        entryPrice: point.price,
        slDist,
        tp1Dist,
        tp2Dist,
        maxHolding: 4,
        exitTime: null,
        exitPrice: null,
        outcome: 'SL',
        pnlPct: 0,
        session: session || 'all_day',
      });
    }
  }

  const completedTrades: Trade[] = [];
  for (const trade of trades) {
    const data = allData.get(trade.symbol) ?? [];
    const result = await simulateTrade(trade, data);
    completedTrades.push(result);
  }

  const completed = completedTrades.filter(t => t.outcome !== 'SL' || t.pnlPct !== 0);
  const totalTrades = completed.length;

  if (totalTrades === 0) {
    return {
      name: '',
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      sharpe: 0,
      profitFactor: 0,
      slHitRate: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0 },
    };
  }

  const wins = completed.filter(t => t.outcome !== 'SL');
  const winRate = (wins.length / totalTrades) * 100;

  const pnlValues = completed.map(t => t.pnlPct);
  const avgPnl = pnlValues.reduce((a, b) => a + b, 0) / totalTrades;
  const totalPnl = pnlValues.reduce((a, b) => a + b, 0);

  const mean = avgPnl;
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

  const slHitRate = (outcomes.SL / totalTrades) * 100;

  return {
    name: '',
    totalTrades,
    winRate,
    avgPnl,
    totalPnl,
    sharpe,
    profitFactor,
    slHitRate,
    outcomes,
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

function formatComparisonMessage(results: ComparisonResult[]): string {
  let m = '📊 <b>M15 BACKTEST - PHASE 1 COMPARAISON</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += 'Comparaison 4 variantes sur 1H, 90 jours:\n\n';

  const labels = [
    '1. BASELINE (tous tokens, 24/24)',
    '2. + WHITELIST (LINK+BTC only)',
    '3. + SESSION FILTER (EU/US only)',
    '4. + WHITELIST + SESSION',
  ];

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    m += '<b>' + labels[i] + '</b>\n';
    m += 'Trades: ' + r.totalTrades + '\n';
    if (r.totalTrades > 0) {
      const pnlStr = r.totalPnl >= 0 ? '+' : '';
      const emoji = r.totalPnl >= 0 ? '🟢' : '🔴';
      m += emoji + ' PNL: ' + pnlStr + r.totalPnl.toFixed(2) + '%\n';
      m += 'WR: ' + r.winRate.toFixed(1) + '% | Sharpe: ' + r.sharpe.toFixed(2) + '\n';
      m += 'PF: ' + r.profitFactor.toFixed(2) + ' | SL Hit: ' + r.slHitRate.toFixed(1) + '%\n';
      m += 'TP1/TP2/SL: ' + r.outcomes.TP1 + '/' + r.outcomes.TP2 + '/' + r.outcomes.SL + '\n';
    } else {
      m += '⚠️ Aucun trade\n';
    }
    m += '\n';
  }

  // Find best
  const best = results.filter(r => r.totalTrades > 0).sort((a, b) => b.totalPnl - a.totalPnl)[0];
  if (best && best.totalPnl > 0) {
    m += '🏆 <b>MEILLEUR: PNL positif!</b>\n\n';
  } else {
    m += '⚠️ <b>AUCUNE variante profitable</b>\n\n';
  }

  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - PHASE 1 COMPARAISON');
  console.log('==========================================');

  const results: ComparisonResult[] = [];

  console.log('\n[1/4] BASELINE (tous tokens, 24/24)');
  const r1 = await runBacktestVariant(ALL_TOKENS, false);
  r1.name = 'Baseline';
  results.push(r1);
  console.log('  -> ' + r1.totalTrades + ' trades, PNL ' + r1.totalPnl.toFixed(2) + '%');

  console.log('\n[2/4] + WHITELIST (LINK+BTC only)');
  const r2 = await runBacktestVariant(WHITELIST_TOKENS, false);
  r2.name = 'Whitelist';
  results.push(r2);
  console.log('  -> ' + r2.totalTrades + ' trades, PNL ' + r2.totalPnl.toFixed(2) + '%');

  console.log('\n[3/4] + SESSION FILTER (EU/US only)');
  const r3 = await runBacktestVariant(ALL_TOKENS, true);
  r3.name = 'Session Filter';
  results.push(r3);
  console.log('  -> ' + r3.totalTrades + ' trades, PNL ' + r3.totalPnl.toFixed(2) + '%');

  console.log('\n[4/4] + WHITELIST + SESSION');
  const r4 = await runBacktestVariant(WHITELIST_TOKENS, true);
  r4.name = 'Whitelist + Session';
  results.push(r4);
  console.log('  -> ' + r4.totalTrades + ' trades, PNL ' + r4.totalPnl.toFixed(2) + '%');

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  for (let i = 0; i < results.length; i++) {
    console.log((i + 1) + '. ' + results[i].name + ': ' + results[i].totalTrades + ' trades, PNL ' + results[i].totalPnl.toFixed(2) + '%');
  }
  console.log('==========================================');

  const message = formatComparisonMessage(results);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
