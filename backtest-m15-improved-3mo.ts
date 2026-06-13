/**
 * M15 BACKTEST - AMÉLIORÉ (3 mois)
 *
 * AMÉLIORATIONS APPLIQUÉES:
 * 1. ÉLIMINER les SHORT (seulement LONG)
 * 2. Filtrer funding < -2 bps (fort négatif)
 * 3. Signaux contrarian: price baisse + funding négatif
 * 4. Focus sur 5m (meilleur ratio)
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

import { VOL_WINDOWS, HL_TAKER_FEE, HL_MAKER_FEE, HL_ROUND_TRIP } from './src/lib/constants';

const HL_FEES_ROUND_TRIP = HL_ROUND_TRIP;

// ─── CONFIGURATION AMÉLIORÉE ───

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const DAYS_BACK = 90; // 3 mois

const TIMEFRAMES = [
  { name: '5m', interval: '5m', binanceInterval: '5m', maxHolding: 12 },
  { name: '15m', interval: '15m', binanceInterval: '15m', maxHolding: 8 },
  { name: '30m', interval: '30m', binanceInterval: '30m', maxHolding: 4 },
  { name: '1h', interval: '1h', binanceInterval: '1h', maxHolding: 4 },
];

const SLIPPAGE_BPS = 5;
const STRESS_MULTIPLIER = 1.0;

// ─── FILTRES AMÉLIORÉS ───

const MIN_FUNDING_BPS = -2; // Funding doit être < -2 bps (0.02%)
const MIN_SCORE = 60; // Score minimum
const LONG_ONLY = true; // Éliminer les SHORT
const REQUIRE_CONTRARIAN = true; // Prix doit baisser (contrarian)

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
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL' | 'PENDING';
  pnlPct: number;
  holdingPeriod: number;
}

interface BacktestSummary {
  timeframe: string;
  totalSignals: number;
  longSignals: number;
  filteredSignals: number;
  totalTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  profitFactor: number;
  avgHoldingHours: number;
  outcomes: { TP1: number; TP2: number; SL: number };
  bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }>;
}

// ─── API HELPERS ───

async function fetchBinanceKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  // Pour 90 jours, on doit faire plusieurs requêtes
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
  const map: Record<string, number> = { '5m': 5*60*1000, '15m': 15*60*1000, '30m': 30*60*1000, '1h': 60*60*1000 };
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
  const map: Record<string, number> = { '5m': 5/60, '15m': 0.25, '30m': 0.5, '1h': 1 };
  return map[interval] || 1;
}

// ─── M15 SCORING AMÉLIORÉ ───

function computeM15ScoreImproved(data: HistoricalData, sessionScore: number): { final: number; l1: number; l2: number; l3: number; isLongSignal: boolean } {
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

  // Contrarian bonus: prix baisse + funding négatif
  let trendScore = 50;
  if (data.change24h < -0.5 && fundingBps < -2) trendScore = 100; // Parfait contrarian
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

  // Signal LONG si:
  // 1. Score >= MIN_SCORE
  // 2. Funding < -2 bps
  // 3. (Optionnel) Prix baisse (contrarian)
  const fundingBpsCheck = fundingBps < MIN_FUNDING_BPS;
  const contrarianCheck = !REQUIRE_CONTRARIAN || data.change24h < 0;
  const isLongSignal = final >= MIN_SCORE && fundingBpsCheck && contrarianCheck;

  return { final, l1: Math.round(l1Score), l2: Math.round(l2Score), l3: Math.round(l3Score), isLongSignal };
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

  const slPrice = trade.direction === 'LONG' ? entryData.price * (1 - trade.slDist) : entryData.price * (1 + trade.slDist);
  const tp1Price = trade.direction === 'LONG' ? entryData.price * (1 + trade.tp1Dist) : entryData.price * (1 - trade.tp1Dist);
  const tp2Price = trade.direction === 'LONG' ? entryData.price * (1 + trade.tp2Dist) : entryData.price * (1 - trade.tp2Dist);

  const intervalHours = getIntervalHours(trade.timeframe);

  for (let i = 1; i <= trade.maxHolding; i++) {
    const nextTime = trade.entryTime + i * intervalHours * 60 * 60 * 1000;
    const nextData = historicalData.find(d => d.timestamp === nextTime);

    if (!nextData) continue;

    const price = nextData.price;

    const hitSL = trade.direction === 'LONG' ? price <= slPrice : price >= slPrice;
    const hitTP1 = trade.direction === 'LONG' ? price >= tp1Price : price <= tp1Price;
    const hitTP2 = trade.direction === 'LONG' ? price >= tp2Price : price <= tp2Price;

    if (hitSL) {
      const pnlNoSlip = trade.direction === 'LONG' ? (slPrice - entryData.price) / entryData.price : (entryData.price - slPrice) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: slPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: i };
    }

    if (hitTP2) {
      const pnlNoSlip = trade.direction === 'LONG' ? (tp2Price - entryData.price) / entryData.price : (entryData.price - tp2Price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp2Price, outcome: 'TP2', pnlPct: pnlPct * 100, holdingPeriod: i };
    }

    if (hitTP1) {
      const pnlNoSlip = trade.direction === 'LONG' ? (tp1Price - entryData.price) / entryData.price : (entryData.price - tp1Price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp1Price, outcome: 'TP1', pnlPct: pnlPct * 100, holdingPeriod: i };
    }
  }

  const exitTime = trade.entryTime + trade.maxHolding * intervalHours * 60 * 60 * 1000;
  const exitData = historicalData.find(d => d.timestamp === exitTime);
  const exitPrice = exitData ? exitData.price : entryData.price;

  const pnlNoSlip = trade.direction === 'LONG' ? (exitPrice - entryData.price) / entryData.price : (entryData.price - exitPrice) / entryData.price;
  const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);

  return { ...trade, exitTime, exitPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: trade.maxHolding, reason: 'Timeout' };
}

// ─── BACKTEST PER TIMEFRAME ───

async function runBacktestTimeframe(tf: typeof TIMEFRAMES[0]): Promise<BacktestSummary> {
  console.log('\n==========================================');
  console.log('TIMEFRAME: ' + tf.name);
  console.log('==========================================');

  const allData: Map<string, HistoricalData[]> = new Map();
  const bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};

  for (const symbol of TOP_TOKENS) {
    const data = await buildHistoricalData(symbol, DAYS_BACK, tf.binanceInterval);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const trades: Trade[] = [];
  let totalSignals = 0, longSignals = 0, filteredSignals = 0;
  let maxScore = 0;

  for (const [symbol, data] of allData) {
    for (const point of data) {
      totalSignals++;
      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15ScoreImproved(point, sessionScore);

      maxScore = Math.max(maxScore, score.final);

      if (!score.isLongSignal) {
        filteredSignals++;
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
      });
    }
  }

  console.log('[SIGNALS] Total: ' + totalSignals + ', LONG: ' + longSignals + ', Filtrés: ' + filteredSignals);
  console.log('[TRADES] Trades générés: ' + trades.length + ' (max score: ' + maxScore + ')');

  // Simuler trades
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
      timeframe: tf.name, totalSignals, longSignals, filteredSignals, totalTrades: 0,
      winRate: 0, avgPnlPct: 0, totalPnlPct: 0, maxDrawdownPct: 0,
      sharpe: 0, profitFactor: 0, avgHoldingHours: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0 }, bySymbol: {}
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
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252 * 24) : 0;

  // Profit Factor
  const grossProfit = wins.reduce((sum, t) => sum + t.pnlPct, 0);
  const grossLoss = Math.abs(completed.filter(t => t.outcome === 'SL').reduce((sum, t) => sum + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

  const outcomes = {
    TP1: completed.filter(t => t.outcome === 'TP1').length,
    TP2: completed.filter(t => t.outcome === 'TP2').length,
    SL: completed.filter(t => t.outcome === 'SL').length,
  };

  const avgHolding = completed.reduce((sum, t) => sum + t.holdingPeriod, 0) / totalTrades * getIntervalHours(tf.name);

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
    filteredSignals,
    totalTrades,
    winRate,
    avgPnlPct,
    totalPnlPct,
    maxDrawdownPct: maxDD,
    sharpe,
    profitFactor,
    avgHoldingHours: avgHolding,
    outcomes,
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
  let message = '[BACKTEST] M15 AMELIORE - 3 MOIS\n\n';
  message += 'Periode: ' + DAYS_BACK + ' jours (' + (DAYS_BACK / 30).toFixed(1) + ' mois)\n';
  message += 'Frais HL: ' + (HL_FEES_ROUND_TRIP * 100).toFixed(3) + '% RT\n';
  message += 'Slippage: ' + SLIPPAGE_BPS + ' bps\n\n';

  message += '========================================\n';
  message += 'AMELIORATIONS APPLIQUEES:\n';
  message += '- LONG ONLY (pas de SHORT)\n';
  message += '- Funding lt -2 bps (fort negatif)\n';
  message += '- Signaux contrarian (prix baisse)\n';
  message += '- Score min: ' + MIN_SCORE + '/100\n';
  message += '========================================\n\n';

  for (const r of results) {
    message += '[' + r.timeframe + ']\n';
    message += '  Signaux: ' + r.totalSignals + ' -> LONG: ' + r.longSignals + ' -> Trades: ' + r.totalTrades + '\n';
    message += '  Filtrés: ' + r.filteredSignals + ' (' + ((r.filteredSignals / r.totalSignals) * 100).toFixed(1) + '%)\n';
    if (r.totalTrades > 0) {
      message += '  Win Rate: ' + r.winRate.toFixed(1) + '%\n';
      message += '  Avg PNL: ' + r.avgPnlPct.toFixed(3) + '%\n';
      message += '  Total PNL: ' + r.totalPnlPct.toFixed(2) + '%\n';
      message += '  Max DD: ' + r.maxDrawdownPct.toFixed(2) + '%\n';
      message += '  Sharpe: ' + r.sharpe.toFixed(2) + '\n';
      message += '  Profit Factor: ' + r.profitFactor.toFixed(2) + '\n';
      message += '  TP1/TP2/SL: ' + r.outcomes.TP1 + '/' + r.outcomes.TP2 + '/' + r.outcomes.SL + '\n';
    } else {
      message += '  Aucun trade\n';
    }
    message += '\n';
  }

  // Meilleur timeframe
  const bestTF = results.filter(r => r.totalTrades >= 10).sort((a, b) => b.totalPnlPct - a.totalPnlPct)[0];
  if (bestTF) {
    message += '[MEILLEUR TF]\n';
    message += bestTF.timeframe + ' -> PNL: ' + bestTF.totalPnlPct.toFixed(2) + '% (WR: ' + bestTF.winRate.toFixed(1) + '%)\n\n';
  }

  // Top symbols
  message += '[TOP SYMBOLS] (min 5 trades)\n';
  const allSymbols: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};
  for (const r of results) {
    for (const [symbol, data] of Object.entries(r.bySymbol)) {
      if (!allSymbols[symbol]) {
        allSymbols[symbol] = { trades: 0, winRate: 0, totalPnl: 0 };
      }
      allSymbols[symbol].trades += data.trades;
      allSymbols[symbol].totalPnl += data.totalPnl;
    }
  }
  for (const s in allSymbols) {
    if (allSymbols[s].trades >= 5) {
      const symbolWins = results.reduce((sum, r) => {
        const st = r.bySymbol[s];
        return sum + (st ? st.trades * (st.winRate / 100) : 0);
      }, 0);
      allSymbols[s].winRate = symbolWins / allSymbols[s].trades;
    }
  }
  const sortedSymbols = Object.entries(allSymbols)
    .filter(([_, d]) => d.trades >= 5)
    .sort((a, b) => b[1].totalPnl - a[1].totalPnl)
    .slice(0, 5);

  for (const [symbol, data] of sortedSymbols) {
    const pnl = data.totalPnl >= 0 ? '+' : '';
    message += symbol + ': ' + pnl + data.totalPnl.toFixed(2) + '% (' + data.trades + ' trades, ' + data.winRate.toFixed(0) + '% WR)\n';
  }

  message += '\nhttps://macro-dashboard-lemon.vercel.app/';
  return message;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - AMELIORÉ (3 MOIS)');
  console.log('==========================================');
  console.log('Début: ' + new Date().toISOString());

  const results: BacktestSummary[] = [];

  for (const tf of TIMEFRAMES) {
    const summary = await runBacktestTimeframe(tf);
    results.push(summary);
  }

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  for (const r of results) {
    if (r.totalTrades > 0) {
      console.log(r.timeframe + ': ' + r.totalTrades + ' trades, WR ' + r.winRate.toFixed(1) + '%, PNL ' + r.totalPnlPct.toFixed(2) + '%');
    } else {
      console.log(r.timeframe + ': 0 trades');
    }
  }
  console.log('==========================================');

  const message = formatMessage(results);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
