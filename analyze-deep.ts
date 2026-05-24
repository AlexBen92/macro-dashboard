import { promises as fs } from 'fs';

interface Trade {
  holdBars: number;
  pnlNet: number;
  pnlR: number;
  outcome: string;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  tpPrice: number;
  atrAtEntry: number;
  exitReason: string;
  signals: {
    momentum: number;
  };
}

interface Result {
  coin: string;
  totalTrades: number;
  trades: Trade[];
  equityCurve: number[];
}

async function analyze() {
  const files = await fs.readdir('results-v5');
  const allResults: Result[] = [];
  
  for (const file of files) {
    const content = await fs.readFile(`results-v5/${file}`, 'utf-8');
    const result: Result = JSON.parse(content);
    if (result.totalTrades > 0) {
      allResults.push(result);
    }
  }
  
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                 ANALYSE APPROFONDIE - DIAGNOSTIC                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');

  // 1. FEE IMPACT
  console.log('💸 IMPACT DES FRAIS DE TRANSACTION');
  console.log('═'.repeat(80));
  
  let totalNet = 0;
  let totalTrades = 0;
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      totalNet += trade.pnlNet;
      totalTrades++;
    }
  }
  
  // Assuming 0.04% fee per side
  const avgTradeSize = 10000; // Starting capital
  const estimatedFeePerTrade = avgTradeSize * 0.0004 * 2; // Entry + Exit
  const totalEstimatedFees = totalTrades * estimatedFeePerTrade;
  
  console.log(`\nTotal Trades: ${totalTrades}`);
  console.log(`Total Net P&L: $${totalNet.toFixed(2)}`);
  console.log(`Est. Fees: $${totalEstimatedFees.toFixed(2)}`);
  console.log(`Fee Impact: ${(totalEstimatedFees / Math.abs(totalNet) * 100).toFixed(1)}% of net result`);
  console.log(`Avg Fee/Trade: $${estimatedFeePerTrade.toFixed(4)}`);

  // 2. STOP LOSS VS TP HIT RATE
  console.log('\n\n🎯 TAUX DE FRAPPE: STOP VS TP');
  console.log('═'.repeat(80));
  
  let tpHits = 0;
  let trailingHits = 0;
  let stopHits = 0;
  let tpPnl = 0;
  let stopPnl = 0;
  let trailingPnl = 0;
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      if (trade.exitReason === 'TP') {
        tpHits++;
        tpPnl += trade.pnlNet;
      } else if (trade.exitReason === 'TRAILING') {
        trailingHits++;
        trailingPnl += trade.pnlNet;
      } else if (trade.exitReason === 'STOP') {
        stopHits++;
        stopPnl += trade.pnlNet;
      }
    }
  }
  
  const totalExits = tpHits + trailingHits + stopHits;
  console.log(`\nTP Hits: ${tpHits} (${(tpHits/totalExits*100).toFixed(1)}%) → avg: $${(tpPnl/tpHits || 0).toFixed(2)}`);
  console.log(`Trailing Hits: ${trailingHits} (${(trailingHits/totalExits*100).toFixed(1)}%) → avg: $${(trailingPnl/trailingHits).toFixed(2)}`);
  console.log(`Stop Hits: ${stopHits} (${(stopHits/totalExits*100).toFixed(1)}%) → avg: $${(stopPnl/stopHits || 0).toFixed(2)}`);

  // 3. MOMENTUM ANALYSIS
  console.log('\n\n📊 MOMENTUM AU SIGNAL VS RESULTAT');
  console.log('═'.repeat(80));
  
  const momentumRanges = [
    { min: -0.02, max: -0.01, name: 'Fortement Negatif' },
    { min: -0.01, max: -0.005, name: 'Modere Negatif' },
    { min: -0.005, max: 0, name: 'Faiblement Negatif' },
    { min: 0, max: 0.005, name: 'Faiblement Positif' },
    { min: 0.005, max: 0.01, name: 'Modere Positif' },
    { min: 0.01, max: 0.02, name: 'Fortement Positif' },
  ];
  
  console.log('\nMomentum Range      | Trades | Wins  | WR    | Avg P&L');
  console.log('─'.repeat(65));
  
  for (const range of momentumRanges) {
    let trades = 0, wins = 0, totalPnl = 0;
    
    for (const result of allResults) {
      for (const trade of result.trades) {
        if (trade.signals.momentum >= range.min && trade.signals.momentum < range.max) {
          trades++;
          totalPnl += trade.pnlNet;
          if (trade.outcome === 'WIN') wins++;
        }
      }
    }
    
    if (trades > 0) {
      const wr = (wins / trades * 100).toFixed(1);
      const avg = (totalPnl / trades).toFixed(2);
      console.log(`${range.name.padEnd(19)} | ${trades.toString().padStart(6)} | ${wins.toString().padStart(5)} | ${wr.padStart(5)}% | $${avg.padStart(7)}`);
    }
  }

  // 4. ATR AT ENTRY VS RESULT
  console.log('\n\n📊 VOLATILITE (ATR) AU SIGNAL VS RESULTAT');
  console.log('═'.repeat(80));
  
  const atrBuckets: Record<string, {trades: number, wins: number, pnl: number}> = {};
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      const atrPct = (trade.atrAtEntry / trade.entryPrice) * 100;
      let bucket = 'unknown';
      if (atrPct < 0.5) bucket = '<0.5%';
      else if (atrPct < 1) bucket = '0.5-1%';
      else if (atrPct < 2) bucket = '1-2%';
      else bucket = '>2%';
      
      if (!atrBuckets[bucket]) atrBuckets[bucket] = {trades: 0, wins: 0, pnl: 0};
      atrBuckets[bucket].trades++;
      atrBuckets[bucket].pnl += trade.pnlNet;
      if (trade.outcome === 'WIN') atrBuckets[bucket].wins++;
    }
  }
  
  console.log('\nATR Range    | Trades | Wins  | WR    | Avg P&L');
  console.log('─'.repeat(55));
  for (const [bucket, data] of Object.entries(atrBuckets)) {
    const wr = (data.wins / data.trades * 100).toFixed(1);
    const avg = (data.pnl / data.trades).toFixed(2);
    console.log(`${bucket.padEnd(12)} | ${data.trades.toString().padStart(6)} | ${data.wins.toString().padStart(5)} | ${wr.padStart(5)}% | $${avg.padStart(7)}`);
  }

  // 5. EQUITY CURVE ANALYSIS
  console.log('\n\n📊 ANALYSE DE LA COURBE D EQUITY');
  console.log('═'.repeat(80));
  
  let maxDrawdownEver = 0;
  let longestLosingStreak = 0;
  let longestWinningStreak = 0;
  
  for (const result of allResults) {
    if (result.equityCurve.length < 2) continue;
    
    let peak = result.equityCurve[0];
    let maxDD = 0;
    
    for (const equity of result.equityCurve) {
      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak * 100;
      if (dd > maxDD) maxDD = dd;
    }
    
    if (maxDD > maxDrawdownEver) maxDrawdownEver = maxDD;
    
    // Count streaks
    let currentLosing = 0, currentWinning = 0;
    for (const trade of result.trades) {
      if (trade.outcome === 'WIN') {
        currentWinning++;
        if (currentLosing > longestLosingStreak) longestLosingStreak = currentLosing;
        currentLosing = 0;
      } else {
        currentLosing++;
        if (currentWinning > longestWinningStreak) longestWinningStreak = currentWinning;
        currentWinning = 0;
      }
    }
  }
  
  console.log(`\nMax Drawdown (global): ${maxDrawdownEver.toFixed(1)}%`);
  console.log(`Longest Losing Streak: ${longestLosingStreak} trades`);
  console.log(`Longest Winning Streak: ${longestWinningStreak} trades`);

  // 6. POSITION SIZING
  console.log('\n\n📊 TAILLE DES POSITIONS');
  console.log('═'.repeat(80));
  
  const stopDistances: number[] = [];
  const tpDistances: number[] = [];
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      const stopDist = Math.abs(trade.entryPrice - trade.stopPrice) / trade.entryPrice * 100;
      const tpDist = Math.abs(trade.tpPrice - trade.entryPrice) / trade.entryPrice * 100;
      stopDistances.push(stopDist);
      tpDistances.push(tpDist);
    }
  }
  
  stopDistances.sort((a, b) => a - b);
  tpDistances.sort((a, b) => a - b);
  
  console.log(`\nStop Distance (% of price):`);
  console.log(`  Min: ${stopDistances[0].toFixed(3)}%`);
  console.log(`  25th: ${stopDistances[Math.floor(stopDistances.length * 0.25)].toFixed(3)}%`);
  console.log(`  Median: ${stopDistances[Math.floor(stopDistances.length * 0.5)].toFixed(3)}%`);
  console.log(`  75th: ${stopDistances[Math.floor(stopDistances.length * 0.75)].toFixed(3)}%`);
  console.log(`  Max: ${stopDistances[stopDistances.length - 1].toFixed(3)}%`);
  
  console.log(`\nTP Distance (% of price):`);
  console.log(`  Min: ${tpDistances[0].toFixed(3)}%`);
  console.log(`  25th: ${tpDistances[Math.floor(tpDistances.length * 0.25)].toFixed(3)}%`);
  console.log(`  Median: ${tpDistances[Math.floor(tpDistances.length * 0.5)].toFixed(3)}%`);
  console.log(`  75th: ${tpDistances[Math.floor(tpDistances.length * 0.75)].toFixed(3)}%`);
  console.log(`  Max: ${tpDistances[tpDistances.length - 1].toFixed(3)}%`);
  
  const medianStop = stopDistances[Math.floor(stopDistances.length * 0.5)];
  const medianTP = tpDistances[Math.floor(tpDistances.length * 0.5)];
  const theoreticalRR = medianTP / medianStop;
  console.log(`\nTheorique R:R (median): 1:${theoreticalRR.toFixed(1)}`);
}

analyze().catch(console.error);
