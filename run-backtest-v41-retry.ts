/**
 * BACKTEST V4.1 - RETRY WITH DIFFERENT CONFIG
 *
 * Tentative de reproduire les metrics spécifiques
 */

import { runBacktestV4, type BtCandle } from './src/lib/backtest-v4';

const BINANCE_BASE = 'https://fapi.binance.com';

interface BinanceKline {
  0: number; 1: string; 2: string; 3: string; 4: string; 5: string;
  6: number; 7: string; 8: number; 9: string; 10: string; 11: string;
}

async function fetchKlines(symbol: string, interval: string = '1h', limit: number = 1500, endTime?: number): Promise<BinanceKline[]> {
  let url = `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) url += `&endTime=${endTime}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Binance API error: ${response.status}`);
  return response.json();
}

async function fetchAllKlines(symbol: string, months: number = 6): Promise<BinanceKline[]> {
  const now = Date.now();
  const startTime = now - months * 30 * 24 * 60 * 60 * 1000;
  let allKlines: BinanceKline[] = [];
  let currentEndTime = now;

  while (allKlines.length < 4500) {
    const klines = await fetchKlines(symbol, '1h', 1500, currentEndTime);
    if (klines.length === 0) break;

    const sortedKlines = [...klines].sort((a, b) => a[0] - b[0]);
    const newKlines = sortedKlines.filter(k => !allKlines.some(existing => existing[0] === k[0]));

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
    } catch (e) { /* ignore */ }

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

async function runBacktest(symbol: string, label: string) {
  console.log(`\n[${symbol}] Fetching data...`);

  const klines = await fetchAllKlines(symbol, 6);
  const candles = await convertToBtCandles(klines, symbol);

  if (candles.length < 1000) {
    console.log(`  ERROR: Not enough data (${candles.length} candles)`);
    return null;
  }

  console.log(`  Data: ${candles.length} candles from ${new Date(candles[0].t).toLocaleDateString()} to ${new Date(candles[candles.length - 1].t).toLocaleDateString()}`);

  const result = runBacktestV4(candles, symbol, {
    feeRate: 0.0004,
    initialCapital: 100_000,
    useHMM: true,
    useVPIN: true,
    useEhlers: true,
    useOI: false,
    useKelly: true,
    kellyWindowSize: 30,
    vpinHighThreshold: 0.65,
    regimeThresholds: { bullConfluence: 60, bearConfluence: 60, rangingConfluence: 75 },
  });

  const years = (candles[candles.length - 1].t - candles[0].t) / (365 * 24 * 60 * 60 * 1000);
  const annualizedReturn = Math.pow((100_000 + result.totalPnl) / 100_000, 1 / years) - 1;

  console.log(`  Result: P&L=$${result.totalPnl.toFixed(0)}, Sharpe=${result.sharpe.toFixed(2)}, MaxDD=${(result.maxDrawdownPct/100).toFixed(2)}%`);

  return {
    symbol,
    label,
    totalPnl: result.totalPnl,
    sharpe: result.sharpe,
    maxDD: result.maxDrawdownPct / 100,
    winRate: result.winRate / 100,
    totalTrades: result.totalTrades,
    annualizedReturn,
    years,
    finalEquity: 100_000 + result.totalPnl,
  };
}

async function main() {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4.1 - RETRY (6 MOIS)                         ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const symbols = ['DOGEUSDT', 'SOLUSDT'];
  const results: any[] = [];

  for (const symbol of symbols) {
    try {
      const result = await runBacktest(symbol, symbol);
      if (result) results.push(result);
    } catch (e) {
      console.error(`Error for ${symbol}:`, e);
    }
  }

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS                                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  for (const r of results) {
    console.log(`  ${r.symbol}:`);
    console.log(`    Sharpe: ${r.sharpe.toFixed(2)}`);
    console.log(`    CAGR: ${(r.annualizedReturn * 100).toFixed(2)}%`);
    console.log(`    Max DD: ${(r.maxDD * 100).toFixed(2)}%`);
    console.log(`    Final Equity: $${r.finalEquity.toFixed(0)}`);
  }

  return results;
}

main().catch(console.error);
