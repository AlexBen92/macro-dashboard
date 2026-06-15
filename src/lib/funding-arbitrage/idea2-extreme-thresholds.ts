/**
 * PURE FUNDING ARBITRAGE — IDÉE 2
 *
 * THRESHOLD EXTRÊME : FUNDING < -5 BPS UNIQUEMENT
 *
 * Avec -0.5bps, trop de bruit. Avec -5bps, seuls les overcrowding réels.
 *
 * Objectifs:
 * - Tester paliers -3 / -5 / -8 / -10 bps
 * - Mesurer funding collected (8h) vs max drawdown directionnel
 * - Garder le palier où funding_collected / max_drawdown > 1.5
 * - Trouver le threshold où le funding compense la perte de prix
 */

interface ThresholdResult {
  threshold: number;
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  avgPnl: number;
  sharpe: number;
  maxDrawdown: number;
  totalFundingCollected: number;
  avgFundingPerTrade: number;
  fundingToDDRatio: number; // funding_collected / max_drawdown
  profitFactor: number;
  avgHoldHours: number;
}

interface BacktestData {
  timestamp: number;
  price: number;
  fundingRate: number;
  symbol: string;
}

const HL_ROUND_TRIP = 0.0010;
const POSITION_SIZE_USD = 1000;

/**
 * Fetch prix + funding depuis Binance
 */
