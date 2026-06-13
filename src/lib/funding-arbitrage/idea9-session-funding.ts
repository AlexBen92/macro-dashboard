/**
 * PURE FUNDING ARBITRAGE — IDÉE 9
 *
 * SESSION FUNDING : CONCENTRER SUR LES PRINTS 00h/08h/16h UTC
 *
 * Le funding se print exactement à 00h00, 08h00, 16h00 UTC sur Binance.
 * N'entrer QUE dans les 30 minutes AVANT un print de funding.
 *
 * Logic:
 * - Si funding < -X bps à T-30min → le prochain print te paiera
 * - Entre à T-30min, exit à T+5min (après le print)
 * - Cela garantit qu'on capture le paiement de funding
 *
 * Objectif: Mesurer funding_received - slippage - fees par trade
 */

interface PriceFundingPoint {
  timestamp: number;
  price: number;
  fundingRate: number;
  symbol: string;
  hour: number; // UTC hour (0-23)
  isFundingTime: boolean; // True si timestamp ≈ 00h00, 08h00, 16h00 UTC
}

interface SessionTrade {
  symbol: string;
  entryTime: number;
  entryPrice: number;
  entryFundingRate: number;
  exitTime: number;
  exitPrice: number;
  exitFundingRate: number;
  pnlPct: number;
  fundingCollected: number;
  holdDurationHours: number;
  session: string; // "00h", "08h", "16h"
  entryReason: string;
  exitReason: string;
}

interface SessionResult {
  symbol: string;
  threshold: number;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  totalFundingCollected: number;
  sharpe: number;
  maxDrawdown: number;
  avgHoldHours: number;
  sessions: { '00h': number; '08h': number; '16h': number };
}

const HL_ROUND_TRIP = 0.0010;
const POSITION_SIZE_USD = 1000;
const FUNDING_HOURS_UTC = [0, 8, 16]; // Heures des prints de funding
const ENTRY_WINDOW_MINUTES = 30; // Entrer 30min avant le print
const EXIT_AFTER_MINUTES = 5; // Exit 5min après le print

/**
 * Fetch prix + funding depuis Binance
 */
async function fetchPriceAndFundingData(
  symbol: string,
  daysBack: number = 90
): Promise<PriceFundingPoint[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;
  const binanceSymbol = symbol + 'USDT';

  const allData: PriceFundingPoint[] = [];
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
        const timestamp = kline[0];
        const date = new Date(timestamp);
        const hour = date.getUTCHours();

        allData.push({
          timestamp,
          price: parseFloat(kline[4]),
          fundingRate: 0, // Sera rempli après
          symbol,
          hour,
          isFundingTime: FUNDING_HOURS_UTC.includes(hour) && date.getUTCMinutes() === 0,
        });
      }

      klineStart = klines[klines.length - 1][0] + 3600000;
      if (klines.length < 1000) break;
    } catch (e) {
      console.error(`Error fetching klines: ${e}`);
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
        // Forward fill: pour chaque point, trouver le funding rate le plus récent
        let fundingIdx = 0;
        let currentFunding = 0;

        for (let i = 0; i < allData.length; i++) {
          const point = allData[i];

          // Avancer dans les funding rates tant que le timestamp est <= au point actuel
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
    console.error(`Error fetching funding: ${e}`);
  }

  return allData;
}

/**
 * Simule un trade session-based
 */
function simulateSessionTrade(
  data: PriceFundingPoint[],
  startIndex: number,
  thresholdBps: number
): SessionTrade | null {
  const entry = data[startIndex];
  const entryFundingBps = entry.fundingRate * 10000;

  // Vérifier le signal d'entrée d'abord
  if (entryFundingBps >= thresholdBps) return null;

  // Vérifier si l'heure actuelle est une heure de pré-funding (23h pour 00h, 07h pour 08h, 15h pour 16h)
  const preFundingHours = [23, 7, 15]; // Heures avant chaque funding time
  if (!preFundingHours.includes(entry.hour)) {
    return null; // Pas dans une heure de pré-funding
  }

  // Déterminer la session de funding
  let session = '';
  if (entry.hour === 23) session = '00h';
  else if (entry.hour === 7) session = '08h';
  else session = '16h';

  const trade: SessionTrade = {
    symbol: entry.symbol,
    entryTime: entry.timestamp,
    entryPrice: entry.price,
    entryFundingRate: entry.fundingRate,
    exitTime: null as any,
    exitPrice: null as any,
    exitFundingRate: null as any,
    pnlPct: 0,
    fundingCollected: 0,
    holdDurationHours: 0,
    session,
    entryReason: 'prefunding_signal',
    exitReason: '',
  };

  // Sortir après 2 heures (après le funding time)
  const exitIdx = Math.min(startIndex + 2, data.length - 1);
  if (exitIdx <= startIndex) return null;

  const exit = data[exitIdx];
  trade.exitTime = exit.timestamp;
  trade.exitPrice = exit.price;
  trade.exitFundingRate = exit.fundingRate;
  trade.holdDurationHours = (exit.timestamp - entry.timestamp) / (1000 * 60 * 60);
  trade.exitReason = 'after_funding_session';

  // Calculer PNL
  const priceChangePct = ((exit.price - entry.price) / entry.price) * 100;

  // Estimer funding collecté (on a tenu pendant le funding print)
  // Si on entre à 23h et sort à 01h (après 2h), on a capturé le funding de 00h
  const avgFundingRate = Math.abs(entry.fundingRate);
  trade.fundingCollected = avgFundingRate * POSITION_SIZE_USD;

  // PNL = price change + funding - fees
  const feesPct = HL_ROUND_TRIP * 100;
  const fundingPct = (trade.fundingCollected / POSITION_SIZE_USD) * 100;
  trade.pnlPct = priceChangePct + fundingPct - feesPct;

  return trade;
}

