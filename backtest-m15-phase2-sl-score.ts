/**
 * M15 BACKTEST - PHASE 2: SL DYNAMIQUE + SCORE OPTIMISATION
 *
 * Combine:
 * - Idée 2: Funding < -0.5 bps (validé)
 * - Idée 4: SL 1.5x ATR (au lieu de 0.75x)
 * - Idée 8: Score ≥ 70 (au lieu de 60)
 *
 * Objectif: Réduire SL Hit Rate (94.7% → <60%)
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
const DAYS_BACK = 90;
const SLIPPAGE_BPS = 5;

// Idée 2: Funding optimal
const MIN_FUNDING_BPS = -0.5;

// Test différents scores et SL multipliers
const SCORE_THRESHOLDS = [60, 65, 70, 75];
const SL_MULTIPLIERS = [0.75, 1.0, 1.5, 2.0];

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
}

interface ComboTestResult {
  scoreThreshold: number;
  slMultiplier: number;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
  profitFactor: number;
  slHitRate: number;
  avgHolding: number;
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

// Calculate ATR(14)
function calculateATR14(data: HistoricalData[]): number {
  if (data.length < 14) return 0;

  let sum = 0;
  for (let i = Math.max(0, data.length - 14); i < data.length; i++) {
    const high = data[i].price * 1.01; // Approximate high
    const low = data[i].price * 0.99; // Approximate low
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

  // Calculate ATR for each point
  for (let i = 0; i < data.length; i++) {
    const slice = data.slice(0, i + 1);
    data[i].atr14 = calculateATR14(slice);
  }

  return data;
}

function computeM15Score(data: HistoricalData, sessionScore: number, minScore: number, minFundingBps: number): { final: number; isLongSignal: boolean } {
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

  const fundingBpsCheck = fundingBps < minFundingBps;
  const contrarianCheck = data.change24h < 0;
  const isLongSignal = final >= minScore && fundingBpsCheck && contrarianCheck;

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

async function runBacktestCombo(scoreThreshold: number, slMultiplier: number): Promise<ComboTestResult> {
  const allData: Map<string, HistoricalData[]> = new Map();

  for (const symbol of ALL_TOKENS) {
    const data = await buildHistoricalData(symbol, DAYS_BACK);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const trades: Trade[] = [];

  for (const [symbol, data] of allData) {
    for (const point of data) {
      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore, scoreThreshold, MIN_FUNDING_BPS);

      if (!score.isLongSignal) continue;

      // Use ATR-based SL
      const atr = point.atr14 || point.price * 0.005;
      const atrPct = atr / point.price;
      const slDist = Math.max(0.004, atrPct * slMultiplier);
      const tp1Dist = slDist;
      const tp2Dist = slDist * 2;

      trades.push({
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
      scoreThreshold,
      slMultiplier,
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      sharpe: 0,
      profitFactor: 0,
      slHitRate: 0,
      avgHolding: 0,
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
  const avgHolding = completed.reduce((sum, t) => sum + t.holdingPeriod, 0) / totalTrades;

  return {
    scoreThreshold,
    slMultiplier,
    totalTrades,
    winRate,
    avgPnl,
    totalPnl,
    sharpe,
    profitFactor,
    slHitRate,
    avgHolding,
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

function formatComboMessage(results: ComboTestResult[]): string {
  let m = '📊 <b>M15 BACKTEST - PHASE 2: SL + SCORE OPTIMISATION</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += 'Funding &lt; -0.5 bps (fixe)\n';
  m += 'Teste Score × SL Multiplier combos:\n\n';

  // Group by score threshold
  const byScore: Record<number, ComboTestResult[]> = {};
  for (const r of results) {
    if (!byScore[r.scoreThreshold]) byScore[r.scoreThreshold] = [];
    byScore[r.scoreThreshold].push(r);
  }

  for (const score of SCORE_THRESHOLDS) {
    m += '<b>SCORE ≥ ' + score + '</b>\n';
    const scoreResults = byScore[score] || [];

    for (const r of scoreResults) {
      const pnlStr = r.totalPnl >= 0 ? '+' : '';
      const emoji = r.totalPnl >= 0 ? '🟢' : '🔴';

      m += '  SL ' + r.slMultiplier + 'x: ' + r.totalTrades + ' trades | ';
      m += emoji + ' PNL ' + pnlStr + r.totalPnl.toFixed(2) + '% | ';
      m += 'WR ' + r.winRate.toFixed(0) + '% | ';
      m += 'SL Hit ' + r.slHitRate.toFixed(0) + '%\n';
    }
    m += '\n';
  }

  // Find best combinations
  const bestPnl = results.filter(r => r.totalTrades >= 20).sort((a, b) => b.totalPnl - a.totalPnl)[0];
  if (bestPnl) {
    m += '🏆 <b>MEILLEUR PNL:</b> Score ≥ ' + bestPnl.scoreThreshold + ', SL ' + bestPnl.slMultiplier + 'x\n';
    m += 'PNL: ' + (bestPnl.totalPnl >= 0 ? '+' : '') + bestPnl.totalPnl.toFixed(2) + '% (' + bestPnl.totalTrades + ' trades)\n\n';
  }

  const bestWR = results.filter(r => r.totalTrades >= 20).sort((a, b) => b.winRate - a.winRate)[0];
  if (bestWR) {
    m += '🎯 <b>MEILLEUR WIN RATE:</b> Score ≥ ' + bestWR.scoreThreshold + ', SL ' + bestWR.slMultiplier + 'x\n';
    m += 'WR: ' + bestWR.winRate.toFixed(1) + '% (SL Hit: ' + bestWR.slHitRate.toFixed(1) + '%)\n\n';
  }

  const bestPF = results.filter(r => r.totalTrades >= 20).sort((a, b) => b.profitFactor - a.profitFactor)[0];
  if (bestPF) {
    m += '📈 <b>MEILLEUR PROFIT FACTOR:</b> Score ≥ ' + bestPF.scoreThreshold + ', SL ' + bestPF.slMultiplier + 'x\n';
    m += 'PF: ' + bestPF.profitFactor.toFixed(2) + '\n\n';
  }

  // Check SL hit rate goal
  const slHitGoal = results.filter(r => r.slHitRate < 60 && r.totalTrades >= 20);
  if (slHitGoal.length > 0) {
    m += '✅ <b>OBJECTIF SL HIT &lt; 60% ATTEINT:</b>\n';
    for (const r of slHitGoal.slice(0, 3)) {
      m += '  Score ≥ ' + r.scoreThreshold + ', SL ' + r.slMultiplier + 'x → ' + r.slHitRate.toFixed(1) + '%\n';
    }
  } else {
    m += '⚠️ <b>OBJECTIF SL HIT &lt; 60% NON ATTEINT</b>\n';
  }

  m += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - PHASE 2: SL + SCORE OPTIMISATION');
  console.log('==========================================');

  const results: ComboTestResult[] = [];
  const total = SCORE_THRESHOLDS.length * SL_MULTIPLIERS.length;
  let count = 0;

  for (const scoreThreshold of SCORE_THRESHOLDS) {
    for (const slMultiplier of SL_MULTIPLIERS) {
      count++;
      console.log('\n[' + count + '/' + total + '] Score ≥ ' + scoreThreshold + ', SL ' + slMultiplier + 'x');
      const result = await runBacktestCombo(scoreThreshold, slMultiplier);
      results.push(result);
      console.log('  -> ' + result.totalTrades + ' trades, PNL ' + result.totalPnl.toFixed(2) + '%, SL Hit ' + result.slHitRate.toFixed(1) + '%');
    }
  }

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  for (const r of results.slice(0, 5)) {
    console.log('Score ' + r.scoreThreshold + ', SL ' + r.slMultiplier + 'x: ' + r.totalTrades + ' trades, PNL ' + r.totalPnl.toFixed(2) + '%');
  }
  console.log('==========================================');

  const message = formatComboMessage(results);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
