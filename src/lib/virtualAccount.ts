// Virtual paper trading account — 10 000$ initial, 0.04% fees each side

export const INITIAL_BALANCE = 10_000; // $
export const FEE_RATE = 0.0004;         // 0.04% per side
export const RISK_PER_TRADE_PCT = 0.01; // 1% risk per trade default

export type AccountType = 'crypto' | 'ftmo';

export interface VirtualTrade {
  id: string;
  account: AccountType;
  instrument: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stop: number;
  tp: number;
  qty: number;           // units / contracts
  riskUsd: number;       // $ risked (after fees)
  feeEntry: number;      // $ fee at open
  feeExit: number;       // $ fee at close (estimated at open, final at close)
  openedAt: string;      // ISO
  closedAt: string | null;
  exit: number | null;
  status: 'OPEN' | 'WIN' | 'LOSS' | 'BE';
  pnlGross: number | null;  // $ before fees
  pnlNet: number | null;    // $ after fees
  pnlR: number | null;      // R-multiple
  balanceAfter: number | null; // account balance after close
  signals?: string[];
  notes?: string;
}

export interface VirtualAccount {
  type: AccountType;
  initialBalance: number;
  balance: number;        // current balance (updated on close)
  equity: number;         // balance + unrealised PnL
  trades: VirtualTrade[];
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  totalPnl: number;       // $ from initial
  totalPnlPct: number;    // %
  totalFees: number;      // $ total fees paid
  totalTrades: number;
  wins: number;
  losses: number;
  breakEven: number;
  winRate: number;        // 0-100
  avgWinUsd: number;
  avgLossUsd: number;
  profitFactor: number;
  expectancyUsd: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  sharpeRolling: number;
  currentStreak: number;
  equityCurveUsd: number[]; // $ values from initial
  drawdownCurveUsd: number[]; // $ drawdown from peak
}

// Calculate lot/qty so that 1% of account is risked (after entry fee)
export function calcQty(
  balance: number,
  entry: number,
  stop: number,
  riskPct = RISK_PER_TRADE_PCT,
): { qty: number; riskUsd: number; feeEntry: number } {
  const riskUsd = balance * riskPct;
  const stopDist = Math.abs(entry - stop);
  if (stopDist === 0) return { qty: 0, riskUsd: 0, feeEntry: 0 };
  // Position value = qty * entry
  // Fee entry = qty * entry * FEE_RATE
  // Net risk = qty * stopDist - feeEntry (conservative: fee adds to loss side)
  // qty * stopDist + qty * entry * FEE_RATE = riskUsd
  // qty = riskUsd / (stopDist + entry * FEE_RATE)
  const qty = riskUsd / (stopDist + entry * FEE_RATE);
  const feeEntry = qty * entry * FEE_RATE;
  return {
    qty: Math.round(qty * 10000) / 10000,
    riskUsd: Math.round(riskUsd * 100) / 100,
    feeEntry: Math.round(feeEntry * 100) / 100,
  };
}

export function calcPnl(trade: VirtualTrade, exitPrice: number): {
  pnlGross: number;
  feeExit: number;
  pnlNet: number;
  pnlR: number;
  status: VirtualTrade['status'];
} {
  const { qty, entry, stop, direction, feeEntry } = trade;
  const priceDiff = direction === 'LONG' ? exitPrice - entry : entry - exitPrice;
  const pnlGross = priceDiff * qty;
  const feeExit = qty * exitPrice * FEE_RATE;
  const pnlNet = pnlGross - feeEntry - feeExit;
  const risk = trade.riskUsd > 0 ? trade.riskUsd : Math.abs(entry - stop) * qty;
  const pnlR = risk > 0 ? pnlNet / risk : 0;
  const status: VirtualTrade['status'] = pnlNet > 0.5 ? 'WIN' : pnlNet < -0.5 ? 'LOSS' : 'BE';
  return {
    pnlGross: Math.round(pnlGross * 100) / 100,
    feeExit: Math.round(feeExit * 100) / 100,
    pnlNet: Math.round(pnlNet * 100) / 100,
    pnlR: Math.round(pnlR * 100) / 100,
    status,
  };
}

