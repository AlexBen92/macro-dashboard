/**
 * PURE FUNDING ARBITRAGE — IDÉE 10
 *
 * BACKTEST ISOLÉ : FUNDING ONLY (ZERO DIRECTIONNEL)
 *
 * Mesure l'edge PUR du funding sans aucun biais de prix.
 * Simule un scénario où le prix ne bouge JAMAIS (flat).
 *
 * PNL = sum(funding_payments) - fees sur 12 mois
 * Donne le PNL maximal théorique de la stratégie.
 *
 * Si PNL > 0 → le funding a un edge
 * Si PNL < 0 → les frais mangent le funding → abandon total
 */

interface FundingPureResult {
  symbol: string;
  totalFundingPayments: number;
  totalFees: number;
  netPnlPct: number;
  fundingEpisodes: number;
  avgFundingPerEpisode: number;
  maxFundingSingleEpisode: number;
  minFundingSingleEpisode: number;
  medianFunding: number;
  totalHours: number;
}

interface HistoricalFundingData {
  timestamp: number;
  fundingRate: number;
  symbol: string;
}

const HL_ROUND_TRIP = 0.0010; // 0.10% round trip
const ENTRY_FEE = 0.0005; // 0.05% taker fee
const POSITION_SIZE_USD = 1000; // Size standardisée pour comparaison

/**
 * Récupère l'historique des funding rates depuis Binance
 */
async function fetchBinanceFundingHistory(
  symbol: string,
  startTime: number,
  endTime: number
): Promise<HistoricalFundingData[]> {
  const binanceSymbol = symbol + 'USDT';
  const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${binanceSymbol}&startTime=${startTime}&endTime=${endTime}&limit=1000`;

  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((d: any) => ({
      timestamp: d.fundingTime || d.time,
      fundingRate: parseFloat(d.fundingRate || '0'),
      symbol,
    }));
  } catch (e) {
    console.error(`Error fetching funding for ${symbol}:`, e);
    return [];
  }
}

/**
 * Récupère l'historique complet sur 12 mois (pagination)
 */
async function fetchFullFundingHistory(
  symbol: string,
  daysBack: number = 365
): Promise<HistoricalFundingData[]> {
  const now = Date.now();
  const startTime = now - daysBack * 24 * 60 * 60 * 1000;
  const endTime = now;

  const allData: HistoricalFundingData[] = [];
  let currentStart = startTime;
  let page = 0;

  while (currentStart < endTime) {
    const url = `https://fapi.binance.com/fapi/v1/fundingRate?symbol=${symbol}USDT&startTime=${currentStart}&endTime=${endTime}&limit=1000`;

    try {
      const response = await fetch(url);
      if (!response.ok) break;
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;

      allData.push(
        ...data.map((d: any) => ({
          timestamp: d.fundingTime || d.time,
          fundingRate: parseFloat(d.fundingRate || '0'),
          symbol,
        }))
      );

      currentStart = data[data.length - 1].fundingTime + 1;
      page++;

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      if (data.length < 1000) break;
    } catch (e) {
      console.error(`Error fetching page ${page}:`, e);
      break;
    }
  }

  return allData.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Simule le scénario FLAT: prix ne bouge jamais.
 * On entre quand funding < -X bps et on sort quand funding >= 0.
 */
