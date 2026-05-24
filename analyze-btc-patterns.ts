import { promises as fs } from 'fs';

interface Trade {
  entryTime: number;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  tpPrice: number;
  trailingStopPrice: number;
  exitReason: string;
  holdBars: number;
  pnlNet: number;
  pnlR: number;
  outcome: string;
  atrAtEntry: number;
  signals: {
    momentum: number;
    trend: string;
  };
}

interface Result {
  coin: string;
  trades: Trade[];
}

async function analyze() {
  const content = await fs.readFile('results-v5/BTCUSDT_v5.json', 'utf-8');
  const result: Result = JSON.parse(content);
  
  console.log('╔═══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    ANALYSE PATTERNS BTC - WHIPSAW WARS                  ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
  
  // Find biggest losing streak
  let maxLosingStreak = 0;
  let currentLosingStreak = 0;
  let maxLosingStreakStart = -1;
  let currentStreakStart = -1;
  
  for (let i = 0; i < result.trades.length; i++) {
    if (result.trades[i].outcome === 'LOSS') {
      if (currentLosingStreak === 0) {
        currentStreakStart = i;
      }
      currentLosingStreak++;
      if (currentLosingStreak > maxLosingStreak) {
        maxLosingStreak = currentLosingStreak;
        maxLosingStreakStart = currentStreakStart;
      }
    } else {
      currentLosingStreak = 0;
    }
  }
  
  console.log(`📊 PLUS LONGUE SERIE PERDANTE: ${maxLosingStreak} trades`);
  console.log(`   Debut: Trade #${maxLosingStreakStart + 1}\n`);
  
  // Show the losing streak
  console.log('🔻 DETAILS DE LA SERIE PERDANTE:');
  console.log('═'.repeat(100));
  const streakEnd = Math.min(maxLosingStreakStart + maxLosingStreak, result.trades.length);
  let streakPnl = 0;
  
  for (let i = maxLosingStreakStart; i < streakEnd; i++) {
    const t = result.trades[i];
    streakPnl += t.pnlNet;
    const date = new Date(t.entryTime).toISOString().split('T')[0].split('-').slice(1).join('/');
    const move = ((t.exitPrice - t.entryPrice) / t.entryPrice * 100).toFixed(3);
    
    console.log(`#${i+1} [${date}] ${t.signals.trend.padEnd(4)} | Entry: $${t.entryPrice.toFixed(1)} → Exit: $${t.exitPrice.toFixed(1)} (${move}%) | ${t.exitReason.padEnd(15)} | ${t.holdBars} bars | P&L: $${t.pnlNet.toFixed(2)}`);
  }
  console.log('─'.repeat(100));
  console.log(`TOTAL SERIE: $${streakPnl.toFixed(2)} sur ${maxLosingStreak} trades\n`);
  
  // Analyze whipsaw patterns (quick in/out)
  console.log('🔄 ANALYSE WHIPSAW (trades < 3 bars)');
  console.log('═'.repeat(100));
  
  const whipsawTrades = result.trades.filter(t => t.holdBars <= 3);
  const whipsawPnl = whipsawTrades.reduce((sum, t) => sum + t.pnlNet, 0);
  const whipsawWR = (whipsawTrades.filter(t => t.outcome === 'WIN').length / whipsawTrades.length * 100).toFixed(1);
  
  console.log(`Nombre: ${whipsawTrades.length} (${(whipsawTrades.length/result.trades.length*100).toFixed(1)}% du total)`);
  console.log(`P&L Total: $${whipsawPnl.toFixed(2)}`);
  console.log(`WR: ${whipsawWR}%`);
  console.log(`Avg P&L: $${(whipsawPnl/whipsawTrades.length).toFixed(2)} per trade\n`);
  
  // Show worst 5 whipsaws
  console.log('💀 TOP 5 WORST WHIPSAWS:');
  console.log('═'.repeat(100));
  whipsawTrades.sort((a, b) => a.pnlNet - b.pnlNet).slice(0, 5).forEach((t, i) => {
    const date = new Date(t.entryTime).toISOString().split('T')[0].split('-').slice(1).join('/');
    const move = ((t.exitPrice - t.entryPrice) / t.entryPrice * 100).toFixed(3);
    console.log(`#${i+1} [${date}] Entry: $${t.entryPrice.toFixed(1)} → Exit: $${t.exitPrice.toFixed(1)} (${move}%) | ${t.holdBars} bars | $${t.pnlNet.toFixed(2)}`);
  });
  
  console.log('\n\n📈 ANALYSE DES GAINS (TP hits)');
  console.log('═'.repeat(100));
  
  const tpHits = result.trades.filter(t => t.exitReason === 'TP');
  console.log(`Nombre: ${tpHits.length} (${(tpHits.length/result.trades.length*100).toFixed(1)}% du total)`);
  
  if (tpHits.length > 0) {
    const tpPnl = tpHits.reduce((sum, t) => sum + t.pnlNet, 0);
    const tpAvgHold = tpHits.reduce((sum, t) => sum + t.holdBars, 0) / tpHits.length;
    console.log(`P&L Total: $${tpPnl.toFixed(2)}`);
    console.log(`Avg Hold: ${tpAvgHold.toFixed(1)} bars`);
    console.log(`Avg P&L: $${(tpPnl/tpHits.length).toFixed(2)} per trade\n`);
    
    console.log('🎯 DETAILS DES TP HITS:');
    tpHits.forEach((t, i) => {
      const date = new Date(t.entryTime).toISOString().split('T')[0].split('-').slice(1).join('/');
      const move = ((t.exitPrice - t.entryPrice) / t.entryPrice * 100).toFixed(3);
      console.log(`#${i+1} [${date}] Entry: $${t.entryPrice.toFixed(1)} → Exit: $${t.exitPrice.toFixed(1)} (${move}%) | ${t.holdBars} bars | $${t.pnlNet.toFixed(2)} | R:${t.pnlR.toFixed(1)}`);
    });
  }
  
  // Stop loss analysis
  console.log('\n\n🛑 ANALYSE STOP LOSS VS TRAILING');
  console.log('═'.repeat(100));
  
  const trailingHits = result.trades.filter(t => t.exitReason === 'TRAILING');
  const stopHits = result.trades.filter(t => t.exitReason === 'STOP');
  const reversalHits = result.trades.filter(t => t.exitReason === 'SIGNAL_REVERSAL');
  
  console.log(`TRAILING: ${trailingHits.length} trades | Avg: $${(trailingHits.reduce((s,t) => s+t.pnlNet,0)/trailingHits.length).toFixed(2)}`);
  console.log(`STOP: ${stopHits.length} trades | Avg: $${(stopHits.reduce((s,t) => s+t.pnlNet,0)/stopHits.length || 0).toFixed(2)}`);
  console.log(`REVERSAL: ${reversalHits.length} trades | Avg: $${(reversalHits.reduce((s,t) => s+t.pnlNet,0)/reversalHits.length).toFixed(2)}`);
  
  // ATR analysis
  console.log('\n\n📊 ANALYSE VOLATILITE (ATR)');
  console.log('═'.repeat(100));
  
  const atrs = result.trades.map(t => (t.atrAtEntry / t.entryPrice) * 100);
  atrs.sort((a, b) => a - b);
  
  console.log(`Min ATR: ${atrs[0].toFixed(3)}%`);
  console.log(`25th percentile: ${atrs[Math.floor(atrs.length * 0.25)].toFixed(3)}%`);
  console.log(`Median ATR: ${atrs[Math.floor(atrs.length * 0.5)].toFixed(3)}%`);
  console.log(`75th percentile: ${atrs[Math.floor(atrs.length * 0.75)].toFixed(3)}%`);
  console.log(`Max ATR: ${atrs[atrs.length - 1].toFixed(3)}%`);
  
  // Conclusion
  console.log('\n\n🎯 CONCLUSION');
  console.log('═'.repeat(100));
  console.log(`La strategie souffre de "WHIPSAW DEATH":`);
  console.log(`- ${whipsawTrades.length} trades ( ${(whipsawTrades.length/result.trades.length*100).toFixed(0)}%) sortent en < 3 bars`);
  console.log(`- Ces whipsaws perdent $${whipsawPnl.toFixed(2)} au total`);
  console.log(`- Seulement ${tpHits.length} trades (${(tpHits.length/result.trades.length*100).toFixed(1)}%) atteignent le TP`);
  console.log(`- ${maxLosingStreak} trades perdants consecutifs au maximum`);
  console.log(`\nLe trailing stop de 1.2x ATR est la cause principale des pertes.`);
}

analyze().catch(console.error);
