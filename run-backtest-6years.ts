/**
 * BACKTEST V4 - 6 ANS DE DONNÉES (2020-2026)
 *
 * Backtest historique complet sur 6 ans
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

async function fetchAllKlines(symbol: string, years: number = 6): Promise<BinanceKline[]> {
  const now = Date.now();
  const startTime = now - years * 365 * 24 * 60 * 60 * 1000;
  let allKlines: BinanceKline[] = [];
  let currentEndTime = now;

  console.log(`Fetching ${years} years of 1h data from Binance...`);

  while (true) {
    const klines = await fetchKlines(symbol, '1h', 1500, currentEndTime);
    if (klines.length === 0) break;

    const sortedKlines = [...klines].sort((a, b) => a[0] - b[0]);
    const newKlines = sortedKlines.filter(k => !allKlines.some(existing => existing[0] === k[0]));

    if (newKlines.length === 0) break;

    allKlines = [...newKlines, ...allKlines];
    allKlines.sort((a, b) => a[0] - b[0]);

    const oldestTime = allKlines[0][0];
    const progress = Math.min(100, ((now - oldestTime) / (now - startTime)) * 100);
    console.log(`  Progress: ${progress.toFixed(0)}% (${allKlines.length} candles, from ${new Date(oldestTime).toLocaleDateString()})`);

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

  console.log(`  Funding rates loaded: ${fundingMap.size} data points`);

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

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

async function runBacktest6Years(symbol: string) {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4 - 6 ANS ${symbol.padEnd(19)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  const startTime = Date.now();

  const klines = await fetchAllKlines(symbol, 6);
  const candles = await convertToBtCandles(klines, symbol);

  if (candles.length < 1000) {
    console.error('Not enough data');
    return;
  }

  console.log(`\nDATA SUMMARY:`);
  console.log(`  Total candles:   ${candles.length}`);
  console.log(`  Date range:      ${new Date(candles[0].t).toLocaleDateString()} → ${new Date(candles[candles.length - 1].t).toLocaleDateString()}`);
  console.log(`  Period:          ${((candles[candles.length - 1].t - candles[0].t) / (365 * 24 * 60 * 60 * 1000)).toFixed(1)} years`);

  console.log(`\nRunning V4 backtest...`);

  const result = runBacktestV4(candles, symbol, {
    feeRate: 0.0004,
    initialCapital: 10_000,
    useHMM: true,
    useVPIN: true,
    useEhlers: true,
    useOI: false,
    useKelly: true,
    kellyWindowSize: 30,
    vpinHighThreshold: 0.65,
    regimeThresholds: { bullConfluence: 60, bearConfluence: 60, rangingConfluence: 75 },
  });

  const elapsed = Date.now() - startTime;

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      BACKTEST RESULTS                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  const initialCapital = 10_000;
  const finalBalance = initialCapital + result.totalPnl;
  const years = (candles[candles.length - 1].t - candles[0].t) / (365 * 24 * 60 * 60 * 1000);
  const annualizedReturn = (Math.pow(finalBalance / initialCapital, 1 / years) - 1);

  console.log(`BASIC INFO:`);
  console.log(`  Symbol:           ${result.coin}`);
  console.log(`  Period:           ${new Date(candles[0].t).toLocaleDateString()} → ${new Date(candles[candles.length - 1].t).toLocaleDateString()}`);
  console.log(`  Years:            ${years.toFixed(1)}`);
  console.log(`  Total Candles:    ${candles.length}\n`);

  console.log(`PORTFOLIO PERFORMANCE:`);
  console.log(`  Initial Capital:  ${formatCurrency(initialCapital)}`);
  console.log(`  Final Balance:    ${formatCurrency(finalBalance)}`);
  console.log(`  Total Return:     ${formatPercent(result.totalPnlPct)}`);
  console.log(`  Annualized Return:${formatPercent(annualizedReturn)}`);
  console.log(`  Total P&L:        ${formatCurrency(result.totalPnl)}`);
  console.log(`  Total Fees:       ${formatCurrency(result.totalFees)}\n`);

  console.log(`TRADE STATISTICS:`);
  console.log(`  Total Trades:     ${result.totalTrades}`);
  console.log(`  Winning Trades:   ${result.wins} (${formatPercent(result.wins / result.totalTrades)})`);
  console.log(`  Win Rate:         ${formatPercent(result.winRate / 100)}\n`);

  console.log(`RISK METRICS:`);
  console.log(`  Max Drawdown:     ${formatPercent(result.maxDrawdownPct / 100)} (${formatCurrency(result.maxDrawdownUsd)})`);
  console.log(`  Sharpe Ratio:     ${result.sharpe.toFixed(2)}`);
  console.log(`  Sortino Ratio:    ${result.sortino.toFixed(2)}\n`);

  console.log(`Backtest completed in ${(elapsed / 1000).toFixed(2)}s`);

  return {
    symbol,
    years,
    totalPnl: result.totalPnl,
    sharpe: result.sharpe,
    maxDD: result.maxDrawdownPct / 100,
    winRate: result.winRate / 100,
    totalTrades: result.totalTrades,
    annualizedReturn,
  };
}

async function main() {
  const symbols = ['DOGEUSDT', 'SOLUSDT'];
  const results: any[] = [];

  for (const symbol of symbols) {
    try {
      const result = await runBacktest6Years(symbol);
      results.push(result);
    } catch (e) {
      console.error(`Error for ${symbol}:`, e);
    }
  }

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    6-YEARS COMPARISON                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`┌───────────┬────────┬──────────┬────────┬────────┬─────────┬───────────┐`);
  console.log(`│ Symbol    │ Years  │ Total P&L│ Sharpe │ MaxDD  │ WinRate │ CAGR      │`);
  console.log(`├───────────┼────────┼──────────┼────────┼────────┼─────────┼───────────┤`);

  for (const r of results) {
    const icon = r.totalPnl > 0 ? '🟢' : '🔴';
    console.log(`│ ${r.symbol.padEnd(9)} │ ${r.years.toFixed(1).padStart(6)} │ `
      + `${icon} ${r.totalPnl.toFixed(0).padStart(7)} │ `
      + `${r.sharpe.toFixed(2).padStart(6)} │ `
      + `${(r.maxDD * 100).toFixed(1).padStart(6)}% │ `
      + `${(r.winRate * 100).toFixed(1).padStart(6)}% │ `
      + `${(r.annualizedReturn * 100).toFixed(1).padStart(8)}% │`);
  }

  console.log(`└───────────┴────────┴──────────┴────────┴────────┴─────────┴───────────┘`);

  const totalPnl = results.reduce((a, r) => a + r.totalPnl, 0);
  const avgSharpe = results.reduce((a, r) => a + r.sharpe, 0) / results.length;

  console.log(`\nPORTFOLIO (DOGE + SOL):`);
  console.log(`  Total P&L: ${formatCurrency(totalPnl)}`);
  console.log(`  Avg Sharpe: ${avgSharpe.toFixed(2)}`);
}

main().catch(console.error);
