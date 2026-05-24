/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ADVANCED QUANTITATIVE METRICS MODULE — V4
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Métriques quantitatives avancées pour évaluation complète de performance.
 * Remplace les métriques basiques (WR, PF, Sharpe) par un panel académique.
 *
 * CATÉGORIES:
 *  1. Rendement: Total, CAGR, avg trade, expectancy
 *  2. Risque-Rendement: Sharpe, Sortino, Calmar, Omega, Tail Ratio
 *  3. Drawdown: Max DD, durée, avg DD, recovery factor, ulcer index
 *  4. Statistiques: Win rate, profit factor, payoff ratio, Kelly
 *  5. Distribution: Skewness, kurtosis, VaR, CVaR, consecutive losses
 *  6. Marché: Holding time, trades/month, fee drag, slippage
 *  7. Robustesse: Monte Carlo, walk-forward, sensibilité paramètres
 *
 * REFERENCES:
 *  - Sharpe, W.F. (1966). "Mutual Fund Performance." J. Business 39(1).
 *  - Sortino, F. & van der Meer, R. (1991). "Downside Risk." J. Portfolio Mgmt.
 *  - López de Prado, M. (2018). "Advances in Financial Machine Learning."
 *
 * INPUT/OUTPUT:
 *  Input:  trades[], equityCurve[]
 *  Output: AdvancedMetrics interface complet
 * ═══════════════════════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

export interface Trade {
  pnl: number;
  pnlR: number;           // PnL en multiples de R
  entryTime: number;
  exitTime: number;
  direction: 'LONG' | 'SHORT';
  outcome: 'WIN' | 'LOSS' | 'BE';
}

export interface EquityPoint {
  timestamp: number;
  equity: number;
}

export interface AdvancedMetrics {
  // === MÉTRIQUES DE RENDEMENT ===
  totalReturn: number;           // % rendement total
  cagr: number;                  // Compound Annual Growth Rate
  avgTradeReturn: number;        // Rendement moyen par trade en $
  expectancy: number;            // E[PnL] par trade

  // === MÉTRIQUES DE RISQUE-RENDEMENT ===
  sharpeRatio: number;           // (mean - rf) / std, annualisé √252
  sortinoRatio: number;          // (mean - rf) / downside_std
  calmarRatio: number;           // CAGR / MaxDrawdown%
  omegaRatio: number;            // P(gain > threshold) / P(loss > threshold)
  tailRatio: number;             // 95th percentile gain / 5th percentile loss

  // === MÉTRIQUES DE DRAWDOWN ===
  maxDrawdownPct: number;        // DD% maximal absolu
  maxDrawdownDuration: number;   // Durée du DD max en périodes
  avgDrawdownPct: number;        // DD% moyen sur tous les DDs
  recoveryFactor: number;        // Total PnL / MaxDrawdown $
  ulcerIndex: number;            // RMS des drawdowns

  // === MÉTRIQUES STATISTIQUES ===
  winRate: number;               // % trades gagnants
  profitFactor: number;          // GrossWin / GrossLoss
  payoffRatio: number;           // AvgWin / AvgLoss
  expectancyScore: number;       // Score en multiples R
  kellySizing: number;           // Kelly optimal calculé

  // === MÉTRIQUES DE DISTRIBUTION ===
  returnSkewness: number;        // Asymétrie
  returnKurtosis: number;        // Kurtosis excès
  valueAtRisk95: number;         // VaR 95% en $
  conditionalVaR95: number;      // CVaR/Expected Shortfall
  maxConsecutiveLosses: number;  // Série de pertes consécutives max

  // === MÉTRIQUES DE MARCHÉ ===
  avgHoldingTime: number;        // Durée moyenne trade en heures
  tradesPerMonth: number;        // Fréquence de trading
  feeDrag: number;               // % de PnL brut perdu en frais
  slippageEstimate: number;      // Estimation slippage