function simulateFundingOnlyBacktest(
  fundingData: HistoricalFundingData[],
  entryThresholdBps: number
): FundingPureResult {
  if (fundingData.length === 0) {
    return {
      symbol: fundingData[0]?.symbol || 'UNKNOWN',
      totalFundingPayments: 0,
      totalFees: 0,
      netPnlPct: 0,
      fundingEpisodes: 0,
      avgFundingPerEpisode: 0,
      maxFundingSingleEpisode: 0,
      minFundingSingleEpisode: 0,
      medianFunding: 0,
      totalHours: 0,
    };
  }

  const symbol = fundingData[0].symbol;
  let inPosition = false;
  let positionEntryTime = 0;
  let totalFundingCollected = 0;
  let totalFeesPaid = 0;
  const fundingCollectedPerEpisode: number[] = [];

  const entryThreshold = entryThresholdBps / 10000; // Convert bps to decimal

  for (let i = 0; i < fundingData.length; i++) {
    const current = fundingData[i];
    const fundingBps = current.fundingRate * 10000;

    // ENTRÉE: funding devient négatif (on LONG pour recevoir funding)
    if (!inPosition && fundingBps < entryThresholdBps) {
      inPosition = true;
      positionEntryTime = current.timestamp;
      totalFeesPaid += ENTRY_FEE;
    }

    // SORTIE: funding redevient positif ou >= 0
    if (inPosition && fundingBps >= 0) {
      // On collecte le funding de la période précédente (8h)
      const prevFundingRate = i > 0 ? fundingData[i - 1].fundingRate : 0;
      const fundingPayment = Math.abs(prevFundingRate) * POSITION_SIZE_USD;
      totalFundingCollected += fundingPayment;
      fundingCollectedPerEpisode.push(fundingPayment);

      // Pay exit fee
      totalFeesPaid += ENTRY_FEE;
      inPosition = false;
    }

    // Si toujours en position à la fin, on collecte le dernier funding
    if (inPosition && i === fundingData.length - 1) {
      const fundingPayment = Math.abs(current.fundingRate) * POSITION_SIZE_USD;
      totalFundingCollected += fundingPayment;
      fundingCollectedPerEpisode.push(fundingPayment);
    }
  }

  const totalHours = (fundingData[fundingData.length - 1].timestamp - fundingData[0].timestamp) / (1000 * 60 * 60);

  // Stats
  const sortedFundings = [...fundingCollectedPerEpisode].sort((a, b) => a - b);
  const medianFunding = sortedFundings.length > 0
    ? sortedFundings[Math.floor(sortedFundings.length / 2)]
    : 0;

  const netPnl = totalFundingCollected - totalFeesPaid;
  const netPnlPct = (netPnl / POSITION_SIZE_USD) * 100;

  return {
    symbol,
    totalFundingPayments: totalFundingCollected,
    totalFees: totalFeesPaid,
    netPnlPct,
    fundingEpisodes: fundingCollectedPerEpisode.length,
    avgFundingPerEpisode: fundingCollectedPerEpisode.length > 0
      ? totalFundingCollected / fundingCollectedPerEpisode.length
      : 0,
    maxFundingSingleEpisode: fundingCollectedPerEpisode.length > 0
      ? Math.max(...fundingCollectedPerEpisode)
      : 0,
    minFundingSingleEpisode: fundingCollectedPerEpisode.length > 0
      ? Math.min(...fundingCollectedPerEpisode)
      : 0,
    medianFunding,
    totalHours,
  };
}

/**
 * Teste tous les seuils de funding pour un symbole
 */
async function testThresholdsForSymbol(
  symbol: string,
  daysBack: number = 365
): Promise<Map<number, FundingPureResult>> {
  console.log(`\n[*] Fetching ${daysBack} days of funding data for ${symbol}...`);
  const fundingData = await fetchFullFundingHistory(symbol, daysBack);
  console.log(`    Got ${fundingData.length} funding entries`);

  const thresholds = [-0.25, -0.5, -1, -2, -3, -5, -8, -10];
  const results = new Map<number, FundingPureResult>();

  for (const threshold of thresholds) {
    const result = simulateFundingOnlyBacktest(fundingData, threshold);
    results.set(threshold, result);
    console.log(`    Threshold < ${threshold} bps: ${result.netPnlPct.toFixed(2)}% PNL (${result.fundingEpisodes} episodes)`);
  }

  return results;
}

/**
 * Formate les résultats pour Telegram
 */
