/**
 * PURE FUNDING ARBITRAGE — IDÉE 1
 *
 * REMPLACER LE SL PRIX PAR UN EXIT FUNDING-BASED
 *
 * Le SL prix est la cause n°1 d'échec (97% hit rate).
 * Supprimer totalement le SL prix fixe.
 *
 * Exit conditions (par ordre de priorité) :
 * 1. funding >= 0 → exit immédiat
 * 2. funding > +1bps → exit immédiat (retournement)
 * 3. Time-based exit : max 4 heures de hold (= 0.5 période funding)
 * 4. Perte directionnelle > 3% → exit de sécurité uniquement
 *
 * Backtester avec ces 4 sorties uniquement, zéro SL classique.
 */

interface PriceFundingPoint {
  timestamp: number;
  price: number;
  fundingRate: number;
  symbol: string;
}

interface Trade {
  symbol: string;
  entryTime: number;
  entryPrice: number;
  entryFundingRate: number;
  exitTime: number | null;
  exitPrice: number | null;
  exitFundingRate: number | null;
  exitReason: string | null;
  pnlPct: number;
  fundingCollected: number;
  holdDurationHours: number;
}

interface BacktestResult {
  symbol: string;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
  maxDrawdown: number;
  profitFactor: number;
  avgHoldHours: number;
  exitReasons: Record<string, number>;
}

const HL_ROUND_TRIP = 0.0010; // 0.10% round trip
const POSITION_SIZE_USD = 1000;

/**
 * Fetch prix + funding depuis Binance
 */
async function fetchPriceAndFundingData(
  symbol: string,
  daysBack: number = 365
): Promise<PriceFundingPoint[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;
  const binanceSymbol = symbol + 'USDT';

  const allData: PriceFundingPoint[] = [];
  let klineStart = startTime;

  // Fetch klines par lots de 1000
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
          fundingRate: 0, // Sera rempli après
          symbol,
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
        console.log(`    Fetched ${fundingRates.length} funding rates`);
        // Afficher les premiers funding rates
        if (fundingRates.length > 0) {
          const firstFunding = fundingRates[0];
          const lastFunding = fundingRates[fundingRates.length - 1];
          console.log(`    First funding: ${new Date(firstFunding.fundingTime || firstFunding.time).toISOString()}, rate=${firstFunding.fundingRate}`);
          console.log(`    Last funding: ${new Date(lastFunding.fundingTime || lastFunding.time).toISOString()}, rate=${lastFunding.fundingRate}`);
        }

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

        // Debug: vérifier les dernières valeurs
        console.log(`    After forward-fill, last 3 funding rates: ${allData.slice(-3).map(d => (d.fundingRate * 10000).toFixed(2) + ' bps').join(', ')}`);
      }
    }
  } catch (e) {
    console.error(`Error fetching funding: ${e}`);
  }

  return allData;
}

/**
 * Simule un trade avec exits funding-based
 */