export function calcAccountMetrics(account: VirtualAccount): AccountMetrics {
  const closed = account.trades.filter(
    t => t.status !== 'OPEN' && t.pnlNet != null
  ) as (VirtualTrade & { pnlNet: number; balanceAfter: number })[];

  const totalFees = account.trades.reduce((a, t) => {
    return a + t.feeEntry + (t.feeExit ?? 0);
  }, 0);

  if (closed.length === 0) {
    return {
      balance: account.balance,
      equity: account.equity,
      totalPnl: account.balance - account.initialBalance,
      totalPnlPct: ((account.balance - account.initialBalance) / account.initialBalance) * 100,
      totalFees,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      breakEven: 0,
      winRate: 0,
      avgWinUsd: 0,
      avgLossUsd: 0,
      profitFactor: 0,
      expectancyUsd: 0,
      maxDrawdownUsd: 0,
      maxDrawdownPct: 0,
      sharpeRolling: 0,
      currentStreak: 0,
      equityCurveUsd: [account.initialBalance],
      drawdownCurveUsd: [0],
    };
  }

  const wins = closed.filter(t => t.pnlNet > 0);
  const losses = closed.filter(t => t.pnlNet < 0);
  const beCount = closed.filter(t => t.pnlNet >= -0.5 && t.pnlNet <= 0.5).length;

  const winRate = (wins.length / closed.length) * 100;
  const avgWinUsd = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlNet, 0) / wins.length : 0;
  const avgLossUsd = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnlNet, 0) / losses.length) : 0;
  const grossWin = wins.reduce((a, t) => a + t.pnlNet, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlNet, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const expectancyUsd = closed.reduce((a, t) => a + t.pnlNet, 0) / closed.length;

  // Equity curve in $
  const equityCurveUsd: number[] = [account.initialBalance];
  for (const t of closed) {
    equityCurveUsd.push(t.balanceAfter);
  }

  // Drawdown curve
  const drawdownCurveUsd: number[] = [0];
  let peak = account.initialBalance;
  let maxDD = 0;
  for (let i = 1; i < equityCurveUsd.length; i++) {
    if (equityCurveUsd[i] > peak) peak = equityCurveUsd[i];
    const dd = equityCurveUsd[i] - peak;
    drawdownCurveUsd.push(dd);
    if (dd < maxDD) maxDD = dd;
  }
  const maxDDPct = peak > 0 ? (Math.abs(maxDD) / peak) * 100 : 0;

  // Sharpe (last 20 trades, pnlNet / riskUsd = R)
  const recent20R = closed.slice(-20).map(t => t.pnlR ?? 0);
  let sharpe = 0;
  if (recent20R.length >= 4) {
    const mean = recent20R.reduce((a, v) => a + v, 0) / recent20R.length;
    const variance = recent20R.reduce((a, v) => a + (v - mean) ** 2, 0) / recent20R.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(250) : 0;
  }

  // Streak
  let streak = 0;
  for (let i = closed.length - 1; i >= 0; i--) {
    const isWin = closed[i].pnlNet > 0;
    if (i === closed.length - 1) {
      streak = isWin ? 1 : -1;
    } else if (streak > 0 && isWin) {
      streak++;
    } else if (streak < 0 && !isWin) {
      streak--;
    } else {
      break;
    }
  }

  return {
    balance: account.balance,
    equity: account.equity,
    totalPnl: account.balance - account.initialBalance,
    totalPnlPct: ((account.balance - account.initialBalance) / account.initialBalance) * 100,
    totalFees: Math.round(totalFees * 100) / 100,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    breakEven: beCount,
    winRate,
    avgWinUsd: Math.round(avgWinUsd * 100) / 100,
    avgLossUsd: Math.round(avgLossUsd * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectancyUsd: Math.round(expectancyUsd * 100) / 100,
    maxDrawdownUsd: Math.round(maxDD * 100) / 100,
    maxDrawdownPct: Math.round(maxDDPct * 100) / 100,
    sharpeRolling: Math.round(sharpe * 100) / 100,
    currentStreak: streak,
    equityCurveUsd,
    drawdownCurveUsd,
  };
}
