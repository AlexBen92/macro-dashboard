/**
 * M15 BACKTEST - ANALYSE PAR RÉGIME
 *
 * Compare performance Bull vs Bear vs Sideways market
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

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const DAYS_BACK = 90; // 3 mois

// Focus sur 5m (plus de données)
const TIMEFRAMES = [
  { name: '5m', interval: '5m', binanceInterval: '5m', maxHolding: 12 },
];

const SLIPPAGE_BPS = 5;

// ─── RÉGIME PARAMETERS ───

const REGIME_WINDOW_DAYS = 7; // Période pour déterminer le régime
const BULL_THRESHOLD = 3; // +3% sur 7j = Bull
const BEAR_THRESHOLD = -3; // -3% sur 7j = Bear

// ─── TYPES ───

type RegimeType = 'BULL' | 'BEAR' | 'SIDEWAYS';

interface RegimePeriod {
  startTime: number;
  endTime: number;
  type: RegimeType;
  btcChange: number;
  duration: number; // jours
}

interface HistoricalData {
  timestamp: number;
  symbol: string;
  price: number;
  funding: number;
  vol24h: number;
  change24h: number;
  regime?: RegimeType;
}

interface Trade {
  symbol: string;
  timeframe: string;
  entryTime: number;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
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
  regime?: RegimeType;
}

interface RegimeStats {
  type: RegimeType;
  duration: number;
  btcChange: number;
  totalSignals: number;
  longSignals: number;
  shortSignals: number;
  filteredSignals: number;
  totalTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  profitFactor: number;
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

// ─── REGIME DETECTION ───

async function detectRegimes(symbol: string, daysBack: number): Promise<RegimePeriod[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;

  console.log('\n[REGIME] Detection pour ' + symbol);
  const klines = await fetchBinanceKlines(symbol, '1d', startTime, now);

  if (klines.length === 0) return [];

  const regimes: RegimePeriod[] = [];
  let currentRegime: RegimeType = 'SIDEWAYS';
  let regimeStart = startTime;

  for (let i = REGIME_WINDOW_DAYS; i < klines.length; i++) {
    const windowStart = klines[i - REGIME_WINDOW_DAYS];
    const windowEnd = klines[i];
    const startPrice = parseFloat(windowStart[4]);
    const endPrice = parseFloat(windowEnd[4]);
    const change = ((endPrice - startPrice) / startPrice) * 100;

    let newRegime: RegimeType;
    if (change >= BULL_THRESHOLD) newRegime = 'BULL';
    else if (change <= BEAR_THRESHOLD) newRegime = 'BEAR';
    else newRegime = 'SIDEWAYS';

    if (newRegime !== currentRegime || i === klines.length - 1) {
      const endTime = i === klines.length - 1 ? now : klines[i][0];
      const startPriceRegime = parseFloat(klines[Math.max(0, i - REGIME_WINDOW_DAYS)][4]);
      const endPriceRegime = parseFloat(klines[i][4]);
      const totalChange = ((endPriceRegime - startPriceRegime) / startPriceRegime) * 100;

      regimes.push({
        startTime: regimeStart,
        endTime,
        type: currentRegime,
        btcChange: totalChange,
        duration: (endTime - regimeStart) / (24 * 60 * 60 * 1000),
      });

      currentRegime = newRegime;
      regimeStart = endTime;
    }
  }

  console.log('[REGIME] ' + regimes.length + ' périodes détectées');
  for (const r of regimes) {
    console.log('  - ' + r.type + ': ' + r.duration.toFixed(1) + 'j (BTC ' + (r.btcChange >= 0 ? '+' : '') + r.btcChange.toFixed(1) + '%)');
  }

  return regimes;
}

async function buildHistoricalDataWithRegime(
  symbol: string,
  daysBack: number,
  interval: string,
  regimes: RegimePeriod[]
): Promise<HistoricalData[]> {
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

    // Determine regime for this timestamp
    const regime = regimes.find(r => timestamp >= r.startTime && timestamp < r.endTime)?.type;

    data.push({ timestamp, symbol, price: close, funding, vol24h, change24h, regime });
  }

  console.log('  -> ' + data.length + ' points');
  return data;
}

function getIntervalHours(interval: string): number {
  const map: Record<string, number> = { '5m': 5/60, '15m': 0.25, '30m': 0.5, '1h': 1 };
  return map[interval] || 1;
}

// ─── M15 SCORING ───

function computeM15Score(data: HistoricalData, sessionScore: number): { final: number; isLongSignal: boolean; isShortSignal: boolean } {
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

  // Signal logic
  const MIN_SCORE = 60;
  const MIN_FUNDING_BPS = -2;
  const isLongSignal = final >= MIN_SCORE && fundingBps < MIN_FUNDING_BPS && data.change24h < 0;
  const isShortSignal = final >= MIN_SCORE && fundingBps > 2 && data.change24h > 0;

  return { final, isLongSignal, isShortSignal };
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

// ─── BACKTEST PAR RÉGIME ───

async function runBacktestByRegime(tf: typeof TIMEFRAMES[0], regimes: RegimePeriod[]): Promise<Map<RegimeType, RegimeStats>> {
  console.log('\n==========================================');
  console.log('TIMEFRAME: ' + tf.name);
  console.log('==========================================');

  const allData: Map<string, HistoricalData[]> = new Map();
  const statsByRegime = new Map<RegimeType, RegimeStats>();

  // Initialize stats for each regime type
  for (const regimeType of ['BULL', 'BEAR', 'SIDEWAYS'] as RegimeType[]) {
    statsByRegime.set(regimeType, {
      type: regimeType,
      duration: 0,
      btcChange: 0,
      totalSignals: 0,
      longSignals: 0,
      shortSignals: 0,
      filteredSignals: 0,
      totalTrades: 0,
      winRate: 0,
      avgPnlPct: 0,
      totalPnlPct: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      profitFactor: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0 },
    });
  }

  for (const symbol of TOP_TOKENS) {
    const data = await buildHistoricalDataWithRegime(symbol, DAYS_BACK, tf.binanceInterval, regimes);
    if (data.length > 0) {
      allData.set(symbol, data);
    }
  }

  const trades: Trade[] = [];

  for (const [symbol, data] of allData) {
    for (const point of data) {
      if (!point.regime) continue;

      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      const stats = statsByRegime.get(point.regime)!;
      stats.totalSignals++;
      stats.duration += (24 * 60 * 60 * 1000) / (DAYS_BACK * 24 * 60 * 60 * 1000) / data.length;

      if (score.isLongSignal) {
        stats.longSignals++;

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
          regime: point.regime,
        });
      } else if (score.isShortSignal) {
        stats.shortSignals++;
      } else {
        stats.filteredSignals++;
      }
    }
  }

  console.log('[TRADES] Total: ' + trades.length);

  // Simulate trades and group by regime
  for (const trade of trades) {
    const data = allData.get(trade.symbol) ?? [];
    const result = await simulateTrade(trade, data);

    const stats = statsByRegime.get(result.regime!)!;
    stats.totalTrades++;

    if (result.outcome === 'TP1') stats.outcomes.TP1++;
    else if (result.outcome === 'TP2') stats.outcomes.TP2++;
    else stats.outcomes.SL++;

    stats.totalPnlPct += result.pnlPct;
  }

  // Calculate final stats
  for (const [regimeType, stats] of statsByRegime) {
    if (stats.totalTrades === 0) continue;

    const regimeTrades = trades.filter(t => t.regime === regimeType && t.outcome !== 'PENDING');
    const wins = regimeTrades.filter(t => t.outcome !== 'SL').length;

    stats.winRate = (wins / stats.totalTrades) * 100;
    stats.avgPnlPct = stats.totalTrades > 0 ? stats.totalPnlPct / stats.totalTrades : 0;

    const winsPnl = regimeTrades.filter(t => t.outcome !== 'SL').reduce((sum, t) => sum + t.pnlPct, 0);
    const lossesPnl = Math.abs(regimeTrades.filter(t => t.outcome === 'SL').reduce((sum, t) => sum + t.pnlPct, 0));
    stats.profitFactor = lossesPnl > 0 ? winsPnl / lossesPnl : 0;

    // Calculate max drawdown and Sharpe per regime
    const pnls = regimeTrades.map(t => t.pnlPct);
    let maxDD = 0, peak = 0, cumulative = 0;
    for (const pnl of pnls) {
      cumulative += pnl;
      peak = Math.max(peak, cumulative);
      maxDD = Math.max(maxDD, peak - cumulative);
    }
    stats.maxDrawdownPct = maxDD;

    if (pnls.length > 0) {
      const mean = stats.avgPnlPct;
      const variance = pnls.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / pnls.length;
      stats.sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;
    }
  }

  return statsByRegime;
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

function formatMessage(regimes: RegimePeriod[], statsByRegime: Map<RegimeType, RegimeStats>): string {
  let message = '[BACKTEST] M15 - ANALYSE PAR REGIME\n\n';
  message += 'Periode: ' + DAYS_BACK + ' jours\n';
  message += 'Timeframe: 5m\n\n';

  message += '========================================\n';
  message += 'REGIMES DETECTES (BTC):\n';
  message += '========================================\n';
  for (const r of regimes) {
    message += r.type + ': ' + r.duration.toFixed(1) + 'j (BTC ' + (r.btcChange >= 0 ? '+' : '') + r.btcChange.toFixed(1) + '%)\n';
  }
  message += '\n';

  message += '========================================\n';
  message += 'PERFORMANCE PAR REGIME:\n';
  message += '========================================\n\n';

  for (const regimeType of ['BULL', 'BEAR', 'SIDEWAYS'] as RegimeType[]) {
    const stats = statsByRegime.get(regimeType)!;
    message += '[' + regimeType + ']\n';
    message += '  Trades: ' + stats.totalTrades + '\n';
    if (stats.totalTrades > 0) {
      message += '  Win Rate: ' + stats.winRate.toFixed(1) + '%\n';
      message += '  Avg PNL: ' + stats.avgPnlPct.toFixed(3) + '%\n';
      message += '  Total PNL: ' + (stats.totalPnlPct >= 0 ? '+' : '') + stats.totalPnlPct.toFixed(2) + '%\n';
      message += '  Max DD: ' + stats.maxDrawdownPct.toFixed(2) + '%\n';
      message += '  Sharpe: ' + stats.sharpe.toFixed(2) + '\n';
      message += '  Profit Factor: ' + stats.profitFactor.toFixed(2) + '\n';
      message += '  TP1/TP2/SL: ' + stats.outcomes.TP1 + '/' + stats.outcomes.TP2 + '/' + stats.outcomes.SL + '\n';
    }
    message += '\n';
  }

  message += '\nhttps://macro-dashboard-lemon.vercel.app/';
  return message;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - ANALYSE PAR REGIME');
  console.log('==========================================');
  console.log('Début: ' + new Date().toISOString());

  // Detect regimes using BTC
  const regimes = await detectRegimes('BTC', DAYS_BACK);

  if (regimes.length === 0) {
    console.error('No regimes detected');
    return;
  }

  const tf = TIMEFRAMES[0];
  const statsByRegime = await runBacktestByRegime(tf, regimes);

  console.log('\n==========================================');
  console.log('[SUMMARY]');
  for (const [regimeType, stats] of statsByRegime) {
    console.log(regimeType + ': ' + stats.totalTrades + ' trades, PNL ' + stats.totalPnlPct.toFixed(2) + '%');
  }
  console.log('==========================================');

  const message = formatMessage(regimes, statsByRegime);
  const sent = await sendTelegramMessage(message);

  if (!sent) process.exit(1);
  console.log('\n[OK] Sent!');
}

main().catch(console.error);
