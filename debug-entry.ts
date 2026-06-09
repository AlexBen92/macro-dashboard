import { runBacktestV7 } from './src/lib/backtest-v7';
import { promises as fs } from 'fs';

async function main() {
  const data = JSON.parse(await fs.readFile('./data/BTCUSDT_H1.json', 'utf-8'));
  
  // Add debug logging
  console.log('Data points:', data.length);
  console.log('Testing with NO filters...');
  
  const result = runBacktestV7(data.slice(0, 500), 'BTCUSDT', {
    minRegimeScore: 0,  // Disable
    adxTrendThreshold: 0,
    minVolatility: 0,
    maxVolatility: 100,
    maxHoldBars: 1000,
  });
  
  console.log('Trades:', result.totalTrades);
}

main().catch(console.error);