  // === MÉTRIQUES DE ROBUSTESSE ===
  monteCarloP5: number;          // Percentile 5 Monte Carlo
  monteCarloP50: number;         // Médiane Monte Carlo
  monteCarloP95: number;         // Percentile 95 Monte Carlo
  monteCarloMaxDD: number;       // DD max médian simulé
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CALCULATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcule toutes les métriques avancées d'un coup.
 *
 * @param trades - Liste des trades
 * @param equityCurve - Courbe d'equity (timestamp, equity)
 * @param initialCapital - Capital initial (défaut 10000)
 * @param riskFreeRate - Taux sans risque annualisé (défaut 5%)
 * @returns AdvancedMetrics complet
 */
export function computeAdvancedMetrics(
  trades: Trade[],
  equityCurve: EquityPoint[],
  initialCapital: number = 10000,
  riskFreeRate: number = 0.05
): AdvancedMetrics {
  // Validate inputs
  const validTrades = trades.filter(t => Number.isFinite(t.pnl));
  const validEquity = equityCurve.filter(e => Number.isFinite(e.equity));

  if (validEquity.length === 0) {
    return createZeroMetrics();
  }

  // Extract returns
  const returns: number[] = [];
  for (let i = 1; i < validEquity.length; i++) {
    const ret = (validEquity[i].equity - validEquity[i - 1].equity) / validEquity[i - 1].equity;
    if (Number.isFinite(ret)) {
      returns.push(ret);
    }
  }

  const finalEquity = validEquity[validEquity.length - 1].equity;
  const totalPnl = finalEquity - initialCapital;

  // Calculate metrics
  return {
    // === RENDEMENT ===
    totalReturn: (totalPnl / initialCapital) * 100,
    cagr: calculateCAGR(initialCapital, finalEquity, validEquity),
    avgTradeReturn: validTrades.length > 0 ? totalPnl / validTrades.length : 0,
    expectancy: calculateExpectancy(validTrades),

    // === RISQUE-RENDEMENT ===
    sharpeRatio: calculateSharpe(returns, riskFreeRate),
    sortinoRatio: calculateSortino(returns, riskFreeRate),
    calmarRatio: calculateCalmarRatio(
      calculateCAGR(initialCapital, finalEquity, validEquity),
      calculateMaxDrawdown(validEquity).pct
    ),
    omegaRatio: calculateOmegaRatio(returns, 0),
    tailRatio: calculateTailRatio(validTrades),

    // === DRAWDOWN ===
    maxDrawdownPct: calculateMaxDrawdown(validEquity).pct,
    maxDrawdownDuration: calculateMaxDrawdownDuration(validEquity),
    avgDrawdownPct: calculateAvgDrawdown(validEquity),
    recoveryFactor: totalPnl / Math.abs(calculateMaxDrawdown(validEquity).value),
    ulcerIndex: calculateUlcerIndex(validEquity.map(e => e.equity)),

    // === STATISTIQUES ===
    winRate: calculateWinRate(validTrades),
    profitFactor: calculateProfitFactor(validTrades),
    payoffRatio: calculatePayoffRatio(validTrades),
    expectancyScore: calculateExpectancyScore(validTrades),
    kellySizing: calculateKellyFromTrades(validTrades),

    // === DISTRIBUTION ===
    returnSkewness: calculateSkewness(returns),
    returnKurtosis: calculateKurtosis(returns),
    valueAtRisk95: calculateVaR(validTrades, 0.05),
    conditionalVaR95: calculateCVaR(validTrades, 0.05),
    maxConsecutiveLosses: calculateMaxConsecutiveLosses(validTrades),

    // === MARCHÉ ===
    avgHoldingTime: calculateAvgHoldingTime(validTrades),
    tradesPerMonth: calculateTradesPerMonth(validTrades, validEquity),
    feeDrag: 0,  // À calculer si fees disponibles
    slippageEstimate: 0,  // À calculer si données disponibles

    // === ROBUSTESSE ===
    monteCarloP5: 0,
    monteCarloP50: 0,
    monteCarloP95: 0,
    monteCarloMaxDD: 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// RETURN METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function calculateCAGR(
  initialCapital: number,
  finalEquity: number,
  equityCurve: EquityPoint[]
): number {
  if (initialCapital <= 0 || finalEquity <= 0 || equityCurve.length < 2) {
    return 0;
  }

  const start = equityCurve[0].timestamp;
  const end = equityCurve[equityCurve.length - 1].timestamp;
  const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);

  if (years <= 0) return 0;

  const cagr = (Math.pow(finalEquity / initialCapital, 1 / years) - 1) * 100;
  return cagr;
}

export function calculateExpectancy(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  return trades.reduce((a, t) => a + t.pnl, 0) / trades.length;
}

// ─────────────────────────────────────────────────────────────────────────────
// RISK-RETURN METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function calculateSharpe(returns: number[], riskFreeRate: number = 0.05): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, r) => a + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);

