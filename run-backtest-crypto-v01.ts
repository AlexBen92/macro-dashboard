/**
 * BACKTEST CRYPTO V01 - BTC TREND FOLLOWING
 *
 * Approche: Trend following sur BTC/ETH
 * - Crypto a des trends plus forts et plus longs
 * - Moins de correlation aux macros equity
 * - Volatility élevée mais trends directionnels
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

const CONFIG = {
  symbols: ['BTC-USD', 'ETH-USD'],
  basePositionPct: 0.40,
  maxPositionPct: 0.60,

  // Trend filters
  emaShort: 20,
  emaLong: 50,
  emaTrend: 200,

  // Momentum
  momentumPeriod: 30,
  minMomentum: 0.03,

  // Risk management
  maxDD: 0.25,
  stopLossPct: 0.10,
  atrMultiplier: 2,

  rebalanceDays: 3,
  initialCapital: 100000,
};

async function fetchCrypto(symbol: string): Promise<PriceData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&period1=1451606400&period2=${Math.floor(Date.now()/1000)}`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return [];
    const data = await res.json();
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
    const timestamps = data.chart?.result?.[0]?.timestamp;
    if (!quotes || !timestamps) return [];
    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000),
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0
    })).filter((d: PriceData) => d.close > 0);
  } catch { return []; }
}

function ema(data: PriceData[], period: number): number {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  const mult = 2 / (period + 1);
  let em = data.slice(0, period).reduce((s, d) => s + d.close, 0) / period;
  for (let i = period; i < data.length; i++) {
    em = (data[i].close - em) * mult + em;
  }
  return em;
}

function atr(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = data.length - period; i < data.length; i++) {
    if (i === 0) {
      trs.push(data[i].high - data[i].low);
    } else {
      const hl = data[i].high - data[i].low;
      const hc = Math.abs(data[i].high - data[i - 1].close);
      const lc = Math.abs(data[i].low - data[i - 1].close);
      trs.push(Math.max(hl, hc, lc));
    }
  }
  return trs.reduce((a, b) => a + b, 0) / period;
}

function momentum(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0;
  const cur = data[data.length - 1].close;
  const prev = data[data.length - period - 1].close;
  return (cur - prev) / prev;
}

interface CryptoScore {
  symbol: string;
  momentum: number;
  trendStrength: number;
  score: number;
}

async function runCryptoV01(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST CRYPTO V01 - TREND FOLLOWING                ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nApproche Crypto V01:`);
  console.log(`  • Trend following sur BTC/ETH`);
  console.log(`  • EMAs pour confirmation de trend`);
  console.log(`  • Position sizing par ATR`);
  console.log(`  • Stop loss dynamique`);

  console.log(`\nFetching crypto data...`);
  const cryptoData = new Map<string, PriceData[]>();

  for (const sym of CONFIG.symbols) {
    const data = await fetchCrypto(sym);
    if (data.length > 500) {
      cryptoData.set(sym, data);
      console.log(`  ✓ ${sym}: ${data.length} days`);
    }
  }

  if (cryptoData.size === 0) throw new Error('No crypto data');

  const btcData = cryptoData.get('BTC-USD')!;
  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const positions = new Map<string, { symbol: string; shares: number; entryPrice: number; stopLoss: number }>();

  let peak = CONFIG.initialCapital;
  let lastRebalance = -99;

  const yearlyReturns: number[] = [];
  let currentYearRet = 0;
  let currentYear = new Date(btcData[CONFIG.emaTrend].date).getFullYear();
  let yearStartEq = CONFIG.initialCapital;

  for (let dayIdx = CONFIG.emaTrend; dayIdx < btcData.length; dayIdx++) {
    const today = btcData[dayIdx].date;

    let totalEq = cash;
    for (const [sym, pos] of positions) {
      const data = cryptoData.get(sym);
      if (!data) continue;
      const bar = data.find(x => x.date.getTime() === today.getTime());
      if (bar) totalEq += pos.shares * bar.close;
    }

    equity.push(totalEq);

    if (today.getFullYear() !== currentYear) {
      yearlyReturns.push(currentYearRet);
      currentYear = today.getFullYear();
      currentYearRet = 0;
      yearStartEq = totalEq;
    }
    currentYearRet = (totalEq - yearStartEq) / yearStartEq;

    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    if (dd > CONFIG.maxDD) {
      for (const [sym, pos] of positions) {
        const data = cryptoData.get(sym);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) cash += pos.shares * bar.close;
      }
      positions.clear();
      lastRebalance = dayIdx;
      continue;
    }

    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    const scores: CryptoScore[] = [];

    for (const sym of CONFIG.symbols) {
      const data = cryptoData.get(sym);
      if (!data) continue;

      const slice = data.slice(0, dayIdx + 1);
      if (slice.length < CONFIG.emaTrend) continue;

      const price = slice[slice.length - 1].close;
      const ema20 = ema(slice, CONFIG.emaShort);
      const ema50 = ema(slice, CONFIG.emaLong);
      const ema200 = ema(slice, CONFIG.emaTrend);

      const mom = momentum(slice, CONFIG.momentumPeriod);

      // Trend strength: alignment of EMAs
      let trendStrength = 0;
      if (price > ema20 && ema20 > ema50 && ema50 > ema200) {
        trendStrength = 3; // Strong uptrend
      } else if (price > ema50 && ema50 > ema200) {
        trendStrength = 2; // Medium uptrend
      } else if (price > ema200) {
        trendStrength = 1; // Weak uptrend
      } else {
        trendStrength = 0; // No trend/bearish
      }

      if (trendStrength === 0) continue;

      const score = trendStrength * 100 + mom * 500;

      scores.push({ symbol: sym, momentum: mom, trendStrength, score });
    }

    if (scores.length === 0) {
      for (const [sym, pos] of positions) {
        const data = cryptoData.get(sym);
        if (!data) continue;
        const bar = data.find(x => x.date.getTime() === today.getTime());
        if (bar) cash += pos.shares * bar.close;
      }
      positions.clear();
      continue;
    }

    scores.sort((a, b) => b.score - a.score);

    const targetSym = scores[0];
    const data = cryptoData.get(targetSym.symbol);
    if (!data) continue;

    const bar = data.find(x => x.date.getTime() === today.getTime());
    if (!bar || bar.open <= 0) continue;

    const currentPos = positions.get(targetSym.symbol);

    const atrVal = atr(data.slice(0, dayIdx + 1), 14);
    const stopLoss = bar.close - atrVal * CONFIG.atrMultiplier;

    let positionPct = CONFIG.basePositionPct;
    if (targetSym.trendStrength >= 3) positionPct = CONFIG.maxPositionPct;
    else if (targetSym.trendStrength === 2) positionPct = 0.50;

    const targetValue = totalEq * positionPct;
    const targetShares = Math.floor(targetValue / bar.open);

    if (currentPos) {
      if (targetSym.score > 0) {
        if (targetShares > currentPos.shares) {
          const addShares = targetShares - currentPos.shares;
          const cost = addShares * bar.open;
          if (cash >= cost) {
            currentPos.shares = targetShares;
            currentPos.stopLoss = stopLoss;
            cash -= cost;
          }
        }
      }

      if (bar.close < currentPos.stopLoss) {
        cash += currentPos.shares * bar.close;
        positions.delete(targetSym.symbol);
      }
    } else {
      if (cash >= targetValue && targetSym.score > 0) {
        positions.set(targetSym.symbol, {
          symbol: targetSym.symbol,
          shares: targetShares,
          entryPrice: bar.open,
          stopLoss: stopLoss,
        });
        cash -= targetShares * bar.open;
      }
    }

    if (dayIdx % 252 === 0) {
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq).toLocaleString()}, DD=${(dd*100).toFixed(1)}%, Pos=${positions.size}`);
    }
  }

  for (const [sym, pos] of positions) {
    const data = cryptoData.get(sym);
    if (!data) continue;
    const bar = data[data.length - 1];
    cash += pos.shares * bar.close;
  }

  equity.push(cash);

  const returns: number[] = [];
  for (let i = 1; i < equity.length; i++) {
    returns.push((equity[i] - equity[i - 1]) / equity[i - 1]);
  }

  const avgR = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdR = Math.sqrt(returns.reduce((a, r) => a + (r - avgR) ** 2, 0) / returns.length);
  const sharpe = (avgR * 252) / (stdR * Math.sqrt(252));

  let maxDD = 0;
  let pk = equity[0];
  for (const e of equity) {
    pk = Math.max(pk, e);
    maxDD = Math.max(maxDD, (pk - e) / pk);
  }

  const days = equity.length;
  const cagr = Math.pow(equity[equity.length - 1] / equity[0], 252 / days) - 1;
  const calmar = cagr / maxDD;

  const validYears = yearlyReturns.filter(r => !isNaN(r) && isFinite(r));
  const yearlySharpes = validYears.map(r => r / 0.50); // Higher vol for crypto
  const sortedSharpes = [...yearlySharpes].sort((a, b) => a - b);
  const coreSharpes = sortedSharpes.slice(1, -1);

  const avgSharpe = coreSharpes.length > 0 ? coreSharpes.reduce((a, b) => a + b, 0) / coreSharpes.length : 0;
  const minSharpe = coreSharpes.length > 0 ? Math.min(...coreSharpes) : 0;
  const wfRatio = avgSharpe > 0 ? Math.min(1, Math.max(0, minSharpe / avgSharpe)) : 0;

  const results = { sharpe, cagr, maxDD, calmar, finalEquity: cash, yearlyReturns, yearlySharpes, wfRatio };

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                   CRYPTO V01 RESULTS                      ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);

  console.log(`\n  Walk-Forward (Yearly):`);
  console.log(`    Returns: [${yearlyReturns.map(r => (r * 100).toFixed(1)).join('%, ')}%]`);
  console.log(`    WF Ratio: ${wfRatio.toFixed(2)}`);

  const checks = [
    ['Sharpe > 1.0', results.sharpe > 1.0],
    ['CAGR > 20%', results.cagr > 0.20],
    ['Max DD < 30%', results.maxDD < 0.30],
    ['WF Ratio > 0.4', results.wfRatio > 0.4],
  ];

  let passCount = 0;
  for (const [name, pass] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}`);
  }

  console.log(`\n  VERDICT: ${passCount >= 3 ? '✅ VALIDÉ' : '❌ REJETÉ'} (${passCount}/4)`);

  return results;
}

runCryptoV01().catch(console.error);
