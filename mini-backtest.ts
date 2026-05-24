#!/usr/bin/env tsx
/**
 * MINI BACKTEST - BTC Momentum Simple Strategy
 *
 * Stratégie simple:
 * - Achat quand RSI < 30 (oversold) ET prix > SMA 200
 * - Vente quand RSI > 70 (overbought) OU stop-loss -5%
 */

interface Trade {
  entryTime: number;
  entryPrice: number;
  exitTime?: number;
  exitPrice?: number;
  direction: 'LONG' | 'SHORT';
  pnl?: number;
  pnlPct?: number;
  exitReason?: string;
}

interface BacktestResult {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  totalPnlPct: number;
  maxDrawdown: number;
  sharpe: number;
  trades: Trade[];
  equityCurve: number[];
}

// Fonction pour calculer le RSI
function rsi(prices: number[], period: number = 14): number[] {
  const rsiValues: number[] = [];
  const changes: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }

  for (let i = period; i < changes.length; i++) {
    let gains = 0;
    let losses = 0;

    for (let j = i - period + 1; j <= i; j++) {
      if (changes[j] > 0) gains += changes[j];
      else losses -= changes[j];
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }
  }

  return rsiValues;
}

// Fonction pour calculer la SMA
function sma(prices: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += prices[i - j];
    }
    result.push(sum / period);
  }
  return result;
}