  if (std === 0) return 0;

  // Annualize (assume hourly data → 252 trading days * 24 hours)
  const annualizedMean = mean * 252 * 24;
  const annualizedStd = std * Math.sqrt(252 * 24);

  return (annualizedMean - riskFreeRate) / annualizedStd;
}

export function calculateSortino(
  returns: number[],
  riskFreeRate: number = 0.05,
  targetReturn: number = 0
): number {
  if (returns.length < 2) return 0;

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;

  // Downside deviation: only consider returns below target
  const downsideReturns = returns.filter(r => r < targetReturn);
  if (downsideReturns.length === 0) return mean > 0 ? 999 : 0;

  const downsideVariance = downsideReturns.reduce((a, r) => a + (r - targetReturn) ** 2, 0) / downsideReturns.length;
  const downsideStd = Math.sqrt(downsideVariance);

  if (downsideStd === 0) return mean > 0 ? 999 : 0;

  // Annualize
  const annualizedMean = mean * 252 * 24;
  const annualizedDownsideStd = downsideStd * Math.sqrt(252 * 24);

  return (annualizedMean - riskFreeRate / (252 * 24)) / annualizedDownsideStd;
}

export function calculateCalmarRatio(cagr: number, maxDrawdownPct: number): number {
  if (maxDrawdownPct <= 0) return cagr > 0 ? 999 : 0;
  return cagr / Math.abs(maxDrawdownPct);
}

export function calculateOmegaRatio(returns: number[], threshold: number = 0): number {
  if (returns.length === 0) return 0;

  const gains = returns.filter(r => r > threshold).reduce((a, r) => a + r - threshold, 0);
  const losses = Math.abs(returns.filter(r => r < threshold).reduce((a, r) => a + r - threshold, 0));

  return losses > 0 ? gains / losses : gains > 0 ? 999 : 0;
}

export function calculateTailRatio(trades: Trade[]): number {
  const pnls = trades.map(t => t.pnl).filter(p => Number.isFinite(p));
  if (pnls.length < 10) return 0;

  pnls.sort((a, b) => a - b);
  const n = pnls.length;

  const percentile95Gain = pnls[Math.floor(0.95 * n)];
  const percentile5Loss = Math.abs(pnls[Math.floor(0.05 * n)]);

  return percentile5Loss > 0 ? percentile95Gain / percentile5Loss : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// DRAWDOWN METRICS
// ─────────────────────────────────────────────────────────────────────────────

export interface DrawdownResult {
  value: number;     // Maximum drawdown in currency
  pct: number;       // Maximum drawdown in percentage
  duration: number;  // Duration in periods
}

export function calculateMaxDrawdown(equityCurve: EquityPoint[]): DrawdownResult {
  if (equityCurve.length === 0) {
    return { value: 0, pct: 0, duration: 0 };
  }

  let peak = equityCurve[0].equity;
  let maxDD = 0;
  let maxDDPct = 0;

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity;
    }
    const dd = peak - point.equity;
    const ddPct = (dd / peak) * 100;

    if (dd > maxDD) {
      maxDD = dd;
      maxDDPct = ddPct;
    }
  }

  return { value: maxDD, pct: maxDDPct, duration: 0 };
}

