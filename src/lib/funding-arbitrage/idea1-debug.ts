/**
 * DEBUG BACKTEST — Vérification des résultats
 *
 * Points à vérifier:
 * 1. Données source cohérentes ?
 * 2. Logique position LONG vs SHORT ?
 * 3. Calcul PNL correct ?
 * 4. Funding collected vs price change ?
 * 5. Regime de marché bullish/bearish ?
 */

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

interface PriceFundingPoint {
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

  // Fetch funding rates par lots
  const allFundingRates: any[] = [];
  let fundingStart = startTime;

  while (fundingStart < now) {
    const fundingUrl = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${binanceSymbol}&startTime=${fundingStart}&endTime=${now}&limit=1000`;

    try {
      const fundingRes = await fetch(fundingUrl);
      if (fundingRes.ok) {
        const fundingRates = await fundingRes.json();
        if (Array.isArray(fundingRates) && fundingRates.length > 0) {
          allFundingRates.push(...fundingRates);
          fundingStart = fundingRates[fundingRates.length - 1].fundingTime + 1;
          if (fundingRates.length < 1000) break;
        } else {
          break;
        }
      }
    } catch (e) {
      break;
    }
  }

  // Forward fill funding rates
  let fundingIdx = 0;
  let currentFunding = 0;

  for (let i = 0; i < allData.length; i++) {
    const point = allData[i];

    while (fundingIdx < allFundingRates.length) {
      const fundingTime = allFundingRates[fundingIdx].fundingTime || allFundingRates[fundingIdx].time;
      if (fundingTime <= point.timestamp) {
        currentFunding = parseFloat(allFundingRates[fundingIdx].fundingRate || '0');
        fundingIdx++;
      } else {
        break;
      }
    }

    allData[i].fundingRate = currentFunding;
  }

  return allData;
}

/**
 * Simule un trade avec logique détaillée
 */
function simulateTradeDetailed(
  data: PriceFundingPoint[],
  startIndex: number,
  entryThresholdBps: number,
  maxTrades: number = 10
): { trades: Trade[]; analysis: any } {
  const trades: Trade[] = [];
  const analysis = {
    totalEntries: 0,
    fundingEntries: 0, // entrées avec funding vraiment négatif
    priceDirection: { up: 0, down: 0 },
    exitReasons: {} as Record<string, number>,
    avgFundingAtEntry: 0,
  };

  let cooldownUntil = 0;
  const fundingValues: number[] = [];

  for (let i = 0; i < Math.min(data.length - 1, startIndex + maxTrades); i++) {
    const point = data[i];
    const fundingBps = point.fundingRate * 10000;

    if (point.timestamp < cooldownUntil) continue;

    // Signal d'entrée: funding négatif
    if (fundingBps < entryThresholdBps) {
      analysis.totalEntries++;
      fundingValues.push(fundingBps);

      if (fundingBps < 0) {
        analysis.fundingEntries++;
      }

      const entry = data[i];
      const maxHoldHours = 8;

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

      // Simuler forward
      for (let idx = i + 1; idx < Math.min(i + maxHoldHours + 1, data.length); idx++) {
        const current = data[idx];
        const currentFundingBps = current.fundingRate * 10000;
        const hoursHeld = (current.timestamp - entry.timestamp) / (1000 * 60 * 60);

        // EXIT conditions
        if (currentFundingBps >= 0) {
          trade.exitTime = current.timestamp;
          trade.exitPrice = current.price;
          trade.exitFundingRate = current.fundingRate;
          trade.exitReason = 'funding_normalized';
          break;
        }

        if (currentFundingBps > 1) {
          trade.exitTime = current.timestamp;
          trade.exitPrice = current.price;
          trade.exitFundingRate = current.fundingRate;
          trade.exitReason = 'funding_reversal';
          break;
        }

        if (hoursHeld >= maxHoldHours) {
          trade.exitTime = current.timestamp;
          trade.exitPrice = current.price;
          trade.exitFundingRate = current.fundingRate;
          trade.exitReason = 'time_limit';
          break;
        }

        const priceChangePct = ((current.price - entry.price) / entry.price) * 100;
        if (priceChangePct < -3) {
          trade.exitTime = current.timestamp;
          trade.exitPrice = current.price;
          trade.exitFundingRate = current.fundingRate;
          trade.exitReason = 'stop_loss';
          break;
        }
      }

      // Exit par défaut
      if (!trade.exitTime) {
        const lastIdx = Math.min(i + maxHoldHours, data.length - 1);
        const last = data[lastIdx];
        trade.exitTime = last.timestamp;
        trade.exitPrice = last.price;
        trade.exitFundingRate = last.fundingRate;
        trade.exitReason = 'data_end';
      }

      // Calcul PNL détaillé
      const priceChangePct = ((trade.exitPrice! - entry.price) / entry.price) * 100;
      trade.holdDurationHours = (trade.exitTime! - entry.timestamp) / (1000 * 60 * 60);

      // Funding collected: si SHORT et funding négatif, on reçoit des paiements
      // Si LONG et funding négatif, on PAYE des frais
      // Pour simplifier: on assume SHORT quand funding est négatif
      const fundingPayments = Math.max(0, Math.floor(trade.holdDurationHours / 8));
      const avgFundingRate = Math.abs(entry.entryFundingRate);
      trade.fundingCollected = fundingPayments > 0 ? fundingPayments * avgFundingRate * POSITION_SIZE_USD : 0;

      const feesPct = HL_ROUND_TRIP * 100;
      const fundingPct = trade.fundingCollected > 0 ? (trade.fundingCollected / POSITION_SIZE_USD * 100) : 0;
      trade.pnlPct = priceChangePct + fundingPct - feesPct;

      // Track direction
      if (priceChangePct > 0) {
        analysis.priceDirection.up++;
      } else {
        analysis.priceDirection.down++;
      }

      analysis.exitReasons[trade.exitReason || 'unknown'] =
        (analysis.exitReasons[trade.exitReason || 'unknown'] || 0) + 1;

      trades.push(trade);

      // Cooldown après trade perdant
      if (trade.pnlPct < 0) {
        cooldownUntil = trade.exitTime! + 4 * 60 * 60 * 1000;
      }

      if (trades.length >= maxTrades) break;
    }
  }

  analysis.avgFundingAtEntry = fundingValues.length > 0
    ? fundingValues.reduce((a, b) => a + b, 0) / fundingValues.length
    : 0;

  return { trades, analysis };
}

/**
 * Vérifier la cohérence des données
 */
async function verifyDataConsistency(symbol: string, daysBack: number = 30): Promise<any> {
  console.log(`\n[*] Vérification données ${symbol} (${daysBack} jours)...`);

  const data = await fetchPriceAndFundingData(symbol, daysBack);

  const stats = {
    totalPoints: data.length,
    fundingNegative: 0,
    fundingPositive: 0,
    fundingZero: 0,
    avgFundingRate: 0,
    minPrice: Infinity,
    maxPrice: -Infinity,
    priceChange: 0,
    firstTimestamp: data[0]?.timestamp,
    lastTimestamp: data[data.length - 1]?.timestamp,
  };

  let fundingSum = 0;
  for (const point of data) {
    const f = point.fundingRate * 10000;
    if (f < 0) stats.fundingNegative++;
    else if (f > 0) stats.fundingPositive++;
    else stats.fundingZero++;

    fundingSum += f;
    stats.minPrice = Math.min(stats.minPrice, point.price);
    stats.maxPrice = Math.max(stats.maxPrice, point.price);
  }

  stats.avgFundingRate = fundingSum / data.length;  // déjà en bps
  stats.priceChange = ((data[data.length - 1].price - data[0].price) / data[0].price) * 100;

  console.log(`    Points: ${stats.totalPoints}`);
  console.log(`    Funding: négatif=${stats.fundingNegative}, positif=${stats.fundingPositive}, zéro=${stats.fundingZero}`);
  console.log(`    Prix: ${stats.minPrice} → ${stats.maxPrice} (${stats.priceChange.toFixed(2)}%)`);
  console.log(`    Avg funding: ${stats.avgFundingRate.toFixed(4)} bps`);

  return { symbol, stats, data };
}

/**
 * Main debug
 */
async function main() {
  console.log('========================================');
  console.log('DEBUG BACKTEST — Vérification');
  console.log('========================================');

  // 1. Vérifier la cohérence des données
  const btcData = await verifyDataConsistency('BTC', 30);

  // 2. Simuler quelques trades manuellement
  console.log('\n[*] Simulation manuelle de 10 trades BTC...');

  const { trades, analysis } = simulateTradeDetailed(btcData.data, 0, -0.25, 100);

  console.log(`\nANALYSE:`);
  console.log(`    Entrées totales: ${analysis.totalEntries}`);
  console.log(`    Entrées avec funding < 0: ${analysis.fundingEntries}`);
  console.log(`    Avg funding à l'entrée: ${analysis.avgFundingAtEntry.toFixed(2)} bps`);
  console.log(`    Direction prix: up=${analysis.priceDirection.up}, down=${analysis.priceDirection.down}`);
  console.log(`    Exit reasons:`, analysis.exitReasons);

  console.log(`\nTRADES SAMPLE (${trades.length} générés):`);
  let totalPnl = 0;
  let totalPriceChange = 0;
  let totalFunding = 0;

  for (let i = 0; i < Math.min(5, trades.length); i++) {
    const t = trades[i];
    const priceChange = ((t.exitPrice! - t.entryPrice) / t.entryPrice) * 100;
    totalPriceChange += priceChange;
    totalFunding += t.fundingCollected / POSITION_SIZE_USD * 100;
    totalPnl += t.pnlPct;

    console.log(`    ${i + 1}. Entry: ${t.entryPrice.toFixed(2)} (funding: ${(t.entryFundingRate * 10000).toFixed(2)} bps)`);
    console.log(`       Exit: ${t.exitPrice!.toFixed(2)} (${priceChange.toFixed(3)}%) after ${t.holdDurationHours.toFixed(1)}h`);
    console.log(`       Reason: ${t.exitReason}, PNL: ${t.pnlPct.toFixed(3)}% (price: ${priceChange.toFixed(3)}%, funding: ${(t.fundingCollected / POSITION_SIZE_USD * 100).toFixed(3)}%, fees: -0.1%)`);
  }

  console.log(`\nTOTALS (sample):`);
  console.log(`    Price change: ${totalPriceChange.toFixed(3)}%`);
  console.log(`    Funding collected: ${totalFunding.toFixed(3)}%`);
  console.log(`    Fees: -${(0.1 * Math.min(5, trades.length)).toFixed(3)}%`);
  console.log(`    Net PNL: ${totalPnl.toFixed(3)}%`);

  // 3. Vérifier le régime de marché sur 6 ans
  console.log('\n[*] Vérification régime de marché 6 ans...');

  const btc6y = await verifyDataConsistency('BTC', 365 * 6);

  const buyHoldPnl = ((btc6y.data[btc6y.data.length - 1].price - btc6y.data[0].price) / btc6y.data[0].price) * 100;

  console.log(`\nBUY & HOLD BTC sur 6 ans: +${buyHoldPnl.toFixed(1)}%`);
  console.log(`    Prix: ${btc6y.data[0].price} → ${btc6y.data[btc6y.data.length - 1].price}`);
  console.log(`    Période: ${new Date(btc6y.data[0].timestamp).toISOString()} → ${new Date(btc6y.data[btc6y.data.length - 1].timestamp).toISOString()}`);

  // 4. Comparer avec les résultats du backtest
  console.log('\n========================================');
  console.log('COMPARAISON:');
  console.log('========================================');
  console.log(`Buy & Hold BTC 6 ans: +${buyHoldPnl.toFixed(1)}%`);
  console.log(`Stratégie Funding Exit BTC 6 ans: +1245.9%`);
  console.log(`Ratio: ${(1245.9 / buyHoldPnl).toFixed(2)}x`);

  if (buyHoldPnl > 500) {
    console.log('\n⚠️  ATTENTION: Buy & Hold très fort sur cette période');
    console.log('    La stratégie peut bénéficier du bull market');
  }

  return { btcData, trades, analysis, buyHoldPnl };
}

if (require.main === module) {
  main().catch(console.error);
}

export { main };
