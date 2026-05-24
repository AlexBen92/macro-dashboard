/**
 * Walk-forward backtest engine — replays V3 signals on max H1 candles
 * Entry rules: confluence >= 65 LONG or <= 35 SHORT (MACD + VWTSMOM + Regime)
 * Exit: ATR(14) stop = 2×ATR, TP = 3×ATR → R:R 1:1.5
 * Fees: 0.04% entry + 0.04% exit (maker model)
 * No continue after close — can re-enter same candle
 */

import { calcMACD, calcVWTSMOM, detectRegime } from './crypto-signals-v3';

export const BACKTEST_FEE = 0.0004; // 0.04% per side
export const RISK_PER_TRADE = 0.01; // 1% of capital per trade
export const INITIAL_CAPITAL = 10_000;

export interface BtCandle {
  t: number;  // timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface BacktestTrade {
  id: string;
  coin: string;
  direction: 'LONG' | 'SHORT';
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  stopPrice: number;
  tpPrice: number;
  qty: number;
  riskUsd: number;
  feeEntry: number;
  feeExit: number;
  pnlGross: number;
  pnlNet: number;
  pnlR: number;
  outcome: 'WIN' | 'LOSS' | 'BE';
  balanceAfter: number;
  // Strategy description shown in UI
  strategyLabel: string;
  signals: {
    multiTF: 'BULL' | 'BEAR' | 'FLAT';
    macdCross: string;
    vwtsmom: number;
    regime: string;
  };
  confluenceScore: number;
}

export interface BacktestResult {
  coin: string;
  runDate: string;
  candleFrom: string;
  candleTo: string;
  totalCandles: number;
  trades: BacktestTrade[];
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinUsd: number;
  avgLossUsd: number;
  profitFactor: number;
  expectancyUsd: number;
  totalPnl: number;
  totalPnlPct: number;
  totalFees: number;
  maxDrawdownUsd: number;
  maxDrawdownPct: number;
  sharpe: number;
  equityCurve: number[];
  drawdownCurve: number[];
  signalAccuracy: {
    multiTF_bull: { wins: number; total: number };
    multiTF_bear: { wins: number; total: number };
    vwtsmom_pos: { wins: number; total: number };
    vwtsmom_neg: { wins: number; total: number };
    regime_momentum: { wins: number; total: number };
    macd_cross: { wins: number; total: number };
  };
}