export function calculateMaxDrawdownDuration(equityCurve: EquityPoint[]): number {
  if (equityCurve.length === 0) return 0;

  let peak = equityCurve[0].equity;
  let peakTime = equityCurve[0].timestamp;
  let maxDuration = 0;
  let inDrawdown = false;

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity;
      peakTime = point.timestamp;
      inDrawdown = false;
    } else {
      inDrawdown = true;
      const duration = point.timestamp - peakTime;
      if (duration > maxDuration) {
        maxDuration = duration;
      }
    }
  }

  // Convert to hours
  return maxDuration / (60 * 60 * 1000);
}

export function calculateAvgDrawdown(equityCurve: EquityPoint[]): number {
  if (equityCurve.length < 2) return 0;

  const drawdowns: number[] = [];
  let peak = equityCurve[0].equity;

  for (const point of equityCurve) {
    if (point.equity > peak) {
      peak = point.equity;
    } else {
      const dd = ((peak - point.equity) / peak) * 100;
      if (dd > 0.01) {  // Minimum 0.01% to qualify
        drawdowns.push(dd);
      }
    }
  }

  return drawdowns.length > 0 ? drawdowns.reduce((a, b) => a + b, 0) / drawdowns.length : 0;
}

export function calculateUlcerIndex(equityCurve: number[]): number {
  if (equityCurve.length < 2) return 0;

  let peak = equityCurve[0];
  const squaredDrawdowns: number[] = [];

  for (const equity of equityCurve) {
    if (equity > peak) {
      peak = equity;
    } else {
      const dd = ((peak - equity) / peak) * 100;
      squaredDrawdowns.push(dd * dd);
    }
  }

  if (squaredDrawdowns.length === 0) return 0;
  return Math.sqrt(squaredDrawdowns.reduce((a, b) => a + b, 0) / squaredDrawdowns.length);
}

// ─────────────────────────────────────────────────────────────────────────────
// STATISTICAL METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function calculateWinRate(trades: Trade[]): number {
  if (trades.length === 0) return 0;
  const wins = trades.filter(t => t.outcome === 'WIN').length;
  return (wins / trades.length) * 100;
}

export function calculateProfitFactor(trades: Trade[]): number {
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');

  const grossWin = wins.reduce((a, t) => a + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnl, 0));

  return grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
}

export function calculatePayoffRatio(trades: Trade[]): number {
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');

  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnl, 0)) / losses.length : 1;

  return avgLoss > 0 ? avgWin / avgLoss : 0;
}

export function calculateExpectancyScore(trades: Trade[]): number {
  const winRate = calculateWinRate(trades) / 100;
  const avgWin = trades.filter(t => t.outcome === 'WIN').reduce((a, t) => a + t.pnlR, 0) /
    (trades.filter(t => t.outcome === 'WIN').length || 1);
  const avgLoss = Math.abs(trades.filter(t => t.outcome === 'LOSS').reduce((a, t) => a + t.pnlR, 0)) /
    (trades.filter(t => t.outcome === 'LOSS').length || 1);

  return winRate * avgWin - (1 - winRate) * avgLoss;
}

export function calculateKellyFromTrades(trades: Trade[]): number {
  const winRate = calculateWinRate(trades) / 100;
  const avgWin = trades.filter(t => t.outcome === 'WIN').reduce((a, t) => a + t.pnl, 0) /
    (trades.filter(t => t.outcome === 'WIN').length || 1);
  const avgLoss = Math.abs(trades.filter(t => t.outcome === 'LOSS').reduce((a, t) => a + t.pnl, 0)) /
    (trades.filter(t => t.outcome === 'LOSS').length || 1);

  if (avgLoss <= 0) return 0;

  return (winRate * avgWin - (1 - winRate) * avgLoss) / avgLoss;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISTRIBUTION METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function calculateSkewness(data: number[]): number {
  if (data.length < 3) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, v) => a + (v - mean) ** 2, 0) / data.length;
  const std = Math.sqrt(variance);

  if (std === 0) return 0;

  const skew = data.reduce((a, v) => a + ((v - mean) / std) ** 3, 0) / data.length;
  return skew;
}

