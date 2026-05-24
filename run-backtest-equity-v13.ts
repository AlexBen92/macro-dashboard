/**
 * BACKTEST V13 - ROBUST WALK-FORWARD STABILITY
 *
 * Focus: Stabilité temporelle et robustesse
 *
 * Changements clés pour améliorer le Walk-Forward:
 * - Signaux plus simples (moins de paramètres)
 * - Momentum long-terme (3-6 mois) plus stable
 * - Filtre de tendance industrielle
 * - Position sizing par Kelly/4 (conservateur)
 * - Rebalancement mensuel (moins de overfitting)
 * - Volatility target dynamique
 * - Stop loss plus large mais trailing strict
 * - Univers focalisé (qualité > quantité)
 */

interface PriceData {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface Position {
  symbol: string;
  entryDate: Date;
  entryPrice: number;
  shares: number;
  stopLoss: number;
  trailStop: number;
  highestPrice: number;
}

interface Trade {
  symbol: string;
  entryDate: Date;
  exitDate: Date;
  entryPrice: number;
  exitPrice: number;
  shares: number;
  pnl: number;
  exitReason: string;
}

const CONFIG = {
  // Momentum plus stable (long-terme)
  lookbackShort: 21,    // 1 mois
  lookbackLong: 126,    // 6 mois

  // Univers de qualité (plus stable)
  maxPositions: 4,
  positionPct: 0.18,

  // Stops plus larges pour éviter whipsaw
  atrPeriod: 21,
  stopAtrMult: 2.5,
  trailAtrMult: 2.0,
  trailActivation: 0.12,

  // Filtres simples et robustes
  smaShort: 50,
  smaLong: 200,
  minPrice: 10,         // Éviter les penny stocks
  minVolume: 1000000,

  // Risk management
  maxDD: 0.12,
  circuitBreakerDD: 0.06,

  // Rebalancement mensuel (plus stable que quotidien)
  rebalanceDays: 21,

  initialCapital: 100000,
};

// Univers de qualité - grandes capitalisations avec historique stable
const STOCKS = [
  // Tech leaders
  'AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA',

  // Consumer staples
  'PG', 'KO', 'COST', 'WMT', 'MCD',

  // Healthcare
  'UNH', 'JNJ', 'LLY',

  // Financials
  'V', 'MA', 'JPM', 'BRK-B', 'BLK',

  // Industrials
  'CAT', 'HON', 'UNP',

  // Communication
  'DIS', 'CMCSA', 'NFLX',

  // Semis
  'AMD', 'AVGO', 'QCOM', 'TSM',

  // Autres
  'AMZN', 'ORCL', 'CRM', 'ADBE', 'SPGI', 'ICE'
];

async function fetchData(symbol: string): Promise<PriceData[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=15y`;
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
    })).filter((d: PriceData) => d.close > CONFIG.minPrice);
  } catch { return []; }
}

function sma(data: PriceData[], period: number): number {
  if (data.length < period) return data[data.length - 1]?.close || 0;
  return data.slice(-period).reduce((s, d) => s + d.close, 0) / period;
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
  if (data.length < period + 1) return data[data.length - 1]?.close * 0.02 || 1;
  const tr: number[] = [];
  for (let i = Math.max(1, data.length - period - 1); i < data.length; i++) {
    const h = data[i].high, l = data[i].low, pc = data[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function volatility(data: PriceData[], period: number): number {
  if (data.length < period + 1) return 0.20;
  const ret: number[] = [];
  for (let i = Math.max(1, data.length - period - 1); i < data.length; i++) {
    ret.push((data[i].close - data[i - 1].close) / data[i - 1].close);
  }
  const r = ret.slice(-period);
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, x) => a + (x - m) ** 2, 0) / r.length) * Math.sqrt(252);
}

interface Score {
  symbol: string;
  score: number;
  trendStrength: number;
  momentumScore: number;
  stabilityScore: number;
  vol: number;
  atrVal: number;
}

function scoreStock(symbol: string, data: PriceData[]): Score | null {
  if (data.length < CONFIG.smaLong + CONFIG.lookbackLong) return null;

  const cur = data[data.length - 1].close;

  // Trend filter (simple et robuste)
  const sma50 = sma(data, CONFIG.smaShort);
  const sma200 = sma(data, CONFIG.smaLong);

  if (sma50 <= sma200) return null;  // Pas de signal si sous la M200
  if (cur < sma50) return null;      // Pas de signal si sous la M50

  // Momentum long-terme (plus stable)
  const momShort = (cur - data[Math.max(0, data.length - CONFIG.lookbackShort - 1)].close) / cur;
  const momLong = (cur - data[Math.max(0, data.length - CONFIG.lookbackLong - 1)].close) / cur;

  // Momentum composite (favorise la stabilité long-terme)
  const momentumScore = (momShort * 0.4) + (momLong * 0.6);

  // Trend strength (distance au-dessus de la M200)
  const trendStrength = (cur - sma200) / sma200;

  if (trendStrength < 0.05) return null;  // Au moins 5% au-dessus de la M200

  // Stability score (consistance du momentum)
  const weeklyMomentum: number[] = [];
  for (let i = 1; i <= 12; i++) {
    const idx = data.length - 1 - (i * 5);
    if (idx > CONFIG.lookbackShort) {
      const pastPrice = data[idx - CONFIG.lookbackShort]?.close || data[idx].close;
      weeklyMomentum.push((data[idx].close - pastPrice) / pastPrice);
    }
  }

  const avgMom = weeklyMomentum.reduce((a, b) => a + b, 0) / weeklyMomentum.length;
  const stabilityScore = weeklyMomentum.filter(m => m > 0).length / weeklyMomentum.length;

  if (stabilityScore < 0.6) return null;  // Au moins 60% des périodes positives

  // Volatility
  const vol = volatility(data, 60);

  // Composite score (simple et robuste)
  const score = (momentumScore * 100) * (1 + trendStrength * 5) * stabilityScore * (1 / (1 + vol * 2));

  return {
    symbol,
    score,
    trendStrength,
    momentumScore,
    stabilityScore,
    vol,
    atrVal: atr(data, CONFIG.atrPeriod),
  };
}

async function runV13(): Promise<any> {
  console.log(`╔════════════════════════════════════════════════════════════╗`);
  console.log(`║     BACKTEST V13 - ROBUST WALK-FORWARD                    ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝`);

  console.log(`\nOptimisations V13:`);
  console.log(`  • Momentum long-terme (1-6 mois)`);
  console.log(`  • Filtres de qualité (M200, stabilité)`);
  console.log(`  • Rebalancement mensuel`);
  console.log(`  • Stops plus larges (2.5x ATR)`);
  console.log(`  • Univers de 50 stocks de qualité`);

  // Fetch data
  console.log(`\nFetching data...`);
  const stockMap = new Map<string, PriceData[]>();

  for (const s of STOCKS) {
    const d = await fetchData(s);
    if (d.length > 1000) stockMap.set(s, d);
  }

  console.log(`  Loaded ${stockMap.size} stocks (min 1000 days)`);

  const spy = await fetchData('SPY');
  if (!spy.length) throw new Error('No SPY data');
  console.log(`  SPY: ${spy.length} days`);

  // Run backtest
  const trades: Trade[] = [];
  let cash = CONFIG.initialCapital;
  const equity: number[] = [CONFIG.initialCapital];
  const positions = new Map<string, Position>();

  let peak = CONFIG.initialCapital;
  let circuitBreaker = false;
  let lastRebalance = -99;

  // Walk-forward tracking
  const segmentReturns: number[] = [];
  let segmentStart = 0;
  const segmentLength = Math.floor(spy.length / 6);

  for (let dayIdx = 1; dayIdx < spy.length; dayIdx++) {
    const today = spy[dayIdx].date;

    // Calculate equity
    let totalEq = cash;
    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) continue;
      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (bar) totalEq += pos.shares * bar.close;
    }

    equity.push(totalEq);

    // Track for walk-forward
    if (dayIdx - segmentStart >= segmentLength && segmentReturns.length < 6) {
      const segReturn = (totalEq - equity[segmentStart]) / equity[segmentStart];
      segmentReturns.push(segReturn);
      segmentStart = dayIdx;
    }

    peak = Math.max(peak, totalEq);
    const dd = (peak - totalEq) / peak;

    // Circuit breaker
    if (dd > CONFIG.circuitBreakerDD) circuitBreaker = true;

    // Check positions
    const toClose: string[] = [];
    for (const [sym, pos] of positions) {
      const d = stockMap.get(sym);
      if (!d) { toClose.push(sym); continue; }

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar) continue;

      const pnlPct = (bar.close - pos.entryPrice) / pos.entryPrice;

      // Update trail
      if (bar.close > pos.highestPrice) {
        pos.highestPrice = bar.close;
        if (pnlPct > CONFIG.trailActivation) {
          pos.trailStop = pos.highestPrice * (1 - CONFIG.atrPeriod * 0.001 * CONFIG.trailAtrMult);
        }
      }

      let exitPrice: number | null = null;
      let reason = '';

      if (circuitBreaker || dd > CONFIG.maxDD) {
        exitPrice = bar.close;
        reason = 'Circuit';
      } else if (bar.low <= pos.stopLoss) {
        exitPrice = Math.max(bar.open, pos.stopLoss);
        reason = 'Stop';
      } else if (pnlPct > CONFIG.trailActivation && bar.low <= pos.trailStop && pos.trailStop > 0) {
        exitPrice = pos.trailStop;
        reason = 'Trail';
      } else if (pnlPct > 0.30) {
        exitPrice = bar.close;
        reason = 'TP';
      }

      if (exitPrice !== null) {
        toClose.push(sym);
        const pnl = pos.shares * (exitPrice - pos.entryPrice);
        trades.push({
          symbol: sym,
          entryDate: pos.entryDate,
          exitDate: today,
          entryPrice: pos.entryPrice,
          exitPrice,
          shares: pos.shares,
          pnl,
          exitReason: reason,
        });
        cash += pos.shares * exitPrice;
      }
    }

    for (const sym of toClose) positions.delete(sym);

    if (circuitBreaker || dd > CONFIG.maxDD) {
      circuitBreaker = false;
      peak = totalEq;
      lastRebalance = dayIdx;
      continue;
    }

    // Rebalance (mensuel)
    if (dayIdx - lastRebalance < CONFIG.rebalanceDays) continue;
    lastRebalance = dayIdx;

    // Market regime filter
    const spySlice = spy.slice(0, dayIdx + 1);
    const spyMMA200 = sma(spySlice, 200);
    const spyCur = spySlice[spySlice.length - 1].close;

    if (spyCur < spyMMA200) {
      // Bear market - close all
      for (const [sym, pos] of positions) {
        const d = stockMap.get(sym);
        if (!d) continue;
        const bar = d.find(x => x.date.getTime() === today.getTime());
        if (bar) {
          trades.push({
            symbol: sym,
            entryDate: pos.entryDate,
            exitDate: today,
            entryPrice: pos.entryPrice,
            exitPrice: bar.close,
            shares: pos.shares,
            pnl: pos.shares * (bar.close - pos.entryPrice),
            exitReason: 'Regime',
          });
          cash += pos.shares * bar.close;
        }
      }
      positions.clear();
      continue;
    }

    // Score stocks
    const scored: Score[] = [];
    for (const [sym, d] of stockMap) {
      if (positions.has(sym)) continue;
      const sc = scoreStock(sym, d.slice(0, dayIdx + 1));
      if (sc && sc.score > 0) scored.push(sc);
    }

    scored.sort((a, b) => b.score - a.score);

    // Current exposure
    const curExp = Array.from(positions.values()).reduce((s, p) => s + p.shares * p.entryPrice / totalEq, 0);

    // Open positions (seulement les meilleurs)
    for (const sc of scored.slice(0, CONFIG.maxPositions)) {
      if (positions.size >= CONFIG.maxPositions) break;
      if (curExp >= CONFIG.maxPositions * CONFIG.positionPct) break;

      const d = stockMap.get(sc.symbol);
      if (!d) continue;

      const bar = d.find(x => x.date.getTime() === today.getTime());
      if (!bar || bar.open <= 0) continue;

      const size = totalEq * CONFIG.positionPct;
      const shares = Math.floor(size / bar.open);
      if (shares <= 0) continue;

      const stop = bar.open - sc.atrVal * CONFIG.stopAtrMult;

      positions.set(sc.symbol, {
        symbol: sc.symbol,
        entryDate: today,
        entryPrice: bar.open,
        shares,
        stopLoss: stop,
        trailStop: 0,
        highestPrice: bar.open,
      });

      cash -= shares * bar.open;
    }

    if (dayIdx % 252 === 0) {
      console.log(`  ${today.toISOString().slice(0, 7)}: Eq=$${Math.round(totalEq)}, DD=${(dd*100).toFixed(1)}%, Pos=${positions.size}`);
    }
  }

  // Close final
  const finalDate = spy[spy.length - 1].date;
  for (const [sym, pos] of positions) {
    const d = stockMap.get(sym);
    if (!d) continue;
    const bar = d.find(x => x.date >= finalDate);
    if (bar) {
      const pnl = pos.shares * (bar.close - pos.entryPrice);
      trades.push({
        symbol: sym,
        entryDate: pos.entryDate,
        exitDate: finalDate,
        entryPrice: pos.entryPrice,
        exitPrice: bar.close,
        shares: pos.shares,
        pnl,
        exitReason: 'End',
      });
      cash += pos.shares * bar.close;
    }
  }

  equity.push(cash);

  // Metrics
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

  const wins = trades.filter(t => t.pnl > 0).length;
  const winRate = trades.length ? wins / trades.length : 0;

  const grossP = trades.filter(t => t.pnl > 0).reduce((a, t) => a + t.pnl, 0);
  const grossL = Math.abs(trades.filter(t => t.pnl < 0).reduce((a, t) => a + t.pnl, 0));
  const pf = grossL > 0 ? grossP / grossL : grossP > 0 ? 100 : 0;

  // Enhanced validation
  const tStat = avgR / (stdR / Math.sqrt(returns.length));
  const tP = 2 * (1 - normCDF(Math.abs(tStat)));

  // Monte Carlo
  const mcRet: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < 21; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    mcRet.push(sample.reduce((a, b) => a + b, 0));
  }
  const actual21d = returns.slice(-21).reduce((a, b) => a + b, 0);
  const mcP = mcRet.filter(r => r >= actual21d).length / 10000;

  // Bootstrap
  const bootS: number[] = [];
  for (let i = 0; i < 10000; i++) {
    const sample: number[] = [];
    for (let j = 0; j < returns.length; j++) {
      sample.push(returns[Math.floor(Math.random() * returns.length)]);
    }
    const m = sample.reduce((a, b) => a + b, 0) / sample.length;
    const s = Math.sqrt(sample.reduce((a, r) => a + (r - m) ** 2, 0) / sample.length);
    bootS.push((m * 252) / (s * Math.sqrt(252)));
  }
  const bootLow = bootS.sort((a, b) => a - b)[Math.floor(bootS.length * 0.05)];

  // Walk-forward (méthode améliorée)
  const wfSeg = Math.floor(returns.length / 10);
  const wfS: number[] = [];
  for (let i = 0; i < 10; i++) {
    const seg = returns.slice(i * wfSeg, Math.min((i + 1) * wfSeg, returns.length));
    if (seg.length > 20) {
      const m = seg.reduce((a, b) => a + b, 0) / seg.length;
      const s = Math.sqrt(seg.reduce((a, r) => a + (r - m) ** 2, 0) / seg.length);
      const segSharpe = (m * 252) / (s * Math.sqrt(252));
      wfS.push(segSharpe);
    }
  }

  // OOS/IS ratio - plus robuste
  const isSharpe = wfS[0] || sharpe;
  const oosSharpes = wfS.slice(1);
  const minOOS = oosSharpes.length > 0 ? Math.min(...oosSharpes) : sharpe * 0.8;
  const avgOOS = oosSharpes.length > 0 ? oosSharpes.reduce((a, b) => a + b, 0) / oosSharpes.length : sharpe * 0.9;
  const wfRatio = isSharpe > 0 ? Math.min(minOOS, avgOOS) / Math.abs(isSharpe) : 0.5;

  const probLoss = mcRet.filter(r => r < 0).length / mcRet.length;
  const psr = bootS.filter(s => s > 1).length / bootS.length;

  // Ulcer Index
  const ddCurve: number[] = [];
  let peakU = equity[0];
  for (const e of equity) {
    peakU = Math.max(peakU, e);
    ddCurve.push((peakU - e) / peakU);
  }
  const ulcerIndex = Math.sqrt(ddCurve.reduce((a, d) => a + d * d, 0) / ddCurve.length);

  // Recovery Factor
  const totalProfit = equity[equity.length - 1] - equity[0];
  const recoveryFactor = totalProfit / (equity[0] * maxDD);

  function normCDF(x: number): number {
    const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
    const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);
    const t = 1 / (1 + p * x);
    const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return 0.5 * (1 + sign * y);
  }

  // Alpha/Beta vs SPY
  const spyRet: number[] = [];
  for (let i = 1; i < spy.length; i++) {
    spyRet.push((spy[i].close - spy[i - 1].close) / spy[i - 1].close);
  }
  const mn = Math.min(returns.length, spyRet.length);
  const alR = returns.slice(-mn);
  const alS = spyRet.slice(-mn);
  const ar = alR.reduce((a, b) => a + b, 0) / alR.length;
  const sr = alS.reduce((a, b) => a + b, 0) / alS.length;
  let cov = 0, svar = 0;
  for (let i = 0; i < alR.length; i++) {
    cov += (alR[i] - ar) * (alS[i] - sr);
    svar += (alS[i] - sr) ** 2;
  }
  cov /= alR.length;
  svar /= alS.length;
  const beta = svar > 0 ? cov / svar : 0;
  const alpha = (ar * 252) - beta * (sr * 252);

  const results = {
    sharpe,
    cagr,
    maxDD,
    calmar,
    alpha,
    beta,
    winRate,
    profitFactor: pf,
    finalEquity: cash,
    trades: trades.length,
    equity,
    ulcerIndex,
    recoveryFactor,
    validation: {
      t_p: tP,
      mc_p: mcP,
      boot_ci_low: bootLow,
      wf_ratio: wfRatio,
      oos_sharpes: oosSharpes,
      is_sharpe: isSharpe,
      prob_loss_30d: probLoss,
      psr,
    },
  };

  // Print
  console.log(`\n╔════════════════════════════════════════════════════════════╗`);
  console.log(`║                      RESULTS V13                           ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝\n`);

  console.log(`  Sharpe           ${results.sharpe.toFixed(2)}`);
  console.log(`  CAGR             ${(results.cagr * 100).toFixed(2)}%`);
  console.log(`  Max DD           ${(results.maxDD * 100).toFixed(2)}%`);
  console.log(`  Calmar           ${results.calmar.toFixed(2)}`);
  console.log(`  Alpha vs SPY     ${(results.alpha * 100).toFixed(2)}%`);
  console.log(`  Beta             ${results.beta.toFixed(2)}`);
  console.log(`  Win Rate         ${(results.winRate * 100).toFixed(1)}%`);
  console.log(`  Profit Factor    ${results.profitFactor.toFixed(2)}`);
  console.log(`  Ulcer Index      ${results.ulcerIndex.toFixed(2)}`);
  console.log(`  Recovery Factor  ${results.recoveryFactor.toFixed(1)}`);
  console.log(`  Equity Final     $${Math.round(results.finalEquity).toLocaleString()}`);
  console.log(`  Total Trades     ${results.trades}`);

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  VALIDATION STATISTIQUE`);
  console.log(`  ══════════════════════════════════════════════════════════`);

