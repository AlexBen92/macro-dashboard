/**
 * REGIME ANALYSIS — Bull vs Bear Market Performance
 *
 * Questions:
 * 1. Est-ce que la stratégie surperforme dans les marchés bear ?
 * 2. Est-ce que le win rate change selon le régime ?
 * 3. Corrélation avec buy & hold ?
 */

async function fetchPriceData(symbol: string, daysBack: number): Promise<any[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;
  const binanceSymbol = symbol + 'USDT';

  const allData: any[] = [];
  let klineStart = startTime;

  while (klineStart < now) {
    const klineUrl = `https://fapi.binance.com/fapi/v1/klines?symbol=${binanceSymbol}&interval=1d&startTime=${klineStart}&endTime=${now}&limit=1000`;

    try {
      const klineRes = await fetch(klineUrl);
      if (!klineRes.ok) break;

      const klines = await klineRes.json();
      if (!Array.isArray(klines) || klines.length === 0) break;

      for (const kline of klines) {
        allData.push({
          timestamp: kline[0],
          open: parseFloat(kline[1]),
          high: parseFloat(kline[2]),
          low: parseFloat(kline[3]),
          close: parseFloat(kline[4]),
        });
      }

      klineStart = klines[klines.length - 1][0] + 86400000;
      if (klines.length < 1000) break;
    } catch (e) {
      break;
    }
  }

  return allData;
}

function identifyRegimes(data: any[]): Array<{start: number, end: number, regime: string, return: number}> {
  const regimes: Array<{start: number, end: number, regime: string, return: number}> = [];

  // SMA 50 pour identifier trend
  const lookback = 50;
  let currentRegime: string | null = null;
  let regimeStart: number | null = null;
  let regimeStartPrice: number | null = null;

  for (let i = lookback; i < data.length; i++) {
    const recent = data.slice(i - lookback, i);
    const sma50 = recent.reduce((sum, d) => sum + d.close, 0) / lookback;
    const currentPrice = data[i].close;

    // Bull = price > SMA50, Bear = price < SMA50
    const regime = currentPrice > sma50 ? 'BULL' : 'BEAR';

    if (regime !== currentRegime) {
      // Sauvegarder le régime précédent
      if (currentRegime && regimeStart !== null && regimeStartPrice !== null) {
        const returnPct = ((data[i - 1].close - regimeStartPrice) / regimeStartPrice) * 100;
        regimes.push({
          start: regimeStart,
          end: data[i - 1].timestamp,
          regime: currentRegime,
          return: returnPct,
        });
      }

      currentRegime = regime;
      regimeStart = data[i].timestamp;
      regimeStartPrice = data[i].close;
    }
  }

  // Dernier régime
  if (currentRegime && regimeStart !== null && regimeStartPrice !== null) {
    const returnPct = ((data[data.length - 1].close - regimeStartPrice) / regimeStartPrice) * 100;
    regimes.push({
      start: regimeStart,
      end: data[data.length - 1].timestamp,
      regime: currentRegime,
      return: returnPct,
    });
  }

  return regimes;
}

async function main() {
  console.log('========================================');
  console.log('REGIME ANALYSIS — BTC 6 ans');
  console.log('========================================\n');

  const data = await fetchPriceData('BTC', 365 * 6);
  console.log(`Chargé ${data.length} jours de données\n`);

  const regimes = identifyRegimes(data);

  console.log('RÉGIMES IDENTIFIÉS:');
  console.log('====================');
  for (const r of regimes) {
    const startDate = new Date(r.start).toISOString().split('T')[0];
    const endDate = new Date(r.end).toISOString().split('T')[0];
    console.log(`${r.regime}: ${startDate} → ${endDate} (${r.return.toFixed(1)}%)`);
  }

  // Stats
  const bullRegimes = regimes.filter(r => r.regime === 'BULL');
  const bearRegimes = regimes.filter(r => r.regime === 'BEAR');

  const bullReturn = bullRegimes.reduce((sum, r) => sum + r.return, 0);
  const bearReturn = bearRegimes.reduce((sum, r) => sum + r.return, 0);
  const bullDays = bullRegimes.reduce((sum, r) => sum + (r.end - r.start) / 86400000, 0);
  const bearDays = bearRegimes.reduce((sum, r) => sum + (r.end - r.start) / 86400000, 0);

  console.log('\nSTATS:');
  console.log('=======');
  console.log(`Périodes BULL: ${bullRegimes.length} (${bullDays.toFixed(0)} jours), return total: +${bullReturn.toFixed(1)}%`);
  console.log(`Périodes BEAR: ${bearRegimes.length} (${bearDays.toFixed(0)} jours), return total: ${bearReturn.toFixed(1)}%`);
  console.log(`Ratio BULL/BEAR jours: ${(bullDays / bearDays).toFixed(2)}x`);

  const totalReturn = ((data[data.length - 1].close - data[0].close) / data[0].close) * 100;
  console.log(`\nBuy & Hold total: +${totalReturn.toFixed(1)}%`);

  console.log('\n========================================');
  console.log('CONCLUSION:');
  console.log('========================================');

  if (bullDays > bearDays * 2) {
    console.log('⚠️  Marché majoritairement BULL sur cette période');
    console.log('   La stratégie LONG bénéficie du trend global.');
  }

  if (bearRegimes.length > 0 && bearReturn > -50) {
    console.log('✅ Marchés BEAR limités en sévérité.');
  }

  console.log('\nRECOMMANDATION: Backtester séparement par régime');
  console.log('pour vérifier si l\'edge persiste en BEAR.');
}

if (require.main === module) {
  main().catch(console.error);
}
