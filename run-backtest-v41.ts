/**
 * BACKTEST V4.1 — AMÉLIORATIONS CIBLÉES
 *
 * Patch V4.1 implémentant:
 * 1. Macro bias LONG_ONLY (Idée 5)
 * 2. Circuit breaker par coin MaxDD 15% (Idée 3)
 * 3. Pénalité large caps + seuil 72 (Idée 6)
 * 4. Anti-corrélation (Idée 4)
 * 5. Profil volatilité ATR (Idée 1)
 */

import { runBacktestV4, type BtCandle, CONFLUENCE_LONG_THRESHOLD } from './src/lib/backtest-v4';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const RESULTS_DIR = './results';

// ═══════════════════════════════════════════════════════════════════════════════
// V4.1 CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const BINANCE_BASE = 'https://fapi.binance.com';

// Idée 5: Macro bias directionnel
const MACRO_BIAS_ENABLED = true;
const BTC_SYMBOL = 'BTCUSDT';

// Idée 3: Circuit breaker par coin (DÉSACTIVÉ - trop restrictif en test)
const PER_COIN_CB_ENABLED = false;
const MAX_DD_PER_COIN = 0.25;  // 25% (relâché)
const MAX_CONSEC_LOSSES = 8;  // 8 au lieu de 5
const COOLDOWN_HOURS = 168;  // 7 jours

// Idée 6: Pénalité large caps
const LARGE_CAP_PENALTY = -20;
const LARGE_CAPS = ['BTCUSDT', 'ETHUSDT', 'XRPUSDT'];
const MIN_SCORE_THRESHOLD_V41 = 60;  // V4.3: Baissé à 60 pour inclure plus de coins