async function fetchPriceAndFundingData(
  symbol: string,
  daysBack: number = 90
): Promise<BacktestData[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;
  const binanceSymbol = symbol + 'USDT';

  const allData: BacktestData[] = [];
  let klineStart = startTime;

  // Fetch klines par lots
  while (klineStart < now) {
    const klineUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=1h&startTime=${klineStart}&endTime=${now}&limit=1000`;

    try {
      const klineRes = await fetch(klineUrl);
      if (!klineRes.ok) break;

      const klines = await klineRes.json();
      if (!Array.isArray(klines) || klines.length === 0) break;

      for (const kline of klines) {
        allData.push({
          timestamp: kline[0],
          price: parseFloat(kline[4]),
          fundingRate: 0,
          symbol,
        });
      }

      klineStart = klines[klines.length - 1][0] + 3600000;
      if (klines.length < 1000) break;
    } catch (e) {
      break;
    }
  }

  // Fetch funding rates
  const fundingUrl = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${binanceSymbol}&startTime=${startTime}&endTime=${now}&limit=1000`;

  try {
    const fundingRes = await fetch(fundingUrl);
    if (fundingRes.ok) {
      const fundingRates = await fundingRes.json();
      if (Array.isArray(fundingRates) && fundingRates.length > 0) {
        let fundingIdx = 0;
        let currentFunding = 0;

        for (let i = 0; i < allData.length; i++) {
          const point = allData[i];

          while (fundingIdx < fundingRates.length) {
            const fundingTime = fundingRates[fundingIdx].fundingTime || fundingRates[fundingIdx].time;
            if (fundingTime <= point.timestamp) {
              currentFunding = parseFloat(fundingRates[fundingIdx].fundingRate || '0');
              fundingIdx++;
            } else {
              break;
            }
          }

          allData[i].fundingRate = currentFunding;
        }
      }
    }
  } catch (e) {
    // Ignore
  }

  return allData;
}

/**
 * Trade avec exits funding-based
 */
interface Trade {
  entryTime: number;
  entryPrice: number;
  entryFundingRate: number;
  exitTime: number;
  exitPrice: number;
  pnlPct: number;
  fundingCollected: number;
  holdHours: number;
  exitReason: string;
}

function simulateTrade(
  data: BacktestData[],
  startIndex: number,
  thresholdBps: number,
  maxHoldHours: number = 8
): Trade | null {
  const entry = data[startIndex];
  const entryFundingBps = entry.fundingRate * 10000;

  if (entryFundingBps >= thresholdBps) return null;
  if (startIndex >= data.length - 2) return null;

  const maxIdx = Math.min(startIndex + maxHoldHours + 1, data.length - 1);

  // Simuler heure par heure
  let exitIdx = startIndex + 1;
  let exitReason = 'time_limit';

  for (let idx = startIndex + 1; idx <= maxIdx; idx++) {
    const current = data[idx];
    const fundingBps = current.fundingRate * 10000;
    const priceChangePct = ((current.price - entry.price) / entry.price) * 100;
    const hoursHeld = (current.timestamp - entry.timestamp) / (1000 * 60 * 60);

    // Exit conditions
    if (fundingBps >= 0) {
      exitIdx = idx;
      exitReason = 'funding_normalized';
      break;
    }
    if (fundingBps > 1) {
      exitIdx = idx;
      exitReason = 'funding_reversal';
      break;
    }
    if (hoursHeld >= maxHoldHours) {
      exitIdx = idx;
      exitReason = 'time_limit';
      break;
    }
    if (priceChangePct < -5) {
      exitIdx = idx;
      exitReason = 'stop_loss';
      break;
    }
  }

  const exit = data[exitIdx];
  const priceChangePct = ((exit.price - entry.price) / entry.price) * 100;
  const holdHours = (exit.timestamp - entry.timestamp) / (1000 * 60 * 60);

  // Funding collected (1 payment pour 8h de hold)
  const fundingPayments = Math.floor(holdHours / 8);
  const avgFundingRate = Math.abs(entry.fundingRate);
  const fundingCollected = fundingPayments * avgFundingRate * POSITION_SIZE_USD;

  const feesPct = HL_ROUND_TRIP * 100;
  const fundingPct = (fundingCollected / POSITION_SIZE_USD) * 100;
  const pnlPct = priceChangePct + fundingPct - feesPct;

  return {
    entryTime: entry.timestamp,
    entryPrice: entry.price,
    entryFundingRate: entry.fundingRate,
    exitTime: exit.timestamp,
    exitPrice: exit.price,
    pnlPct,
    fundingCollected,
    holdHours,
    exitReason,
  };
}

/**
 * Run backtest pour un threshold
 */
async function runThresholdBacktest(
  symbol: string,
  thresholdBps: number,
  daysBack: number = 90
): Promise<ThresholdResult> {
  const data = await fetchPriceAndFundingData(symbol, daysBack);

  const trades: Trade[] = [];
  let cooldownUntil = 0;

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const fundingBps = point.fundingRate * 10000;

    if (point.timestamp < cooldownUntil) continue;
    if (fundingBps >= thresholdBps) continue;

    const trade = simulateTrade(data, i, thresholdBps);
    if (trade) {
      trades.push(trade);
      if (trade.pnlPct < 0) {
        cooldownUntil = trade.exitTime + 4 * 60 * 60 * 1000;
      }
    }
  }

  if (trades.length === 0) {
    return {
      threshold: thresholdBps,
      totalTrades: 0,
      winRate: 0,
      totalPnl: 0,
      avgPnl: 0,
      sharpe: 0,
      maxDrawdown: 0,
      totalFundingCollected: 0,
      avgFundingPerTrade: 0,
      fundingToDDRatio: 0,
      profitFactor: 0,
      avgHoldHours: 0,
    };
  }

  const wins = trades.filter(t => t.pnlPct > 0);
  const winRate = (wins.length / trades.length) * 100;

  const pnlValues = trades.map(t => t.pnlPct);
  const avgPnl = pnlValues.reduce((a, b) => a + b, 0) / trades.length;
  const totalPnl = pnlValues.reduce((a, b) => a + b, 0);

  // Sharpe
  const mean = avgPnl;
  const variance = pnlValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / trades.length;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  // Max Drawdown
  let cumulative = 0;
  let peak = 0;
  let maxDD = 0;
  for (const pnl of pnlValues) {
    cumulative += pnl;
    peak = Math.max(peak, cumulative);
    const dd = peak > 0 ? ((peak - cumulative) / peak) * 100 : 0;
    maxDD = Math.max(maxDD, dd);
  }

  // Funding metrics
  const totalFundingCollected = trades.reduce((sum, t) => sum + t.fundingCollected, 0);
  const avgFundingPerTrade = totalFundingCollected / trades.length;

  // Ratio funding / DD
  const fundingToDDRatio = maxDD > 0 ? (totalFundingCollected / POSITION_SIZE_USD * 100) / maxDD : 0;

  // Profit Factor
  const grossProfit = wins.reduce((sum, t) => sum + t.pnlPct, 0);
  const losses = trades.filter(t => t.pnlPct < 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  const avgHoldHours = trades.reduce((sum, t) => sum + t.holdHours, 0) / trades.length;

  return {
    threshold: thresholdBps,
    totalTrades: trades.length,
    winRate,
    avgPnl,
    totalPnl,
    sharpe,
    maxDrawdown: maxDD,
    totalFundingCollected,
    avgFundingPerTrade,
    fundingToDDRatio,
    profitFactor,
    avgHoldHours,
  };
}

/**
 * Teste tous les thresholds pour tous les symboles
 */
async function testAllThresholds(
  symbols: string[],
  daysBack: number = 90
): Promise<Map<string, ThresholdResult[]>> {
  const THRESHOLDS = [-1, -2, -3, -5, -8, -10];
  const allResults = new Map<string, ThresholdResult[]>();

  for (const symbol of symbols) {
    console.log(`\n[*] Testing ${symbol}...`);
    const results: ThresholdResult[] = [];

    for (const threshold of THRESHOLDS) {
      const result = await runThresholdBacktest(symbol, threshold, daysBack);
      results.push(result);

      const fundingPct = (result.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      const ratioStr = result.fundingToDDRatio.toFixed(2);
      console.log(`  ${threshold} bps: ${result.totalTrades}T, PNL ${result.totalPnl.toFixed(1)}%, Fund ${fundingPct}%, DD ${result.maxDrawdown.toFixed(1)}%, Ratio ${ratioStr}`);
    }

    allResults.set(symbol, results);
  }

  return allResults;
}

/**
 * Trouve le threshold optimal pour chaque symbole
 */
function findOptimalThreshold(results: ThresholdResult[]): ThresholdResult | null {
  const valid = results.filter(r =>
    r.totalTrades >= 5 &&
    r.fundingToDDRatio >= 1.5 &&
    r.profitFactor >= 1.5
  );

  if (valid.length === 0) {
    // Fallback: meilleur Sharpe
    const bySharpe = results.filter(r => r.totalTrades >= 5).sort((a, b) => b.sharpe - a.sharpe);
    return bySharpe[0] || null;
  }

  // Optimal: meilleur ratio funding/DD avec PNL positif
  return valid.sort((a, b) => b.fundingToDDRatio - a.fundingToDDRatio)[0];
}

/**
 * Formate message Telegram
 */
function formatTelegramMessage(allResults: Map<string, ThresholdResult[]>): string {
  let message = '📊 <b>PURE FUNDING ARBITRAGE — IDÉE 2</b>\n';
  message += '⚡ <b>THRESHOLDS EXTRÊMES</b>\n\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  message += '<i>Objectif: Trouver où funding_collected / max_drawdown > 1.5</i>\n';
  message += '<i>Test: -1 / -2 / -3 / -5 / -8 / -10 bps</i>\n\n';

  const THRESHOLDS = [-1, -2, -3, -5, -8, -10];

  // Pour chaque symbole
  for (const [symbol, results] of allResults) {
    message += `<b>${symbol}</b>\n`;

    for (const result of results) {
      if (result.totalTrades === 0) {
        message += `  ${result.threshold} bps: 0T\n`;
        continue;
      }

      const pnlStr = result.totalPnl >= 0 ? '+' : '';
      const fundingPct = (result.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      const ratioStr = result.fundingToDDRatio.toFixed(2);
      const emoji = result.fundingToDDRatio >= 1.5 ? '🟢' : result.fundingToDDRatio >= 1.0 ? '🟡' : '🔴';

      message += `  ${emoji} ${result.threshold} bps: `;
      message += `${result.totalTrades}T | `;
      message += `PNL ${pnlStr}${result.totalPnl.toFixed(1)}% | `;
      message += `Fund ${fundingPct}% | `;
      message += `Ratio ${ratioStr}\n`;
    }

    // Threshold optimal
    const optimal = findOptimalThreshold(results);
    if (optimal) {
      const fundingPct = (optimal.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      message += `  → <b>Optimal: ${optimal.threshold} bps</b> (Ratio ${optimal.fundingToDDRatio.toFixed(2)})\n\n`;
    } else {
      message += `  → No valid threshold\n\n`;
    }
  }

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Analyse globale
  const globalOptimal: { symbol: string; threshold: number; ratio: number; pnl: number }[] = [];

  for (const [symbol, results] of allResults) {
    const optimal = findOptimalThreshold(results);
    if (optimal && optimal.fundingToDDRatio >= 1.0) {
      globalOptimal.push({
        symbol,
        threshold: optimal.threshold,
        ratio: optimal.fundingToDDRatio,
        pnl: optimal.totalPnl,
      });
    }
  }

  // Trier par ratio
  globalOptimal.sort((a, b) => b.ratio - a.ratio);

  message += `<b>TOP RATIOS (funding/DD >= 1.0):</b>\n`;
  for (const item of globalOptimal.slice(0, 5)) {
    message += `• ${item.symbol} < ${item.threshold} bps: Ratio ${item.ratio.toFixed(2)}, PNL ${item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(1)}%\n`;
  }

  // Recommandation
  if (globalOptimal.length > 0) {
    const avgThreshold = globalOptimal.reduce((sum, item) => sum + item.threshold, 0) / globalOptimal.length;
    const above1_5 = globalOptimal.filter(item => item.ratio >= 1.5).length;

    message += `\n<b>RECOMMANDATION:</b>\n`;
    message += `Threshold moyen optimal: ${avgThreshold.toFixed(1)} bps\n`;
    message += `${above1_5}/${globalOptimal.length} symboles avec ratio >= 1.5\n`;

    if (above1_5 >= globalOptimal.length * 0.6) {
      message += '\n✅ <b>FUNDING ARB OPTIMISÉ</b> — Threshold extrême validé';
    } else {
      message += '\n⚠️ <b>RATIO FAIBLE</b> — Garder threshold modéré (-1 bps)';
    }
  }

  message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return message;
}

/**
 * Main
 */
async function main() {
  console.log('========================================');
  console.log('PURE FUNDING ARBITRAGE — IDÉE 2');
  console.log('THRESHOLDS EXTRÊMES');
  console.log('========================================');

  const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
  const DAYS_BACK = 90;

  const allResults = await testAllThresholds(SYMBOLS, DAYS_BACK);

  console.log('\n========================================');
  console.log('[SUMMARY - OPTIMAL THRESHOLDS]');

  for (const [symbol, results] of allResults) {
    const optimal = findOptimalThreshold(results);
    if (optimal) {
      const fundingPct = (optimal.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      console.log(`${symbol}: ${optimal.threshold} bps (Ratio ${optimal.fundingToDDRatio.toFixed(2)}, Fund ${fundingPct}%, ${optimal.totalTrades}T)`);
    } else {
      console.log(`${symbol}: No valid threshold`);
    }
  }

  console.log('========================================');

  // Sauvegarder
  const resultsObj: Record<string, any> = {};
  for (const [symbol, results] of allResults) {
    resultsObj[symbol] = results;
  }

  const fs = await import('fs');
  const summaryPath = '/root/projects/macro-dashboard/funding-arb-idea2-results.json';
  fs.writeFileSync(summaryPath, JSON.stringify(resultsObj, null, 2));
  console.log(`\n[OK] Results saved to ${summaryPath}`);

  const message = formatTelegramMessage(allResults);
  console.log('\n[TELEGRAM MESSAGE]');
  console.log(message);

  return { allResults, message };
}

if (require.main === module) {
  main().catch(console.error);
}

export { main, runThresholdBacktest };
