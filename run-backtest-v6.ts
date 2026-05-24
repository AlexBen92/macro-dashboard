/**
 * BACKTEST V6 - MEAN-REVERSION STRATEGY
 */

import { runBacktestV6, type BacktestV6Result } from './src/lib/backtest-v6';
import { promises as fs } from 'fs';
import { join } from 'path';

const DATA_DIR = './data';
const RESULTS_DIR = './results-v6';
const REPORT_FILE = './BACKTEST_V6_MEANREVERSION_REPORT.md';

const TEST_COINS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'TRXUSDT', 'DOTUSDT',
  'LTCUSDT', 'LINKUSDT', 'ATOMUSDT', 'UNIUSDT', 'ETCUSDT',
  'XLMUSDT', 'ALGOUSDT', 'VETUSDT', 'FILUSDT', 'ICPUSDT',
];

interface BtCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

async function loadCandles(symbol: string): Promise<BtCandle[]> {
  const filePath = join(DATA_DIR, `${symbol}_H1.json`);

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const klines: any[][] = JSON.parse(content);

    return klines.map((k) => ({
      t: Number(k[0]),
      o: Number(k[1]),
      h: Number(k[2]),
      l: Number(k[3]),
      c: Number(k[4]),
      v: Number(k[5]),
    }));
  } catch (e) {
    console.error(`Failed to load ${symbol}:`, e);
    return [];
  }
}

