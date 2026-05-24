/**
 * SCRIPT DE BACKTEST V4
 *
 * Usage: npx tsx run-backtest.ts [symbol]
 * Example: npx tsx run-backtest.ts BTCUSDT
 */

import { runBacktestV4, type BtCandle } from './src/lib/backtest-v4';
import { monteCarloSimulation } from './src/lib/quant/advanced-metrics';

// ═══════════════════════════════════════════════════════════════════════════════
// DATA GENERATION (SIMULÉE - en production utiliser Binance API)
// ═══════════════════════════════════════════════════════════════════════════════

interface GeneratedData {
  timestamps: number[];
  opens: number[];
  highs: number[];
  lows: number[];
  closes: number[];
  volumes: number[];
  oi?: number[];
  fundingRates?: number[];
}

/**
 * Génère des données OHLCV réalistes pour le backtest
 * Simule un marché crypto avec tendance, volatilité et bruit
 */
function generateBacktestData(
  nPoints: number = 2000,
  startPrice: number = 45000,
  dailyVolatility: number = 0.025,
  drift: number = 0.0001
): GeneratedData {
  const timestamps: number[] = [];
  const opens: number[] = [];
  const highs: number[] = [];
  const lows: number[] = [];
  const closes: number[] = [];
  const volumes: number[] = [];
  const oi: number[] = [];
  const fundingRates: number[] = [];

  const now = Date.now();
  const barSize = 60 * 60 * 1000; // 1h bars
  let price = startPrice;
  let trend = 0;

  // Volume base
  const baseVolume = 1_000_000;

  for (let i = 0; i < nPoints; i++) {
    const timestamp = now - (nPoints - i) * barSize;
    timestamps.push(timestamp);

    // Trend component (slow cycles)
    trend = Math.sin(i / 100) * 0.002 + drift;

    // Price movement
    const open = price;
    const change = trend + (Math.random() - 0.5) * dailyVolatility;
    const close = open * (1 + change);

    // High/Low
    const highLowRange = Math.abs(change) * open * (0.5 + Math.random() * 0.5);
    const high = Math.max(open, close) + Math.random() * highLowRange;
    const low = Math.min(open, close) - Math.random() * highLowRange;

    opens.push(open);
    closes.push(close);
    highs.push(high);
    lows.push(low);

    // Volume with some randomness
    const volume = baseVolume * (0.5 + Math.random() * 1.5);
    volumes.push(volume);

    // OI (correlated with price trend)
    const oiValue = 20_000_000_000 + (price - startPrice) * 500_000 + (Math.random() - 0.5) * 2_000_000_000;
    oi.push(Math.max(10_000_000_000, oiValue));

    // Funding rate (mean reverting around 0.01%)
    const fundingRate = 0.0001 + (close / startPrice - 1) * 0.0005 + (Math.random() - 0.5) * 0.0002;
    fundingRates.push(Math.max(-0.0005, Math.min(0.0005, fundingRate)));

    price = close;
  }

  return { timestamps, opens, highs, lows, closes, volumes, oi, funding: fundingRates };
}

/**
 * Convertit les données générées en format BtCandle
 */
function toBtCandles(data: GeneratedData): BtCandle[] {
  return data.timestamps.map((t, i) => ({
    t,
    o: data.opens[i],
    h: data.highs[i],
    l: data.lows[i],
    c: data.closes[i],
    v: data.volumes[i],
    oi: data.oi?.[i],
    funding: data.fundingRates?.[i],
  }));
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

async function runBacktest() {
  const symbol = process.argv[2] || 'BTCUSDT';

  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST ENGINE V4 - ${symbol.padEnd(26)}║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log();

  // Generate test data (2000 hourly bars = ~83 days)
  console.log('Generating test data (2000 hourly bars)...');
  const rawData = generateBacktestData(2000, 45000, 0.025, 0.0001);
  const candles = toBtCandles(rawData);

  console.log(`  Data points: ${candles.length}`);
  console.log(`  Date range: ${new Date(candles[0].t).toLocaleDateString()} → ${new Date(candles[candles.length - 1].t).toLocaleDateString()}`);
  console.log(`  Price range: $${Math.min(...candles.map(c => c.c)).toFixed(0)} - $${Math.max(...candles.map(c => c.c)).toFixed(0)}`);
  console.log();

  // Run backtest with all V4 features enabled
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
  console.log(`  Win Rate:         ${formatPercent(result.winRate)}`);
  console.log(`  Avg Trade Return: ${formatPercent(result.avgTradeReturn)}`);
  console.log(`  Expectancy:       ${formatCurrency(result.expectancyUsd)} per trade`);
  console.log();

  // Risk metrics
  console.log('RISK METRICS:');
  console.log(`  Max Drawdown:     ${formatPercent(result.maxDrawdownPct)} (${formatCurrency(result.maxDrawdownUsd)})`);
  console.log(`  Sharpe Ratio:     ${result.sharpe.toFixed(2)}`);
  console.log(`  Sortino Ratio:    ${result.sortino.toFixed(2)}`);
  console.log(`  Calmar Ratio:     ${result.calmar.toFixed(2)}`);
  console.log();

  // Advanced metrics
  console.log('ADVANCED METRICS:');
  console.log(`  Total Return:     ${formatPercent(result.advancedMetrics.totalReturn)}`);
  console.log(`  CAGR:             ${formatPercent(result.advancedMetrics.cagr)}`);
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
  console.log(`  Avg Kelly Used:   ${formatPercent(result.avgKellyUsed)}`);
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
      console.log(`  ${icon} ${trade.direction.padEnd(5)} ${formatCurrency(pnl$).padStart(10)} (${pnlPct.toFixed(2)}%)${kellyInfo}`);
    }
  }
}

async function run() {
  await runBacktest();
}

run().catch(console.error);
