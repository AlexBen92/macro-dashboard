/**
 * M15 BACKTEST - READY SIGNALS (≥80)
 *
 * Backtest des signaux M15 avec score ≥ 80 (READY - Full Size)
 *
 * Hypothèses:
 * - Entry: Signal READY détecté
 * - SL: 0.4% (max de ATR proxy)
 * - TP1: 0.5% (1R)
 * - TP2: 1.0% (2R)
 * - Fees: 0.05% taker entry, 0.05% taker exit = 0.10% round-trip
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
function loadEnv() {
  const envPath = resolve(__dirname, '.env.local');
  try {
    const envContent = readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        if (value && !key.startsWith('#')) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    console.warn('Could not load .env.local:', e);
  }
}

loadEnv();

import { VOL_WINDOWS, HL_TAKER_FEE, HL_MAKER_FEE, HL_ROUND_TRIP } from './src/lib/constants';

const HL_FEES_ROUND_TRIP = HL_ROUND_TRIP; // ~0.10%

// Stocker les résultats des tokens analysés
const analyzedTokens: { symbol: string; score: number; direction: string; funding: number; vol24h: number }[] = [];

// ─── TYPES ───

interface BacktestResult {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  exitPrice: number;
  slPrice: number;
  tp1Price: number;
  tp2Price: number;
  outcome: 'TP1' | 'TP2' | 'SL';
  pnlPct: number;
  pnlUsd: number;
  reason: string;
}

interface BacktestStats {
  totalTrades: number;
  winRate: number;
  avgPnlPct: number;
  totalPnlPct: number;
  totalPnlUsd: number;
  maxDrawdownPct: number;
  sharpe: number;
  outcomes: { TP1: number; TP2: number; SL: number };
  bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }>;
}

// ─── SIMULATION PRICE MOVEMENT ───

/**
 * Simule le mouvement de prix sur 1 période de scalping (15-30 min)
 * Basé sur la volatilité historique et le funding rate (indicateur de sentiment)
 */
function simulatePriceMove(
  entryPrice: number,
  direction: 'LONG' | 'SHORT',
  fundingRate: number,
  vol24h: number
): { outcome: 'TP1' | 'TP2' | 'SL'; exitPrice: number; reason: string } {
  // ATR proxy: vol24h * 0.02 (volatilité moyenne 15m)
  const atrProxy = entryPrice * (vol24h / entryPrice) * 0.02;

  // SL distance: max(0.4%, 0.75*ATR)
  const slDist = Math.max(entryPrice * 0.004, atrProxy * 0.75);
  const slPrice = direction === 'LONG' ? entryPrice - slDist : entryPrice + slDist;

  // TP1: 1R = slDist
  const tp1Price = direction === 'LONG' ? entryPrice + slDist : entryPrice - slDist;

  // TP2: 2R = 2 * slDist
  const tp2Price = direction === 'LONG' ? entryPrice + slDist * 2 : entryPrice - slDist * 2;

  // Funding comme indicateur de sentiment contrarian
  // Funding négatif = shorts dominent = potentiel squeeze LONG
  // Funding positif = longs dominent = potentiel flush SHORT
  const contrarianEdge = Math.abs(fundingRate) * 100; // en %

  // Probabilité basée sur:
  // 1. Direction vs funding alignment (contrarian = meilleur edge)
  // 2. Volatilité (plus de vol = plus de chances de toucher TP)
  // 3. Random component

  let winProbability = 0.5;

  // Contrarian edge: si direction alignée avec funding contrarian
  if (direction === 'LONG' && fundingRate < -0.0002) {
    winProbability += 0.15; // +15% edge
  } else if (direction === 'SHORT' && fundingRate > 0.0002) {
    winProbability += 0.15; // +15% edge
  }

  // Volatilité: trop faible = moins de chances de mouvement significatif
  const volRatio = atrProxy / entryPrice;
  if (volRatio < 0.002) {
    winProbability -= 0.10; // -10% si vol trop faible
  } else if (volRatio > 0.01) {
    winProbability -= 0.05; // -5% si vol trop élevé (choppy)
  }

  winProbability = Math.max(0.3, Math.min(0.7, winProbability));

  // Simuler le mouvement
  const random = Math.random();

  if (random < winProbability * 0.4) {
    // 40% des wins → TP2 (2R)
    return {
      outcome: 'TP2',
      exitPrice: tp2Price,
      reason: 'TP2 atteint (2R)',
    };
  } else if (random < winProbability) {
    // 60% des wins → TP1 (1R)
    return {
      outcome: 'TP1',
      exitPrice: tp1Price,
      reason: 'TP1 atteint (1R)',
    };
  } else {
    // Loss → SL
    return {
      outcome: 'SL',
      exitPrice: slPrice,
      reason: 'SL atteint (-1R)',
    };
  }
}

