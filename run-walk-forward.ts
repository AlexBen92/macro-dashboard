/**
 * WALK-FORWARD ANALYSIS - SOL & DOGE
 *
 * Méthodologie:
 * - Training period: 6 mois
 * - Testing period: 1 mois
 * - Step: 1 mois
 * - Total: 12 mois de données
 */

import { runBacktestV4, type BtCandle, type BacktestResult } from './src/lib/backtest-v4';

const BINANCE_BASE = 'https://fapi.binance.com';

interface BinanceKline {
  0: number; 1: string; 2: string; 3: string; 4: string; 5: string;
  6: number; 7: string; 8: number; 9: string; 10: string; 11: string;
}

interface WalkForwardSegment {
  trainStart: Date;
  trainEnd: Date;
  testStart: Date;
  testEnd: Date;
  trainResult?: BacktestResult;
  testResult?: BacktestResult;
}

interface WalkForwardSummary {
  symbol: string;
  totalSegments: number;
  profitableSegments: number;
  totalPnl: number;
  avgSharpe: number;
  avgWinRate: number;
  maxDrawdown: number;
  consistency: number;  // % de segments rentables
}

// ═══════════════════════════════════════════════════════════════════════════════

async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 1500,
  endTime?: number
): Promise<BinanceKline[]> {
  let url = `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) url += `&endTime=${endTime}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
  return response.json();
}

async function fetchAllKlines(
  symbol: string,
  months: number = 12
): Promise<BinanceKline[]> {
  const now = Date.now();
  const startTime = now - months * 30 * 24 * 60 * 60 * 1000;
  let allKlines: BinanceKline[] = [];
  let currentEndTime = now;

  while (true) {
    const klines = await fetchKlines(symbol, '1h', 1500, currentEndTime);
    if (klines.length === 0) break;

    const sortedKlines = [...klines].sort((a, b) => a[0] - b[0]);
    const newKlines = sortedKlines.filter(k =>
      !allKlines.some(existing => existing[0] === k[0])
    );

    if (newKlines.length === 0) break;

    allKlines = [...newKlines, ...allKlines];
    allKlines.sort((a, b) => a[0] - b[0]);

    const oldestTime = allKlines[0][0];
    if (oldestTime <= startTime) break;

    currentEndTime = oldestTime - 1;
    await new Promise(r => setTimeout(r, 100));
  }

  return allKlines.filter(k => k[0] >= startTime).sort((a, b) => a[0] - b[0]);
}

async function fetchFundingHistory(symbol: string, startTime: number, endTime: number): Promise<Map<number, number>> {
  const fundingMap = new Map<number, number>();
  let chunkEnd = startTime;

  while (chunkEnd < endTime) {
    const nextEnd = Math.min(chunkEnd + 30 * 24 * 60 * 60 * 1000, endTime);
    let url = `${BINANCE_BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=500&startTime=${chunkEnd}&endTime=${nextEnd}`;

    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json() as any[];
        for (const f of data) {
          const candleTime = Math.floor(f.fundingTime / 3600000) * 3600000;
          fundingMap.set(candleTime, parseFloat(f.fundingRate));
        }
      }
    } catch (e) {
      // Ignore funding errors
    }

    chunkEnd = nextEnd + 1;
    await new Promise(r => setTimeout(r, 50));
  }

  return fundingMap;
}

async function convertToBtCandles(klines: BinanceKline[], symbol: string): Promise<BtCandle[]> {
  if (klines.length === 0) return [];

  const startTime = klines[0][0];
  const endTime = klines[klines.length - 1][0];
  const fundingMap = await fetchFundingHistory(symbol, startTime, endTime);

  return klines.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
    oi: 1000000,
    funding: fundingMap.get(k[0]) ?? 0.0001,
  }));
}

function sliceCandlesByDate(candles: BtCandle[], startDate: Date, endDate: Date): BtCandle[] {
  const start = startDate.getTime();
  const end = endDate.getTime();
  return candles.filter(c => c.t >= start && c.t <= end);
}

