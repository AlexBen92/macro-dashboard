/**
 * BACKTEST V4 - TOP 50 BINANCE FUTURES
 *
 * Récupère les 50 premiers symbols par volume et lance le backtest
 */

import { runBacktestV4, type BtCandle } from './src/lib/backtest-v4';
import { monteCarloSimulation } from './src/lib/quant/advanced-metrics';
import { promises as fs } from 'fs';
import { join } from 'path';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const DATA_DIR = './data';
const RESULTS_DIR = './results';
const EXCLUDED_PATTERNS = ['UPUSDT', 'DOWNUSDT', 'BULLUSDT', 'BEARUSDT', 'BUSDUSDT'];
const MIN_SCORE_THRESHOLD = 80;  // Seuil 80 pour ne garder que les meilleurs coins
const REQUEST_DELAY_MS = 100;
const MAX_COINS = 50;

const BINANCE_BASE = 'https://fapi.binance.com';

// Top 50 symbols par volume (approximatif)
const TOP_50_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'TRXUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'UNIUSDT',
  'ETCUSDT', 'XLMUSDT', 'ALGOUSDT', 'VETUSDT', 'FILUSDT',
  'ICPUSDT', 'NEARUSDT', 'APEUSDT', 'SANDUSDT', 'MANAUSDT',
  'AXSUSDT', 'SHIBUSDT', 'GALAUSDT', 'AAVEUSDT', 'MKRUSDT',
  'COMPUSDT', 'YFIUSDT', 'SNXUSDT', 'CRVUSDT', 'RUNEUSDT',
  'SUSHIUSDT', '1INCHUSDT', 'IMXUSDT', 'APEXUSDT', 'GMXUSDT',
  'ZRXUSDT', 'BATUSDT', 'ENJUSDT', 'CHZUSDT', 'FTMUSDT',
  'ROSEUSDT', 'HOTUSDT', 'CELOUSDT', 'MASKUSDT', 'LDOUSDT'
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface BinanceKline {
  0: number; 1: string; 2: string; 3: string; 4: string; 5: string;
  6: number; 7: string; 8: number; 9: string; 10: string; 11: string;
}

interface CoinScore {
  symbol: string;
  score: number;
  selected: boolean;
}

interface BacktestResult {
  symbol: string;
  score: number;
  totalPnl: number;
  totalPnlPct: number;
  sharpe: number;
  calmar: number;
  maxDD: number;
  winRate: number;
  trades: number;
  fees: number;
  kellyUsed: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BINANCE API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchWithRetry(url: string, maxRetries = 3): Promise<any> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await new Promise(r => setTimeout(r, 300 * (i + 1)));
    }
  }
}

async function fetchAllKlines(symbol: string, months = 6): Promise<BinanceKline[]> {
  const now = Date.now();
  const startTime = now - months * 30 * 24 * 60 * 60 * 1000;
  let allKlines: BinanceKline[] = [];
  let currentEndTime = now;

  while (true) {
    let url = `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=1h&limit=1000`;
    if (currentEndTime < now) url += `&endTime=${currentEndTime}`;

    const klines = await fetchWithRetry(url);
    if (klines.length === 0) break;

    const sortedKlines = [...klines].sort((a, b) => a[0] - b[0]);
    const oldestNewTime = sortedKlines[0][0];

    const newKlines = sortedKlines.filter(k =>
      !allKlines.some(existing => existing[0] === k[0])
    );

    if (newKlines.length === 0) break;

    allKlines = [...newKlines, ...allKlines];
    allKlines.sort((a, b) => a[0] - b[0]);

    if (oldestNewTime <= startTime || allKlines.length >= 5000) break;

    currentEndTime = oldestNewTime - 1;
    await new Promise(r => setTimeout(r, 30));
  }

  return allKlines.filter(k => k[0] >= startTime).sort((a, b) => a[0] - b[0]);
}

