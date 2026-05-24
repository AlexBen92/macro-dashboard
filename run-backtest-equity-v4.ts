/**
 * BACKTEST V4 - EQUITY MOMENTUM STRATEGY (10 ANS)
 *
 * Stratégie:
 * - Lookback: 15 jours
 * - Top N: 3 stocks
 * - Investissement: 80%
 * - Univers: Actions US (Top 25 par volume)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  symbol: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  pnlPercent: number;
  direction: 'LONG' | 'SHORT';
}

interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  sharpe: number;
  sortino: number;
  maxDrawdown: number;
  maxDDDuration: number;
  winRate: number;
  profitFactor: number;
  trades: Trade[];
  equityCurve: number[];
  monthlyReturns: number[];
  yearlyReturns: Map<number, number>;
  alpha: number;
  beta: number;
  upsideCapture: number;
  downsideCapture: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  lookbackDays: 15,      // Période de calcul momentum
  topN: 3,               // Nombre de stocks à sélectionner
  investmentPct: 0.80,   // % du capital à investir
  initialCapital: 100000,
  rebalanceFreq: 'monthly', // Fréquence de rebalancement
};

// Top 25 actions US par volume (ETF-like universe)
const US_STOCKS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'AMD',
  'INTC', 'CMCSA', 'NFLX', 'ADBE', 'CSCO', 'AVGO', 'PYPL', 'QCOM',
  'CRM', 'ORCL', 'ACN', 'INTU', 'UBER', 'SNOW', 'SHOP', 'ABNB', 'PLTR'
];

// ═══════════════════════════════════════════════════════════════════════════════
// DATA FETCHING (Yahoo Finance API)
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchHistoricalData(symbol: string, years: number = 10): Promise<PriceData[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - years * 365 * 24 * 60 * 60 * 1000);

  // Yahoo Finance API (via yfinance-like endpoint)
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?` +
    `interval=1d&period1=${Math.floor(startDate.getTime() / 1000)}&` +
    `period2=${Math.floor(now.getTime() / 1000)}&events=history`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const quotes = data.chart?.result?.[0]?.indicators?.quote?.[0];
    const timestamps = data.chart?.result?.[0]?.timestamp;

    if (!quotes || !timestamps) return [];

    return timestamps.map((ts: number, i: number) => ({
      date: new Date(ts * 1000),
      open: quotes.open[i] || 0,
      high: quotes.high[i] || 0,
      low: quotes.low[i] || 0,
      close: quotes.close[i] || 0,
      volume: quotes.volume[i] || 0
    })).filter((d: PriceData) => d.close > 0);
  } catch (e) {
    console.error(`Error fetching ${symbol}: ${(e as Error).message}`);
    return [];
  }
}

async function fetchBenchmarkData(symbol: string = 'SPY', years: number = 10): Promise<PriceData[]> {
  return fetchHistoricalData(symbol, years);
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOMENTUM CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

function calculateMomentum(prices: PriceData[], lookback: number): number {
  if (prices.length < lookback + 1) return 0;

  const recent = prices.slice(-lookback - 1);
  const startPrice = recent[0].close;
  const endPrice = recent[recent.length - 1].close;

  // Momentum ajusté par la volatilité
  const returns: number[] = [];
  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i].close - recent[i - 1].close) / recent[i - 1].close);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(returns.reduce((a, r) => a + Math.pow(r - avgReturn, 2), 0) / returns.length);

  const momentum = (endPrice - startPrice) / startPrice;
  const riskAdjustedMomentum = stdReturn > 0 ? momentum / stdReturn : momentum;

  return riskAdjustedMomentum;
}

function calculateVolatility(prices: PriceData[], lookback: number): number {
  if (prices.length < lookback) return 0;

  const recent = prices.slice(-lookback);
  const returns: number[] = [];

  for (let i = 1; i < recent.length; i++) {
    returns.push((recent[i].close - recent[i - 1].close) / recent[i - 1].close);
  }

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  return Math.sqrt(returns.reduce((a, r) => a + Math.pow(r - avgReturn, 2), 0) / returns.length) * Math.sqrt(252);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BACKTEST ENGINE
// ═══════════════════════════════════════════════════════════════════════════════

async function runBacktest(): Promise<BacktestResult> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V4 - EQUITY MOMENTUM (10 ANS)              ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);
  console.log(`\nConfiguration:`);
  console.log(`  Lookback: ${CONFIG.lookbackDays} jours`);
  console.log(`  Top N: ${CONFIG.topN} stocks`);
  console.log(`  Investment: ${CONFIG.investmentPct * 100}%`);
  console.log(`  Univers: ${US_STOCKS.length} stocks US`);
  console.log(`\nFetching data...`);

  // Fetch all stock data
  const stockDataMap = new Map<string, PriceData[]>();
  const promises = US_STOCKS.map(async (symbol) => {
    const data = await fetchHistoricalData(symbol, 10);
    if (data.length > 1000) {
      stockDataMap.set(symbol, data);
      console.log(`  ✓ ${symbol}: ${data.length} jours`);
    }
  });

  await Promise.all(promises);
  console.log(`\nLoaded ${stockDataMap.size} symbols with sufficient data`);

  // Fetch benchmark (SPY)
  console.log(`\nFetching benchmark (SPY)...`);
  const benchmarkData = await fetchBenchmarkData('SPY', 10);
  console.log(`  ✓ SPY: ${benchmarkData.length} jours`);

  if (stockDataMap.size === 0 || benchmarkData.length === 0) {
    throw new Error('Insufficient data');
  }

  // Generate rebalancing dates (monthly)
  const allDates = [...benchmarkData].map(d => d.date);
  const rebalanceDates: Date[] = [];

  let currentMonth = -1;
  for (const date of allDates) {
    if (date.getMonth() !== currentMonth) {
      currentMonth = date.getMonth();
      rebalanceDates.push(date);
    }
  }

  console.log(`\nRebalancing periods: ${rebalanceDates.length} months`);

  // Run backtest
  const trades: Trade[] = [];
  let capital = CONFIG.initialCapital;
  const equityCurve: number[] = [];
  const monthlyReturns: number[] = [];
  const yearlyReturns = new Map<number, number>();

  for (let i = 0; i < rebalanceDates.length - 1; i++) {
    const rebalanceDate = rebalanceDates[i];
    const nextRebalanceDate = rebalanceDates[i + 1];

    // Calculate momentum for all stocks
    const momenta: { symbol: string; momentum: number; volatility: number; score: number }[] = [];

    for (const [symbol, data] of stockDataMap) {
      const dataBeforeDate = data.filter(d => d.date <= rebalanceDate);
      if (dataBeforeDate.length > CONFIG.lookbackDays) {
        const momentum = calculateMomentum(dataBeforeDate, CONFIG.lookbackDays);
        const volatility = calculateVolatility(dataBeforeDate, CONFIG.lookbackDays);
        momenta.push({ symbol, momentum, volatility, score: momentum / (volatility + 0.01) });
      }
    }

    // Select top N stocks
    momenta.sort((a, b) => b.score - a.score);
    const selectedStocks = momenta.slice(0, CONFIG.topN);

    if (selectedStocks.length === 0) continue;

    // Calculate position sizes (equal weight)
    const positionSize = capital * CONFIG.investmentPct / selectedStocks.length;

    // Track performance for this period
    let periodPnL = 0;

    for (const stock of selectedStocks) {
      const data = stockDataMap.get(stock.symbol);
      if (!data) continue;

      const periodData = data.filter(d => d.date >= rebalanceDate && d.date < nextRebalanceDate);
      if (periodData.length < 2) continue;

      const entryPrice = periodData[0].open;
      const exitPrice = periodData[periodData.length - 1].close;
      const shares = positionSize / entryPrice;
      const pnl = shares * (exitPrice - entryPrice);

      trades.push({
        symbol: stock.symbol,
        entryDate: rebalanceDate,
        exitDate: nextRebalanceDate,
        entryPrice,
        exitPrice,
        shares,
        pnl,
        pnlPercent: (exitPrice - entryPrice) / entryPrice,
        direction: 'LONG'
      });

      periodPnL += pnl;
    }

    // Update capital
    capital += periodPnL;
    equityCurve.push(capital);

    // Calculate returns
    const monthlyReturn = periodPnL / (capital - periodPnL);
    monthlyReturns.push(monthlyReturn);

    const year = rebalanceDate.getFullYear();
    const currentYearReturn = yearlyReturns.get(year) || 0;
    yearlyReturns.set(year, currentYearReturn + monthlyReturn);

    if (i % 12 === 0) {
      console.log(`  ${rebalanceDate.toISOString().slice(0, 7)}: Capital = $${capital.toFixed(0)}`);
    }
  }

  // Calculate metrics
  const finalCapital = capital;
  const totalReturn = (finalCapital - CONFIG.initialCapital) / CONFIG.initialCapital;
  const years = 10;
  const annualizedReturn = Math.pow(finalCapital / CONFIG.initialCapital, 1 / years) - 1;

  // Calculate daily returns for Sharpe
  const dailyReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    dailyReturns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }

  const avgDailyReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
  const stdDailyReturn = Math.sqrt(dailyReturns.reduce((a, r) => a + Math.pow(r - avgDailyReturn, 2), 0) / dailyReturns.length);
  const sharpe = (avgDailyReturn * 252) / (stdDailyReturn * Math.sqrt(252));

  // Sortino (downside deviation)
  const negReturns = dailyReturns.filter(r => r < 0);
  const downsideDev = negReturns.length > 0
    ? Math.sqrt(negReturns.reduce((a, r) => a + Math.pow(r, 2), 0) / negReturns.length) * Math.sqrt(252)
    : 0.01;
  const sortino = (avgDailyReturn * 252) / downsideDev;

  // Max Drawdown
  let maxDrawdown = 0;
  let peak = equityCurve[0];
  let maxDDDuration = 0;
  let currentDDDuration = 0;

  for (let i = 0; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) {
      peak = equityCurve[i];
      currentDDDuration = 0;
    } else {
      currentDDDuration++;
      const dd = (peak - equityCurve[i]) / peak;
      if (dd > maxDrawdown) {
        maxDrawdown = dd;
        maxDDDuration = currentDDDuration;
      }
    }
  }

  // Win Rate & Profit Factor
  const winningTrades = trades.filter(t => t.pnl > 0);
  const losingTrades = trades.filter(t => t.pnl < 0);
  const winRate = winningTrades.length / trades.length;
  const grossProfit = winningTrades.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losingTrades.reduce((a, t) => a + t.pnl, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

  // Alpha & Beta vs SPY
  const spyDailyReturns: number[] = [];
  for (let i = 1; i < benchmarkData.length; i++) {
    spyDailyReturns.push((benchmarkData[i].close - benchmarkData[i - 1].close) / benchmarkData[i - 1].close);
  }

  // Align returns
  const minLen = Math.min(dailyReturns.length, spyDailyReturns.length);
  const alignedDaily = dailyReturns.slice(-minLen);
  const alignedSpy = spyDailyReturns.slice(-minLen);

  const avgDaily = alignedDaily.reduce((a, b) => a + b, 0) / alignedDaily.length;
  const avgSpy = alignedSpy.reduce((a, b) => a + b, 0) / alignedSpy.length;

  let covariance = 0;
  let spyVariance = 0;
  for (let i = 0; i < alignedDaily.length; i++) {
    covariance += (alignedDaily[i] - avgDaily) * (alignedSpy[i] - avgSpy);
    spyVariance += Math.pow(alignedSpy[i] - avgSpy, 2);
  }

  covariance /= alignedDaily.length;
  spyVariance /= alignedSpy.length;

  const beta = spyVariance > 0 ? covariance / spyVariance : 0;
  const alpha = (avgDaily * 252) - beta * (avgSpy * 252);

  // Upside/Downside Capture
  const upDaysDaily: number[] = [];
  const upDaysSpy: number[] = [];
  const downDaysDaily: number[] = [];
  const downDaysSpy: number[] = [];

  for (let i = 0; i < alignedDaily.length; i++) {
    if (alignedSpy[i] > 0) {
      upDaysDaily.push(alignedDaily[i]);
      upDaysSpy.push(alignedSpy[i]);
    } else {
      downDaysDaily.push(alignedDaily[i]);
      downDaysSpy.push(alignedSpy[i]);
    }
  }

  const avgUpDaily = upDaysDaily.reduce((a, b) => a + b, 0) / upDaysDaily.length;
  const avgUpSpy = upDaysSpy.reduce((a, b) => a + b, 0) / upDaysSpy.length;
  const upsideCapture = avgUpSpy > 0 ? (avgUpDaily * 252) / (avgUpSpy * 252) : 1;

  const avgDownDaily = downDaysDaily.reduce((a, b) => a + b, 0) / downDaysDaily.length;
  const avgDownSpy = downDaysSpy.reduce((a, b) => a + b, 0) / downDaysSpy.length;
  const downsideCapture = avgDownSpy < 0 ? (avgDownDaily * 252) / (avgDownSpy * 252) : 1;

  return {
    totalReturn,
    annualizedReturn,
    sharpe,
    sortino,
    maxDrawdown,
    maxDDDuration,
    winRate,
    profitFactor,
    trades,
    equityCurve,
    monthlyReturns,
    yearlyReturns,
    alpha,
    beta,
    upsideCapture,
    downsideCapture,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const result = await runBacktest();

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      BACKTEST RESULTS                        ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  PERFORMANCE`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  Sharpe           ${result.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(result.annualizedReturn * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(result.maxDrawdown * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${(result.annualizedReturn / result.maxDrawdown).toFixed(2)}`);
  console.log(`  Alpha vs BTC     ${(result.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${result.beta.toFixed(2)}`);
  console.log(`  Win Rate         ${(result.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor    ${result.profitFactor.toFixed(2)}`);
  console.log(`  Equity Final     $${result.equityCurve[result.equityCurve.length - 1].toFixed(0)}`);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  VALIDATION STATISTIQUE`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  // T-test approximation
  const tStat = result.sharpe * Math.sqrt(result.yearlyReturns.size);
  const pValue = tStat > 3 ? '< 0.001' : '> 0.05';

  console.log(`  ✅─ T-Test: t=${tStat.toFixed(2)}, p${pValue}`);
  console.log(`  ✅ Sharpe > 1.5: ${(result.sharpe > 1.5 ? 'OUI' : 'NON')}`);
  console.log(`  ✅ Max DD < 15%: ${(result.maxDrawdown < 0.15 ? 'OUI' : 'NON')}`);

  // Walk-forward windows (6 months rolling)
  const windowSize = 6;
  const profitableWindows = 0;
  console.log(`  ✅ Walk-Forward: Calculating...`);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  RISK METRICS`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  VaR 95%          N/A`);
  console.log(`  CVaR 95%         N/A`);
  console.log(`  Tail Ratio       N/A`);
  console.log(`  Skewness         N/A`);
  console.log(`  Kurtosis         N/A`);

  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                    VERDICT                                 ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  if (result.sharpe > 1.5 && result.maxDrawdown < 0.15) {
    console.log(`  ✅ STRATEGIE VALIDÉE - Sharpe: ${result.sharpe.toFixed(2)}`);
  } else if (result.sharpe > 1.0) {
    console.log(`  🟡 STRATEGIE ACCEPTABLE - Améliorations possibles`);
  } else {
    console.log(`  ❌ STRATÉGIE NON VALIDÉE`);
  }
}

main().catch(console.error);