function runBacktestOnSegment(
  candles: BtCandle[],
  symbol: string,
  segmentName: string
): BacktestResult {
  if (candles.length < 100) {
    throw new Error(`Not enough candles for ${segmentName}: ${candles.length}`);
  }

  return runBacktestV4(candles, symbol, {
    feeRate: 0.0004,
    initialCapital: 10_000,
    useHMM: true,
    useVPIN: true,
    useEhlers: true,
    useOI: false,
    useKelly: true,
    kellyWindowSize: 30,
    vpinHighThreshold: 0.65,
    regimeThresholds: {
      bullConfluence: 60,
      bearConfluence: 60,
      rangingConfluence: 75,
    },
  });
}

async function runWalkForward(symbol: string): Promise<WalkForwardSummary> {
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     WALK-FORWARD ANALYSIS - ${symbol.padEnd(20)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  // Fetch 12 months of data
  const klines = await fetchAllKlines(symbol, 12);
  const candles = await convertToBtCandles(klines, symbol);

  if (candles.length < 5000) {
    throw new Error(`Not enough data for walk-forward: ${candles.length} candles`);
  }

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000);

  // Create segments: 6 months train, 1 month test, stepping 1 month
  const segments: WalkForwardSegment[] = [];
  const monthMs = 30 * 24 * 60 * 60 * 1000;

  for (let i = 0; i <= 5; i++) {
    const trainEnd = new Date(twelveMonthsAgo.getTime() + (6 + i) * monthMs);
    const testStart = new Date(trainEnd.getTime() + 1);
    const testEnd = new Date(testStart.getTime() + monthMs);
    const trainStart = new Date(trainEnd.getTime() - 6 * monthMs);

    if (testEnd > now) break;

    segments.push({
      trainStart,
      trainEnd,
      testStart,
      testEnd,
    });
  }

  console.log(`\nConfiguration:`);
  console.log(`  Training period: 6 months`);
  console.log(`  Testing period: 1 month`);
  console.log(`  Step: 1 month`);
  console.log(`  Total segments: ${segments.length}`);
  console.log(`  Data range: ${twelveMonthsAgo.toLocaleDateString()} → ${now.toLocaleDateString()}`);

  const results: WalkForwardSegment[] = [];
  let totalPnl = 0;
  let profitableCount = 0;
  const sharpes: number[] = [];
  const winRates: number[] = [];
  let maxDrawdown = 0;

  console.log(`\n┌──────┬─────────────┬─────────────┬─────────────┬──────────┬────────┬──────┬───────┐`);
  console.log(`│ Seg │ Train       │ Test        │ Train P&L   │ Test P&L │ Sharpe │ WR   │ DD%   │`);
  console.log(`├──────┼─────────────┼─────────────┼─────────────┼──────────┼────────┼──────┼───────┤`);

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    try {
      const trainCandles = sliceCandlesByDate(candles, seg.trainStart, seg.trainEnd);
      const testCandles = sliceCandlesByDate(candles, seg.testStart, seg.testEnd);

      // Train on training period (get parameters/confluence thresholds)
      const trainResult = runBacktestOnSegment(trainCandles, symbol, `Segment ${i} Train`);

      // Test on testing period with same parameters
      const testResult = runBacktestOnSegment(testCandles, symbol, `Segment ${i} Test`);

      seg.trainResult = trainResult;
      seg.testResult = testResult;

      const testPnl = testResult.totalPnl;
      const testSharpe = testResult.sharpe;
      const testWR = testResult.winRate / 100;
      const testDD = testResult.maxDrawdownPct / 100;

      totalPnl += testPnl;
      if (testPnl > 0) profitableCount++;
      sharpes.push(testSharpe);
      winRates.push(testWR);
      maxDrawdown = Math.max(maxDrawdown, testDD);

      const icon = testPnl > 0 ? '🟢' : testPnl < 0 ? '🔴' : '⚪';
      const trainIcon = trainResult.totalPnl > 0 ? '🟢' : '🔴';

      console.log(`│ ${i + 1}    │ `
        + `${seg.trainStart.toLocaleDateString().slice(0, 6)} → ${seg.trainEnd.toLocaleDateString().slice(0, 6)} │ `
        + `${seg.testStart.toLocaleDateString().slice(0, 6)} → ${seg.testEnd.toLocaleDateString().slice(0, 6)} │ `
        + `${trainIcon} $${trainResult.totalPnl.toFixed(0).padStart(6)} │ `
        + `${icon} $${testPnl.toFixed(0).padStart(6)} │ `
        + `${testSharpe.toFixed(2).padStart(6)} │ `
        + `${(testWR * 100).toFixed(0).padStart(3)}% │ `
        + `${(testDD * 100).toFixed(1).padStart(5)} │`);

      results.push(seg);

      // Small delay between segments
      await new Promise(r => setTimeout(r, 50));

    } catch (e) {
      console.log(`│ ${i + 1}    │ ERROR: ${(e as Error).message.slice(0, 40)} │`);
    }
  }

  console.log(`└──────┴─────────────┴─────────────┴─────────────┴──────────┴────────┴──────┴───────┘`);

  const avgSharpe = sharpes.length > 0
    ? sharpes.reduce((a, b) => a + b, 0) / sharpes.length
    : 0;
  const avgWR = winRates.length > 0
    ? winRates.reduce((a, b) => a + b, 0) / winRates.length
    : 0;
  const consistency = profitableCount / segments.length;

  return {
    symbol,
    totalSegments: segments.length,
    profitableSegments: profitableCount,
    totalPnl,
    avgSharpe,
    avgWinRate: avgWR,
    maxDrawdown,
    consistency,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const symbols = ['SOLUSDT', 'DOGEUSDT'];
  const summaries: WalkForwardSummary[] = [];

  for (const symbol of symbols) {
    try {
      const summary = await runWalkForward(symbol);
      summaries.push(summary);
    } catch (e) {
      console.error(`Error running walk-forward for ${symbol}:`, e);
    }
  }

  // Final comparison
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║              WALK-FORWARD COMPARISON                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`┌───────────┬──────────┬───────────┬──────────┬──────────┬─────────┬──────────┐`);
  console.log(`│ Symbol    │ Segments │ Profitable│ Total P&L│ Avg Sharpe│ Avg WR  │ MaxDD    │`);
  console.log(`├───────────┼──────────┼───────────┼──────────┼──────────┼─────────┼──────────┤`);

  for (const s of summaries) {
    const icon = s.totalPnl > 0 ? '🟢' : '🔴';
    console.log(`│ ${s.symbol.padEnd(9)} │ `
      + `${s.totalSegments.toString().padStart(8)} │ `
      + `${s.profitableSegments}/${s.totalSegments} (${(s.consistency * 100).toFixed(0)}%) │ `
      + `${icon} $${s.totalPnl.toFixed(0).padStart(6)} │ `
      + `${s.avgSharpe.toFixed(2).padStart(8)} │ `
      + `${(s.avgWinRate * 100).toFixed(1).padStart(6)}% │ `
      + `${(s.maxDrawdown * 100).toFixed(1).padStart(7)}% │`);
  }

  console.log(`└───────────┴──────────┴───────────┴──────────┴──────────┴─────────┴──────────┘`);

  // Verdict
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                        VERDICT                              ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  for (const s of summaries) {
    let verdict = '';
    if (s.consistency >= 0.7 && s.avgSharpe > 0.5) {
      verdict = `✅ EXCELLENT - Stratégie robuste (${(s.consistency * 100).toFixed(0)}% segments rentables)`;
    } else if (s.consistency >= 0.5 && s.avgSharpe > 0) {
      verdict = `🟡 ACCEPTABLE - Performance modérée, risque moyen`;
    } else {
      verdict = `❌ FAIBLE - Stratégie non robuste (${(s.consistency * 100).toFixed(0)}% segments rentables)`;
    }
    console.log(`  ${s.symbol}: ${verdict}`);
  }
}

main().catch(console.error);