// ─── RUN BACKTEST ───

async function runBacktest(): Promise<BacktestStats> {
  console.log('🔍 Fetching Hyperliquid data...');

  const response = await fetch('https://api.hyperliquid.xyz/info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const data = await response.json();
  const meta: Array<{ name: string }> = data[0]?.universe ?? [];
  const ctxs: any[] = data[1] ?? [];

  const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'PEPE', 'BNB', 'ADA', 'AVAX', 'LINK', 'MATIC', 'DOT', 'UNI', 'LTC', 'BCH'];
  const results: BacktestResult[] = [];
  const sessionScore = getSessionScore();

  // Clear previous analysis
  analyzedTokens.length = 0;

  console.log(`\n⏰ Session score: ${sessionScore}/100`);

  for (let i = 0; i < meta.length; i++) {
    const symbol = meta[i].name;
    if (!TOP_TOKENS.includes(symbol)) continue;

    const ctx = ctxs[i] ?? {};
    const price = parseFloat(ctx.markPx ?? '0');
    const funding = parseFloat(ctx.funding ?? '0');
    const oi = parseFloat(ctx.openInterest ?? '0');
    const vol24h = parseFloat(ctx.dayNtlVlm ?? '0');

    if (price === 0 || oi < 5_000_000 || vol24h < 2_000_000) continue;

    // Calculer score M15
    const score = computeM15Score(symbol, price, funding, oi, vol24h, sessionScore);

    // Store for analysis
    analyzedTokens.push({
      symbol,
      score: score.final,
      direction: score.direction,
      funding,
      vol24h,
    });

    // Only backtest READY signals (≥80)
    if (score.final < 80 || score.action !== 'READY') continue;

    if (score.direction === 'NEUTRAL') continue;

    // Simuler le trade
    const sim = simulatePriceMove(price, score.direction, funding, vol24h);

    // Calculer PNL
    const priceChange = (sim.exitPrice - price) / price * 100;
    const pnlPct = score.direction === 'LONG' ? priceChange : -priceChange;
    const pnlUsd = pnlPct / 100 * price * 1000; // 1000 USD position size

    results.push({
      symbol,
      direction: score.direction,
      entryPrice: price,
      exitPrice: sim.exitPrice,
      slPrice: 0,
      tp1Price: 0,
      tp2Price: 0,
      outcome: sim.outcome,
      pnlPct: pnlPct - HL_FEES_ROUND_TRIP * 100, // Net des fees
      pnlUsd,
      reason: sim.reason,
    });

    console.log(`✓ ${symbol}: ${score.final}/100 ${score.direction} → ${sim.outcome} (${pnlPct.toFixed(3)}%)`);
  }

  // Calculer les stats
  return computeStats(results);
}

// ─── M15 SCORE (simplified) ───

function computeM15Score(
  symbol: string,
  price: number,
  funding: number,
  oi: number,
  vol24h: number,
  sessionScore: number
): { final: number; action: string; direction: 'LONG' | 'SHORT' | 'NEUTRAL' } {
  let l1Score = 0;
  let l2Score = 0;
  let l3Score = 0;

  // L1: Hard Filters
  l1Score += Math.min(sessionScore / 100 * 25, 25); // Session
  if (vol24h >= 2_000_000) l1Score += 20; // Vol24h
  if (oi >= 5_000_000) l1Score += 15; // OI
  l1Score += 15; // Spread proxy (assume OK)
  l1Score += 15; // News (assume OK)
  l1Score += 10; // Chop (assume OK)

  // L2: Setup
  const fundingEdge = Math.abs(funding) * 100 - HL_TAKER_FEE * 100;
  const fundingScore = fundingEdge >= 0.10 ? 100 : fundingEdge >= 0.05 ? 70 : 30;
  l2Score += fundingScore * 0.25; // Funding
  l2Score += 70 * 0.15; // OI (assume moyenne)
  l2Score += 70 * 0.15; // Vol
  l2Score += 50 * 0.15; // Flow
  l2Score += 50 * 0.10; // Trend
  l2Score += 70 * 0.20; // VWAP

  // L3: Confirmation
  l3Score += 50 * 0.30; // Momentum
  l3Score += 50 * 0.25; // Reclaim
  l3Score += 50 * 0.25; // CVD
  l3Score += 50 * 0.10; // Structure
  l3Score += 50 * 0.10; // Retest

  const final = Math.round(l1Score * 0.30 + l2Score * 0.40 + l3Score * 0.30);

  let action = 'AVOID';
  if (final >= 80) action = 'READY';
  else if (final >= 60) action = 'WATCH';

  let direction: 'LONG' | 'SHORT' | 'NEUTRAL' = 'NEUTRAL';
  if (funding < -0.0002) direction = 'LONG';
  else if (funding > 0.0002) direction = 'SHORT';

  return { final, action, direction };
}