function simulateFundingExitTrade(
  data: PriceFundingPoint[],
  startIndex: number,
  entryThresholdBps: number,
  debug: boolean = false
): Trade | null {
  if (startIndex >= data.length - 1) return null;

  const entry = data[startIndex];

  // Debug: vérifier les données
  if (debug && startIndex === 0) {
    console.log('  [DEBUG] First 5 data points:');
    for (let i = 0; i < Math.min(5, data.length); i++) {
      console.log(`    ${i}: ts=${data[i].timestamp}, price=${data[i].price}, funding=${data[i].fundingRate} (${(data[i].fundingRate * 10000).toFixed(2)} bps)`);
    }
  }

  const entryFundingBps = entry.fundingRate * 10000;

  // Vérifier le signal d'entrée
  if (entryFundingBps >= entryThresholdBps) {
    if (debug && startIndex < 5) {
      console.log(`  [SKIP] Index ${startIndex}: funding=${entryFundingBps.toFixed(2)} bps >= ${entryThresholdBps} bps`);
    }
    return null;
  }

  if (debug && startIndex < 5) {
    console.log(`  [ENTRY] Index ${startIndex}: funding=${entryFundingBps.toFixed(2)} bps < ${entryThresholdBps} bps, price=${entry.price}`);
  }

  const trade: Trade = {
    symbol: entry.symbol,
    entryTime: entry.timestamp,
    entryPrice: entry.price,
    entryFundingRate: entry.fundingRate,
    exitTime: null,
    exitPrice: null,
    exitFundingRate: null,
    exitReason: null,
    pnlPct: 0,
    fundingCollected: 0,
    holdDurationHours: 0,
  };

  const maxHoldHours = 8; // 8h pour recevoir au moins un paiement de funding
  const maxIdx = Math.min(startIndex + maxHoldHours + 1, data.length - 1);

  if (debug && startIndex < 5) {
    console.log(`    Max idx: ${maxIdx}, data length: ${data.length}`);
  }

  // Simuler heure par heure
  for (let idx = startIndex + 1; idx <= maxIdx; idx++) {
    const current = data[idx];
    const fundingBps = current.fundingRate * 10000;
    const priceChangePct = ((current.price - entry.price) / entry.price) * 100;
    const hoursHeld = (current.timestamp - entry.timestamp) / (1000 * 60 * 60);

    if (debug && startIndex < 5 && idx <= startIndex + 2) {
      console.log(`    Step ${idx - startIndex}: funding=${fundingBps.toFixed(2)} bps, price=${current.price}, hours=${hoursHeld.toFixed(2)}`);
    }

    // EXIT 1: funding >= 0 (normalisation)
    if (fundingBps >= 0) {
      trade.exitTime = current.timestamp;
      trade.exitPrice = current.price;
      trade.exitFundingRate = current.fundingRate;
      trade.exitReason = 'funding_normalized';
      if (debug && startIndex < 5) console.log(`    EXIT: funding_normalized`);
      break;
    }

    // EXIT 2: funding > +1bps (retournement)
    if (fundingBps > 1) {
      trade.exitTime = current.timestamp;
      trade.exitPrice = current.price;
      trade.exitFundingRate = current.fundingRate;
      trade.exitReason = 'funding_reversal';
      if (debug && startIndex < 5) console.log(`    EXIT: funding_reversal`);
      break;
    }

    // EXIT 3: Time-based (4h max)
    if (hoursHeld >= maxHoldHours) {
      trade.exitTime = current.timestamp;
      trade.exitPrice = current.price;
      trade.exitFundingRate = current.fundingRate;
      trade.exitReason = 'time_limit';
      if (debug && startIndex < 5) console.log(`    EXIT: time_limit`);
      break;
    }

    // EXIT 4: Perte directionnelle > 3% (sécurité)
    if (priceChangePct < -3) {
      trade.exitTime = current.timestamp;
      trade.exitPrice = current.price;
      trade.exitFundingRate = current.fundingRate;
      trade.exitReason = 'stop_loss';
      if (debug && startIndex < 5) console.log(`    EXIT: stop_loss`);
      break;
    }
  }

  // Si pas d'exit, exit au dernier point
  if (!trade.exitTime || trade.exitPrice === null) {
    const last = data[Math.max(0, maxIdx)];
    trade.exitTime = last.timestamp;
    trade.exitPrice = last.price;
    trade.exitFundingRate = last.fundingRate;
    trade.exitReason = 'data_end';
    if (debug) console.log(`    EXIT: data_end (idx ${maxIdx})`);
  }

  // Calculer PNL
  if (trade.exitPrice !== null && trade.exitPrice !== undefined && entry.price > 0) {
    const priceChangePct = ((trade.exitPrice - entry.price) / entry.price) * 100;
    trade.holdDurationHours = (trade.exitTime! - entry.timestamp) / (1000 * 60 * 60);

    // Estimer funding collecté (approximation basée sur la durée)
    const fundingPayments = Math.floor(trade.holdDurationHours / 8);
    // Utiliser la valeur absolue du funding rate d'entrée, avec une valeur par défaut
    const avgFundingRate = Math.abs(entry.entryFundingRate || 0);
    trade.fundingCollected = fundingPayments * avgFundingRate * POSITION_SIZE_USD;

    // PNL = price change + funding - fees
    const feesPct = HL_ROUND_TRIP * 100;
    const fundingPct = (trade.fundingCollected / POSITION_SIZE_USD * 100);
    trade.pnlPct = priceChangePct + fundingPct - feesPct;

    if (debug && startIndex < 100) {
      console.log(`    PNL calc: priceChange=${priceChangePct.toFixed(3)}%, funding=${fundingPct.toFixed(3)}%, fees=${feesPct.toFixed(3)}%, total=${trade.pnlPct.toFixed(3)}%`);
    }
  } else {
    if (debug) console.log(`    ERROR: Invalid prices for PNL calculation`);
  }

  return trade;
}

/**
 * Run backtest avec exits funding-based
 */