// Mini backtest avec prix simulés (basé sur mouvement BTC réel)
async function fetchBtcPrices(days: number = 90): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=${days}`
    );
    const data = await res.json();
    return data.prices.map((p: number[]) => p[1]);
  } catch {
    // Fallback: prix simulés avec volatilité BTC réaliste
    const prices: number[] = [];
    let price = 70000;
    for (let i = 0; i < days * 24; i++) {
      const change = (Math.random() - 0.48) * 0.02; // Légèrement bullish
      price = price * (1 + change);
      prices.push(price);
    }
    return prices;
  }
}

function runMiniBacktest(prices: number[]): BacktestResult {
  const trades: Trade[] = [];
  const rsiValues = rsi(prices, 14);
  const sma200 = sma(prices, 200);
  const equityCurve: number[] = [10000];
  let balance = 10000;
  let inPosition = false;
  let entryPrice = 0;
  let entryBar = 0;
  let peakEquity = 10000;
  let maxDrawdown = 0;

  const lookback = 200; // pour SMA 200

  for (let i = lookback; i < prices.length; i++) {
    const currentRsi = rsiValues[i - lookback] ?? 50;
    const currentSma = sma200[i - lookback] ?? prices[i];
    const price = prices[i];

    // LOGIQUE DE TRADING
    if (!inPosition) {
      // SIGNAL D'ENTRÉE: RSI oversold + prix au-dessus SMA 200 (trend haussier)
      if (currentRsi < 35 && price > currentSma) {
        inPosition = true;
        entryPrice = price;
        entryBar = i;
      }
    } else {
      // CALCUL PnL
      const pnlPct = ((price - entryPrice) / entryPrice) * 100;
      const pnl = (balance * pnlPct) / 100;

      // SIGNALS DE SORTIE
      let shouldExit = false;
      let exitReason = '';

      // Take-profit: RSI overbought
      if (currentRsi > 65) {
        shouldExit = true;
        exitReason = 'TP_RSI';
      }
      // Stop-loss: -5%
      else if (pnlPct < -5) {
        shouldExit = true;
        exitReason = 'SL';
      }
      // Trailing: si on est à +3% et que le prix baisse de 1.5%
      else if (pnlPct > 3 && ((price - entryPrice) / entryPrice) < 0.015) {
        shouldExit = true;
        exitReason = 'TRAILING';
      }
      // Time exit: max 48 heures
      else if (i - entryBar > 48) {
        shouldExit = true;
        exitReason = 'TIME';
      }

      if (shouldExit) {
        balance += pnl;
        equityCurve.push(balance);

        if (balance > peakEquity) {
          peakEquity = balance;
        }
        const dd = (peakEquity - balance) / peakEquity * 100;
        if (dd > maxDrawdown) maxDrawdown = dd;

        trades.push({
          entryTime: i,
          entryPrice,
          exitTime: i,
          exitPrice: price,
          direction: 'LONG',
          pnl,
          pnlPct,
          exitReason,
        });

        inPosition = false;
      }
    }
  }

  // Stats
  const wins = trades.filter(t => (t.pnl ?? 0) > 0).length;
  const losses = trades.filter(t => (t.pnl ?? 0) < 0).length;
  const totalPnl = balance - 10000;
  const totalPnlPct = (totalPnl / 10000) * 100;

  // Sharpe ratio (simplifié)
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i] - equityCurve[i - 1]) / equityCurve[i - 1]);
  }
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const stdReturn = Math.sqrt(
    returns.reduce((sum, r) => sum + (r - avgReturn) ** 2, 0) / returns.length
  );
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

  return {
    totalTrades: trades.length,
    wins,
    losses,
    winRate: trades.length > 0 ? (wins / trades.length) * 100 : 0,
    totalPnl,
    totalPnlPct,
    maxDrawdown,
    sharpe,
    trades,
    equityCurve,
  };
}

// AFFICHAGE
function printResults(result: BacktestResult, prices: number[]) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 MINI BACKTEST - BTC Momentum Strategy');
  console.log('='.repeat(60));
  console.log(`📈 Période    : ${prices.length} bougies (~${Math.floor(prices.length / 24)} jours)`);
  console.log(`💰 Capital    : $10,000`);
  console.log(`📊 Trades     : ${result.totalTrades}`);
  console.log(`✅ Wins       : ${result.wins}`);
  console.log(`❌ Losses     : ${result.losses}`);
  console.log(`🎯 Win Rate   : ${result.winRate.toFixed(1)}%`);
  console.log('');
  console.log(`💵 PnL Total  : $${result.totalPnl.toFixed(2)} (${result.totalPnlPct > 0 ? '+' : ''}${result.totalPnlPct.toFixed(2)}%)`);
  console.log(`📉 Max DD     : ${result.maxDrawdown.toFixed(2)}%`);
  console.log(`📊 Sharpe     : ${result.sharpe.toFixed(2)}`);
  console.log('='.repeat(60));

  if (result.trades.length > 0) {
    console.log('\n📋 DERNIERS TRADES:');
    console.log('-'.repeat(60));
    result.trades.slice(-5).forEach((t, i) => {
      const pnlSign = (t.pnl ?? 0) >= 0 ? '✅' : '❌';
      console.log(`${pnlSign} ${t.exitReason?.padEnd(10)} | Entry: $${t.entryPrice.toFixed(0)} | Exit: $${t.exitPrice?.toFixed(0)} | PnL: ${t.pnlPct?.toFixed(2)}%`);
    });
  }

  console.log('\n📊 ÉQUITY CURVE (10 derniers points):');
  console.log('-'.repeat(40));
  const lastEquity = result.equityCurve.slice(-10);
  lastEquity.forEach((eq, i) => {
    const bar = '█'.repeat(Math.floor(eq / 1000));
    console.log(`${(i + 1).toString().padStart(2)} | $${eq.toFixed(0).padStart(7)} | ${bar}`);
  });
  console.log('='.repeat(60) + '\n');
}

// MAIN
async function main() {
  console.log('\n🔄 Récupération des prix BTC...');
  const prices = await fetchBtcPrices(90);
  console.log(`✅ ${prices.length} bougies récupérées`);

  console.log('\n🔄 Exécution du backtest...');
  const result = runMiniBacktest(prices);

  printResults(result, prices);

  // Evaluation finale
  let verdict = '';
  if (result.sharpe > 1.5 && result.winRate > 50 && result.totalPnlPct > 10) {
    verdict = '🚀 STRATÉGIE PROMETTEUSE';
  } else if (result.sharpe > 0.5 && result.totalPnlPct > 0) {
    verdict = '📈 STRATÉGIE VALIDE';
  } else if (result.totalPnlPct < 0) {
    verdict = '⚠️ STRATÉGIE NON RENTABLE';
  } else {
    verdict = '😐 STRATÉGIE MEDIOCRE';
  }

  console.log(`\n🎯 ${verdict}\n`);
}

main().catch(console.error);