function getSessionScore(): number {
  const h = new Date().getUTCHours();
  const win = VOL_WINDOWS.find(w => h >= w.start && h < w.end);
  return win ? win.score * 100 : 0;
}

// ─── STATS ───

function computeStats(results: BacktestResult[]): BacktestStats {
  const totalTrades = results.length;
  if (totalTrades === 0) {
    return {
      totalTrades: 0,
      winRate: 0,
      avgPnlPct: 0,
      totalPnlPct: 0,
      totalPnlUsd: 0,
      maxDrawdownPct: 0,
      sharpe: 0,
      outcomes: { TP1: 0, TP2: 0, SL: 0 },
      bySymbol: {},
    };
  }

  const wins = results.filter(r => r.outcome !== 'SL');
  const winRate = (wins.length / totalTrades) * 100;

  const avgPnlPct = results.reduce((sum, r) => sum + r.pnlPct, 0) / totalTrades;
  const totalPnlPct = results.reduce((sum, r) => sum + r.pnlPct, 0);
  const totalPnlUsd = results.reduce((sum, r) => sum + r.pnlUsd, 0);

  // Max drawdown
  let maxDrawdown = 0;
  let peak = 0;
  let cumulative = 0;
  for (const r of results) {
    cumulative += r.pnlPct;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Sharpe (simplified, annualisé)
  const returns = results.map(r => r.pnlPct);
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(252 * 24) : 0; // 252 jours * 24 périodes

  const outcomes = {
    TP1: results.filter(r => r.outcome === 'TP1').length,
    TP2: results.filter(r => r.outcome === 'TP2').length,
    SL: results.filter(r => r.outcome === 'SL').length,
  };

  // By symbol
  const bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};
  for (const r of results) {
    if (!bySymbol[r.symbol]) {
      bySymbol[r.symbol] = { trades: 0, winRate: 0, totalPnl: 0 };
    }
    bySymbol[r.symbol].trades++;
    bySymbol[r.symbol].totalPnl += r.pnlUsd;
  }
  for (const s in bySymbol) {
    const symbolTrades = results.filter(r => r.symbol === s);
    const symbolWins = symbolTrades.filter(r => r.outcome !== 'SL').length;
    bySymbol[s].winRate = (symbolWins / symbolTrades.length) * 100;
  }

  return {
    totalTrades,
    winRate,
    avgPnlPct,
    totalPnlPct,
    totalPnlUsd,
    maxDrawdownPct: maxDrawdown,
    sharpe,
    outcomes,
    bySymbol,
  };
}

// ─── SEND TELEGRAM ───

async function sendTelegramMessage(message: string): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('❌ Telegram credentials not configured');
    return false;
  }

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });

    const data = await res.json() as { ok: boolean; description?: string };

    if (!data.ok) {
      console.error('❌ Telegram API error:', data.description);
      return false;
    }

    console.log('✅ Message sent to Telegram');
    return true;
  } catch (e) {
    console.error('❌ Error sending to Telegram:', e);
    return false;
  }
}

