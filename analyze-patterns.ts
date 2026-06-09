import { promises as fs } from 'fs';

interface BacktestResult {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  sharpe: number;
  trades: any[];
  avgHoldBars: number;
  profitFactor: number;
}

async function main() {
  const resultsDir = './results-v6';
  const files = await fs.readdir(resultsDir);
  const resultFiles = files.filter(f => f.endsWith('_v6.json'));

  const winners: BacktestResult[] = [];
  const losers: BacktestResult[] = [];

  for (const file of resultFiles) {
    const content = await fs.readFile(`${resultsDir}/${file}`, 'utf-8');
    const result: BacktestResult = JSON.parse(content);

    if (result.totalPnl > 0) {
      winners.push(result);
    } else {
      losers.push(result);
    }
  }

  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  PATTERN ANALYSIS: WINNERS VS LOSERS                                        ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // BASIC STATS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('📊 BASIC STATISTICS');
  console.log('═'.repeat(80));

  const avgWinRate = winners.reduce((s, r) => s + r.winRate, 0) / winners.length;
  const avgLoserWinRate = losers.reduce((s, r) => s + r.winRate, 0) / losers.length;
  const avgTradesWin = winners.reduce((s, r) => s + r.totalTrades, 0) / winners.length;
  const avgTradesLose = losers.reduce((s, r) => s + r.totalTrades, 0) / losers.length;
  const avgHoldWin = winners.reduce((s, r) => s + r.avgHoldBars, 0) / winners.length;
  const avgHoldLose = losers.reduce((s, r) => s + r.avgHoldBars, 0) / losers.length;

  console.log(`Winners (${winners.length}): Avg WR ${(avgWinRate).toFixed(1)}%, Avg Trades ${avgTradesWin.toFixed(1)}, Avg Hold ${avgHoldWin.toFixed(1)} bars`);
  console.log(`Losers (${losers.length}):  Avg WR ${(avgLoserWinRate).toFixed(1)}%, Avg Trades ${avgTradesLose.toFixed(1)}, Avg Hold ${avgHoldLose.toFixed(1)} bars`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // ENTRY SIGNAL ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('📈 ENTRY SIGNAL ANALYSIS');
  console.log('═'.repeat(80));

  const winEntryBB: number[] = [];
  const winEntryRSI: number[] = [];
  const loseEntryBB: number[] = [];
  const loseEntryRSI: number[] = [];

  for (const r of winners) {
    for (const t of r.trades) {
      if (t.entryBB !== undefined) winEntryBB.push(t.entryBB);
      if (t.entryRSI !== undefined) winEntryRSI.push(t.entryRSI);
    }
  }

  for (const r of losers) {
    for (const t of r.trades) {
      if (t.entryBB !== undefined) loseEntryBB.push(t.entryBB);
      if (t.entryRSI !== undefined) loseEntryRSI.push(t.entryRSI);
    }
  }

  console.log(`Winners - Avg BB Position: ${winEntryBB.length ? (winEntryBB.reduce((a,b)=>a+b,0)/winEntryBB.length).toFixed(2) : 'N/A'} (sigma from middle)`);
  console.log(`Winners - Avg RSI at Entry: ${winEntryRSI.length ? (winEntryRSI.reduce((a,b)=>a+b,0)/winEntryRSI.length).toFixed(1) : 'N/A'}`);
  console.log(`Losers  - Avg BB Position: ${loseEntryBB.length ? (loseEntryBB.reduce((a,b)=>a+b,0)/loseEntryBB.length).toFixed(2) : 'N/A'} (sigma from middle)`);
  console.log(`Losers  - Avg RSI at Entry: ${loseEntryRSI.length ? (loseEntryRSI.reduce((a,b)=>a+b,0)/loseEntryRSI.length).toFixed(1) : 'N/A'}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // EXIT ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('📉 EXIT REASON ANALYSIS');
  console.log('═'.repeat(80));

  const winExits: Record<string, number> = {};
  const loseExits: Record<string, number> = {};

  for (const r of winners) {
    for (const t of r.trades) {
      winExits[t.exitReason] = (winExits[t.exitReason] || 0) + 1;
    }
  }

  for (const r of losers) {
    for (const t of r.trades) {
      loseExits[t.exitReason] = (loseExits[t.exitReason] || 0) + 1;
    }
  }

  console.log('Winners Exit Reasons:');
  for (const [reason, count] of Object.entries(winExits)) {
    console.log(`  ${reason}: ${count}`);
  }

  console.log('Losers Exit Reasons:');
  for (const [reason, count] of Object.entries(loseExits)) {
    console.log(`  ${reason}: ${count}`);
  }
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // SIGNAL COMBINATION ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('🎯 SIGNAL COMBINATION ANALYSIS');
  console.log('═'.repeat(80));

  let winBBOnly = 0, winRSIONly = 0, winBoth = 0, winNeither = 0;
  let loseBBOnly = 0, loseRSIONly = 0, loseBoth = 0, loseNeither = 0;

  for (const r of winners) {
    for (const t of r.trades) {
      if (t.bbSignal && t.rsiSignal) winBoth++;
      else if (t.bbSignal) winBBOnly++;
      else if (t.rsiSignal) winRSIONly++;
      else winNeither++;
    }
  }

  for (const r of losers) {
    for (const t of r.trades) {
      if (t.bbSignal && t.rsiSignal) loseBoth++;
      else if (t.bbSignal) loseBBOnly++;
      else if (t.rsiSignal) loseRSIONly++;
      else loseNeither++;
    }
  }

  console.log('Winners:');
  console.log(`  BB + RSI Both: ${winBoth} (${winBoth ? (winBoth/(winBoth+winBBOnly+winRSIONly+winNeither)*100).toFixed(1) : 0}%)`);
  console.log(`  BB Only: ${winBBOnly} (${winBBOnly ? (winBBOnly/(winBoth+winBBOnly+winRSIONly+winNeither)*100).toFixed(1) : 0}%)`);
  console.log(`  RSI Only: ${winRSIONly} (${winRSIONly ? (winRSIONly/(winBoth+winBBOnly+winRSIONly+winNeither)*100).toFixed(1) : 0}%)`);

  console.log('Losers:');
  console.log(`  BB + RSI Both: ${loseBoth} (${loseBoth ? (loseBoth/(loseBoth+loseBBOnly+loseRSIONly+loseNeither)*100).toFixed(1) : 0}%)`);
  console.log(`  BB Only: ${loseBBOnly} (${loseBBOnly ? (loseBBOnly/(loseBoth+loseBBOnly+loseRSIONly+loseNeither)*100).toFixed(1) : 0}%)`);
  console.log(`  RSI Only: ${loseRSIONly} (${loseRSIONly ? (loseRSIONly/(loseBoth+loseBBOnly+loseRSIONly+loseNeither)*100).toFixed(1) : 0}%)`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // HOLD TIME ANALYSIS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('⏱️  HOLD TIME DISTRIBUTION');
  console.log('═'.repeat(80));

  const winHolds = winners.flatMap(r => r.trades.map(t => t.holdBars));
  const loseHolds = losers.flatMap(r => r.trades.map(t => t.holdBars));

  const avgWinHold = winHolds.reduce((a,b)=>a+b,0) / winHolds.length;
  const avgLoseHold = loseHolds.reduce((a,b)=>a+b,0) / loseHolds.length;

  console.log(`Winners - Avg Hold: ${avgWinHold.toFixed(1)} bars, Min: ${Math.min(...winHolds)}, Max: ${Math.max(...winHolds)}`);
  console.log(`Losers  - Avg Hold: ${avgLoseHold.toFixed(1)} bars, Min: ${Math.min(...loseHolds)}, Max: ${Math.max(...loseHolds)}`);
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════════
  // INDIVIDUAL TRADE ANALYSIS FOR LOSERS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('═'.repeat(80));
  console.log('🔍 LOSING TRADES DETAIL');
  console.log('═'.repeat(80));

  for (const loser of losers) {
    console.log(`\n${loser.coin}:`);
    for (const t of loser.trades) {
      const pnl = t.pnlNet >= 0 ? `+$${t.pnlNet.toFixed(2)}` : `-$${Math.abs(t.pnlNet).toFixed(2)}`;
      const icon = t.pnlNet > 0 ? '✅' : '❌';
      console.log(`  ${icon} ${t.direction} | Entry: ${t.entryPrice.toFixed(2)} | Exit: ${t.exitPrice.toFixed(2)} | PnL: ${pnl} | Hold: ${t.holdBars} bars | BB: ${t.entryBB?.toFixed(2)} | RSI: ${t.entryRSI?.toFixed(1)} | Exit: ${t.exitReason}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // KEY INSIGHTS
  // ═══════════════════════════════════════════════════════════════════════════════

  console.log('\n');
  console.log('═'.repeat(80));
  console.log('💡 KEY INSIGHTS');
  console.log('═'.repeat(80));

  const rsiExtremesWin = winEntryRSI.filter(r => r < 25 || r > 75).length;
  const rsiExtremesLose = loseEntryRSI.filter(r => r < 25 || r > 75).length;

  console.log(`1. RSI Extremes (<25 or >75):`);
  console.log(`   Winners: ${rsiExtremesWin}/${winEntryRSI.length} entries (${(rsiExtremesWin/winEntryRSI.length*100).toFixed(1)}%)`);
  console.log(`   Losers: ${rsiExtremesLose}/${loseEntryRSI.length} entries (${(rsiExtremesLose/loseEntryRSI.length*100).toFixed(1)}%)`);

  const bbExtremesWin = winEntryBB.filter(b => Math.abs(b) > 2.5).length;
  const bbExtremesLose = loseEntryBB.filter(b => Math.abs(b) > 2.5).length;

  console.log(`\n2. BB Extremes (>2.5 sigma):`);
  console.log(`   Winners: ${bbExtremesWin}/${winEntryBB.length} entries (${(bbExtremesWin/winEntryBB.length*100).toFixed(1)}%)`);
  console.log(`   Losers: ${bbExtremesLose}/${loseEntryBB.length} entries (${(bbExtremesLose/loseEntryBB.length*100).toFixed(1)}%)`);

  const signalReversalsWin = Object.entries(winExits).find(([k]) => k === 'SIGNAL_REVERSAL')?.[1] || 0;
  const signalReversalsLose = Object.entries(loseExits).find(([k]) => k === 'SIGNAL_REVERSAL')?.[1] || 0;

  console.log(`\n3. Signal Reversal Exits (premature):`);
  console.log(`   Winners: ${signalReversalsWin} exits`);
  console.log(`   Losers: ${signalReversalsLose} exits`);

  const avgWinHoldFiltered = winHolds.filter(h => h < 5).length;
  const avgLoseHoldFiltered = loseHolds.filter(h => h < 5).length;

  console.log(`\n4. Quick Trades (<5 bars):`);
  console.log(`   Winners: ${avgWinHoldFiltered}/${winHolds.length} (${(avgWinHoldFiltered/winHolds.length*100).toFixed(1)}%)`);
  console.log(`   Losers: ${avgLoseHoldFiltered}/${loseHolds.length} (${(avgLoseHoldFiltered/loseHolds.length*100).toFixed(1)}%)`);
}

main().catch(console.error);
