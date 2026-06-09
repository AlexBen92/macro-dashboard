import { runBacktestV7 } from './src/lib/backtest-v7';
import { promises as fs } from 'fs';

async function main() {
  const data = JSON.parse(await fs.readFile('./data/BTCUSDT_H1.json', 'utf-8'));
  
  console.log('Testing with relaxed thresholds...');
  const result = runBacktestV7(data, 'BTCUSDT', {
    minRegimeScore: 0.2,  // Very low
    adxTrendThreshold: 20,
    minVolatility: 0.1,
    maxVolatility: 10,
  });
  
  console.log('Trades:', result.totalTrades);
  console.log('Win Rate:', result.winRate);
  console.log('PnL:', result.totalPnl);
  console.log('Trend Trades:', result.trendTrades);
  console.log('Range Trades:', result.rangeTrades);
}

main().catch(console.error);
