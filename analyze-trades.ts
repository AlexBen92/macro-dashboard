import { promises as fs } from 'fs';

interface Trade {
  entryTime: number;
  exitReason: string;
  holdBars: number;
  pnlNet: number;
  pnlR: number;
  outcome: string;
  confluenceScore: number;
  regime: string;
  signals: {
    trend: string;
    momentum: number;
  };
}

interface Result {
  coin: string;
  totalTrades: number;
  winRate: number;
  sharpe: number;
  profitFactor: number;
  avgHoldBars: number;
  trades: Trade[];
}

async function analyze() {
  const files = await fs.readdir('results-v5');
  const allResults: Result[] = [];
  
  for (const file of files) {
    const content = await fs.readFile(`results-v5/${file}`, 'utf-8');
    const result: Result = JSON.parse(content);
    allResults.push(result);
  }
  
  // Sort by Sharpe
  allResults.sort((a, b) => b.sharpe - a.sharpe);
  
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ANALYSE COMPLÈTE DES TRADES                           ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  
  // 1. EXIT REASONS ANALYSIS
  console.log('📊 RAISONS DE SORTIE (TOP 5 COINS)');
  console.log('═'.repeat(80));
  
  for (const result of allResults.slice(0, 5)) {
    const exitReasons: Record<string, number> = {};
    const pnlByReason: Record<string, {total: number, count: number}> = {};
    
    for (const trade of result.trades) {
      exitReasons[trade.exitReason] = (exitReasons[trade.exitReason] || 0) + 1;
      if (!pnlByReason[trade.exitReason]) {
        pnlByReason[trade.exitReason] = {total: 0, count: 0};
      }
      pnlByReason[trade.exitReason].total += trade.pnlNet;
      pnlByReason[trade.exitReason].count++;
    }
    
    console.log(`\n${result.coin}:`);
    for (const [reason, count] of Object.entries(exitReasons)) {
      const avgPnl = pnlByReason[reason].total / pnlByReason[reason].count;
      const pct = (count / result.totalTrades * 100).toFixed(1);
      console.log(`  ${reason.padEnd(15)} ${count.toString().padStart(4)} (${pct}%) → avg: $${avgPnl.toFixed(2)}`);
    }
  }
  
  // 2. HOLD TIME ANALYSIS
  console.log('\n\n📊 DURÉE DES TRADES (HOLD BARS)');
  console.log('═'.repeat(80));
  
  for (const result of allResults.slice(0, 5)) {
    const holdTimes = {
      short: 0, // 1-3 bars
      medium: 0, // 4-10 bars  
      long: 0, // 11+ bars
    };
    
    for (const trade of result.trades) {
      if (trade.holdBars <= 3) holdTimes.short++;
      else if (trade.holdBars <= 10) holdTimes.medium++;
      else holdTimes.long++;
    }
    
    console.log(`\n${result.coin}:`);
    console.log(`  1-3 bars:   ${holdTimes.short} (${(holdTimes.short/result.totalTrades*100).toFixed(1)}%)`);
    console.log(`  4-10 bars:  ${holdTimes.medium} (${(holdTimes.medium/result.totalTrades*100).toFixed(1)}%)`);
    console.log(`  11+ bars:   ${holdTimes.long} (${(holdTimes.long/result.totalTrades*100).toFixed(1)}%)`);
    console.log(`  Avg: ${result.avgHoldBars.toFixed(1)} bars`);
  }
  
  // 3. CONFLUENCE SCORE ANALYSIS
  console.log('\n\n📊 SCORE DE CONFLUENCE VS WIN RATE');
  console.log('═'.repeat(80));
  
  const scoreBuckets: Record<number, {trades: number, wins: number, pnl: number}> = {};
  for (let i = 30; i <= 100; i += 10) {
    scoreBuckets[i] = {trades: 0, wins: 0, pnl: 0};
  }
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      const bucket = Math.floor(trade.confluenceScore / 10) * 10;
      if (scoreBuckets[bucket]) {
        scoreBuckets[bucket].trades++;
        scoreBuckets[bucket].pnl += trade.pnlNet;
        if (trade.outcome === 'WIN') scoreBuckets[bucket].wins++;
      }
    }
  }
  
  console.log('\nScore Range | Trades | Wins  | WR    | Avg P&L');
  console.log('─'.repeat(60));
  for (const [score, data] of Object.entries(scoreBuckets).sort((a, b) => Number(a[0]) - Number(b[0]))) {
    if (data.trades > 0) {
      const wr = (data.wins / data.trades * 100).toFixed(1);
      const avgPnl = (data.pnl / data.trades).toFixed(2);
      console.log(`${score.padEnd(4)}-${(Number(score)+9).toString().padEnd(4)} | ${data.trades.toString().padStart(6)} | ${data.wins.toString().padStart(5)} | ${wr.padStart(5)}% | $${avgPnl.padStart(7)}`);
    }
  }
  
  // 4. R:R DISTRIBUTION
  console.log('\n\n📊 DISTRIBUTION R:R (R-Multiples)');
  console.log('═'.repeat(80));
  
  const rBuckets: Record<string, number> = {
    '< -2R': 0,
    '-2R to -1R': 0,
    '-1R to 0R': 0,
    '0R to 1R': 0,
    '1R to 2R': 0,
    '2R to 3R': 0,
    '> 3R': 0,
  };
  
  let totalRR = 0;
  for (const result of allResults) {
    for (const trade of result.trades) {
      totalRR += trade.pnlR;
      if (trade.pnlR < -2) rBuckets['< -2R']++;
      else if (trade.pnlR < -1) rBuckets['-2R to -1R']++;
      else if (trade.pnlR < 0) rBuckets['-1R to 0R']++;
      else if (trade.pnlR < 1) rBuckets['0R to 1R']++;
      else if (trade.pnlR < 2) rBuckets['1R to 2R']++;
      else if (trade.pnlR < 3) rBuckets['2R to 3R']++;
      else rBuckets['> 3R']++;
    }
  }
  
  const totalTrades = allResults.reduce((sum, r) => sum + r.totalTrades, 0);
  const avgRR = totalRR / totalTrades;
  
  console.log(`\nAvg R-Multiple: ${avgRR.toFixed(3)}`);
  console.log('\nRange        | Trades  | %');
  console.log('─'.repeat(40));
  for (const [range, count] of Object.entries(rBuckets)) {
    const pct = (count / totalTrades * 100).toFixed(1);
    console.log(`${range.padEnd(12)} | ${count.toString().padStart(7)} | ${pct.padStart(5)}%`);
  }
  
  // 5. REGIME ANALYSIS
  console.log('\n\n📊 PERFORMANCE PAR RÉGIME HMM');
  console.log('═'.repeat(80));
  
  const regimeStats: Record<string, {trades: number, wins: number, pnl: number}> = {
    'BULL': {trades: 0, wins: 0, pnl: 0},
    'BEAR': {trades: 0, wins: 0, pnl: 0},
    'RANGING': {trades: 0, wins: 0, pnl: 0},
  };
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      if (regimeStats[trade.regime]) {
        regimeStats[trade.regime].trades++;
        regimeStats[trade.regime].pnl += trade.pnlNet;
        if (trade.outcome === 'WIN') regimeStats[trade.regime].wins++;
      }
    }
  }
  
  console.log('\nRegime  | Trades  | Wins  | WR     | Total P&L    | Avg/Trade');
  console.log('─'.repeat(70));
  for (const [regime, stats] of Object.entries(regimeStats)) {
    const wr = (stats.wins / stats.trades * 100).toFixed(1);
    const avg = (stats.pnl / stats.trades).toFixed(2);
    console.log(`${regime.padEnd(7)} | ${stats.trades.toString().padStart(7)} | ${stats.wins.toString().padStart(5)} | ${wr.padStart(6)}% | $${stats.pnl.toFixed(0).padStart(10)} | $${avg.padStart(7)}`);
  }
  
  // 6. SIGNALS ANALYSIS
  console.log('\n\n📊 PERFORMANCE PAR SIGNAL DE TREND');
  console.log('═'.repeat(80));
  
  const trendStats: Record<string, {trades: number, wins: number, pnl: number}> = {
    'LONG_BULL': {trades: 0, wins: 0, pnl: 0},
    'LONG_BEAR': {trades: 0, wins: 0, pnl: 0},
    'SHORT_BEAR': {trades: 0, wins: 0, pnl: 0},
    'SHORT_BULL': {trades: 0, wins: 0, pnl: 0},
  };
  
  for (const result of allResults) {
    for (const trade of result.trades) {
      const key = `${trade.signals.trend === 'BULL' ? 'LONG' : 'SHORT'}_${trade.regime}`;
      if (trendStats[key]) {
        trendStats[key].trades++;
        trendStats[key].pnl += trade.pnlNet;
        if (trade.outcome === 'WIN') trendStats[key].wins++;
      }
    }
  }
  
  console.log('\nSignal       | Trades  | Wins  | WR     | Total P&L    | Avg/Trade');
  console.log('─'.repeat(70));
  for (const [signal, stats] of Object.entries(trendStats)) {
    if (stats.trades > 0) {
      const wr = (stats.wins / stats.trades * 100).toFixed(1);
      const avg = (stats.pnl / stats.trades).toFixed(2);
      console.log(`${signal.padEnd(12)} | ${stats.trades.toString().padStart(7)} | ${stats.wins.toString().padStart(5)} | ${wr.padStart(6)}% | $${stats.pnl.toFixed(0).padStart(10)} | $${avg.padStart(7)}`);
    }
  }
}

analyze().catch(console.error);
