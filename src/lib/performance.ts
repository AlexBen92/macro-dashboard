export interface TradeRecord {
  id: string;
  instrument: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stop: number;
  tp: number;
  exit: number | null;
  openedAt: string; // ISO
  closedAt: string | null; // ISO
  status: 'OPEN' | 'WIN' | 'LOSS' | 'BE';
  pnlR: number | null; // P&L in R-multiples
  notes?: string;
  signals?: string[]; // signal IDs that triggered this trade
}

export interface PerformanceMetrics {
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number; // 0-100
  avgWin: number; // in R
  avgLoss: number; // in R
  profitFactor: number;
  expectancy: number; // in R per trade
  maxDrawdown: number; // in R (negative)
  maxDrawdownPct: number; // 0-100 percentage of peak equity
  sharpeRolling: number; // annualized Sharpe over last 20 trades
  calmarRatio: number;
  currentStreak: number; // positive = wins, negative = losses
  equityCurve: number[]; // cumulative R values starting at 0
  drawdownCurve: number[]; // drawdown from peak at each point
  recentPnl: number[]; // last 20 trade pnlR values
}

export function calcPerformanceMetrics(trades: TradeRecord[]): PerformanceMetrics {
  const closed = trades.filter(t => t.status !== 'OPEN' && t.pnlR != null) as (TradeRecord & { pnlR: number })[];

  if (closed.length === 0) {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakEven: 0,
      winRate: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      expectancy: 0,
      maxDrawdown: 0,
      maxDrawdownPct: 0,
      sharpeRolling: 0,
      calmarRatio: 0,
      currentStreak: 0,
      equityCurve: [0],
      drawdownCurve: [0],
      recentPnl: [],
    };
  }

  const wins = closed.filter(t => t.pnlR > 0);
  const losses = closed.filter(t => t.pnlR < 0);
  const beCount = closed.filter(t => t.pnlR === 0).length;

  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlR, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnlR, 0) / losses.length) : 0;
  const grossWin = wins.reduce((a, t) => a + t.pnlR, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlR, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const expectancy = closed.reduce((a, t) => a + t.pnlR, 0) / closed.length;

  // Equity curve
  const equityCurve: number[] = [0];
  let running = 0;
  for (const t of closed) {
    running += t.pnlR;
    equityCurve.push(running);
  }

  // Drawdown curve
  const drawdownCurve: number[] = [0];
  let peak = 0;
  let maxDD = 0;
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) peak = equityCurve[i];
    const dd = equityCurve[i] - peak;
    drawdownCurve.push(dd);
    if (dd < maxDD) maxDD = dd;
  }

  // Max drawdown as percentage of peak equity (if peak > 0)
  const maxDDPct = peak > 0 ? (Math.abs(maxDD) / peak) * 100 : 0;

  // Rolling Sharpe (last 20 trades, annualized assuming ~250 trades/year)
  const recent20 = closed.slice(-20).map(t => t.pnlR);
  let sharpe = 0;
  if (recent20.length >= 4) {
    const mean = recent20.reduce((a, v) => a + v, 0) / recent20.length;
    const variance = recent20.reduce((a, v) => a + (v - mean) ** 2, 0) / recent20.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(250) : 0;
  }

  // Calmar ratio = annualized return / maxDD
  const annualizedR = expectancy * 250;
  const calmar = maxDD < 0 ? annualizedR / Math.abs(maxDD) : 0;

  // Current streak
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const isWin = closed[i].pnlR > 0;
    if (i === closed.length - 1) {
      streak = isWin ? 1 : -1;
    } else if (streak > 0 && isWin) {
      streak++;
    } else if (streak < 0 && !isWin && closed[i].pnlR <= 0) {
      streak--;
    } else {
      break;
    }
  }

  return {
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: beCount,
    winRate,
    avgWin,
    avgLoss,
    profitFactor,
    expectancy,
    maxDrawdown: maxDD,
    maxDrawdownPct: maxDDPct,
    sharpeRolling: sharpe,
    calmarRatio: calmar,
    currentStreak: streak,
    equityCurve,
    drawdownCurve,
    recentPnl: recent20,
  };
}

// Helper: generate a sample equity curve for demo purposes
export function generateDemoTrades(): TradeRecord[] {
  const instruments = ['BTC/USD', 'ETH/USD', 'NAS100', 'XAUUSD'];
  const trades: TradeRecord[] = [];
  const now = Date.now();
  // Simulate 30 closed trades
  const outcomes: Array<{ pnlR: number; status: TradeRecord['status'] }> = [
    { pnlR: 1.5, status: 'WIN' }, { pnlR: -1, status: 'LOSS' }, { pnlR: 2.1, status: 'WIN' },
    { pnlR: 1.2, status: 'WIN' }, { pnlR: -1, status: 'LOSS' }, { pnlR: 0, status: 'BE' },
    { pnlR: 3.0, status: 'WIN' }, { pnlR: -1, status: 'LOSS' }, { pnlR: 1.8, status: 'WIN' },
    { pnlR: 1.5, status: 'WIN' }, { pnlR: -1, status: 'LOSS' }, { pnlR: 2.4, status: 'WIN' },
    { pnlR: -1, status: 'LOSS' }, { pnlR: 1.1, status: 'WIN' }, { pnlR: -1, status: 'LOSS' },
    { pnlR: 2.0, status: 'WIN' }, { pnlR: 1.7, status: 'WIN' }, { pnlR: -1, status: 'LOSS' },
    { pnlR: 1.3, status: 'WIN' }, { pnlR: -1, status: 'LOSS' }, { pnlR: 2.5, status: 'WIN' },
    { pnlR: 0, status: 'BE' }, { pnlR: 1.9, status: 'WIN' }, { pnlR: -1, status: 'LOSS' },
    { pnlR: 1.6, status: 'WIN' }, { pnlR: 2.2, status: 'WIN' }, { pnlR: -1, status: 'LOSS' },
    { pnlR: 1.4, status: 'WIN' }, { pnlR: 1.8, status: 'WIN' }, { pnlR: -1, status: 'LOSS' },
  ];
  for (let i = 0; i < outcomes.length; i++) {
    const o = outcomes[i];
    const openedAt = new Date(now - (outcomes.length - i) * 24 * 3600 * 1000).toISOString();
    const closedAt = new Date(now - (outcomes.length - i - 1) * 24 * 3600 * 1000).toISOString();
    trades.push({
      id: `demo-${i}`,
      instrument: instruments[i % instruments.length],
      direction: i % 3 === 2 ? 'SHORT' : 'LONG',
      entry: 100,
      stop: 99,
      tp: 101.5,
      exit: 100 + o.pnlR,
      openedAt,
      closedAt,
      status: o.status,
      pnlR: o.pnlR,
    });
  }
  return trades;
}