async function fetchFundingRate(symbol: string): Promise<number> {
  try {
    const data = await fetchWithRetry(`${BINANCE_BASE}/fapi/v1/premiumIndex?symbol=${symbol}`);
    return parseFloat(data.lastFundingRate || '0.0001');
  } catch {
    return 0.0001;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCORING V4
// ═══════════════════════════════════════════════════════════════════════════════

function calculateV4Score(candles: BtCandle[]): number {
  if (candles.length < 500) return 0;

  const recent = candles.slice(-720);
  const closes = recent.map(c => c.c);
  const volumes = recent.map(c => c.v);
  const highs = recent.map(c => c.h);
  const lows = recent.map(c => c.l);

  // Trend strength (0-25)
  const trend = (closes[closes.length - 1] - closes[0]) / closes[0];
  let trendScore = Math.min(25, Math.abs(trend) * 200 + 5);

  // Volume consistency (0-25)
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volStd = Math.sqrt(volumes.reduce((a, v) => a + (v - avgVol) ** 2, 0) / volumes.length);
  const volCV = volStd / avgVol;
  let volScore = volCV < 0.5 ? 25 : volCV < 0.8 ? 20 : volCV < 1.2 ? 15 : 10;

  // Volatility sweet spot (0-25)
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const dailyVol = Math.sqrt(returns.reduce((a, r) => a + r ** 2, 0) / returns.length) * Math.sqrt(24);
  let volaScore = dailyVol > 0.015 && dailyVol < 0.08 ? 25 : dailyVol > 0.01 && dailyVol < 0.12 ? 20 : 15;

  // Price action quality (0-25)
  const ranges = highs.map((h, i) => (h - lows[i]) / closes[i]);
  const avgRange = ranges.reduce((a, r) => a + r, 0) / ranges.length;
  let paScore = avgRange > 0.02 && avgRange < 0.10 ? 25 : avgRange > 0.01 && avgRange < 0.15 ? 20 : 15;

  return Math.round(trendScore + volScore + volaScore + paScore);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const startTime = Date.now();

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4 - TOP 50 BINANCE FUTURES                   ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const symbols = TOP_50_SYMBOLS.slice(0, MAX_COINS);
  console.log(`Testing ${symbols.length} symbols...`);
  console.log();

  const scores: CoinScore[] = [];
  const results: BacktestResult[] = [];
  let downloaded = 0;
  let cached = 0;

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const cacheFile = join(DATA_DIR, `${symbol}_H1.json`);

    try {
      let klines: BinanceKline[];
      try {
        const cachedData = await fs.readFile(cacheFile, 'utf-8');
        klines = JSON.parse(cachedData);
        cached++;
        process.stdout.write(`\r[${i + 1}/${symbols.length}] ${symbol} — cached (${klines.length})    `);
      } catch {
        downloaded++;
        process.stdout.write(`\r[${i + 1}/${symbols.length}] ${symbol} — downloading...    `);
        klines = await fetchAllKlines(symbol);
        if (klines.length < 1000) {
          console.log(`\r  Skipping ${symbol}: only ${klines.length} candles`);
          continue;
        }
        await fs.writeFile(cacheFile, JSON.stringify(klines));
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

      const score = calculateV4Score(candles);
      scores.push({ symbol, score, selected: score >= MIN_SCORE_THRESHOLD });

      if (score < MIN_SCORE_THRESHOLD) continue;

      // Run backtest
      const result = runBacktestV4(candles, symbol, {
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

      results.push({
        symbol,
        score,
        totalPnl: result.totalPnl,
        totalPnlPct: result.totalPnlPct,
        sharpe: result.sharpe,
        calmar: result.calmar,
        maxDD: result.maxDrawdownPct / 100,
        winRate: result.winRate / 100,
        trades: result.totalTrades,
        fees: result.totalFees,
        kellyUsed: result.avgKellyUsed,
      });

      await fs.writeFile(join(RESULTS_DIR, `${symbol}_result.json`), JSON.stringify(result, null, 2));

    } catch (e) {
      console.log(`\r[${i + 1}/${symbols.length}] ${symbol} — ERROR: ${(e as Error).message.slice(0, 50)}`);
    }

    if (i < symbols.length - 1) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  console.log(`\r`);
  console.log(`Downloaded: ${downloaded}, Cached: ${cached}`);
  console.log();

  // Sort results by Sharpe
  results.sort((a, b) => b.sharpe - a.sharpe);

  // Calculate portfolio metrics
  const profitable = results.filter(r => r.totalPnl > 0);
  const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
  const avgSharpe = results.length > 0 ? results.reduce((a, r) => a + r.sharpe, 0) / results.length : 0;
  const totalFees = results.reduce((a, r) => a + r.fees, 0);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    BACKTEST RESULTS                          ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  console.log(`Completed in ${elapsed}s`);
  console.log(`Coins tested: ${results.length}`);
  console.log(`Profitable: ${profitable.length}/${results.length}`);
  console.log();

  console.log('RANKING BY SHARPE (Top 20):');
  console.log('┌──────┬─────────────┬───────┬────────┬──────┬──────────┬────────┬───────┬───────┐');
  console.log('│ Rank │ Coin        │ Score │ Trades │  WR  │   P&L    │ Sharpe │ MaxDD │ Kelly │');
  console.log('├──────┼─────────────┼───────┼────────┼──────┼──────────┼────────┼───────┼───────┤');
  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    const pnlStr = r.totalPnl >= 0 ? `+$${r.totalPnl.toFixed(0).padStart(5)}` : `-$$${Math.abs(r.totalPnl).toFixed(0).padStart(5)}`;
    const icon = r.sharpe > 1 ? '🟢' : r.sharpe > 0 ? '🟡' : '🔴';
    console.log(`│ ${String(i + 1).padStart(4)} │ ${r.symbol.padEnd(11)} │ ${r.score.toString().padStart(5)} │ ${r.trades.toString().padStart(6)} │ ${(r.winRate * 100).toFixed(1).padStart(4)}% │ ${pnlStr.padEnd(8)} │ ${r.sharpe.toFixed(2).padStart(6)} ${icon} │ ${(r.maxDD * 100).toFixed(1).padStart(5)}% │ ${(r.kellyUsed * 100).toFixed(1).padStart(5)}% │`);
  }
  console.log('└──────┴─────────────┴───────┴────────┴──────┴──────────┴────────┴───────┴───────┘');

  console.log();
  console.log('PORTFOLIO METRICS (equal weight):');
  console.log(`  Total P&L:    ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)} (${(totalPnl / (results.length * 10000) * 100).toFixed(2)}%)`);
  console.log(`  Avg Sharpe:    ${avgSharpe.toFixed(2)}`);
  console.log(`  Total Fees:    $${totalFees.toFixed(0)}`);
  console.log(`  Best Coin:     ${results[0]?.symbol || 'N/A'} ($${results[0]?.totalPnl.toFixed(0) || 0})`);
  console.log(`  Worst Coin:    ${results[results.length - 1]?.symbol || 'N/A'} ($${results[results.length - 1]?.totalPnl.toFixed(0) || 0})`);

  // Winners vs Losers
  console.log();
  console.log('WINNERS (Sharpe > 0):');
  const winners = results.filter(r => r.sharpe > 0);
  if (winners.length > 0) {
    console.log(`  Count: ${winners.length}`);
    const avgWinPnl = winners.reduce((a, r) => a + r.totalPnl, 0) / winners.length;
    console.log(`  Avg P&L: $${avgWinPnl.toFixed(0)}`);
    console.log(`  Symbols: ${winners.map(r => r.symbol).join(', ')}`);
  } else {
    console.log('  None');
  }

  console.log();
  console.log('LOSERS (Sharpe < 0):');
  const losers = results.filter(r => r.sharpe < 0);
  if (losers.length > 0) {
    console.log(`  Count: ${losers.length}`);
    const avgLossPnl = losers.reduce((a, r) => a + r.totalPnl, 0) / losers.length;
    console.log(`  Avg P&L: $${avgLossPnl.toFixed(0)}`);
  } else {
    console.log('  None');
  }

  // Save detailed report
  const report = generateReport(scores, results, elapsed);
  await fs.writeFile('./BACKTEST_TOP50_REPORT.md', report);
  console.log();
  console.log('Report saved: BACKTEST_TOP50_REPORT.md');
}

function generateReport(scores: CoinScore[], results: BacktestResult[], elapsed: string): string {
  const now = new Date().toISOString().split('T')[0];
  const profitable = results.filter(r => r.totalPnl > 0);
  const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
  const avgSharpe = results.length > 0 ? results.reduce((a, r) => a + r.sharpe, 0) / results.length : 0;
  const totalFees = results.reduce((a, r) => a + r.fees, 0);

  let md = `# BACKTEST V4 - TOP 50 BINANCE FUTURES REPORT\n\n`;
  md += `**Date:** ${now}\n`;
  md += `**Elapsed:** ${elapsed}s\n\n`;

  md += `## Summary\n\n`;
  md += `- Coins tested: ${results.length}\n`;
  md += `- Profitable coins: ${profitable.length} (${(profitable.length / results.length * 100).toFixed(1)}%)\n`;
  md += `- Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)} (${(totalPnl / (results.length * 10000) * 100).toFixed(2)}%)\n`;
  md += `- Average Sharpe: ${avgSharpe.toFixed(2)}\n`;
  md += `- Total Fees: $${totalFees.toFixed(0)}\n\n`;

  md += `## Top 20 by Sharpe\n\n`;
  md += `| Rank | Coin | Score | Trades | WR | P&L | Sharpe | MaxDD | Kelly |\n`;
  md += `|------|------|-------|--------|----|-----|--------|-------|------|\n`;
  for (let i = 0; i < Math.min(20, results.length); i++) {
    const r = results[i];
    md += `| ${i + 1} | ${r.symbol} | ${r.score} | ${r.trades} | ${(r.winRate * 100).toFixed(1)}% | $${r.totalPnl.toFixed(0)} | ${r.sharpe.toFixed(2)} | ${(r.maxDD * 100).toFixed(1)}% | ${(r.kellyUsed * 100).toFixed(1)}% |\n`;
  }

  md += `\n## Best Performers (P&L > $1000)\n\n`;
  const bestPerformers = results.filter(r => r.totalPnl > 1000);
  if (bestPerformers.length > 0) {
    md += `| Coin | P&L | Sharpe | Trades | WR |\n`;
    md += `|------|-----|--------|--------|----|\n`;
    for (const r of bestPerformers) {
      md += `| ${r.symbol} | $${r.totalPnl.toFixed(0)} | ${r.sharpe.toFixed(2)} | ${r.trades} | ${(r.winRate * 100).toFixed(1)}% |\n`;
    }
  } else {
    md += `None\n`;
  }

  md += `\n## Worst Performers (P&L <-$1000)\n\n`;
  const worstPerformers = results.filter(r => r.totalPnl < -1000);
  if (worstPerformers.length > 0) {
    md += `| Coin | P&L | Sharpe | MaxDD |\n`;
    md += `|------|-----|--------|-------|\n`;
    for (const r of worstPerformers) {
      md += `| ${r.symbol} | -$${Math.abs(r.totalPnl).toFixed(0)} | ${r.sharpe.toFixed(2)} | ${(r.maxDD * 100).toFixed(1)}% |\n`;
    }
  } else {
    md += `None\n`;
  }

  md += `\n## Recommended Portfolio (Sharpe > 0.5)\n\n`;
  const recommended = results.filter(r => r.sharpe > 0.5);
  if (recommended.length > 0) {
    const recPnl = recommended.reduce((a, r) => a + r.totalPnl, 0);
    md += `Symbols: ${recommended.map(r => r.symbol).join(', ')}\n\n`;
    md += `Portfolio metrics:\n`;
    md += `- Equal weight P&L: $${recPnl.toFixed(0)} (${(recPnl / (recommended.length * 10000) * 100).toFixed(2)}%)\n`;
    md += `- Avg Sharpe: ${(recommended.reduce((a, r) => a + r.sharpe, 0) / recommended.length).toFixed(2)}\n`;
  } else {
    md += `No coins meet the Sharpe > 0.5 threshold\n`;
  }

  md += `\n---\n*Generated by Backtest V4 Engine*\n`;

  return md;
}

main().catch(console.error);