function generateReport(
  results: Record<string, BacktestV6Result>,
  startTime: number
): string {
  const endTime = Date.now();
  const elapsed = ((endTime - startTime) / 1000).toFixed(1);

  const resultsArray = Object.values(results).filter(r => r.totalTrades > 0);
  const sortedByPnL = [...resultsArray].sort((a, b) => b.totalPnl - a.totalPnl);
  const sortedBySharpe = [...resultsArray].sort((a, b) => b.sharpe - a.sharpe);

  const profitableCoins = resultsArray.filter(r => r.totalPnl > 0);
  const totalPnL = resultsArray.reduce((sum, r) => sum + r.totalPnl, 0);
  const totalTrades = resultsArray.reduce((sum, r) => sum + r.totalTrades, 0);
  const avgSharpe = resultsArray.reduce((sum, r) => sum + r.sharpe, 0) / resultsArray.length;
  const avgWR = resultsArray.reduce((sum, r) => sum + r.winRate, 0) / resultsArray.length;
  const avgProfitFactor = resultsArray.reduce((sum, r) => sum + r.profitFactor, 0) / resultsArray.length;

  const best = sortedByPnL[0];
  const worst = sortedByPnL[sortedByPnL.length - 1];

  // Portfolio metrics
  const top5 = sortedBySharpe.slice(0, 5);
  const portfolioPnL = top5.reduce((sum, r) => sum + r.totalPnl, 0);
  const portfolioWR = top5.reduce((sum, r) => sum + r.winRate, 0) / top5.length;
  const portfolioSharpe = top5.reduce((sum, r) => sum + r.sharpe, 0) / top5.length;

  // Build report
  let report = '';

  report += `
# 🚀 BACKTEST V6 - MEAN-REVERSION STRATEGY (H1 CRYPTO)
===========================================================

**Date:** ${new Date().toISOString().split('T')[0]}
**Elapsed:** ${elapsed}s
**Version:** 6.0.0 (Mean-Reversion optimized)

## 📊 CONFIGURATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Mean-Reversion Parameters:**
• Bollinger Bands: Period 20, StdDev 2.0
• RSI: Period 14
• RSI Oversold/Overbought: 30 / 70

**Entry Signals:**
• LONG: Price < Lower BB OR RSI < 30
• SHORT: Price > Upper BB OR RSI > 70
• Trend Filter: Skip if price > 2% from EMA50

**Risk Management:**
• Stop Loss: 2.5x ATR (relaxed)
• Take Profit: 1.5x ATR (R:R 1:1.5)
• Max Hold: 50 bars
• NO Trailing Stop

**Volatility Filter:**
• Min ATR: 0.2%
• Max ATR: 5.0%

## 🏆 AGGREGATE RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Metric | Value |
|--------|-------|
| **Coins Tested** | ${resultsArray.length} |
| **Profitable Coins** | ${profitableCoins.length} (${((profitableCoins.length / resultsArray.length) * 100).toFixed(1)}%) |
| **Total P&L** | $${totalPnL.toFixed(2)} |
| **Total Trades** | ${totalTrades} |
| **Avg Sharpe** | ${avgSharpe.toFixed(2)} |
| **Avg Win Rate** | ${avgWR.toFixed(1)}% |
| **Avg Profit Factor** | ${avgProfitFactor.toFixed(2)} |

**Best Coin:** ${best?.coin || 'N/A'} (+$${best?.totalPnl.toFixed(0) || 'N/A'})
**Worst Coin:** ${worst?.coin || 'N/A'} ($${worst?.totalPnl.toFixed(0) || 'N/A'})

## 📈 RECOMMENDED PORTFOLIO (Top 5 by Sharpe)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Symbols:** ${top5.map(r => r.coin).join(', ')}

**Portfolio Metrics:**
• Equal Weight P&L: $${portfolioPnL.toFixed(2)}
• Avg Sharpe: ${portfolioSharpe.toFixed(2)}
• Avg Win Rate: ${portfolioWR.toFixed(1)}%

## 🥇 TOP 10 PERFORMERS (by P&L)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Rank | Coin | P&L | P&L% | Sharpe | WR | PF | Trades |
|------|------|-----|------|--------|----|----|----|
`;

  for (let i = 0; i < Math.min(10, sortedByPnL.length); i++) {
    const r = sortedByPnL[i];
    report += `| ${i + 1} | **${r.coin}** | ${r.totalPnl > 0 ? '+' : ''}$${r.totalPnl.toFixed(0)} | ${r.totalPnlPct.toFixed(1)}% | ${r.sharpe.toFixed(2)} | ${r.winRate.toFixed(1)}% | ${r.profitFactor.toFixed(2)} | ${r.totalTrades} |\n`;
  }

  report += `
## 💀 BOTTOM 5 PERFORMERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Rank | Coin | P&L | P&L% | Sharpe | WR |
|------|------|-----|------|--------|----|----|
`;

  const bottom5 = sortedByPnL.slice(-5).reverse();
  for (let i = 0; i < bottom5.length; i++) {
    const r = bottom5[i];
    report += `| ${resultsArray.length - i} | ${r.coin} | $${r.totalPnl.toFixed(0)} | ${r.totalPnlPct.toFixed(1)}% | ${r.sharpe.toFixed(2)} | ${r.winRate.toFixed(1)}% |\n`;
  }

  report += `
## 📊 TOP 5 DETAILED ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  for (const r of sortedByPnL.slice(0, 5)) {
    report += `
### ${r.coin}
**P&L:** $${r.totalPnl.toFixed(2)} (${r.totalPnlPct.toFixed(2)}%)
**Sharpe:** ${r.sharpe.toFixed(2)} | **Win Rate:** ${r.winRate.toFixed(1)}% | **Profit Factor:** ${r.profitFactor.toFixed(2)}
**Max DD:** ${r.maxDrawdownPct.toFixed(2)}% | **Avg Hold:** ${r.avgHoldBars.toFixed(1)} bars
**Trades:** ${r.totalTrades} (Wins: ${r.wins}, Losses: ${r.losses})

**Signal Analysis:**
• BB Signals Triggered: ${r.bbSignalsTriggered}
• RSI Signals Triggered: ${r.rsiSignalsTriggered}
• Both Signals: ${r.bothSignalsTriggered}

**Performance:**
• Avg Win: $${r.avgWin.toFixed(2)}
• Avg Loss: $${r.avgLoss.toFixed(2)}
• Win/Loss Ratio: ${r.winLossRatio.toFixed(2)}
`;
  }

  // V5 vs V6 comparison
  report += `
## 🎯 V5 vs V6 COMPARISON
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

| Metric | V5 (Trend) | V6 (Mean-Rev) | Improvement |
|--------|------------|---------------|-------------|
| Avg Win Rate | 27.2% | ${avgWR.toFixed(1)}% | ${(avgWR - 27.2).toFixed(1)}% pts |
| Avg Sharpe | -6.94 | ${avgSharpe.toFixed(2)} | ${(avgSharpe + 6.94).toFixed(2)} |
| Profitable % | 0% | ${((profitableCoins.length / resultsArray.length) * 100).toFixed(1)}% | ${((profitableCoins.length / resultsArray.length) * 100).toFixed(1)}% pts |
| Total P&L | -$276,404 | $${totalPnL > 0 ? '+' : ''}${totalPnL.toFixed(0)} | $${(totalPnL + 276404).toFixed(0)}
`;

  // Exit reasons analysis
  const allTrades = resultsArray.flatMap(r => r.trades);
  const tpHits = allTrades.filter(t => t.exitReason === 'TP').length;
  const stopHits = allTrades.filter(t => t.exitReason === 'STOP').length;
  const reversals = allTrades.filter(t => t.exitReason === 'SIGNAL_REVERSAL').length;
  const maxHold = allTrades.filter(t => t.exitReason === 'MAX_HOLD').length;

  report += `
## 🔍 EXIT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• TP hits: ${tpHits} (${(tpHits/allTrades.length*100).toFixed(1)}%)
• Stop hits: ${stopHits} (${(stopHits/allTrades.length*100).toFixed(1)}%)
• Reversals: ${reversals} (${(reversals/allTrades.length*100).toFixed(1)}%)
• Max hold: ${maxHold} (${(maxHold/allTrades.length*100).toFixed(1)}%)
`;

  // Recommendation
  report += `
## 📋 RECOMMENDATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

  if (profitableCoins.length >= resultsArray.length * 0.5 && avgSharpe > 0) {
    report += `
### ✅ IMPROVEMENT CONFIRMED

The mean-reversion approach shows significant improvement over trend-following.

**Next Steps:**
• Test on 4H timeframe for better signals
• Optimize BB/RSI thresholds per coin
• Add volatility-based position sizing
`;
  } else if (profitableCoins.length > 0) {
    report += `
### ⚠️  PARTIAL IMPROVEMENT

Some coins show promise, but overall results are mixed.

**Next Steps:**
• Focus on profitable coins only
• Investigate why some coins respond better
• Try longer timeframes (4H, Daily)
`;
  } else {
    report += `
### ❌ STRATEGY STILL FAILING

Mean-reversion alone is not sufficient.

**Next Steps:**
• Consider regime-switching (trend in trends, mean-rev in ranges)
• Test on 4H or Daily timeframe
• Add confirmation filters
`;
  }

  report += `

## ═══════════════════════════════════════════════════════════════════════════════
**Generated by Backtest V6 Engine**
**Mean-Reversion Strategy**
${new Date().toISOString()}
═════════════════════════════════════════════════════════════════════════════════
`;

  return report;
}