/**
 * Run backtest session-based
 */
async function runSessionBacktest(
  symbol: string,
  thresholdBps: number,
  daysBack: number = 90
): Promise<SessionResult> {
  console.log(`\n[*] ${symbol} (${daysBack} days, threshold < ${thresholdBps} bps)...`);
  const data = await fetchPriceAndFundingData(symbol, daysBack);
  console.log(`    Got ${data.length} data points`);

  const trades: SessionTrade[] = [];

  for (let i = 0; i < data.length; i++) {
    const trade = simulateSessionTrade(data, i, thresholdBps);
    if (trade) {
      trades.push(trade);
    }
  }

  console.log(`    Generated ${trades.length} trades`);

  if (trades.length === 0) {
    return {
      symbol,
      threshold: thresholdBps,
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      totalFundingCollected: 0,
      sharpe: 0,
      maxDrawdown: 0,
      avgHoldHours: 0,
      sessions: { '00h': 0, '08h': 0, '16h': 0 },
    };
  }

  // Calculer les métriques
  const wins = trades.filter(t => t.pnlPct > 0);
  const winRate = (wins.length / trades.length) * 100;

  const pnlValues = trades.map(t => t.pnlPct);
  const avgPnl = pnlValues.reduce((a, b) => a + b, 0) / trades.length;
  const totalPnl = pnlValues.reduce((a, b) => a + b, 0);

  // Total funding collected
  const totalFundingCollected = trades.reduce((sum, t) => sum + t.fundingCollected, 0);

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

  // Avg hold time
  const avgHoldHours = trades.reduce((sum, t) => sum + t.holdDurationHours, 0) / trades.length;

  // Sessions breakdown
  const sessions = trades.reduce((acc, t) => {
    acc[t.session as keyof typeof acc] = (acc[t.session as keyof typeof acc] || 0) + 1;
    return acc;
  }, { '00h': 0, '08h': 0, '16h': 0 });

  console.log(`    Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`    Total PNL: ${totalPnl.toFixed(2)}% (Funding: ${(totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2)}%)`);
  console.log(`    Sharpe: ${sharpe.toFixed(2)}`);
  console.log(`    Sessions: 00h=${sessions['00h']}, 08h=${sessions['08h']}, 16h=${sessions['16h']}`);

  return {
    symbol,
    threshold: thresholdBps,
    totalTrades: trades.length,
    winRate,
    avgPnl,
    totalPnl,
    totalFundingCollected,
    sharpe,
    maxDrawdown: maxDD,
    avgHoldHours,
    sessions,
  };
}

/**
 * Teste tous les seuils pour tous les symboles
 */
async function testAllThresholds(
  symbols: string[],
  daysBack: number = 90
): Promise<Map<string, Map<number, SessionResult>>> {
  const thresholds = [-0.25, -0.5, -1, -2, -3];
  const allResults = new Map<string, Map<number, SessionResult>>();

  for (const symbol of symbols) {
    console.log(`\n========================================`);
    console.log(`SYMBOL: ${symbol}`);
    console.log(`========================================`);

    const results = new Map<number, SessionResult>();

    for (const threshold of thresholds) {
      const result = await runSessionBacktest(symbol, threshold, daysBack);
      results.set(threshold, result);
    }

    allResults.set(symbol, results);
  }

  return allResults;
}

/**
 * Formate message Telegram
 */
function formatTelegramMessage(allResults: Map<string, Map<number, SessionResult>>): string {
  let message = '📊 <b>PURE FUNDING ARBITRAGE — IDÉE 9</b>\n';
  message += '⏰ <b>SESSION FUNDING (00h/08h/16h UTC)</b>\n\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  message += '<i>Entry: 30min avant funding print</i>\n';
  message += '<i>Exit: 5min après funding print</i>\n';
  message += '<i>Signal: funding < threshold bps</i>\n\n';

  // Pour chaque symbole
  for (const [symbol, results] of allResults) {
    message += `<b>${symbol}</b>\n`;

    for (const [threshold, result] of results) {
      if (result.totalTrades === 0) {
        message += `  < ${threshold} bps: 0 trades\n`;
        continue;
      }

      const pnlStr = result.totalPnl >= 0 ? '+' : '';
      const fundingPct = (result.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      const emoji = result.totalPnl >= 0 ? '🟢' : '🔴';

      message += `  < ${threshold} bps: ${emoji} ${pnlStr}${result.totalPnl.toFixed(1)}% `;
      message += `| Fund ${fundingPct}% `;
      message += `| WR ${result.winRate.toFixed(0)}% `;
      message += `(${result.totalTrades}T)\n`;
    }

    const best = Array.from(results.values())
      .filter(r => r.totalTrades > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)[0];

    if (best) {
      const fundingPct = (best.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      message += `  → Best: ${best.totalPnl >= 0 ? '+' : ''}${best.totalPnl.toFixed(1)}% (Funding ${fundingPct}%)\n\n`;
    } else {
      message += `  → No trades\n\n`;
    }
  }

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Stats globales
  const allBestResults: SessionResult[] = [];
  let totalFundingCollected = 0;

  for (const results of allResults.values()) {
    const best = Array.from(results.values())
      .filter(r => r.totalTrades > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)[0];
    if (best) {
      allBestResults.push(best);
      totalFundingCollected += best.totalFundingCollected;
    }
  }

  if (allBestResults.length > 0) {
    const globalPnl = allBestResults.reduce((sum, r) => sum + r.totalPnl, 0);
    const globalWR = allBestResults.reduce((sum, r) => sum + r.winRate, 0) / allBestResults.length;
    const globalSharpe = allBestResults.reduce((sum, r) => sum + r.sharpe, 0) / allBestResults.length;
    const totalFundingPct = (totalFundingCollected / POSITION_SIZE_USD * 100);

    message += `<b>STATS GLOBALES:</b>\n`;
    message += `Total PNL: ${globalPnl >= 0 ? '+' : ''}${globalPnl.toFixed(1)}%\n`;
    message += `Total Funding: ${totalFundingPct.toFixed(2)}%\n`;
    message += `Avg Win Rate: ${globalWR.toFixed(1)}%\n`;
    message += `Avg Sharpe: ${globalSharpe.toFixed(2)}\n\n`;

    const validSymbols = allBestResults.filter(r => r.totalPnl > 0).length;
    message += `${validSymbols}/${allBestResults.length} symboles positifs\n\n`;

    if (totalFundingPct > 0) {
      message += '✅ <b>FUNDING COLLECTÉ!</b> — Edge pur validé\n';
    } else {
      message += '⚠️ <b>FUNDING = 0</b> — Edge directionnel uniquement\n';
    }
  }

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return message;
}

/**
 * Main
 */
async function main() {
  console.log('========================================');
  console.log('PURE FUNDING ARBITRAGE — IDÉE 9');
  console.log('SESSION FUNDING (00h/08h/16h UTC)');
  console.log('========================================');

  const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
  const DAYS_BACK = 90;

  const allResults = await testAllThresholds(SYMBOLS, DAYS_BACK);

  console.log('\n========================================');
  console.log('[SUMMARY]');

  for (const [symbol, results] of allResults) {
    const best = Array.from(results.values())
      .filter(r => r.totalTrades > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)[0];

    if (best) {
      const fundingPct = (best.totalFundingCollected / POSITION_SIZE_USD * 100).toFixed(2);
      console.log(`${symbol}: PNL ${best.totalPnl.toFixed(1)}% (Funding ${fundingPct}%, WR ${best.winRate.toFixed(0)}%, ${best.totalTrades} trades)`);
    } else {
      console.log(`${symbol}: No trades`);
    }
  }

  console.log('========================================');

  // Sauvegarder
  const resultsObj: Record<string, any> = {};
  for (const [symbol, results] of allResults) {
    resultsObj[symbol] = Object.fromEntries(results);
  }

  const fs = await import('fs');
  const summaryPath = '/root/projects/macro-dashboard/funding-arb-idea9-results.json';
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

export { main, runSessionBacktest };
