import { promises as fs } from 'fs';
import { calculateEMA, calculateATR } from './src/lib/technical-utils';

interface BtCandle { t: number; o: number; h: number; l: number; c: number; v: number; }

async function main() {
  const data = await fs.readFile('data/BTCUSDT_H1.json', 'utf-8');
  const candles: BtCandle[] = JSON.parse(data);
  const closes = candles.map(c => c.c);
  
  console.log(`First 5 closes: ${closes.slice(0, 5).join(', ')}`);
  console.log(`Closes length: ${closes.length}`);
  console.log(`Any NaN? ${closes.some(c => isNaN(c))}`);
  
  const emaFast = calculateEMA(closes, 30);
  const emaSlow = calculateEMA(closes, 150);
  
  console.log(`EMA Fast length: ${emaFast.length}`);
  console.log(`EMA Slow length: ${emaSlow.length}`);
  console.log(`First EMA Fast (30-35): ${emaFast.slice(30, 35)}`);
  console.log(`First EMA Slow (150-155): ${emaSlow.slice(150, 155)}`);
  
  let longSignals = 0;
  let shortSignals = 0;
  
  for (let i = 200; i < 210; i++) {
    const trendFastAboveSlow = emaFast[i] > emaSlow[i];
    const fastAvg = closes.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10;
    const slowAvg = closes.slice(i - 40, i).reduce((a, b) => a + b, 0) / 40;
    const momentum = (fastAvg - slowAvg) / slowAvg;
    
    console.log(`i=${i}: trend=${trendFastAboveSlow}, fast=${fastAvg.toFixed(2)}, slow=${slowAvg.toFixed(2)}, mom=${momentum.toFixed(6)}`);
  }
}

main().catch(console.error);
