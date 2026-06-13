/**
 * M15 BACKTEST - MULTI-TIMEFRAME (5m, 15m, 30m, 1h)
 * + ANALYSE DES SIGNAUX pour amélioration
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

// ─── CONFIGURATION ───

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const DAYS_BACK = 7;

const TIMEFRAMES = [
  { name: '5m', interval: '5m', binanceInterval: '5m', maxHolding: 12 },
  { name: '15m', interval: '15m', binanceInterval: '15m', maxHolding: 8 },
  { name: '30m', interval: '30m', binanceInterval: '30m', maxHolding: 4 },
  { name: '1h', interval: '1h', binanceInterval: '1h', maxHolding: 4 },
];

const SLIPPAGE_BPS = 5;
const STRESS_MULTIPLIER = 1.0; // 1.0 = pas de stress supplémentaire

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

interface SignalAnalysis {
  totalSignals: number;
  longSignals: number;
  shortSignals: number;
  neutralSignals: number;
  avgScoreByDirection: { LONG: number; SHORT: number; NEUTRAL: number };
  fundingDistribution: { negative: number; neutral: number; positive: number };
  priceAfterSignal: { LONG: number[]; SHORT: number[] }; // Prix après 1h pour chaque signal
  bestConditions: { direction: string; fundingRange: string; changeRange: string; avgPnl: number };
}

interface Trade {
  symbol: string;
  timeframe: string;
  entryTime: number;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  score: number;
  fundingAtEntry: number;
  change24hAtEntry: number;
  slDist: number;
  tp1Dist: number;
  tp2Dist: number;
  exitTime: number | null;
  exitPrice: number | null;
  outcome: 'TP1' | 'TP2' | 'SL' | 'PENDING';
  pnlPct: number;
  holdingPeriod: number;
  reason: string;
}

interface BacktestSummary {
  timeframe: string;
  totalSignals: number;
  totalTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  maxDrawdownPct: number;
  sharpe: number;
  avgHoldingHours: number;
  outcomes: { TP1: number; TP2: number; SL: number };
  avgSlippage: number;
  analysis: SignalAnalysis;
}

// ─── API HELPERS ───

async function fetchBinanceKlines(symbol: string, interval: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const url = 'https://fapi.binance.com/fapi/v1/klines?symbol=' + binanceSymbol + '&interval=' + interval + '&startTime=' + startTime + '&endTime=' + endTime + '&limit=1000';
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    return await response.json() || [];
  } catch (e) {
    return [];
  }
}

async function fetchBinanceFunding(symbol: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const url = 'https://fapi.binance.com/fapi/v1/fundingRate?symbol=' + binanceSymbol + '&startTime=' + startTime + '&endTime=' + endTime + '&limit=1000';
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

    data.push({ timestamp, symbol, price: close, funding, oi: 0, vol24h, change24h });
  }

  return data;
}

function getIntervalHours(interval: string): number {
  const map: Record<string, number> = { '5m': 5/60, '15m': 0.25, '30m': 0.5, '1h': 1 };
  return map[interval] || 1;
}

// ─── M15 SCORING (AMÉLIORÉ) ───

function computeM15Score(data: HistoricalData, sessionScore: number): { final: number; l1: number; l2: number; l3: number; direction: 'LONG' | 'SHORT' | 'NEUTRAL' } {
  let l1Score = 0, l2Score = 0, l3Score = 0;

  // L1
  l1Score += Math.min(sessionScore, 100) * 0.25;
  if (data.vol24h >= 10_000_000) l1Score += 20; else if (data.vol24h >= 2_000_000) l1Score += 10;
  l1Score += 40; // OI + spread + news + chop (assume OK)

  // L2
  const fundingBps = data.funding * 10000;
  let fundingScore = fundingBps >= 2 ? 100 : fundingBps >= 1 ? 70 : fundingBps >= 0.5 ? 50 : 30;
  l2Score += fundingScore * 0.25;

  const absChange = Math.abs(data.change24h);
  const oiScore = data.vol24h >= 100_000_000 ? 80 : data.vol24h >= 50_000_000 ? 65 : 50;
  l2Score += oiScore * 0.15;

  const volScore = absChange >= 3 ? 90 : absChange >= 1.5 ? 75 : absChange >= 0.5 ? 60 : 50;
  l2Score += volScore * 0.15;

  const flowScore = Math.abs(fundingBps) >= 2 ? 80 : 50;
  l2Score += flowScore * 0.15;

  let trendScore = 50;
  if (data.change24h > 0.5 && fundingBps < -1) trendScore = 100;
  else if (data.change24h < -0.5 && fundingBps > 1) trendScore = 100;
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

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';

  // AMELIORE: Plus flexible pour détecter plus de signaux
  // LONG: funding négatif (shorts payent) OU price monte avec funding neutre
  if (fundingBps < -0.5) {
    direction = 'LONG'; // Funding fortement négatif = squeeze potentiel
  } else if (fundingBps > 0.5) {
    direction = 'SHORT'; // Funding fortement positif = flush potentiel
  } else if (data.change24h > 1 && fundingBps < 0.5) {
    direction = 'LONG'; // Trend haussier + funding pas trop positif
  } else if (data.change24h < -1 && fundingBps > -0.5) {
    direction = 'SHORT'; // Trend baissier + funding pas trop négatif
  }

  return { final, l1: Math.round(l1Score), l2: Math.round(l2Score), l3: Math.round(l3Score), direction };
}

function getSessionScore(timestamp: number): number {
  const h = new Date(timestamp).getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

// ─── ANALYSE DES SIGNAUX ───

function analyzeSignals(allData: Map<string, HistoricalData[]>): SignalAnalysis {
  const analysis: SignalAnalysis = {
    totalSignals: 0,
    longSignals: 0,
    shortSignals: 0,
    neutralSignals: 0,
    avgScoreByDirection: { LONG: 0, SHORT: 0, NEUTRAL: 0 },
    fundingDistribution: { negative: 0, neutral: 0, positive: 0 },
    priceAfterSignal: { LONG: [], SHORT: [] },
    bestConditions: { direction: '', fundingRange: '', changeRange: '', avgPnl: 0 },
  };

  const scoresByDirection: { LONG: number[]; SHORT: number[]; NEUTRAL: number[] } = { LONG: [], SHORT: [], NEUTRAL: [] };
  const conditionCombinations: Map<string, { count: number; totalPnl: number }> = new Map();

  for (const [symbol, data] of allData) {
    for (let i = 0; i < data.length - 4; i++) { // -4 pour pouvoir regarder le prix après
      const point = data[i];
      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      analysis.totalSignals++;
      scoresByDirection[score.direction].push(score.final);

      if (score.direction === 'LONG') analysis.longSignals++;
      else if (score.direction === 'SHORT') analysis.shortSignals++;
      else analysis.neutralSignals++;

      const fundingBps = point.funding * 10000;
      if (fundingBps < -1) analysis.fundingDistribution.negative++;
      else if (fundingBps > 1) analysis.fundingDistribution.positive++;
      else analysis.fundingDistribution.neutral++;

      // Prix après 1h (4 périodes pour 15m)
      if (i + 4 < data.length) {
        const futurePrice = data[i + 4].price;
        const priceChange = ((futurePrice - point.price) / point.price) * 100;

        if (score.direction === 'LONG') {
          analysis.priceAfterSignal.LONG.push(priceChange);
        } else if (score.direction === 'SHORT') {
          analysis.priceAfterSignal.SHORT.push(-priceChange); // Inverser pour SHORT
        }

        // Analyser par combinaison de conditions
        const fundingRange = fundingBps < -2 ? '<-2' : fundingBps < -1 ? '-2 to -1' : fundingBps < 1 ? '-1 to 1' : fundingBps < 2 ? '1 to 2' : '>2';
        const changeRange = point.change24h < -2 ? '<-2' : point.change24h < -0.5 ? '-2 to -0.5' : point.change24h < 0.5 ? '-0.5 to 0.5' : point.change24h < 2 ? '0.5 to 2' : '>2';
        const key = score.direction + '|' + fundingRange + '|' + changeRange;

        if (!conditionCombinations.has(key)) {
          conditionCombinations.set(key, { count: 0, totalPnl: 0 });
        }
        const combo = conditionCombinations.get(key)!;
        combo.count++;
        combo.totalPnl += score.direction === 'LONG' ? priceChange : -priceChange;
      }
    }
  }

  // Moyennes
  analysis.avgScoreByDirection.LONG = scoresByDirection.LONG.length > 0 ? scoresByDirection.LONG.reduce((a, b) => a + b, 0) / scoresByDirection.LONG.length : 0;
  analysis.avgScoreByDirection.SHORT = scoresByDirection.SHORT.length > 0 ? scoresByDirection.SHORT.reduce((a, b) => a + b, 0) / scoresByDirection.SHORT.length : 0;
  analysis.avgScoreByDirection.NEUTRAL = scoresByDirection.NEUTRAL.length > 0 ? scoresByDirection.NEUTRAL.reduce((a, b) => a + b, 0) / scoresByDirection.NEUTRAL.length : 0;

  // Meilleure combinaison
  let bestPnl = -Infinity;
  for (const [key, data] of conditionCombinations) {
    if (data.count >= 5) { // Minimum 5 occurrences
      const avgPnl = data.totalPnl / data.count;
      if (avgPnl > bestPnl) {
        bestPnl = avgPnl;
        const [dir, fund, chg] = key.split('|');
        analysis.bestConditions = { direction: dir, fundingRange: fund, changeRange: chg, avgPnl };
      }
    }
  }

  return analysis;
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
      return { ...trade, exitTime: nextTime, exitPrice: slPrice, outcome: 'SL', pnlPct: pnlPct * 100, holdingPeriod: i, reason: 'SL' };
    }

    if (hitTP2) {
      const pnlNoSlip = trade.direction === 'LONG' ? (tp2Price - entryData.price) / entryData.price : (entryData.price - tp2Price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp2Price, outcome: 'TP2', pnlPct: pnlPct * 100, holdingPeriod: i, reason: 'TP2' };
    }

    if (hitTP1) {
      const pnlNoSlip = trade.direction === 'LONG' ? (tp1Price - entryData.price) / entryData.price : (entryData.price - tp1Price) / entryData.price;
      const pnlPct = pnlNoSlip - HL_FEES_ROUND_TRIP - (SLIPPAGE_BPS / 10000);
      return { ...trade, exitTime: nextTime, exitPrice: tp1Price, outcome: 'TP1', pnlPct: pnlPct * 100, holdingPeriod: i, reason: 'TP1' };
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

  for (const symbol of TOP_TOKENS) {
    const data = await buildHistoricalData(symbol, DAYS_BACK, tf.binanceInterval);
    if (data.length > 0) {
      allData.set(symbol, data);
      console.log('[DATA] ' + symbol + ': ' + data.length + ' points');
    }
  }

  // Analyse des signaux
  const analysis = analyzeSignals(allData);

  const trades: Trade[] = [];
  let signalCount = 0, maxScore = 0;

  for (const [symbol, data] of allData) {
    for (const point of data) {
      signalCount++;
      const sessionScore = getSessionScore(point.timestamp);
      const score = computeM15Score(point, sessionScore);

      maxScore = Math.max(maxScore, score.final);

      if (score.final < 60 || score.direction === 'NEUTRAL') continue;

      const atrProxy = point.price * 0.005;
      const slDist = Math.max(0.004, atrProxy * 0.75);
      const tp1Dist = slDist;
      const tp2Dist = slDist * 2;

      trades.push({
        symbol,
        timeframe: tf.name,
        entryTime: point.timestamp,
        entryPrice: point.price,
        direction: score.direction,
        score: score.final,
        fundingAtEntry: point.funding,
        change24hAtEntry: point.change24h,
        slDist,
        tp1Dist,
        tp2Dist,
        maxHolding: tf.maxHolding,
        exitTime: null,
        exitPrice: null,
        outcome: 'PENDING',
        pnlPct: 0,
        holdingPeriod: 0,
        reason: 'Signal',
      });
    }
  }

  console.log('[SIGNALS] Total: ' + signalCount + ' -> Trades: ' + trades.length + ' (max score: ' + maxScore + ')');
  console.log('[ANALYSIS] LONG: ' + analysis.longSignals + ', SHORT: ' + analysis.shortSignals + ', NEUTRAL: ' + analysis.neutralSignals);
  console.log('[ANALYSIS] Funding: neg=' + analysis.fundingDistribution.negative + ', neu=' + analysis.fundingDistribution.neutral + ', pos=' + analysis.fundingDistribution.positive);
  if (analysis.priceAfterSignal.LONG.length > 0) {
    console.log('[ANALYSIS] Avg price after LONG signal: ' + (analysis.priceAfterSignal.LONG.reduce((a,b) => a+b, 0) / analysis.priceAfterSignal.LONG.length).toFixed(3) + '%');
  }
  if (analysis.priceAfterSignal.SHORT.length > 0) {
    console.log('[ANALYSIS] Avg price after SHORT signal: ' + (analysis.priceAfterSignal.SHORT.reduce((a,b) => a+b, 0) / analysis.priceAfterSignal.SHORT.length).toFixed(3) + '%');
  }
  if (analysis.bestConditions.direction) {
    console.log('[BEST] ' + analysis.bestConditions.direction + ' | funding ' + analysis.bestConditions.fundingRange + ' | change ' + analysis.bestConditions.changeRange + ' -> avg PNL: ' + analysis.bestConditions.avgPnl.toFixed(3) + '%');
  }

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
    return { timeframe: tf.name, totalSignals: signalCount, totalTrades: 0, winRate: 0, avgPnlPct: 0, totalPnlPct: 0, maxDrawdownPct: 0, sharpe: 0, avgHoldingHours: 0, outcomes: { TP1: 0, TP2: 0, SL: 0 }, avgSlippage: 0, analysis };
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

  const outcomes = {
    TP1: completed.filter(t => t.outcome === 'TP1').length,
    TP2: completed.filter(t => t.outcome === 'TP2').length,
    SL: completed.filter(t => t.outcome === 'SL').length,
  };

  const avgHolding = completed.reduce((sum, t) => sum + t.holdingPeriod, 0) / totalTrades * getIntervalHours(tf.name);

  return {
    timeframe: tf.name,
    totalSignals: signalCount,
    totalTrades,
    winRate,
    avgPnlPct,
    totalPnlPct,
    maxDrawdownPct: maxDD,
    sharpe,
    avgHoldingHours: avgHolding,
    outcomes,
    avgSlippage: 0,
    analysis,
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
  let message = '[BACKTEST] MULTI-TF M15\n\n';
  message += 'Periode: ' + DAYS_BACK + ' jours\n';
  message += 'Frais HL: ' + (HL_FEES_ROUND_TRIP * 100).toFixed(3) + '% RT\n';
  message += 'Slippage: ' + SLIPPAGE_BPS + ' bps\n';
  message += 'Stress: x' + STRESS_MULTIPLIER + '\n';
  message += new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) + '\n';
  message += '==========================================\n\n';

  for (const r of results) {
    message += '[' + r.timeframe + ']\n';
    message += '  Trades: ' + r.totalTrades + ' / ' + r.totalSignals + ' signaux\n';
    if (r.totalTrades > 0) {
      message += '  Win Rate: ' + r.winRate.toFixed(1) + '%\n';
      message += '  Avg PNL: ' + r.avgPnlPct.toFixed(3) + '%\n';
      message += '  Total PNL: ' + r.totalPnlPct.toFixed(2) + '%\n';
      message += '  TP1/TP2/SL: ' + r.outcomes.TP1 + '/' + r.outcomes.TP2 + '/' + r.outcomes.SL + '\n';
    }
    message += '  [Signaux] LONG:' + r.analysis.longSignals + ' SHORT:' + r.analysis.shortSignals + '\n';
    if (r.analysis.priceAfterSignal.LONG.length > 0) {
      const avgLong = r.analysis.priceAfterSignal.LONG.reduce((a,b) => a+b, 0) / r.analysis.priceAfterSignal.LONG.length;
      message += '  Prix apres LONG: ' + avgLong.toFixed(3) + '%\n';
    }
    if (r.analysis.priceAfterSignal.SHORT.length > 0) {
      const avgShort = r.analysis.priceAfterSignal.SHORT.reduce((a,b) => a+b, 0) / r.analysis.priceAfterSignal.SHORT.length;
      message += '  Prix apres SHORT: ' + avgShort.toFixed(3) + '%\n';
    }
    if (r.analysis.bestConditions.direction) {
      const fundRange = r.analysis.bestConditions.fundingRange.replace('<', 'lt ').replace('>', 'gt ');
      const changeRange = r.analysis.bestConditions.changeRange.replace('<', 'lt ').replace('>', 'gt ');
      message += '  [BEST] ' + r.analysis.bestConditions.direction + ' | funding ' + fundRange + ' | PNL ' + r.analysis.bestConditions.avgPnl.toFixed(3) + '%\n';
    }
    message += '\n';
  }

  message += '[RECOMMANDATIONS]\n';

  // Trouver le meilleur timeframe
  const bestTF = results.filter(r => r.totalTrades > 0).sort((a, b) => b.totalPnlPct - a.totalPnlPct)[0];
  if (bestTF) {
    message += '- Meilleur TF: ' + bestTF.timeframe + ' (PNL: ' + bestTF.totalPnlPct.toFixed(2) + '%)\n';
  }

  // Trouver la meilleure combinaison
  const allBests = results.map(r => r.analysis.bestConditions).filter(b => b.direction);
  if (allBests.length > 0) {
    const globalBest = allBests.sort((a, b) => b.avgPnl - a.avgPnl)[0];
    const fundRange = globalBest.fundingRange.replace('<', 'lt ').replace('>', 'gt ');
    const changeRange = globalBest.changeRange.replace('<', 'lt ').replace('>', 'gt ');
    message += '- Meilleure condition: ' + globalBest.direction + ' | funding ' + fundRange + ' | change ' + changeRange + '\n';
    message += '  PNL moyen: +' + globalBest.avgPnl.toFixed(3) + '%\n';
  }

  // Check si signaux inverses
  const longPriceAfter = results[0].analysis.priceAfterSignal.LONG;
  const shortPriceAfter = results[0].analysis.priceAfterSignal.SHORT;
  if (longPriceAfter.length > 0 && shortPriceAfter.length > 0) {
    const avgLong = longPriceAfter.reduce((a,b) => a+b, 0) / longPriceAfter.length;
    const avgShort = shortPriceAfter.reduce((a,b) => a+b, 0) / shortPriceAfter.length;
    if (avgLong < 0 && avgShort < 0) {
      message += '\n[ALERTE] Signaux inverses detected\n';
    } else if (avgLong > 0 && avgShort > 0) {
      message += '\n[OK] Signaux dans la bonne direction\n';
    }
  }

  message += '\nhttps://macro-dashboard-lemon.vercel.app/';
  return message;
}

// ─── MAIN ───

async function main() {
  console.log('==========================================');
  console.log('M15 BACKTEST - MULTI-TF + ANALYSE');
  console.log('==========================================');

  const results: BacktestSummary[] = [];

  for (const tf of TIMEFRAMES) {
    const summary = await runBacktestTimeframe(tf);
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