export function calculateKurtosis(data: number[]): number {
  if (data.length < 4) return 0;

  const mean = data.reduce((a, b) => a + b, 0) / data.length;
  const variance = data.reduce((a, v) => a + (v - mean) ** 2, 0) / data.length;
  const std = Math.sqrt(variance);

  if (std === 0) return 0;

  const kurt = data.reduce((a, v) => a + ((v - mean) / std) ** 4, 0) / data.length - 3;
  return kurt;
}

export function calculateVaR(trades: Trade[], alpha: number = 0.05): number {
  const pnls = trades.map(t => t.pnl).filter(p => Number.isFinite(p));
  if (pnls.length === 0) return 0;

  pnls.sort((a, b) => a - b);
  const index = Math.floor(alpha * pnls.length);
  return pnls[index];
}

export function calculateCVaR(trades: Trade[], alpha: number = 0.05): number {
  const pnls = trades.map(t => t.pnl).filter(p => Number.isFinite(p));
  if (pnls.length === 0) return 0;

  pnls.sort((a, b) => a - b);
  const cutoff = Math.floor(alpha * pnls.length);
  const tail = pnls.slice(0, cutoff);

  return tail.length > 0 ? tail.reduce((a, b) => a + b, 0) / tail.length : 0;
}

export function calculateMaxConsecutiveLosses(trades: Trade[]): number {
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (const trade of trades) {
    if (trade.outcome === 'LOSS') {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 0;
    }
  }

  return maxConsecutive;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARKET METRICS
// ─────────────────────────────────────────────────────────────────────────────

export function calculateAvgHoldingTime(trades: Trade[]): number {
  if (trades.length === 0) return 0;

  const holdingTimes = trades.map(t => t.exitTime - t.entryTime).filter(t => t > 0);
  if (holdingTimes.length === 0) return 0;

  const avgMs = holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length;
  return avgMs / (60 * 60 * 1000);  // Convert to hours
}

export function calculateTradesPerMonth(trades: Trade[], equityCurve: EquityPoint[]): number {
  if (trades.length === 0 || equityCurve.length < 2) return 0;

  const start = equityCurve[0].timestamp;
  const end = equityCurve[equityCurve.length - 1].timestamp;
  const months = (end - start) / (30.44 * 24 * 60 * 60 * 1000);

  return months > 0 ? trades.length / months : 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONTE CARLO SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

export interface MonteCarloResult {
  percentiles: {
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  };
  maxDrawdowns: {
    p5: number;
    p50: number;
    p95: number;
  };
  ruinProbability: number;
  chartData: number[][];  // Sample equity curves for visualization
}

/**
 * Simule Monte Carlo sur les trades (bootstrap).
 *
 * @param trades - Historique des trades
 * @param nSimulations - Nombre de simulations (défaut 1000)
 * @param initialCapital - Capital initial
 * @returns Résultats Monte Carlo
 */
export function monteCarloSimulation(
  trades: Trade[],
  nSimulations: number = 1000,
  initialCapital: number = 10000
): MonteCarloResult {
  if (trades.length === 0) {
    return {
      percentiles: { p5: 0, p25: 0, p50: 0, p75: 0, p95: 0 },
      maxDrawdowns: { p5: 0, p50: 0, p95: 0 },
      ruinProbability: 0,
      chartData: [],
    };
  }

  const tradePnls = trades.map(t => t.pnl);
  const finalEquities: number[] = [];
  const maxDrawdowns: number[] = [];
  const ruinCount = 0;  // Capital < 50% initial
  const sampleEquityCurves: number[][] = [];

  for (let sim = 0; sim < nSimulations; sim++) {
    // Bootstrap: random sampling with replacement
    const shuffledTrades: number[] = [];
    for (let i = 0; i < trades.length; i++) {
      const randomIndex = Math.floor(Math.random() * trades.length);
      shuffledTrades.push(tradePnls[randomIndex]);
    }

    // Calculate equity curve
    let equity = initialCapital;
    const equityCurve: number[] = [equity];
    let peak = equity;
    let maxDD = 0;

    for (const pnl of shuffledTrades) {
      equity += pnl;
      equityCurve.push(equity);

      if (equity > peak) peak = equity;
      const dd = (peak - equity) / peak;
      if (dd > maxDD) maxDD = dd;
    }

    finalEquities.push(equity);
    maxDrawdowns.push(maxDD);

    if (sim < 100) {  // Store first 100 for visualization
      sampleEquityCurves.push(equityCurve);
    }
  }

  // Calculate percentiles
  finalEquities.sort((a, b) => a - b);
  maxDrawdowns.sort((a, b) => a - b);

  const n = finalEquities.length;
  const percentiles = {
    p5: finalEquities[Math.floor(0.05 * n)],
    p25: finalEquities[Math.floor(0.25 * n)],
    p50: finalEquities[Math.floor(0.50 * n)],
    p75: finalEquities[Math.floor(0.75 * n)],
    p95: finalEquities[Math.floor(0.95 * n)],
  };

  const drawdownPercentiles = {
    p5: maxDrawdowns[Math.floor(0.05 * n)],
    p50: maxDrawdowns[Math.floor(0.50 * n)],
    p95: maxDrawdowns[Math.floor(0.95 * n)],
  };

  const ruinProbability = finalEquities.filter(e => e < initialCapital * 0.5).length / nSimulations;

  return {
    percentiles,
    maxDrawdowns: drawdownPercentiles,
    ruinProbability,
    chartData: sampleEquityCurves,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function createZeroMetrics(): AdvancedMetrics {
  return {
    totalReturn: 0,
    cagr: 0,
    avgTradeReturn: 0,
    expectancy: 0,
    sharpeRatio: 0,
    sortinoRatio: 0,
    calmarRatio: 0,
    omegaRatio: 0,
    tailRatio: 0,
    maxDrawdownPct: 0,
    maxDrawdownDuration: 0,
    avgDrawdownPct: 0,
    recoveryFactor: 0,
    ulcerIndex: 0,
    winRate: 0,
    profitFactor: 0,
    payoffRatio: 0,
    expectancyScore: 0,
    kellySizing: 0,
    returnSkewness: 0,
    returnKurtosis: 0,
    valueAtRisk95: 0,
    conditionalVaR95: 0,
    maxConsecutiveLosses: 0,
    avgHoldingTime: 0,
    tradesPerMonth: 0,
    feeDrag: 0,
    slippageEstimate: 0,
    monteCarloP5: 0,
    monteCarloP50: 0,
    monteCarloP95: 0,
    monteCarloMaxDD: 0,
  };
}

/**
 * Formate les métriques pour affichage.
 */
export function formatMetrics(metrics: AdvancedMetrics): string {
  return `
=== PERFORMANCE SUMMARY ===
Total Return: ${metrics.totalReturn.toFixed(2)}%
CAGR: ${metrics.cagr.toFixed(2)}%
Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)}
Sortino Ratio: ${metrics.sortinoRatio.toFixed(2)}
Calmar Ratio: ${metrics.calmarRatio.toFixed(2)}

=== DRAWDOWN ===
Max DD: ${metrics.maxDrawdownPct.toFixed(2)}%
Max DD Duration: ${metrics.maxDrawdownDuration.toFixed(0)} hours
Ulcer Index: ${metrics.ulcerIndex.toFixed(2)}
Recovery Factor: ${metrics.recoveryFactor.toFixed(2)}

=== TRADE STATS ===
Win Rate: ${metrics.winRate.toFixed(1)}%
Profit Factor: ${metrics.profitFactor.toFixed(2)}
Payoff Ratio: ${metrics.payoffRatio.toFixed(2)}
Expectancy: $${metrics.expectancy.toFixed(2)}
Kelly Optimal: ${(metrics.kellySizing * 100).toFixed(1)}%

=== RISK ===
VaR 95%: $${metrics.valueAtRisk95.toFixed(2)}
CVaR 95%: $${metrics.conditionalVaR95.toFixed(2)}
Max Consecutive Losses: ${metrics.maxConsecutiveLosses}
Skewness: ${metrics.returnSkewness.toFixed(2)}
Kurtosis: ${metrics.returnKurtosis.toFixed(2)}
`;
}