function calcATR(candles: BtCandle[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    trs.push(Math.max(
      candles[i].h - candles[i].l,
      Math.abs(candles[i].h - candles[i - 1].c),
      Math.abs(candles[i].l - candles[i - 1].c),
    ));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function buildStrategyLabel(
  macdTrend: 'BULL' | 'BEAR' | 'FLAT',
  macdCross: string,
  vwtsmomVal: number,
  regime: string,
  direction: 'LONG' | 'SHORT',
): string {
  const parts: string[] = [];

  // MACD component
  if (macdCross === 'BULL_CROSS') parts.push('MACD ↑ CROSS');
  else if (macdCross === 'BEAR_CROSS') parts.push('MACD ↓ CROSS');
  else if (macdTrend === 'BULL') parts.push('MACD BULL');
  else if (macdTrend === 'BEAR') parts.push('MACD BEAR');

  // VWTSMOM component
  if (Math.abs(vwtsmomVal) > 0.0005) {
    parts.push(vwtsmomVal > 0 ? 'VWTSMOM ↑' : 'VWTSMOM ↓');
  }

  // Regime component
  if (regime === 'MOMENTUM') parts.push('REGIME: MOMENTUM');
  else if (regime === 'MEAN_REVERSION') parts.push('REGIME: MEAN-REV');
  else if (regime === 'HIGH_VOL') parts.push('REGIME: HIGH-VOL');

  if (parts.length === 0) parts.push(direction === 'LONG' ? 'CONFLUENCE BULL' : 'CONFLUENCE BEAR');
  return parts.join(' + ');
}

function calcConfluenceAndDirection(
  macdTrend: 'BULL' | 'BEAR' | 'FLAT',
  vwtsmomVal: number,
  regimeDir: 'LONG' | 'SHORT' | 'NEUTRAL',
): { score: number } {
  const weights = { macd: 0.6, vwtsmom: 0.6, regime: 0.6 };
  let bull = 0, bear = 0, total = 0;

  if (macdTrend !== 'FLAT') {
    total += weights.macd;
    if (macdTrend === 'BULL') bull += weights.macd;
    else bear += weights.macd;
  }
  if (Math.abs(vwtsmomVal) > 0.0005) {
    total += weights.vwtsmom;
    if (vwtsmomVal > 0) bull += weights.vwtsmom;
    else bear += weights.vwtsmom;
  }
  if (regimeDir !== 'NEUTRAL') {
    total += weights.regime;
    if (regimeDir === 'LONG') bull += weights.regime;
    else bear += weights.regime;
  }

  return { score: total === 0 ? 50 : Math.round((bull / total) * 100) };
}

type OpenTrade = Omit<BacktestTrade, 'exitTime' | 'exitPrice' | 'pnlGross' | 'pnlNet' | 'pnlR' | 'outcome' | 'balanceAfter' | 'feeExit'>;

export function runBacktest(
  candles: BtCandle[],
  coin: string,
  feeRate: number = BACKTEST_FEE,
  longThreshold: number = 65,
  shortThreshold: number = 35
): BacktestResult {
  const WARMUP = 40; // Reduced warmup — enough for MACD(26+9)
  let balance = INITIAL_CAPITAL;
  const trades: BacktestTrade[] = [];
  let openTrade: OpenTrade | null = null;

  for (let i = WARMUP; i < candles.length; i++) {
    const current = candles[i];
    const closes = candles.slice(0, i + 1).map(c => c.c);
    const volumes = candles.slice(0, i + 1).map(c => c.v);
    const slice = candles.slice(0, i + 1);

    // ── Step 1: check if open trade hit SL or TP ──
    if (openTrade) {
      const { direction, stopPrice, tpPrice, qty, riskUsd } = openTrade;
      let closed = false;
      let exitPrice = current.c;
      let outcome: BacktestTrade['outcome'] = 'BE';

      if (direction === 'LONG') {
        if (current.l <= stopPrice) { exitPrice = stopPrice; outcome = 'LOSS'; closed = true; }
        else if (current.h >= tpPrice) { exitPrice = tpPrice; outcome = 'WIN'; closed = true; }
      } else {
        if (current.h >= stopPrice) { exitPrice = stopPrice; outcome = 'LOSS'; closed = true; }
        else if (current.l <= tpPrice) { exitPrice = tpPrice; outcome = 'WIN'; closed = true; }
      }

      if (closed) {
        const priceDiff = direction === 'LONG' ? exitPrice - openTrade.entryPrice : openTrade.entryPrice - exitPrice;
        const pnlGross = priceDiff * qty;
        const feeExit = qty * exitPrice * feeRate;
        const pnlNet = pnlGross - feeExit;
        const pnlR = riskUsd > 0 ? pnlNet / riskUsd : 0;
        balance = Math.round((balance + pnlGross - feeExit) * 100) / 100;
        trades.push({
          ...openTrade,
          feeExit: Math.round(feeExit * 100) / 100,
          exitTime: current.t,
          exitPrice,
          pnlGross: Math.round(pnlGross * 100) / 100,
          pnlNet: Math.round(pnlNet * 100) / 100,
          pnlR: Math.round(pnlR * 100) / 100,
          outcome,
          balanceAfter: balance,
        });
        openTrade = null;
        // ← NO continue: fall through to check for new entry on same candle
      } else {
        // Still in trade, skip entry logic
        continue;
      }
    }

    // ── Step 2: compute signals & check entry ──
    // Daily proxy: last close of every 24h block
    const dailyCloses: number[] = [];
    for (let j = 24; j <= closes.length; j += 24) {
      dailyCloses.push(closes[j - 1]);
    }
    if (dailyCloses.length < 10) continue;

    const macd = calcMACD(closes, 12, 26, 9);
    const vwtsmomSig = calcVWTSMOM(closes, volumes, Math.min(24, closes.length - 1));
    const regimeSig = detectRegime(dailyCloses);

    const vwtsmomVal = (vwtsmomSig.metadata.vwtsmomPct as number) / 100;
    const regime = String(regimeSig.metadata.regime ?? 'NEUTRAL');
    const { score: confluenceScore } = calcConfluenceAndDirection(macd.trend, vwtsmomVal, regimeSig.direction);

    let entryDir: 'LONG' | 'SHORT' | null = null;
    if (confluenceScore >= longThreshold) entryDir = 'LONG';
    else if (confluenceScore <= shortThreshold) entryDir = 'SHORT';
    if (!entryDir) continue;

    // ATR-based sizing
    const atr = calcATR(slice, 14);
    if (atr === 0) continue;

    const entryPrice = current.c;
    const stopDist = atr * 2;
    const tpDist = atr * 3;
    const stopPrice = entryDir === 'LONG' ? entryPrice - stopDist : entryPrice + stopDist;
    const tpPrice = entryDir === 'LONG' ? entryPrice + tpDist : entryPrice - tpDist;

    const riskUsd = balance * RISK_PER_TRADE;
    const qty = riskUsd / (stopDist + entryPrice * feeRate);
    const feeEntry = qty * entryPrice * feeRate;
    balance = Math.round((balance - feeEntry) * 100) / 100;

    const strategyLabel = buildStrategyLabel(macd.trend, macd.cross, vwtsmomVal, regime, entryDir);

    openTrade = {
      id: `bt-${coin}-${current.t}`,
      coin,
      direction: entryDir,
      entryTime: current.t,
      entryPrice,
      stopPrice,
      tpPrice,
      qty: Math.round(qty * 10000) / 10000,
      riskUsd: Math.round(riskUsd * 100) / 100,
      feeEntry: Math.round(feeEntry * 100) / 100,
      strategyLabel,
      signals: { multiTF: macd.trend, macdCross: macd.cross, vwtsmom: vwtsmomVal, regime },
      confluenceScore,
    };
  }

  // Force-close any trade still open at last candle
  if (openTrade) {
    const last = candles[candles.length - 1];
    const exitPrice = last.c;
    const priceDiff = openTrade.direction === 'LONG' ? exitPrice - openTrade.entryPrice : openTrade.entryPrice - exitPrice;
    const pnlGross = priceDiff * openTrade.qty;
    const feeExit = openTrade.qty * exitPrice * feeRate;
    const pnlNet = pnlGross - feeExit;
    const pnlR = openTrade.riskUsd > 0 ? pnlNet / openTrade.riskUsd : 0;
    balance = Math.round((balance + pnlGross - feeExit) * 100) / 100;
    trades.push({
      ...openTrade,
      feeExit: Math.round(feeExit * 100) / 100,
      exitTime: last.t,
      exitPrice,
      pnlGross: Math.round(pnlGross * 100) / 100,
      pnlNet: Math.round(pnlNet * 100) / 100,
      pnlR: Math.round(pnlR * 100) / 100,
      outcome: pnlNet > 0.5 ? 'WIN' : pnlNet < -0.5 ? 'LOSS' : 'BE',
      balanceAfter: balance,
    });
  }

  // ── Metrics ──
  const wins = trades.filter(t => t.outcome === 'WIN');
  const losses = trades.filter(t => t.outcome === 'LOSS');
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWinUsd = wins.length > 0 ? wins.reduce((a, t) => a + t.pnlNet, 0) / wins.length : 0;
  const avgLossUsd = losses.length > 0 ? Math.abs(losses.reduce((a, t) => a + t.pnlNet, 0) / losses.length) : 0;
  const grossWin = wins.reduce((a, t) => a + t.pnlNet, 0);
  const grossLoss = Math.abs(losses.reduce((a, t) => a + t.pnlNet, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const totalPnl = balance - INITIAL_CAPITAL;
  const totalFees = trades.reduce((a, t) => a + t.feeEntry + t.feeExit, 0);
  const expectancyUsd = trades.length > 0 ? trades.reduce((a, t) => a + t.pnlNet, 0) / trades.length : 0;

  // Equity curve
  const equityCurve = [INITIAL_CAPITAL, ...trades.map(t => t.balanceAfter)];
  const drawdownCurve: number[] = [0];
  let peak = INITIAL_CAPITAL;
  let maxDD = 0;
  for (let i = 1; i < equityCurve.length; i++) {
    if (equityCurve[i] > peak) peak = equityCurve[i];
    const dd = equityCurve[i] - peak;
    drawdownCurve.push(dd);
    if (dd < maxDD) maxDD = dd;
  }
  const maxDDPct = peak > 0 ? (Math.abs(maxDD) / peak) * 100 : 0;

  // Sharpe
  const pnlRs = trades.map(t => t.pnlR);
  let sharpe = 0;
  if (pnlRs.length >= 4) {
    const mean = pnlRs.reduce((a, v) => a + v, 0) / pnlRs.length;
    const variance = pnlRs.reduce((a, v) => a + (v - mean) ** 2, 0) / pnlRs.length;
    const std = Math.sqrt(variance);
    sharpe = std > 0 ? (mean / std) * Math.sqrt(250) : 0;
  }

  // Signal accuracy — now includes macd_cross and regime_momentum
  const signalAccuracy = {
    multiTF_bull: { wins: 0, total: 0 },
    multiTF_bear: { wins: 0, total: 0 },
    vwtsmom_pos: { wins: 0, total: 0 },
    vwtsmom_neg: { wins: 0, total: 0 },
    regime_momentum: { wins: 0, total: 0 },
    macd_cross: { wins: 0, total: 0 },
  };
  for (const t of trades) {
    const isWin = t.outcome === 'WIN';
    if (t.signals.multiTF === 'BULL') { signalAccuracy.multiTF_bull.total++; if (isWin) signalAccuracy.multiTF_bull.wins++; }
    if (t.signals.multiTF === 'BEAR') { signalAccuracy.multiTF_bear.total++; if (isWin) signalAccuracy.multiTF_bear.wins++; }
    if (t.signals.vwtsmom > 0) { signalAccuracy.vwtsmom_pos.total++; if (isWin) signalAccuracy.vwtsmom_pos.wins++; }
    if (t.signals.vwtsmom < 0) { signalAccuracy.vwtsmom_neg.total++; if (isWin) signalAccuracy.vwtsmom_neg.wins++; }
    if (t.signals.regime === 'MOMENTUM') { signalAccuracy.regime_momentum.total++; if (isWin) signalAccuracy.regime_momentum.wins++; }
    if (t.signals.macdCross !== 'NONE') { signalAccuracy.macd_cross.total++; if (isWin) signalAccuracy.macd_cross.wins++; }
  }

  return {
    coin,
    runDate: new Date().toISOString(),
    candleFrom: new Date(candles[0].t).toISOString(),
    candleTo: new Date(candles[candles.length - 1].t).toISOString(),
    totalCandles: candles.length,
    trades,
    totalTrades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: Math.round(winRate * 10) / 10,
    avgWinUsd: Math.round(avgWinUsd * 100) / 100,
    avgLossUsd: Math.round(avgLossUsd * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    expectancyUsd: Math.round(expectancyUsd * 100) / 100,
    totalPnl: Math.round(totalPnl * 100) / 100,
    totalPnlPct: Math.round((totalPnl / INITIAL_CAPITAL) * 10000) / 100,
    totalFees: Math.round(totalFees * 100) / 100,
    maxDrawdownUsd: Math.round(maxDD * 100) / 100,
    maxDrawdownPct: Math.round(maxDDPct * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    equityCurve,
    drawdownCurve,
    signalAccuracy,
  };
}
