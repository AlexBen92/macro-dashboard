/**
 * BACKTEST V4 - 12 MOIS DE DONNÉES BINANCE
 *
 * Récupère les données historiques de Binance et lance un backtest V4 complet
 */

import { runBacktestV4, type BtCandle } from './src/lib/backtest-v4';
import { monteCarloSimulation } from './src/lib/quant/advanced-metrics';

// ═══════════════════════════════════════════════════════════════════════════════
// BINANCE API
// ═══════════════════════════════════════════════════════════════════════════════

const BINANCE_BASE = 'https://fapi.binance.com';

interface BinanceKline {
  0: number;  // Open time
  1: string;  // Open
  2: string;  // High
  3: string;  // Low
  4: string;  // Close
  5: string;  // Volume
  6: number;  // Close time
  7: string;  // Quote asset volume
  8: number;  // Number of trades
  9: string;  // Taker buy base asset volume
  10: string; // Taker buy quote asset volume
  11: string; // Ignore
}

interface BinanceOI {
  symbol: string;
  openInterest: string;
  timestamp: number;
}

interface BinanceFunding {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
}

/**
 * Récupère les klines (OHLCV) de Binance Futures
 */
async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 1500,
  endTime?: number
): Promise<BinanceKline[]> {
  let url = `${BINANCE_BASE}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  if (endTime) {
    url += `&endTime=${endTime}`;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Binance API error: ${response.status}`);
  }

  return response.json();
}

/**
 * Récupère les données Open Interest historiques
 * Note: Binance ne fournit pas d'historique OI complet, on utilise l'endpoint actuel
 */
async function fetchCurrentOI(symbol: string): Promise<number> {
  const url = `${BINANCE_BASE}/fapi/v1/openInterest?symbol=${symbol}`;
  const response = await fetch(url);
  if (!response.ok) return 0;

  const data = await response.json() as BinanceOI;
  return parseFloat(data.openInterest);
}

/**
 * Récupère l'historique des funding rates
 */
async function fetchFundingHistory(
  symbol: string,
  limit: number = 500,
  startTime?: number,
  endTime?: number
): Promise<BinanceFunding[]> {
  let url = `${BINANCE_BASE}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`;
  if (startTime) url += `&startTime=${startTime}`;
  if (endTime) url += `&endTime=${endTime}`;

  const response = await fetch(url);
  if (!response.ok) return [];

  return response.json();
}

/**
 * Récupère toutes les klines pour une période (pagination automatique)
 */