async function runFundingExitBacktest(
  symbol: string,
  entryThresholdBps: number,
  daysBack: number = 365
): Promise<BacktestResult> {
  console.log(`\n[*] Fetching data for ${symbol} (${daysBack} days)...`);
  const data = await fetchPriceAndFundingData(symbol, daysBack);
  console.log(`    Got ${data.length} data points`);

  // Debug: afficher quelques échantillons
  console.log(`    Sample data (first 5):`);
  for (let i = 0; i < Math.min(5, data.length); i++) {
    const fundingBps = data[i].fundingRate * 10000;
    console.log(`      ${i}: ts=${new Date(data[i].timestamp).toISOString()}, price=${data[i].price}, funding=${fundingBps.toFixed(2)} bps`);
  }

  const trades: Trade[] = [];
  let cooldownUntil = 0;
  let entriesFound = 0;
  let skipsCooldown = 0;

  for (let i = 0; i < data.length; i++) {
    const point = data[i];
    const fundingBps = point.fundingRate * 10000;

    // Skip si en cooldown
    if (point.timestamp < cooldownUntil) {
      skipsCooldown++;
      continue;
    }

    // Signal d'entrée
    if (fundingBps < entryThresholdBps) {
      entriesFound++;
      const trade = simulateFundingExitTrade(data, i, entryThresholdBps, entriesFound <= 3);

      if (trade) {
        trades.push(trade);

        // Log immédiat pour le premier trade
        if (entriesFound === 1) {
          console.log(`    [FIRST TRADE] entry: ${trade.entryPrice}, exit: ${trade.exitPrice}, reason: ${trade.exitReason}, pnl: ${trade.pnlPct.toFixed(3)}%`);
        }
      }

      // Cooldown de 4h après un trade perdant
      if (trade && trade.pnlPct < 0) {
        cooldownUntil = trade.exitTime! + 4 * 60 * 60 * 1000;
      }
    }
  }

  console.log(`    Entries found: ${entriesFound}, Cooldown skips: ${skipsCooldown}`);
  console.log(`    Generated ${trades.length} trades`);

  if (trades.length === 0) {
    return {
      symbol,
      totalTrades: 0,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      sharpe: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      avgHoldHours: 0,
      exitReasons: {},
    };
  }

  // Filtrer les trades invalides
  const validTrades = trades.filter(t =>
    t.exitPrice !== null &&
    t.exitPrice !== undefined &&
    !isNaN(t.exitPrice) &&
    t.entryPrice > 0 &&
    !isNaN(t.pnlPct)
  );

  console.log(`    Valid trades: ${validTrades.length}/${trades.length}`);

  if (validTrades.length === 0) {
    return {
      symbol,
      totalTrades: trades.length,
      winRate: 0,
      avgPnl: 0,
      totalPnl: 0,
      sharpe: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      avgHoldHours: 0,
      exitReasons: {},
    };
  }

  // Calculer les métriques
  const wins = validTrades.filter(t => t.pnlPct > 0);
  const winRate = (wins.length / validTrades.length) * 100;

  const pnlValues = validTrades.map(t => t.pnlPct);
  const avgPnl = pnlValues.reduce((a, b) => a + b, 0) / validTrades.length;
  const totalPnl = pnlValues.reduce((a, b) => a + b, 0);

  // Sharpe
  const mean = avgPnl;
  const variance = pnlValues.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / validTrades.length;
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

  // Profit Factor
  const grossProfit = wins.reduce((sum, t) => sum + t.pnlPct, 0);
  const losses = validTrades.filter(t => t.pnlPct < 0);
  const grossLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnlPct, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0;

  // Avg hold time
  const avgHoldHours = validTrades.reduce((sum, t) => sum + t.holdDurationHours, 0) / validTrades.length;

  // Exit reasons
  const exitReasons: Record<string, number> = {};
  for (const t of validTrades) {
    const reason = t.exitReason || 'unknown';
    exitReasons[reason] = (exitReasons[reason] || 0) + 1;
  }

  // Debug: afficher quelques trades
  if (validTrades.length > 0) {
    console.log(`    Sample trade: PNL=${validTrades[0].pnlPct.toFixed(3)}%, entry=${validTrades[0].entryPrice}, exit=${validTrades[0].exitPrice}`);
  }

  console.log(`    Win Rate: ${winRate.toFixed(1)}%`);
  console.log(`    Total PNL: ${totalPnl.toFixed(2)}%`);
  console.log(`    Sharpe: ${sharpe.toFixed(2)}`);
  console.log(`    Max DD: ${maxDD.toFixed(2)}%`);

  return {
    symbol,
    totalTrades: validTrades.length,
    winRate,
    avgPnl,
    totalPnl,
    sharpe,
    maxDrawdown: maxDD,
    profitFactor,
    avgHoldHours,
    exitReasons,
  };
}

/**
 * Teste tous les seuils pour tous les symboles
 */
async function testAllThresholds(
  symbols: string[],
  daysBack: number = 365
): Promise<Map<string, Map<number, BacktestResult>>> {
  const thresholds = [-0.25, -0.5, -1, -2, -3];
  const allResults = new Map<string, Map<number, BacktestResult>>();

  for (const symbol of symbols) {
    console.log(`\n========================================`);
    console.log(`SYMBOL: ${symbol}`);
    console.log(`========================================`);

    const results = new Map<number, BacktestResult>();

    for (const threshold of thresholds) {
      console.log(`\n[${thresholds.indexOf(threshold) + 1}/${thresholds.length}] Threshold < ${threshold} bps`);
      const result = await runFundingExitBacktest(symbol, threshold, daysBack);
      results.set(threshold, result);
    }

    allResults.set(symbol, results);
  }

  return allResults;
}