async function main() {
  const startTime = Date.now();

  console.log('🚀 BACKTEST V6 - MEAN-REVERSION STRATEGY');
  console.log('='.repeat(60));
  console.log(`Started: ${new Date().toISOString()}`);
  console.log(`Coins to test: ${TEST_COINS.length}`);
  console.log('');

  await fs.mkdir(RESULTS_DIR, { recursive: true });

  console.log('📂 Loading data...');
  const allCandles: Record<string, BtCandle[]> = {};

  for (const symbol of TEST_COINS) {
    const candles = await loadCandles(symbol);
    if (candles.length > 0) {
      allCandles[symbol] = candles;
      console.log(`  ✅ ${symbol}: ${candles.length} candles`);
    } else {
      console.log(`  ❌ ${symbol}: No data`);
    }
  }

  console.log(`\n📊 Loaded ${Object.keys(allCandles).length} symbols\n`);

  console.log('⚙️  Running backtests (V6 Mean-Reversion)...');
  const results: Record<string, BacktestV6Result> = {};

  let completed = 0;
  for (const [symbol, candles] of Object.entries(allCandles)) {
    try {
      const result = runBacktestV6(candles, symbol, {
        bbPeriod: 20,
        bbStdDev: 2.0,
        rsiPeriod: 14,
        rsiOversold: 30,
        rsiOverbought: 70,
        atrStopMult: 2.5,
        atrTPMult: 1.5,
        maxHoldBars: 50,
        minVolatility: 0.2,
        maxVolatility: 5.0,
        feeRate: 0.0004,
        initialCapital: 10_000,
        maxRiskPerTrade: 0.01,
      });

      results[symbol] = result;
      completed++;

      const status = result.totalPnl > 0 ? '✅' : '❌';
      console.log(`  ${status} ${symbol}: $${result.totalPnl.toFixed(0)} (${result.winRate.toFixed(1)}% WR, Sharpe: ${result.sharpe.toFixed(2)})`);

    } catch (e) {
      console.error(`  ❌ ${symbol}: Error - ${e}`);
    }
  }

  console.log(`\n✅ Completed ${completed}/${Object.keys(allCandles).length} backtests\n`);

  console.log('💾 Saving individual results...');
  for (const [symbol, result] of Object.entries(results)) {
    await fs.writeFile(
      join(RESULTS_DIR, `${symbol}_v6.json`),
      JSON.stringify(result, null, 2)
    );
  }

  const resultsArray = Object.values(results);
  const profitableCoins = resultsArray.filter(r => r.totalPnl > 0);
  const totalPnL = resultsArray.reduce((sum, r) => sum + r.totalPnl, 0);
  const avgSharpe = resultsArray.reduce((sum, r) => sum + r.sharpe, 0) / resultsArray.length;
  const avgWR = resultsArray.reduce((sum, r) => sum + r.winRate, 0) / resultsArray.length;

  console.log('\n📊 AGGREGATE RESULTS:');
  console.log(`  Profitable: ${profitableCoins.length}/${resultsArray.length} (${((profitableCoins.length / resultsArray.length) * 100).toFixed(1)}%)`);
  console.log(`  Total P&L: $${totalPnL.toFixed(2)}`);
  console.log(`  Avg Sharpe: ${avgSharpe.toFixed(2)}`);
  console.log(`  Avg WR: ${avgWR.toFixed(1)}%`);

  console.log('\n📝 Generating report...');
  const report = generateReport(results, startTime);

  await fs.writeFile(REPORT_FILE, report);
  console.log(`✅ Report saved: ${REPORT_FILE}`);

  console.log('\n🎉 DONE!');
}

main().catch(console.error);
