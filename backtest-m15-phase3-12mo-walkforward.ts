/**
 * M15 BACKTEST - PHASE 3: 12 MOIS + WALK-FORWARD
 *
 * Idée 11: Étendre à 12 mois + Walk-forward validation
 * - IS (In-Sample): 8 mois
 * - OOS (Out-of-Sample): 4 mois
 * - Si Sharpe OOS < 0.5 → stratégie invalide
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

// ─── CONFIGURATION PHASE 3 ───

const ALL_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const TOTAL_DAYS = 365; // 12 mois
const IS_DAYS = 240; // 8 mois In-Sample
const OOS_DAYS = 125; // ~4 mois Out-of-Sample

// Optimal params from Phase 2
const MIN_FUNDING_BPS = -0.5;
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
}

interface Trade {
  symbol: string;
  entryTime: number;
  entryPrice: number;
  slDist: number;
  tp1Dist: number;
  tp2Dist: number;
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL';
  pnlPct: number;
  holdingPeriod: number;
  sample: 'IS' | 'OOS';
}

interface WalkForwardResult {
  period: 'IS' | 'OOS' | 'TOTAL';
  days: number;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
  profitFactor: number;
  maxDD: number;
  avgTradesPerDay: number;
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

function calculateATR14(data: HistoricalData[]): number {
  if (data.length < 14) return 0;
  let sum = 0;
  for (let i = Math.max(0, data.length - 14); i < data.length; i++) {
    const high = data[i].price * 1.01;
    const low = data[i].price * 0.99;
    const prevClose = i > 0 ? data[i - 1].price : data[i].price;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    sum += tr;
  }
  return sum / 14;
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

  for (let i = 0; i < data.length; i++) {
    const slice = data.slice(0, i + 1);
    data[i].atr14 = calculateATR14(slice);
  }

  return data;
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

  for (let i = 1; i <= 4; i++) {
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

  const exitTime = trade.entryTime + 4 * 60 * 60 * 1000;
  const exitData = historicalData.find(d => d.timestamp === exitTime);
  const exitPrice = exitData ? exitData.price : entryData.price;
  const pnlNoSlip = (exitPrice - entryData.price) / entryData.price;
  const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);

  return { ...trade, exitTime, exitPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: 4 };
}

async function runWalkForward(): Promise<{ is: WalkForwardResult; oos: WalkForwardResult; total: WalkForwardResult }> {
  const allData: Map<string, HistoricalData[]> = new Map();

  console.log('\n[FETCH] Données 12 mois...');
  for (const symbol of ALL_TOKENS) {
    console.log('  ' + symbol);
    const data = await buildHistoricalData(symbol, TOTAL_DAYS);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const now = Date.now();
  const oosStartTime = now - OOS_DAYS * 24 * 60 * 60 * 1000;

  const tradesISTemp: Trade[] = [];
  const tradesOOSTemp: Trade[] = [];

  for (const [symbol, data] of allData) {
    for (const point of data) {
      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      if (!score.isLongSignal) continue;

      const atr = point.atr14 || point.price * 0.005;
      const atrPct = atr / point.price;
      const slDist = Math.max(0.004, atrPct * SL_MULTIPLIER);
      const tp1Dist = slDist;
      const tp2Dist = slDist * 2;

      const sample: 'IS' | 'OOS' = point.timestamp < oosStartTime ? 'IS' : 'OOS';

      const trade: Trade = {
        symbol,
        entryTime: point.timestamp,
        entryPrice: point.price,
        slDist,
        tp1Dist,
        tp2Dist,
        exitTime: null,
        exitPrice: null,
        outcome: 'SL',
        pnlPct: 0,
        holdingPeriod: 0,
        sample,
      };

      if (sample === 'IS') {
        tradesISTemp.push(trade);
      } else {
        tradesOOSTemp.push(trade);
      }
    }
  }

  console.log('[TRADES] IS: ' + tradesISTemp.length + ', OOS: ' + tradesOOSTemp.length);

  // Simulate trades
  const completedIS: Trade[] = [];
  const completedOOS: Trade[] = [];

  for (const trade of tradesISTemp) {
    const data = allData.get(trade.symbol) ?? [];
    const result = await simulateTrade(trade, data);
    completedIS.push(result);
  }

  for (const trade of tradesOOSTemp) {
    const data = allData.get(trade.symbol) ?? [];
    const result = await simulateTrade(trade, data);
    completedOOS.push(result);
  }

  // Calculate stats for each period
  function calcStats(trades: Trade[], days: number, periodName: 'IS' | 'OOS' | 'TOTAL'): WalkForwardResult {
    const completed = trades.filter(t => t.outcome !== 'SL' || t.pnlPct !== 0);
    const totalTrades = completed.length;

    if (totalTrades === 0) {
      return {
        period: periodName,
        days,
        totalTrades: 0,
        winRate: 0,
        avgPnl: 0,
        totalPnl: 0,
        sharpe: 0,
        profitFactor: 0,
        maxDD: 0,
        avgTradesPerDay: 0,
        outcomes: { TP1: 0, TP2: 0, SL: 0 },
      };
    }

    const wins = completed.filter(t => t.outcome !== 'SL');
    const winRate = (wins.length / totalTrades) * 100;

    const pnlValues = completed.map(t => t.pnlPct);
    const avgPnl = pnlValues.reduce((a, b) => a + b, 0) / totalTrades;
    const totalPnl = pnlValues.reduce((a, b) => a + b, 0);

    // Sharpe
    const mean = avgPnl;
    const variance = pnlValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / totalTrades;
    const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(365 / days * 252) : 0;

    // Profit Factor
    const grossProfit = wins.reduce((sum, t) => sum + t.pnlPct, 0);
    const grossLoss = Math.abs(completed.filter(t => t.outcome === 'SL').reduce((sum, t) => sum + t.pnlPct, 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : 0;

    // Max Drawdown
    let maxDD = 0, peak = 0, cumulative = 0;
    for (const t of completed) {
      cumulative += t.pnlPct;
      peak = Math.max(peak, cumulative);
      maxDD = Math.max(maxDD, peak - cumulative);
    }

    const outcomes = {
      TP1: completed.filter(t => t.outcome === 'TP1').length,
      TP2: completed.filter(t => t.outcome === 'TP2').length,
      SL: completed.filter(t => t.outcome === 'SL').length,
    };

    return {
      period: periodName,
      days,
      totalTrades,
      winRate,
      avgPnl,
      totalPnl,
      sharpe,
      profitFactor,
      maxDD,
      avgTradesPerDay: totalTrades / days,
      outcomes,
    };
  }

  const is = calcStats(completedIS, IS_DAYS, 'IS');
  const oos = calcStats(completedOOS, OOS_DAYS, 'OOS');
  const total = calcStats([...completedIS, ...completedOOS], TOTAL_DAYS, 'TOTAL');

  return { is, oos, total };
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

function formatWalkForwardMessage(results: { is: WalkForwardResult; oos: WalkForwardResult; total: WalkForwardResult }): string {
  let m = '📊 <b>M15 BACKTEST - PHASE 3: WALK-FORWARD 12 MOIS</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += '<b>CONFIG:</b>\n';
  m += '• Timeframe: 1H\n';
  m += '• Funding: &lt; -0.5 bps\n';
  m += '• Score: ≥ 60\n';
  m += '• SL: 1.5x ATR\n\n';

  m += '<b>WALK-FORWARD:</b>\n';
  m += '• IS (In-Sample): 8 mois (' + results.is.days + ' jours)\n';
  m += '• OOS (Out-of-Sample): ~4 mois (' + results.oos.days + ' jours)\n';
  m += '• Total: 12 mois (' + results.total.days + ' jours)\n\n';

  // IS Results
  m += '<b>━━━ IS (In-Sample) ━━━</b>\n';
  const isPnlStr = results.is.totalPnl >= 0 ? '+' : '';
  const isEmoji = results.is.totalPnl >= 0 ? '🟢' : '🔴';
  m += isEmoji + ' PNL: ' + isPnlStr + results.is.totalPnl.toFixed(2) + '%\n';
  m += 'Trades: ' + results.is.totalTrades + ' (' + results.is.avgTradesPerDay.toFixed(1) + '/j)\n';
  m += 'Win Rate: ' + results.is.winRate.toFixed(1) + '%\n';
  m += 'Sharpe: ' + results.is.sharpe.toFixed(2) + '\n';
  m += 'Profit Factor: ' + results.is.profitFactor.toFixed(2) + '\n';
  m += 'Max DD: ' + results.is.maxDD.toFixed(2) + '%\n';
  m += 'TP1/TP2/SL: ' + results.is.outcomes.TP1 + '/' + results.is.outcomes.TP2 + '/' + results.is.outcomes.SL + '\n\n';

  // OOS Results
  m += '<b>━━━ OOS (Out-of-Sample) ━━━</b>\n';
  const oosPnlStr = results.oos.totalPnl >= 0 ? '+' : '';
  const oosEmoji = results.oos.totalPnl >= 0 ? '🟢' : '🔴';
  m += oosEmoji + ' PNL: ' + oosPnlStr + results.oos.totalPnl.toFixed(2) + '%\n';
  m += 'Trades: ' + results.oos.totalTrades + ' (' + results.oos.avgTradesPerDay.toFixed(1) + '/j)\n';
  m += 'Win Rate: ' + results.oos.winRate.toFixed(1) + '%\n';
  m += 'Sharpe: ' + results.oos.sharpe.toFixed(2) + '\n';
  m += 'Profit Factor: ' + results.oos.profitFactor.toFixed(2) + '\n';
  m += 'Max DD: ' + results.oos.maxDD.toFixed(2) + '%\n';
  m += 'TP1/TP2/SL: ' + results.oos.outcomes.TP1 + '/' + results.oos.outcomes.TP2 + '/' + results.oos.outcomes.SL + '\n\n';

  // Validation
  m += '<b>━━━ VALIDATION ━━━</b>\n';

  if (results.oos.sharpe >= 0.5) {
    m += '✅ <b>VALIDÉ</b>: Sharpe OOS ≥ 0.5 (' + results.oos.sharpe.toFixed(2) + ')\n';
    m += '   La stratégie est robuste!\n\n';
  } else if (results.oos.sharpe >= 0) {
    m += '⚠️ <b>FAIBLE</b>: Sharpe OOS = ' + results.oos.sharpe.toFixed(2) + ' (&lt; 0.5)\n';
    m += '   La stratégie fonctionne mais fragile.\n\n';
  } else {
    m += '❌ <b>INVALIDE</b>: Sharpe OOS &lt; 0 (' + results.oos.sharpe.toFixed(2) + ')\n';
    m += '   La stratégie ne marche pas en OOS.\n\n';
  }

  // Total
  m += '<b>━━━ TOTAL (12 mois) ━━━</b>\n';
  const totalPnlStr = results.total.totalPnl >= 0 ? '+' : '';
  const totalEmoji = results.total.totalPnl >= 0 ? '🟢' : '🔴';
  m += totalEmoji + ' PNL: ' + totalPnlStr + results.total.totalPnl.toFixed(2) + '%\n';
  m += 'Trades: ' + results.total.totalTrades + '\n';
  m += 'Sharpe: ' + results.total.sharpe.toFixed(2) + '\n';
  m += 'PF: ' + results.total.profitFactor.toFixed(2) + '\n\n';

  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - PHASE 3: WALK-FORWARD 12 MOIS');
  console.log('==========================================');

  const results = await runWalkForward();

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  console.log('IS: ' + results.is.totalTrades + ' trades, PNL ' + results.is.totalPnl.toFixed(2) + '%, Sharpe ' + results.is.sharpe.toFixed(2));
  console.log('OOS: ' + results.oos.totalTrades + ' trades, PNL ' + results.oos.totalPnl.toFixed(2) + '%, Sharpe ' + results.oos.sharpe.toFixed(2));
  console.log('TOTAL: ' + results.total.totalTrades + ' trades, PNL ' + results.total.totalPnl.toFixed(2) + '%');
  console.log('==========================================');

  const message = formatWalkForwardMessage(results);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