async function fetchAllKlines(
  symbol: string,
  interval: string = '1h',
  months: number = 6
): Promise<BinanceKline[]> {
  const now = Date.now();
  const startTime = now - months * 30 * 24 * 60 * 60 * 1000;

  let allKlines: BinanceKline[] = [];
  let currentEndTime = now;

  console.log(`Fetching ${months} months of ${interval} data from Binance...`);

  while (true) {
    const klines = await fetchKlines(symbol, interval, 1500, currentEndTime);
    if (klines.length === 0) break;

    // Les klines viennent dans l'ordre décroissant (plus récent d'abord)
    // On veut l'ordre croissant
    const sortedKlines = [...klines].sort((a, b) => a[0] - b[0]);

    // Trouver les nouvelles klines (pas encore dans allKlines)
    const oldestNewTime = sortedKlines[0][0];
    const newestNewTime = sortedKlines[sortedKlines.length - 1][0];

    const newKlines = sortedKlines.filter(k =>
      !allKlines.some(existing => existing[0] === k[0])
    );

    if (newKlines.length === 0) {
      // Pas de nouvelles données, on a atteint le début
      break;
    }

    allKlines = [...newKlines, ...allKlines];
    allKlines.sort((a, b) => a[0] - b[0]);

    const oldestTime = allKlines[0][0];
    const progress = Math.min(100, ((now - oldestTime) / (now - startTime)) * 100);
    console.log(`  Progress: ${progress.toFixed(0)}% (${allKlines.length} candles, from ${new Date(oldestTime).toLocaleDateString()})`);

    // Si on a atteint le temps de début
    if (oldestTime <= startTime) {
      break;
    }

    // Continuer à chercher plus loin dans le passé
    currentEndTime = oldestTime - 1;

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  // Filtrer pour ne garder que la période demandée
  allKlines = allKlines.filter(k => k[0] >= startTime);
  allKlines.sort((a, b) => a[0] - b[0]);

  console.log(`  Total candles retrieved: ${allKlines.length}`);
  return allKlines;
}

/**
 * Convertit les klines Binance en BtCandle avec OI et funding
 */
async function convertToBtCandles(
  klines: BinanceKline[],
  symbol: string
): Promise<BtCandle[]> {
  console.log('Converting data and fetching OI/Funding...');

  // Récupérer le funding history
  const fundingMap = new Map<number, number>();
  const startTime = klines[0][0];
  const endTime = klines[klines.length - 1][0];

  let fundingEndTime = startTime;
  while (fundingEndTime < endTime) {
    const chunkEnd = Math.min(fundingEndTime + 30 * 24 * 60 * 60 * 1000, endTime);
    const fundingData = await fetchFundingHistory(symbol, 500, fundingEndTime, chunkEnd);

    for (const f of fundingData) {
      // Trouver le candle correspondant
      const candleTime = Math.floor(f.fundingTime / 3600000) * 3600000;
      fundingMap.set(candleTime, parseFloat(f.fundingRate));
    }

    fundingEndTime = chunkEnd + 1;
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`  Funding rates loaded: ${fundingMap.size} data points`);

  // Récupérer OI actuel (on va le simuler pour l'historique)
  const currentOI = await fetchCurrentOI(symbol);

  const candles: BtCandle[] = klines.map(k => ({
    t: k[0],
    o: parseFloat(k[1]),
    h: parseFloat(k[2]),
    l: parseFloat(k[3]),
    c: parseFloat(k[4]),
    v: parseFloat(k[5]),
    oi: currentOI * (0.8 + Math.random() * 0.4), // Simulé car pas d'historique
    funding: fundingMap.get(k[0]) ?? 0.0001,
  }));

  return candles;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + '%';
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const symbol = (process.argv[2] || 'BTCUSDT').toUpperCase();

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4 - 12 MOIS ${symbol.padEnd(21)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  // Fetch data from Binance
  const klines = await fetchAllKlines(symbol, '1h', 12);
  const candles = await convertToBtCandles(klines, symbol);

  if (candles.length < 500) {
    console.error('Not enough data for backtest (need at least 500 candles)');
    return;
  }

  console.log();
  console.log(`DATA SUMMARY:`);
  console.log(`  Total candles:   ${candles.length}`);
  console.log(`  Date range:      ${new Date(candles[0].t).toLocaleDateString()} → ${new Date(candles[candles.length - 1].t).toLocaleDateString()}`);
  console.log(`  Price range:     $${formatNumber(Math.min(...candles.map(c => c.c)))} - $${formatNumber(Math.max(...candles.map(c => c.c)))}`);
  const avgVolume = candles.reduce((a, c) => a + c.v, 0) / candles.length / 1_000_000;
  console.log(`  Avg volume:      $${avgVolume.toFixed(0)}M`);
  console.log();

  // Run backtest
  console.log('Running V4 backtest...');
  console.log('  Features: HMM ✓, VPIN ✓, Ehlers ✓, OI ✓, Kelly ✓');
  console.log();

  const startTime = Date.now();
  const result = runBacktestV4(candles, symbol, {
    feeRate: 0.0004,
    initialCapital: 10_000,
    useHMM: true,
    useVPIN: true,
    useEhlers: true,
    useOI: true,
    useKelly: true,
    kellyWindowSize: 30,
    vpinHighThreshold: 0.65,
    regimeThresholds: {
      bullConfluence: 60,
      bearConfluence: 60,
      rangingConfluence: 75,
    },
  });
  const elapsed = Date.now() - startTime;

  // ═══════════════════════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log();
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      BACKTEST RESULTS                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  // Basic info
  console.log('BASIC INFO:');
  console.log(`  Symbol:           ${result.coin}`);
  console.log(`  Period:           ${result.candleFrom} → ${result.candleTo}`);
  console.log(`  Total Candles:    ${result.totalCandles}`);
  console.log();

  // Portfolio performance
  console.log('PORTFOLIO PERFORMANCE:');
  const initialCapital = 10_000;
  const finalBalance = initialCapital + result.totalPnl;
  console.log(`  Initial Capital:  ${formatCurrency(initialCapital)}`);
  console.log(`  Final Balance:    ${formatCurrency(finalBalance)}`);
  console.log(`  Total Return:     ${formatPercent(result.totalPnlPct)}`);
  console.log(`  Total P&L:        ${formatCurrency(result.totalPnl)}`);
  console.log(`  Total Fees:       ${formatCurrency(result.totalFees)}`);
  console.log();

  // Trade stats
  console.log('TRADE STATISTICS:');
  console.log(`  Total Trades:     ${result.totalTrades}`);
  console.log(`  Winning Trades:   ${result.wins} (${formatPercent(result.wins / result.totalTrades)})`);
  console.log(`  Losing Trades:    ${result.losses} (${formatPercent(result.losses / result.totalTrades)})`);
  console.log(`  Win Rate:         ${formatPercent(result.winRate / 100)}`);
  console.log(`  Avg Trade Return: ${formatPercent(result.avgTradeReturn / 100)}`);
  console.log(`  Expectancy:       ${formatCurrency(result.expectancyUsd)} per trade`);
  console.log();

  // Risk metrics
  console.log('RISK METRICS:');
  console.log(`  Max Drawdown:     ${formatPercent(result.maxDrawdownPct / 100)} (${formatCurrency(result.maxDrawdownUsd)})`);
  console.log(`  Sharpe Ratio:     ${result.sharpe.toFixed(2)}`);
  console.log(`  Sortino Ratio:    ${result.sortino.toFixed(2)}`);
  console.log(`  Calmar Ratio:     ${result.calmar.toFixed(2)}`);
  console.log();

  // Advanced metrics
  console.log('ADVANCED METRICS:');
  console.log(`  Total Return:     ${formatPercent(result.advancedMetrics.totalReturn / 100)}`);
  console.log(`  CAGR:             ${formatPercent(result.advancedMetrics.cagr / 100)}`);
  console.log(`  Omega Ratio:      ${result.advancedMetrics.omegaRatio.toFixed(2)}`);
  console.log(`  Ulcer Index:      ${result.advancedMetrics.ulcerIndex.toFixed(2)}`);
  console.log(`  Expectancy:       ${formatCurrency(result.advancedMetrics.expectancy)}`);
  console.log();

  // Monte Carlo
  const mc = monteCarloSimulation(
    result.trades.map(t => ({
      pnl: t.pnlNet,
      pnlR: t.pnlR,
      entryTime: t.entryTime,
      exitTime: t.exitTime,
      direction: t.direction,
      isWin: t.outcome === 'WIN',
    })),
    100,
    initialCapital
  );
  console.log('MONTE CARLO (100 SIMULATIONS):');
  console.log(`  P5:               ${formatCurrency(mc.percentiles.p5)}`);
  console.log(`  P50 (Median):     ${formatCurrency(mc.percentiles.p50)}`);
  console.log(`  P95:              ${formatCurrency(mc.percentiles.p95)}`);
  console.log(`  Ruin Prob:        ${formatPercent(mc.ruinProbability)}`);
  console.log();

  // V4 Features
  console.log('V4 FEATURES:');
  console.log(`  Avg Kelly Used:   ${formatPercent(result.avgKellyUsed)}`);  // PATCH: déjà en décimal
  console.log(`  Avg Regime:       ${result.avgRegime}`);
  console.log(`  Avg VPIN:         ${result.avgVPIN.toFixed(3)}`);
  console.log(`  Regime Dist:      BULL:${result.regimeDistribution.BULL} BEAR:${result.regimeDistribution.BEAR} RANGING:${result.regimeDistribution.RANGING}`);
  console.log();

  // Performance
  console.log(`Backtest completed in ${(elapsed / 1000).toFixed(2)}s`);
  console.log();

  // Recent trades
  if (result.trades.length > 0) {
    console.log('RECENT TRADES (last 5):');
    const recent = result.trades.slice(-5).reverse();
    for (const trade of recent) {
      const pnl$ = trade.pnlNet;
      const pnlPct = trade.pnlR * 100;
      const icon = pnl$ >= 0 ? '✅' : '❌';
      const kellyInfo = trade.kellyFraction > 0 ? ` (Kelly: ${(trade.kellyFraction * 100).toFixed(1)}%)` : '';
      const date = new Date(trade.exitTime).toLocaleDateString();
      console.log(`  ${icon} ${date} ${trade.direction.padEnd(5)} ${formatCurrency(pnl$).padStart(10)} (${pnlPct.toFixed(2)}%)${kellyInfo}`);
    }
  }

  // Summary verdict
  console.log();
  console.log('╔════════════════════════════════════════════════════════════╗');
  if (result.totalPnl > 0 && result.sharpe > 1) {
    console.log(`║  ✅ STRATÉGIE PROFITABLE - Sharpe: ${result.sharpe.toFixed(2)}          ║`);
  } else if (result.totalPnl > 0) {
    console.log(`║  ⚠️  PROFITABLE mais risque élevé - Sharpe: ${result.sharpe.toFixed(2)}        ║`);
  } else {
    console.log(`║  ❌ STRATÉGIE NON RENTABLE sur cette période                ║`);
  }
  console.log(`╚════════════════════════════════════════════════════════════╝`);
}

async function run() {
  try {
    await main();
  } catch (error) {
    console.error('Backtest failed:', error);
    process.exit(1);
  }
}

run();
