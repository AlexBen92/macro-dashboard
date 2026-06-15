/**
 * REGIME-BASED BACKTEST
 *
 * Compare la performance de la stratégie:
 * - En période BULL
 * - En période BEAR
 */

interface Regime {
  start: number;
  end: number;
  regime: string;
  return: number;
}

async function fetchPriceAndFunding(symbol: string, startTime: number, endTime: number): Promise<any[]> {
  const binanceSymbol = symbol + 'USDT';
  const allData: any[] = [];
  let klineStart = startTime;

  while (klineStart < endTime) {
    const klineUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=1h&startTime=${klineStart}&endTime=${endTime}&limit=1000`;

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
        });
      }

      klineStart = klines[klines.length - 1][0] + 3600000;
      if (klines.length < 1000) break;
    } catch (e) {
      break;
    }
  }

  // Fetch funding rates
  const allFundingRates: any[] = [];
  let fundingStart = startTime;

  while (fundingStart < endTime) {
    const fundingUrl = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${binanceSymbol}&startTime=${fundingStart}&endTime=${endTime}&limit=1000`;

    try {
      const fundingRes = await fetch(fundingUrl);
      if (fundingRes.ok) {
        const fundingRates = await fundingRes.json();
        if (Array.isArray(fundingRates) && fundingRates.length > 0) {
          allFundingRates.push(...fundingRates);
          fundingStart = fundingRates[fundingRates.length - 1].fundingTime + 1;
          if (fundingRates.length < 1000) break;
        }
      }
    } catch (e) {
      break;
    }
  }

  // Forward fill
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

function runSimpleBacktest(data: any[], entryThresholdBps: number = -0.25): any {
  const trades: any[] = [];
  let cooldownUntil = 0;

  for (let i = 0; i < data.length - 1; i++) {
    const point = data[i];
    const fundingBps = point.fundingRate * 10000;

    if (point.timestamp < cooldownUntil) continue;

    // Signal: funding négatif
    if (fundingBps < entryThresholdBps) {
      const entry = data[i];
      const maxHoldHours = 8;

      // Find exit
      let exitIdx = i + 1;
      let exitReason = '';

      for (let j = i + 1; j < Math.min(i + maxHoldHours + 1, data.length); j++) {
        const current = data[j];
        const currentFundingBps = current.fundingRate * 10000;
        const hoursHeld = (current.timestamp - entry.timestamp) / (1000 * 60 * 60);

        if (currentFundingBps >= 0) {
          exitIdx = j;
          exitReason = 'funding_normalized';
          break;
        }

        if (currentFundingBps > 1) {
          exitIdx = j;
          exitReason = 'funding_reversal';
          break;
        }

        if (hoursHeld >= maxHoldHours) {
          exitIdx = j;
          exitReason = 'time_limit';
          break;
        }

        const priceChangePct = ((current.price - entry.price) / entry.price) * 100;
        if (priceChangePct < -3) {
          exitIdx = j;
          exitReason = 'stop_loss';
          break;
        }
      }

      const exit = data[exitIdx];
      const priceChangePct = ((exit.price - entry.price) / entry.price) * 100;
      const holdDurationHours = (exit.timestamp - entry.timestamp) / (1000 * 60 * 60);

      // Funding collected
      const fundingPayments = Math.floor(holdDurationHours / 8);
      const avgFundingRate = Math.abs(entry.fundingRate);
      const fundingCollected = fundingPayments * avgFundingRate * 1000;
      const fundingPct = (fundingCollected / 1000 * 100);

      // PNL
      const feesPct = 0.1;
      const pnlPct = priceChangePct + fundingPct - feesPct;

      trades.push({
        entryTime: entry.timestamp,
        entryPrice: entry.price,
        exitTime: exit.timestamp,
        exitPrice: exit.price,
        exitReason,
        priceChangePct,
        fundingPct,
        pnlPct,
      });

      if (pnlPct < 0) {
        cooldownUntil = exit.timestamp + 4 * 60 * 60 * 1000;
      }
    }
  }

  // Stats
  const wins = trades.filter(t => t.pnlPct > 0);
  const winRate = (wins.length / trades.length) * 100;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnlPct, 0);
  const avgPnl = totalPnl / trades.length;
  const pricePnl = trades.reduce((sum, t) => sum + t.priceChangePct, 0);
  const fundingPnl = trades.reduce((sum, t) => sum + t.fundingPct, 0);

  return {
    trades: trades.length,
    winRate,
    totalPnl,
    avgPnl,
    pricePnl,
    fundingPnl,
  };
}