/**
 * Formate message Telegram
 */
function formatTelegramMessage(allResults: Map<string, Map<number, BacktestResult>>): string {
  let message = '📊 <b>PURE FUNDING ARBITRAGE — IDÉE 1</b>\n';
  message += '🔄 <b>EXIT FUNDING-BASED (ZERO SL PRIX)</b>\n\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  message += '<i>Exit conditions (par ordre):</i>\n';
  message += '<i>1. funding >= 0 → exit</i>\n';
  message += '<i>2. funding > +1bps → exit</i>\n';
  message += '<i>3. Time-based: 4h max</i>\n';
  message += '<i>4. Perte > 3% → exit sécurité</i>\n\n';

  // Pour chaque symbole, trouver le meilleur seuil
  for (const [symbol, results] of allResults) {
    message += `<b>${symbol}</b>\n`;

    for (const [threshold, result] of results) {
      if (result.totalTrades === 0) {
        message += `  < ${threshold} bps: 0 trades\n`;
        continue;
      }

      const pnlStr = result.totalPnl >= 0 ? '+' : '';
      const emoji = result.totalPnl >= 0 ? '🟢' : '🔴';

      message += `  < ${threshold} bps: ${emoji} ${pnlStr}${result.totalPnl.toFixed(1)}% `;
      message += `| WR ${result.winRate.toFixed(0)}% `;
      message += `| S${result.sharpe.toFixed(2)} `;
      message += `(${result.totalTrades}T)\n`;
    }

    const best = Array.from(results.values())
      .filter(r => r.totalTrades > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)[0];

    if (best) {
      message += `  → Best: ${best.totalPnl >= 0 ? '+' : ''}${best.totalPnl.toFixed(1)}% (WR ${best.winRate.toFixed(0)}%)\n\n`;
    } else {
      message += `  → No valid trades\n\n`;
    }
  }

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Stats globales
  const allBestResults: BacktestResult[] = [];
  for (const results of allResults.values()) {
    const best = Array.from(results.values())
      .filter(r => r.totalTrades > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)[0];
    if (best) allBestResults.push(best);
  }

  if (allBestResults.length > 0) {
    const globalPnl = allBestResults.reduce((sum, r) => sum + r.totalPnl, 0);
    const globalWR = allBestResults.reduce((sum, r) => sum + r.winRate, 0) / allBestResults.length;
    const globalSharpe = allBestResults.reduce((sum, r) => sum + r.sharpe, 0) / allBestResults.length;
    const maxDD = Math.max(...allBestResults.map(r => r.maxDrawdown));

    message += `<b>STATS GLOBALES:</b>\n`;
    message += `Total PNL: ${globalPnl >= 0 ? '+' : ''}${globalPnl.toFixed(1)}%\n`;
    message += `Avg Win Rate: ${globalWR.toFixed(1)}%\n`;
    message += `Avg Sharpe: ${globalSharpe.toFixed(2)}\n`;
    message += `Max DD: ${maxDD.toFixed(1)}%\n\n`;

    const validSymbols = allBestResults.filter(r => r.totalPnl > 0).length;
    message += `${validSymbols}/${allBestResults.length} symboles positifs\n`;

    if (globalPnl > 30 && globalWR > 50) {
      message += '\n✅ <b>FUNDING EXIT VALIDÉ</b> — Continue to Idée 9\n';
    } else if (globalPnl > 0) {
      message += '\n⚠️ <b>EDGE FAIBLE</b> — Optimization needed\n';
    } else {
      message += '\n❌ <b>EDGE NÉGATIF</b> — Pivot required\n';
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
  console.log('PURE FUNDING ARBITRAGE — IDÉE 1');
  console.log('EXIT FUNDING-BASED (ZERO SL PRIX)');
  console.log('========================================');

  const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
  const DAYS_BACK = 90; // Réduit pour test rapide

  const allResults = await testAllThresholds(SYMBOLS, DAYS_BACK);

  console.log('\n========================================');
  console.log('[SUMMARY]');

  for (const [symbol, results] of allResults) {
    const best = Array.from(results.values())
      .filter(r => r.totalTrades > 0)
      .sort((a, b) => b.totalPnl - a.totalPnl)[0];

    if (best) {
      console.log(`${symbol}: PNL ${best.totalPnl.toFixed(1)}% (WR ${best.winRate.toFixed(0)}%, ${best.totalTrades} trades)`);
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
  const summaryPath = '/root/projects/macro-dashboard/funding-arb-idea1-results.json';
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

export { main, runFundingExitBacktest };