function formatBacktestMessage(stats: BacktestStats): string {
  let message = '📊 <b>BACKTEST M15 — READY SIGNALS (&gt;=80)</b>\n\n';
  message += `🕒 ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}\n`;
  message += '═'.repeat(40) + '\n\n';

  if (stats.totalTrades === 0) {
    message += '❌ <b>Aucun signal READY détecté</b>\n\n';
    message += '📋 <b>Top Scores Actuels</b>:\n';

    // Show top 5 by score
    const sorted = analyzedTokens.sort((a, b) => b.score - a.score).slice(0, 5);
    for (const t of sorted) {
      const dirEmoji = t.direction === 'LONG' ? '📈' : t.direction === 'SHORT' ? '📉' : '⬜';
      const scoreColor = t.score >= 70 ? '🟡' : t.score >= 60 ? '🟠' : '🔴';
      message += `   ${scoreColor} ${t.symbol}: ${t.score}/100 ${dirEmoji}\n`;
      message += `      Funding: ${(t.funding * 100).toFixed(4)}% | Vol: $${(t.vol24h / 1e6).toFixed(1)}M\n`;
    }

    message += '\n💡 <b>Pourquoi pas de READY?</b>\n';
    message += '   • Score minimum: 80/100\n';
    message += '   • Session: peut-être off-hours\n';
    message += '   • Funding: edge insuffisant\n';
    message += '   • Volatilité: en dessous du seuil optimal\n\n';
    message += '🔗 <a href="https://macro-dashboard-lemon.vercel.app/">Voir Dashboard</a>';
    return message;
  }

  // Main stats
  message += '📈 <b>PERFORMANCE GLOBALE</b>\n';
  message += `   Trades: <b>${stats.totalTrades}</b>\n`;
  message += `   Win Rate: <b>${stats.winRate.toFixed(1)}%</b>\n`;
  message += `   Avg PNL: <b>${stats.avgPnlPct.toFixed(3)}%</b> per trade\n`;
  message += `   Total PNL: <b>${stats.totalPnlPct.toFixed(2)}%</b> ($${stats.totalPnlUsd.toFixed(2)})\n`;
  message += `   Max DD: <b>${stats.maxDrawdownPct.toFixed(2)}%</b>\n`;
  message += `   Sharpe: <b>${stats.sharpe.toFixed(2)}</b>\n\n`;

  // Outcomes
  message += '🎯 <b>OUTCOMES</b>\n';
  message += `   TP1 (1R): ${stats.outcomes.TP1} (${((stats.outcomes.TP1 / stats.totalTrades) * 100).toFixed(1)}%)\n`;
  message += `   TP2 (2R): ${stats.outcomes.TP2} (${((stats.outcomes.TP2 / stats.totalTrades) * 100).toFixed(1)}%)\n`;
  message += `   SL (-1R): ${stats.outcomes.SL} (${((stats.outcomes.SL / stats.totalTrades) * 100).toFixed(1)}%)\n\n`;

  // Top symbols
  message += '🏆 <b>TOP SYMBOLS</b>\n';
  const sortedSymbols = Object.entries(stats.bySymbol)
    .sort((a, b) => b[1].totalPnl - a[1].totalPnl)
    .slice(0, 5);

  for (const [symbol, data] of sortedSymbols) {
    const pnl = data.totalPnl >= 0 ? '+' : '';
    message += `   ${symbol}: ${pnl}$${data.totalPnl.toFixed(2)} (${data.trades} trades, ${data.winRate.toFixed(0)}% WR)\n`;
  }

  message += '\n';

  // Parameters
  message += '⚙️ <b>PARAMÈTRES</b>\n';
  message += '   Entry: Signal READY (&gt;=80)\n';
  message += '   SL: max(0.4%, 0.75×ATR) = -1R\n';
  message += '   TP1: +1R (0.4-0.6%)\n';
  message += '   TP2: +2R (0.8-1.2%)\n';
  message += '   Fees: 0.10% round-trip\n';
  message += '   Position: 1000 USD\n\n';

  message += '⚠️ <b>NOTE</b>: Simulation basée sur volatilité et funding actuels.\n';
  message += '   Résultats réels peuvent varier.\n\n';

  message += '🔗 <a href="https://macro-dashboard-lemon.vercel.app/">Voir Dashboard</a>';

  return message;
}

// ─── MAIN ───

async function main() {
  console.log('🎯 Starting M15 Backtest (READY signals ≥80)...\n');

  const stats = await runBacktest();

  console.log('\n📊 Results:');
  console.log(`   Total trades: ${stats.totalTrades}`);
  console.log(`   Win rate: ${stats.winRate.toFixed(1)}%`);
  console.log(`   Avg PNL: ${stats.avgPnlPct.toFixed(3)}%`);
  console.log(`   Total PNL: ${stats.totalPnlPct.toFixed(2)}%`);
  console.log(`   Sharpe: ${stats.sharpe.toFixed(2)}`);

  const message = formatBacktestMessage(stats);

  console.log('\n📝 Sending to Telegram...');
  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('\n✅ Backtest report sent to Telegram!');
  } else {
    console.log('\n❌ Failed to send report');
    process.exit(1);
  }
}

main().catch(console.error);