async function main() {
  console.log('========================================');
  console.log('REGIME-BASED BACKTEST — BTC');
  console.log('========================================\n');

  // Définir les régimes manuellement basé sur l'analyse précédente
  const regimes: Regime[] = [
    // Grande période BULL 2020-2021
    { start: 1600000000000, end: 1618700000000, regime: 'BULL', return: 414 },
    // Crash BEAR 2021
    { start: 1618700000000, end: 1619700000000, regime: 'BEAR', return: -3.7 },
    // Bear market 2021-2022
    { start: 1620600000000, end: 1644600000000, regime: 'BEAR', return: -38.7 },
    // Bull 2021-2022
    { start: 1627000000000, end: 1637100000000, regime: 'BULL', return: 30.2 },
    // Bear 2021-2022
    { start: 1637100000000, end: 1644200000000, regime: 'BEAR', return: -25.6 },
    // Bear 2022
    { start: 1649700000000, end: 1658100000000, regime: 'BEAR', return: -43.2 },
    // Bull 2023
    { start: 1672800000000, end: 1680300000000, regime: 'BULL', return: 39.3 },
    // Bear 2023
    { start: 1680300000000, end: 1684600000000, regime: 'BEAR', return: -5.6 },
    // Bull 2023-2024
    { start: 1685300000000, end: 1705100000000, regime: 'BULL', return: 58.6 },
    // Bear 2024
    { start: 1705100000000, end: 1713600000000, regime: 'BEAR', return: -3.7 },
    // Bull 2024
    { start: 1706700000000, end: 1715600000000, regime: 'BULL', return: 55.8 },
    // Bear 2024-2025
    { start: 1736400000000, end: 1743500000000, regime: 'BEAR', return: -22.1 },
    // Bear 2026
    { start: 1738000000000, end: 1742200000000, regime: 'BEAR', return: -19.5 },
  ];

  const results: any = { BULL: [], BEAR: [] };

  for (const regime of regimes) {
    console.log(`[*] ${regime.regime} ${new Date(regime.start).toISOString().split('T')[0]} → ${new Date(regime.end).toISOString().split('T')[0]}`);

    try {
      const data = await fetchPriceAndFunding('BTC', regime.start, regime.end);

      if (data.length < 10) {
        console.log(`    Pas assez de données (${data.length} points)`);
        continue;
      }

      const stats = runSimpleBacktest(data, -0.25);

      console.log(`    Trades: ${stats.trades}, WR: ${stats.winRate.toFixed(1)}%, PNL: ${stats.totalPnl.toFixed(1)}%`);
      console.log(`    Price: ${stats.pricePnl.toFixed(1)}%, Funding: ${stats.fundingPnl.toFixed(1)}%`);

      results[regime.regime].push(stats);
    } catch (e) {
      console.log(`    Error: ${e}`);
    }
  }

  // Aggregate results
  console.log('\n========================================');
  console.log('AGRÉGÉ PAR RÉGIME:');
  console.log('========================================\n');

  for (const regimeType of ['BULL', 'BEAR']) {
    const statsList = results[regimeType];
    if (statsList.length === 0) continue;

    const totalTrades = statsList.reduce((sum, s) => sum + s.trades, 0);
    const totalPnl = statsList.reduce((sum, s) => sum + s.totalPnl, 0);
    const avgWinRate = statsList.reduce((sum, s) => sum + s.winRate, 0) / statsList.length;
    const avgPrice = statsList.reduce((sum, s) => sum + s.pricePnl, 0) / statsList.length;
    const avgFunding = statsList.reduce((sum, s) => sum + s.fundingPnl, 0) / statsList.length;

    console.log(`${regimeType} (${statsList.length} périodes):`);
    console.log(`  Trades: ${totalTrades}`);
    console.log(`  Win Rate: ${avgWinRate.toFixed(1)}%`);
    console.log(`  Total PNL: ${totalPnl.toFixed(1)}%`);
    console.log(`  Avg Price: ${avgPrice.toFixed(1)}%`);
    console.log(`  Avg Funding: ${avgFunding.toFixed(1)}%`);
    console.log('');
  }
}

if (require.main === module) {
  main().catch(console.error);
}
