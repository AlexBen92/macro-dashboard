/**
 * BACKTEST V4 - FULL UNIVERSE BINANCE FUTURES (LIMITÉ À 10 COINS)
 *
 * Version limitée pour test rapide
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
const MIN_SCORE_THRESHOLD = 60;  // Seuil ajusté pour scoring amélioré
const REQUEST_DELAY_MS = 150;
const MAX_COINS = 10;  // LIMITÉ POUR TEST

const BINANCE_BASE = 'https://fapi.binance.com';

// Top 20 coins by volume (hardcoded for speed)
const TOP_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'TRXUSDT', 'MATICUSDT'
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
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
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

    if (oldestNewTime <= startTime) break;

    currentEndTime = oldestNewTime - 1;
    await new Promise(r => setTimeout(r, 50));
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
// SCORING V4 (SIMPLIFIÉ)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateV4Score(candles: BtCandle[]): number {
  if (candles.length < 500) return 0;

  const recent = candles.slice(-720);  // Last 30 days
  const closes = recent.map(c => c.c);
  const volumes = recent.map(c => c.v);

  // Trend strength (0-25) - plus généreux
  const trend = (closes[closes.length - 1] - closes[0]) / closes[0];
  let trendScore = Math.min(25, Math.abs(trend) * 200 + 5);  // Base de 5 points

  // Volume consistency (0-25) - plus généreux
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const volStd = Math.sqrt(volumes.reduce((a, v) => a + (v - avgVol) ** 2, 0) / volumes.length);
  const volCV = volStd / avgVol;
  let volScore = volCV < 0.5 ? 25 : volCV < 0.8 ? 20 : volCV < 1.2 ? 15 : 10;

  // Volatility sweet spot (0-25) - plus généreux
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
  }
  const dailyVol = Math.sqrt(returns.reduce((a, r) => a + r ** 2, 0) / returns.length) * Math.sqrt(24);
  let volaScore = dailyVol > 0.015 && dailyVol < 0.08 ? 25 : dailyVol > 0.01 && dailyVol < 0.12 ? 20 : 15;

  // Price action quality (0-25) - basé sur le range
  const highs = recent.map(c => c.h);
  const lows = recent.map(c => c.l);
  const ranges = highs.map((h, i) => (h - lows[i]) / closes[i]);
  const avgRange = ranges.reduce((a, r) => a + r, 0) / ranges.length;
  let paScore = avgRange > 0.02 && avgRange < 0.10 ? 25 : avgRange > 0.01 && avgRange < 0.15 ? 20 : 15;

  return Math.round(trendScore + volScore + volaScore + paScore);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4 - TOP ${MAX_COINS} BINANCE FUTURES                ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });

  const symbols = TOP_SYMBOLS.slice(0, MAX_COINS);
  console.log(`Symbols to test: ${symbols.join(', ')}`);
  console.log();

  const scores: CoinScore[] = [];
  const results: BacktestResult[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const cacheFile = join(DATA_DIR, `${symbol}_H1.json`);

    try {
      // Download or load cached
      let klines: BinanceKline[];
      try {
        const cached = await fs.readFile(cacheFile, 'utf-8');
        klines = JSON.parse(cached);
        console.log(`[${i + 1}/${symbols.length}] ${symbol} — cached (${klines.length} candles)`);
      } catch {
        console.log(`[${i + 1}/${symbols.length}] ${symbol} — downloading...`);
        klines = await fetchAllKlines(symbol);
        if (klines.length < 1000) {
          console.log(`  Skipped: only ${klines.length} candles`);
          continue;
        }
        await fs.writeFile(cacheFile, JSON.stringify(klines));
        console.log(`  Downloaded: ${klines.length} candles`);
      }

      // Convert to BtCandle
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

      // Score
      const score = calculateV4Score(candles);
      scores.push({ symbol, score, selected: score >= MIN_SCORE_THRESHOLD });
      console.log(`  Score: ${score}/100 ${score >= MIN_SCORE_THRESHOLD ? '✓' : '✗'}`);

      if (score < MIN_SCORE_THRESHOLD) {
        console.log(`  Skipped backtest (score < ${MIN_SCORE_THRESHOLD})`);
        continue;
      }

      // Backtest
      console.log(`  Running backtest...`);
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
      });

      await fs.writeFile(join(RESULTS_DIR, `${symbol}_result.json`), JSON.stringify(result, null, 2));
      console.log(`  Result: P&L=$${result.totalPnl.toFixed(0)}, Sharpe=${result.sharpe.toFixed(2)}, WR=${(result.winRate / 100).toFixed(1)}%`);

    } catch (e) {
      console.log(`[${i + 1}/${symbols.length}] ${symbol} — ERROR: ${(e as Error).message}`);
    }

    if (i < symbols.length - 1) {
      await new Promise(r => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  // Generate report
  results.sort((a, b) => b.sharpe - a.sharpe);

  const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
  const avgSharpe = results.length > 0 ? results.reduce((a, r) => a + r.sharpe, 0) / results.length : 0;
  const totalFees = results.reduce((a, r) => a + r.fees, 0);

  console.log();
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    BACKTEST RESULTS                          ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  console.log('RANKING BY SHARPE:');
  console.log('| Rank | Coin | Score | Trades | WR | PnL | Sharpe | MaxDD |');
  console.log('|------|------|-------|--------|----|-----|--------|-------|');
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    console.log(`| ${i + 1} | ${r.symbol.padEnd(8)} | ${r.score.toString().padStart(3)} | ${r.trades.toString().padStart(4)} | ${(r.winRate * 100).toFixed(1).padStart(5)}% | $${r.totalPnl.toFixed(0).padStart(6)} | ${r.sharpe.toFixed(2).padStart(6)} | ${(r.maxDD * 100).toFixed(1).padStart(5)}% |`);
  }

  console.log();
  console.log('PORTFOLIO METRICS (equal weight):');
  console.log(`  Total P&L: $${totalPnl.toFixed(0)} (${(totalPnl / (results.length * 10000) * 100).toFixed(2)}%)`);
  console.log(`  Avg Sharpe: ${avgSharpe.toFixed(2)}`);
  console.log(`  Total Fees: $${totalFees.toFixed(0)}`);
  console.log();

  // Save report
  const report = `# BACKTEST V4 - TOP ${MAX_COINS} REPORT

**Date:** ${new Date().toISOString().split('T')[0]}

## Results

| Rank | Coin | Score | Trades | WR | PnL | Sharpe | MaxDD |
|------|------|-------|--------|----|-----|--------|-------|
${results.map((r, i) => `| ${i + 1} | ${r.symbol} | ${r.score} | ${r.trades} | ${(r.winRate * 100).toFixed(1)}% | $${r.totalPnl.toFixed(0)} | ${r.sharpe.toFixed(2)} | ${(r.maxDD * 100).toFixed(1)}% |`).join('\n')}

## Portfolio Metrics

- Total P&L: $${totalPnl.toFixed(0)} (${(totalPnl / (results.length * 10000) * 100).toFixed(2)}%)
- Avg Sharpe: ${avgSharpe.toFixed(2)}
- Total Fees: $${totalFees.toFixed(0)}
`;

  await fs.writeFile('./BACKTEST_TOP10_REPORT.md', report);
  console.log('Report saved: BACKTEST_TOP10_REPORT.md');
}

main().catch(console.error);