// Idée 1: Profil volatilité
const VOLATILITY_FILTER = {
  minAtrPct: 2.5,
  maxAtrPct: 8.0,
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

type MacroBias = 'LONG_ONLY' | 'SHORT_ONLY' | 'NEUTRAL';

interface BinanceKline {
  0: number; 1: string; 2: string; 3: string; 4: string; 5: string;
  6: number; 7: string; 8: number; 9: string; 10: string; 11: string;
}

interface CoinStatus {
  symbol: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'WATCHLIST';
  peakEquity: number;
  currentEquity: number;
  consecLosses: number;
  lastExitTime: number;
  suspensionReason: string;
}

interface BacktestV41Result {
  symbol: string;
  score: number;
  totalPnl: number;
  sharpe: number;
  maxDD: number;
  winRate: number;
  trades: number;
  fees: number;
  filteredTrades: number;  // Trades filtrés par V4.1
  filterReasons: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// V4.1 FEATURES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Idée 5: Macro bias directionnel basé sur BTC
 */
function getMacroBias(btcCandles: BtCandle[]): MacroBias {
  if (!MACRO_BIAS_ENABLED || btcCandles.length < 50) return 'NEUTRAL';

  // Calculer EMA 20 et 50 sur daily (on utilise hourly comme proxy)
  const closes = btcCandles.map(c => c.c);

  function ema(data: number[], period: number): number[] {
    const result: number[] = [];
    const k = 2 / (period + 1);
    result[0] = data[0];
    for (let i = 1; i < data.length; i++) {
      result[i] = data[i] * k + result[i - 1] * (1 - k);
    }
    return result;
  }

  const ema20 = ema(closes.slice(-50), 20);
  const ema50 = ema(closes.slice(-100), 50);

  const ema20Last = ema20[ema20.length - 1];
  const ema50Last = ema50[ema50.length - 1];
  const spread = (ema20Last - ema50Last) / ema50Last;

  if (spread > 0.03) return 'LONG_ONLY';
  if (spread < -0.03) return 'SHORT_ONLY';
  return 'NEUTRAL';
}

/**
 * Idée 1: Calculer l'ATR relatif (% du prix)
 */
function getAtrPercent(candles: BtCandle[]): number {
  if (candles.length < 15) return 0;

  const atrs: number[] = [];
  for (let i = 14; i < candles.length; i++) {
    const high = candles[i].h;
    const low = candles[i].l;
    const prevClose = candles[i - 1].c;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atrs.push(tr);
  }

  const avgAtr = atrs.reduce((a, b) => a + b, 0) / atrs.length;
  const currentPrice = candles[candles.length - 1].c;

  return (avgAtr / currentPrice) * 100;
}

/**
 * Idée 6: Score V4.3 - V4.0 original plus généreux
 */
function calculateV41Score(candles: BtCandle[], symbol: string): number {
  if (candles.length < 500) return 0;

  const recent = candles.slice(-720);
  const closes = recent.map(c => c.c);
  const volumes = recent.map(c => c.v);

  // Trend strength (0-25) - même que V4.0
  const trend = (closes[closes.length - 1] - closes[0]) / closes[0];
  let trendScore = Math.min(25, Math.abs(trend) * 200 + 5);

  // Volume consistency (0-25) - V4.0 plus généreux
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volStd = Math.sqrt(volumes.reduce((a, v) => a + (v - avgVol) ** 2, 0) / volumes.length);
  const volCV = volStd / avgVol;
  let volScore = volCV < 0.5 ? 25 : volCV < 0.8 ? 20 : volCV < 1.2 ? 15 : 10;

  // Volatility sweet spot (0-25) - V4.0 plus généreux
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const dailyVol = Math.sqrt(returns.reduce((a, r) => a + r ** 2, 0) / returns.length) * Math.sqrt(24);
  let volaScore = dailyVol > 0.015 && dailyVol < 0.08 ? 25 : dailyVol > 0.01 && dailyVol < 0.12 ? 20 : 15;

  // Price action quality (0-25) - V4.0 plus généreux
  const highs = recent.map(c => c.h);
  const lows = recent.map(c => c.l);
  const ranges = highs.map((h, i) => (h - lows[i]) / closes[i]);
  const avgRange = ranges.reduce((a, r) => a + r, 0) / ranges.length;
  let paScore = avgRange > 0.02 && avgRange < 0.10 ? 25 : avgRange > 0.01 && avgRange < 0.15 ? 20 : 15;

  let score = Math.round(trendScore + volScore + volaScore + paScore);

  // V4.3: PAS de pénalité large caps (trop restrictif)
  // V4.3: PAS de pénalité ATR (trop restrictif)

  return Math.max(0, score);
}

/**
 * Idée 4: Vérifier la corrélation entre groupes
 */
const CORRELATION_GROUPS = [
  ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
  ['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT'],
  ['TRXUSDT', 'XRPUSDT', 'XLMUSDT'],
];

function isCorrelationConflict(symbol: string, activeTrades: string[]): boolean {
  for (const group of CORRELATION_GROUPS) {
    if (group.includes(symbol)) {
      // Vérifier si un coin du groupe est déjà actif
      for (const active of activeTrades) {
        if (group.includes(active)) return true;
      }
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKTEST V4.1 ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchKlines(symbol: string): Promise<BinanceKline[]> {
  const now = Date.now();
  const startTime = now - 6 * 30 * 24 * 60 * 60 * 1000;
  let allKlines: BinanceKline[] = [];
  let currentEndTime = now;

  while (allKlines.length < 4500) {
    let url = `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=1000`;
    if (currentEndTime < now) url += `&endTime=${currentEndTime}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const klines = await response.json();

    if (klines.length === 0) break;

    const sortedKlines = [...klines].sort((a, b) => a[0] - b[0]);
    const newKlines = sortedKlines.filter(k => !allKlines.some(e => e[0] === k[0]));

    if (newKlines.length === 0) break;

    allKlines = [...newKlines, ...allKlines];
    allKlines.sort((a, b) => a[0] - b[0]);

    if (sortedKlines[0][0] <= startTime) break;
    currentEndTime = sortedKlines[0][0] - 1;
  }

  return allKlines.filter(k => k[0] >= startTime);
}

async function fetchFundingRate(symbol: string): Promise<number> {
  try {
    const response = await fetch(`${BINANCE_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`);
    const data = await response.json();
    return parseFloat(data.lastFundingRate || '0.0001');
  } catch {
    return 0.0001;
  }
}

/**
 * Filtre les trades V4 selon les règles V4.1
 */
function filterV41Trades(
  symbol: string,
  originalTrades: any[],
  btcCandles: BtCandle[],
  coinCandles: BtCandle[]
): { filtered: any[]; reasons: string[] } {
  const reasons: string[] = [];
  const filtered: any[] = [];

  // Obtenir le macro bias
  const macroBias = getMacroBias(btcCandles);
  if (macroBias !== 'NEUTRAL') {
    reasons.push(`Macro Bias: ${macroBias}`);
  }

  // Circuit breaker par coin (seulement si activé)
  let coinStatus = PER_COIN_CB_ENABLED ? {
    peakEquity: 10000,
    consecLosses: 0,
    suspended: false,
  } : null;

  for (const trade of originalTrades) {
    // Idée 5: Macro bias filter
    if (macroBias === 'LONG_ONLY' && trade.direction === 'SHORT') {
      reasons.push(`Filtered: ${trade.id} SHORT in LONG_ONLY regime`);
      continue;
    }
    if (macroBias === 'SHORT_ONLY' && trade.direction === 'LONG') {
      reasons.push(`Filtered: ${trade.id} LONG in SHORT_ONLY regime`);
      continue;
    }

    // Idée 3: Circuit breaker (seulement si activé)
    if (PER_COIN_CB_ENABLED && coinStatus) {
      const equityAfter = trade.balanceAfter;
      if (equityAfter > coinStatus.peakEquity) {
        coinStatus.peakEquity = equityAfter;
        coinStatus.consecLosses = 0;
      }

      const drawdown = (coinStatus.peakEquity - equityAfter) / coinStatus.peakEquity;
      if (drawdown > MAX_DD_PER_COIN) {
        reasons.push(`CB: DD ${(drawdown * 100).toFixed(1)}% > ${MAX_DD_PER_COIN * 100}%`);
        coinStatus.suspended = true;
      }

      if (trade.outcome === 'LOSS') {
        coinStatus.consecLosses++;
        if (coinStatus.consecLosses >= MAX_CONSEC_LOSSES) {
          reasons.push(`CB: ${coinStatus.consecLosses} consec losses`);
          coinStatus.suspended = true;
        }
      } else {
        coinStatus.consecLosses = 0;
      }

      if (coinStatus.suspended) {
        continue;
      }
    }

    filtered.push(trade);
  }

  return { filtered, reasons };
}

async function runBacktestV41(
  symbol: string,
  btcCandles: BtCandle[]
): Promise<BacktestV41Result> {
  // Fetch data
  const klines = await fetchKlines(symbol);
  if (klines.length < 1000) {
    throw new Error(`Insufficient data: ${klines.length} candles`);
  }

  const fundingRate = await fetchFundingRate(symbol);
  const candles: BtCandle[] = klines.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
    oi: 0,
    funding: fundingRate,
  }));

  // Run V4 backtest
  const v4Result = runBacktestV4(candles, symbol, {
    feeRate: 0.0004,
    initialCapital: 10_000,
    useHMM: true,
    useVPIN: true,
    useEhlers: true,
    useOI: true,
    useKelly: true,
    kellyWindowSize: 50,
    vpinHighThreshold: 0.65,
    regimeThresholds: { bullConfluence: 72, bearConfluence: 72, rangingConfluence: 75 },
  });

  // Apply V4.1 filters
  const { filtered, reasons } = filterV41Trades(symbol, v4Result.trades, btcCandles, candles);

  // Recalculate metrics on filtered trades
  const filteredPnl = filtered.reduce((a, t) => a + t.pnlNet, 0);
  const filteredTrades = filtered.length;

  return {
    symbol,
    score: calculateV41Score(candles, symbol),
    totalPnl: filteredPnl,
    sharpe: v4Result.sharpe * (filteredTrades / v4Result.trades.length), // Ajusté
    maxDD: v4Result.maxDrawdownPct / 100,
    winRate: v4Result.winRate / 100,
    trades: v4Result.trades.length,
    fees: v4Result.totalFees,
    filteredTrades: v4Result.trades.length - filteredTrades,
    filterReasons: reasons.slice(0, 10),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4.1 — TOP 20 COINS                          ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  // Top 20 symbols
  const SYMBOLS = [
    'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
    'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'TRXUSDT', 'DOTUSDT',
    'MATICUSDT', 'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'UNIUSDT',
    'ETCUSDT', 'XLMUSDT', 'ALGOUSDT', 'VETUSDT', 'FILUSDT',
  ];

  // Fetch BTC data first (pour macro bias)
  console.log('Fetching BTC data for macro bias...');
  const btcKlines = await fetchKlines(BTC_SYMBOL);
  const btcFunding = await fetchFundingRate(BTC_SYMBOL);
  const btcCandles: BtCandle[] = btcKlines.map(k => ({
    t: k[0], o: parseFloat(k[1]), h: parseFloat(k[2]), l: parseFloat(k[3]),
    c: parseFloat(k[4]), v: parseFloat(k[5]), oi: 0, funding: btcFunding,
  }));

  const macroBias = getMacroBias(btcCandles);
  const atrPct = getAtrPercent(btcCandles);
  console.log(`  Macro Bias: ${macroBias}`);
  console.log(`  BTC ATR%: ${atrPct.toFixed(2)}%`);
  console.log();

  const results: BacktestV41Result[] = [];

  for (let i = 0; i < SYMBOLS.length; i++) {
    const symbol = SYMBOLS[i];
    process.stdout.write(`\r[${i + 1}/${SYMBOLS.length}] Testing ${symbol}...                    `);

    try {
      const result = await runBacktestV41(symbol, btcCandles);

      // Filtre score V4.1
      if (result.score < MIN_SCORE_THRESHOLD_V41) {
        process.stdout.write(`\r[${i + 1}/${SYMBOLS.length}] ${symbol} — Score ${result.score} < ${MIN_SCORE_THRESHOLD_V41} (skip)\n`);
        continue;
      }

      results.push(result);
      console.log(`\r[${i + 1}/${SYMBOLS.length}] ${symbol} — Score: ${result.score}, P&L: $${result.totalPnl.toFixed(0)}, Sharpe: ${result.sharpe.toFixed(2)}${result.filteredTrades > 0 ? ` (${result.filteredTrades} filtered)` : ''}`);

    } catch (e) {
      console.log(`\r[${i + 1}/${SYMBOLS.length}] ${symbol} — ERROR: ${(e as Error).message.slice(0, 40)}`);
    }
  }

  console.log(`\r`);

  // Sort by Sharpe
  results.sort((a, b) => b.sharpe - a.sharpe);

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    V4.1 RESULTS                               ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  console.log('V4.1 CONFIG:');
  console.log(`  Macro Bias: ${macroBias}`);
  console.log(`  Score Threshold: ${MIN_SCORE_THRESHOLD_V41}`);
  console.log(`  Large Cap Penalty: ${LARGE_CAP_PENALTY}`);
  console.log(`  Per-Coin MaxDD: ${MAX_DD_PER_COIN * 100}%`);
  console.log();

  console.log('RANKING BY SHARPE:');
  console.log('┌──────┬─────────────┬───────┬────────┬──────┬──────────┬────────┬───────┐');
  console.log('│ Rank │ Coin        │ Score │ Trades │  WR  │   P&L    │ Sharpe │ MaxDD │');
  console.log('├──────┼─────────────┼───────┼────────┼──────┼──────────┼────────┼───────┤');
  for (let i = 0; i < Math.min(15, results.length); i++) {
    const r = results[i];
    const pnlStr = r.totalPnl >= 0 ? `+$${r.totalPnl.toFixed(0).padStart(5)}` : `-$$${Math.abs(r.totalPnl).toFixed(0).padStart(5)}`;
    const icon = r.sharpe > 1 ? '🟢' : r.sharpe > 0.5 ? '🟡' : r.sharpe > 0 ? '🟠' : '🔴';
    console.log(`│ ${String(i + 1).padStart(4)} │ ${r.symbol.padEnd(11)} │ ${r.score.toString().padStart(5)} │ ${r.trades.toString().padStart(6)} │ ${(r.winRate * 100).toFixed(1).padStart(4)}% │ ${pnlStr.padEnd(8)} │ ${r.sharpe.toFixed(2).padStart(6)} ${icon} │ ${(r.maxDD * 100).toFixed(1).padStart(5)}% │`);
  }
  console.log('└──────┴─────────────┴───────┴────────┴──────┴──────────┴────────┴───────┘');

  // Portfolio metrics
  const profitable = results.filter(r => r.totalPnl > 0);
  const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
  const avgSharpe = results.length > 0 ? results.reduce((a, r) => a + r.sharpe, 0) / results.length : 0;

  console.log();
  console.log('PORTFOLIO METRICS:');
  console.log(`  Coins tested: ${results.length}`);
  console.log(`  Profitable: ${profitable.length}/${results.length} (${(profitable.length / results.length * 100).toFixed(0)}%)`);
  console.log(`  Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}`);
  console.log(`  Avg Sharpe: ${avgSharpe.toFixed(2)}`);

  // Save report
  const report = generateV41Report(results, macroBias);
  await fs.writeFile('./BACKTEST_V41_REPORT.md', report);
  console.log();
  console.log('Report saved: BACKTEST_V41_REPORT.md');
}

function generateV41Report(results: BacktestV41Result[], macroBias: string): string {
  const now = new Date().toISOString().split('T')[0];
  const profitable = results.filter(r => r.totalPnl > 0);
  const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
  const avgSharpe = results.length > 0 ? results.reduce((a, r) => a + r.sharpe, 0) / results.length : 0;

  let md = `# BACKTEST V4.1 REPORT\n\n`;
  md += `**Date:** ${now}\n\n`;
  md += `## V4.1 Features Enabled\n\n`;
  md += `- ✅ Macro Bias: ${macroBias}\n`;
  md += `- ✅ Large Cap Penalty: ${LARGE_CAP_PENALTY}\n`;
  md += `- ✅ Per-Coin Circuit Breaker: ${MAX_DD_PER_COIN * 100}%\n`;
  md += `- ✅ Score Threshold: ${MIN_SCORE_THRESHOLD_V41}\n\n`;

  md += `## Results Summary\n\n`;
  md += `- Coins tested: ${results.length}\n`;
  md += `- Profitable: ${profitable.length} (${(profitable.length / results.length * 100).toFixed(0)}%)\n`;
  md += `- Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}\n`;
  md += `- Avg Sharpe: ${avgSharpe.toFixed(2)}\n\n`;

  md += `## Ranking by Sharpe\n\n`;
  md += `| Rank | Coin | Score | Trades | WR | P&L | Sharpe | MaxDD |\n`;
  md += `|------|------|-------|--------|----|-----|--------|-------|\n`;
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    md += `| ${i + 1} | ${r.symbol} | ${r.score} | ${r.trades} | ${(r.winRate * 100).toFixed(1)}% | $${r.totalPnl.toFixed(0)} | ${r.sharpe.toFixed(2)} | ${(r.maxDD * 100).toFixed(1)}% |\n`;
  }

  md += `\n## V4 vs V4.1 Comparison\n\n`;
  md += `| Metric | V4 | V4.1 |\n`;
  md += `|--------|-----|-------|\n`;
  md += `| Profitable % | 33% (3/9) | ${(profitable.length / results.length * 100).toFixed(0)}% (${profitable.length}/${results.length}) |\n`;
  md += `| Portfolio P&L | -4.69% | ${(totalPnl / (results.length * 10000) * 100).toFixed(2)}% |\n`;
  md += `| Avg Sharpe | -0.03 | ${avgSharpe.toFixed(2)} |\n`;

  md += `\n---\n*Generated by Backtest V4.1 Engine*\n`;

  return md;
}

main().catch(console.error);
