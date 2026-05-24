import { promises as fs } from 'fs';
import { calculateEMA, calculateATR } from './src/lib/technical-utils';

interface BtCandle { t: number; o: number; h: number; l: number; c: number; v: number; }

async function main() {
  const data = await fs.readFile('data/BTCUSDT_H1.json', 'utf-8');
  // Data is stored as Binance kline arrays
  const klines: any[][] = JSON.parse(data);
  
  const candles: BtCandle[] = klines.map((k) => ({
    t: Number(k[0]),
    o: Number(k[1]),
    h: Number(k[2]),
    l: Number(k[3]),
    c: Number(k[4]),
    v: Number(k[5]),
  }));
  
  const closes = candles.map(c => c.c);
  
  console.log(`First 5 closes: ${closes.slice(0, 5).join(', ')}`);
  console.log(`Closes length: ${closes.length}`);
  console.log(`Any NaN? ${closes.some(c => isNaN(c))}`);
  
  const emaFast = calculateEMA(closes, 30);
  const emaSlow = calculateEMA(closes, 150);
  
  console.log(`EMA Fast length: ${emaFast.length}`);
  console.log(`EMA Slow length: ${emaSlow.length}`);
  console.log(`First EMA Fast (30-35): ${emaFast.slice(30, 35).map(v => v.toFixed(2)).join(', ')}`);
  console.log(`First EMA Slow (150-155): ${emaSlow.slice(150, 155).map(v => v.toFixed(2)).join(', ')}`);
  
  let longSignals = 0;
  let shortSignals = 0;
  
  for (let i = 200; i < 210; i++) {
    const trendFastAboveSlow = emaFast[i] > emaSlow[i];
    const fastAvg = closes.slice(i - 10, i).reduce((a, b) => a + b, 0) / 10;
    const slowAvg = closes.slice(i - 40, i).reduce((a, b) => a + b, 0) / 40;
    const momentum = (fastAvg - slowAvg) / slowAvg;
    
    console.log(`i=${i}: trend=${trendFastAboveSlow}, fast=${fastAvg.toFixed(2)}, slow=${slowAvg.toFixed(2)}, mom=${momentum.toFixed(6)}`);
    
    if (trendFastAboveSlow && momentum > -0.005) longSignals++;
    if (!trendFastAboveSlow && momentum < 0.005) shortSignals++;
  }
  
  console.log(`\nLong signals: ${longSignals}, Short signals: ${shortSignals}`);
}

main().catch(console.error);