function formatTelegramMessage(allResults: Map<string, Map<number, FundingPureResult>>): string {
  let message = '📊 <b>PURE FUNDING ARBITRAGE — IDÉE 10</b>\n';
  message += '🧪 <b>BACKTEST FLAT (ZERO DIRECTIONNEL)</b>\n\n';
  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  message += '<i>Scénario: Prix ne bouge jamais. PNL = funding collecté - fees.</i>\n';
  message += '<i>Position: 1000 USD, 12 mois de données.</i>\n\n';

  // Pour chaque symbole, trouver le meilleur seuil
  const symbols = Array.from(allResults.keys());

  for (const symbol of symbols) {
    const results = allResults.get(symbol)!;
    message += `<b>${symbol}</b>\n`;

    for (const [threshold, result] of results) {
      const pnlStr = result.netPnlPct >= 0 ? '+' : '';
      const emoji = result.netPnlPct >= 0 ? '🟢' : '🔴';

      message += `  Funding < ${threshold} bps: `;
      message += `${emoji} PNL ${pnlStr}${result.netPnlPct.toFixed(2)}% `;
      message += `(${result.fundingEpisodes} trades, `;
      message += `avg $${result.avgFundingPerEpisode.toFixed(2)})\n`;
    }

    // Meilleur résultat pour ce symbole
    const best = Array.from(results.values()).sort((a, b) => b.netPnlPct - a.netPnlPct)[0];
    message += `  → Best: ${best.netPnlPct >= 0 ? '+' : ''}${best.netPnlPct.toFixed(2)}%\n\n`;
  }

  message += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // Conclusion globale
  let globalValid = 0;
  let globalInvalid = 0;

  for (const results of allResults.values()) {
    const best = Array.from(results.values()).sort((a, b) => b.netPnlPct - a.netPnlPct)[0];
    if (best.netPnlPct > 0) globalValid++;
    else globalInvalid++;
  }

  message += `<b>CONCLUSION GLOBALE:</b>\n`;
  message += `${globalValid} / ${symbols.length} symboles ont un edge positif\n`;

  if (globalValid >= symbols.length * 0.6) {
    message += '✅ <b>FUNDING ARB VALIDÉ</b> — Edge confirmed, continue to Idée 1\n';
  } else {
    message += '❌ <b>FUNDING ARB INVALIDÉ</b> — Kill switch: frais mangent funding\n';
  }

  message += '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  return message;
}

/**
 * Fonction principale
 */
async function main() {
  console.log('========================================');
  console.log('PURE FUNDING ARBITRAGE — IDÉE 10');
  console.log('BACKTEST FLAT (ZERO DIRECTIONNEL)');
  console.log('========================================');

  const SYMBOLS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
  const DAYS_BACK = 365; // 12 mois

  const allResults = new Map<string, Map<number, FundingPureResult>>();

  for (const symbol of SYMBOLS) {
    const results = await testThresholdsForSymbol(symbol, DAYS_BACK);
    allResults.set(symbol, results);
  }

  console.log('\n========================================');
  console.log('[SUMMARY]');

  for (const [symbol, results] of allResults) {
    const best = Array.from(results.values()).sort((a, b) => b.netPnlPct - a.netPnlPct)[0];
    console.log(`${symbol}: Best PNL ${best.netPnlPct.toFixed(2)}% (${best.fundingEpisodes} episodes)`);
  }

  console.log('========================================');

  // Sauvegarder les résultats
  const resultsObj: Record<string, any> = {};
  for (const [symbol, results] of allResults) {
    resultsObj[symbol] = Object.fromEntries(results);
  }

  const summaryPath = '/root/projects/macro-dashboard/funding-arb-idea10-results.json';
  const fs = await import('fs');
  fs.writeFileSync(summaryPath, JSON.stringify(resultsObj, null, 2));
  console.log(`\n[OK] Results saved to ${summaryPath}`);

  // Envoyer à Telegram
  const message = formatTelegramMessage(allResults);
  console.log('\n[TELEGRAM MESSAGE]');
  console.log(message);

  return { allResults, message };
}

// Pour exécution via Node
if (require.main === module) {
  main().catch(console.error);
}

export { main, simulateFundingOnlyBacktest, fetchFullFundingHistory };