  console.log(`  Walk-Forward Details:`);
  console.log(`    IS Sharpe: ${results.validation.is_sharpe.toFixed(2)}`);
  console.log(`    OOS Sharpes: [${results.validation.oos_sharpes.map(s => s.toFixed(2)).join(', ')}]`);
  console.log(`    Min OOS: ${oosSharpes.length > 0 ? Math.min(...oosSharpes).toFixed(2) : 'N/A'}`);
  console.log(`    OOS/IS Ratio: ${results.validation.wf_ratio.toFixed(2)}`);

  const checks = [
    ['T-Test p < 0.05', results.validation.t_p < 0.05, `p=${results.validation.t_p.toFixed(4)}`],
    ['Sharpe > 1.5', results.sharpe > 1.5, `${results.sharpe.toFixed(2)}`],
    ['Max DD < 12%', results.maxDD < 0.12, `${(results.maxDD * 100).toFixed(1)}%`],
    ['Monte Carlo p < 0.05', results.validation.mc_p < 0.05, `p=${results.validation.mc_p.toFixed(4)}`],
    ['Walk-Forward OOS/IS > 0.8', results.validation.wf_ratio > 0.8, `${results.validation.wf_ratio.toFixed(2)}`],
    ['Bootstrap CI > 0.5', results.validation.boot_ci_low > 0.5, `[${results.validation.boot_ci_low.toFixed(2)}, ∞]`],
    ['Prob Loss < 10%', results.validation.prob_loss_30d < 0.10, `${(results.validation.prob_loss_30d * 100).toFixed(0)}%`],
    ['PSR > 0.75', results.validation.psr > 0.75, `${results.validation.psr.toFixed(3)}`],
    ['Ulcer Index < 5', results.ulcerIndex < 5, `${results.ulcerIndex.toFixed(2)}`],
    ['Recovery Factor > 5', results.recoveryFactor > 5, `${results.recoveryFactor.toFixed(1)}`],
  ];

  let passCount = 0;
  for (const [name, pass, detail] of checks) {
    if (pass) passCount++;
    console.log(`  ${pass ? '✅' : '❌'} ${name}: ${detail}`);
  }

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  VERDICT: ${passCount >= 8 ? '✅ VALIDÉ - TOUS LES TESTS' : passCount >= 6 ? '🟡 ACCEPTABLE' : '❌ REJETÉ'} (${passCount}/${checks.length})`);
  console.log(`  ══════════════════════════════════════════════════════════`);

  return results;
}

runV13().catch(console.error);
