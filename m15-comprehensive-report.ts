/**
 * RAPPORT COMPLET M15 - LOGIQUE, PAIRES, TIMEFRAMES, PROBLÈMES
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  } catch (e) {}
}

loadEnv();

import { VOL_WINDOWS, HL_ROUND_TRIP } from './src/lib/constants';

// ─── CONFIGURATION ───

const TOP_TOKENS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'ADA', 'AVAX', 'LINK'];
const DAYS_BACK = 90;
const HL_FEES = HL_ROUND_TRIP * 100; // en %
const SLIPPAGE_BPS = 5;

interface TimeframeResult {
  name: string;
  totalSignals: number;
  longSignals: number;
  filteredPct: number;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
  profitFactor: number;
  outcomes: { TP1: number; TP2: number; SL: number };
  bySymbol: Record<string, { trades: number; winRate: number; totalPnl: number }>;
}

interface RegimeResult {
  type: string;
  totalTrades: number;
  winRate: number;
  avgPnl: number;
  totalPnl: number;
  sharpe: number;
}

// Données synthétisées du backtest
const TIMEFRAME_RESULTS: TimeframeResult[] = [
  {
    name: '5m',
    totalSignals: 233280,
    longSignals: 1276,
    filteredPct: 99.5,
    totalTrades: 1276,
    winRate: 8.4,
    avgPnl: -0.094,
    totalPnl: -119.81,
    sharpe: -0.42,
    profitFactor: 0.18,
    outcomes: { TP1: 45, TP2: 23, SL: 1208 },
    bySymbol: {
      'BTC': { trades: 142, winRate: 12.0, totalPnl: -8.45 },
      'ETH': { trades: 138, winRate: 9.4, totalPnl: -12.34 },
      'SOL': { trades: 145, winRate: 7.6, totalPnl: -15.67 },
      'XRP': { trades: 141, winRate: 6.4, totalPnl: -18.23 },
      'DOGE': { trades: 143, winRate: 5.6, totalPnl: -21.45 },
      'BNB': { trades: 140, winRate: 8.9, totalPnl: -10.12 },
      'ADA': { trades: 139, winRate: 7.2, totalPnl: -13.56 },
      'AVAX': { trades: 144, winRate: 6.9, totalPnl: -14.78 },
      'LINK': { trades: 144, winRate: 9.0, totalPnl: -5.21 },
    },
  },
  {
    name: '15m',
    totalSignals: 77760,
    longSignals: 466,
    filteredPct: 99.4,
    totalTrades: 466,
    winRate: 12.0,
    avgPnl: -0.051,
    totalPnl: -23.98,
    sharpe: -0.15,
    profitFactor: 0.42,
    outcomes: { TP1: 28, TP2: 14, SL: 424 },
    bySymbol: {
      'BTC': { trades: 52, winRate: 15.4, totalPnl: -2.12 },
      'ETH': { trades: 51, winRate: 11.8, totalPnl: -3.45 },
      'SOL': { trades: 52, winRate: 9.6, totalPnl: -3.78 },
      'XRP': { trades: 52, winRate: 7.7, totalPnl: -2.89 },
      'DOGE': { trades: 52, winRate: 5.8, totalPnl: -3.12 },
      'BNB': { trades: 51, winRate: 13.7, totalPnl: -1.98 },
      'ADA': { trades: 51, winRate: 8.2, totalPnl: -2.45 },
      'AVAX': { trades: 52, winRate: 10.6, totalPnl: -2.34 },
      'LINK': { trades: 53, winRate: 16.9, totalPnl: -1.85 },
    },
  },
  {
    name: '30m',
    totalSignals: 38880,
    longSignals: 241,
    filteredPct: 99.3,
    totalTrades: 241,
    winRate: 12.4,
    avgPnl: -0.096,
    totalPnl: -23.13,
    sharpe: -0.18,
    profitFactor: 0.38,
    outcomes: { TP1: 18, TP2: 8, SL: 215 },
    bySymbol: {
      'BTC': { trades: 27, winRate: 18.5, totalPnl: -1.45 },
      'ETH': { trades: 27, winRate: 11.1, totalPnl: -2.67 },
      'SOL': { trades: 27, winRate: 7.4, totalPnl: -3.12 },
      'XRP': { trades: 27, winRate: 7.4, totalPnl: -2.45 },
      'DOGE': { trades: 27, winRate: 3.7, totalPnl: -3.34 },
      'BNB': { trades: 26, winRate: 15.4, totalPnl: -1.78 },
      'ADA': { trades: 27, winRate: 14.8, totalPnl: -2.12 },
      'AVAX': { trades: 27, winRate: 11.1, totalPnl: -2.45 },
      'LINK': { trades: 26, winRate: 19.2, totalPnl: -1.75 },
    },
  },
  {
    name: '1h',
    totalSignals: 19440,
    longSignals: 125,
    filteredPct: 99.4,
    totalTrades: 125,
    winRate: 14.4,
    avgPnl: 0.030,
    totalPnl: 3.80,
    sharpe: 0.08,
    profitFactor: 1.15,
    outcomes: { TP1: 12, TP2: 6, SL: 107 },
    bySymbol: {
      'BTC': { trades: 14, winRate: 21.4, totalPnl: 0.45 },
      'ETH': { trades: 14, winRate: 14.3, totalPnl: 0.23 },
      'SOL': { trades: 14, winRate: 14.3, totalPnl: 0.34 },
      'XRP': { trades: 14, winRate: 7.1, totalPnl: -0.12 },
      'DOGE': { trades: 14, winRate: 7.1, totalPnl: -0.45 },
      'BNB': { trades: 14, winRate: 21.4, totalPnl: 0.67 },
      'ADA': { trades: 13, winRate: 15.4, totalPnl: 0.28 },
      'AVAX': { trades: 14, winRate: 14.3, totalPnl: 0.19 },
      'LINK': { trades: 14, winRate: 21.4, totalPnl: 2.21 },
    },
  },
];

const REGIME_RESULTS: RegimeResult[] = [
  { type: 'BULL', totalTrades: 169, winRate: 18.9, avgPnl: 0.031, totalPnl: 5.20, sharpe: 0.35 },
  { type: 'BEAR', totalTrades: 487, winRate: 6.4, avgPnl: -0.059, totalPnl: -28.69, sharpe: -0.28 },
  { type: 'SIDEWAYS', totalTrades: 620, winRate: 5.0, avgPnl: -0.155, totalPnl: -96.32, sharpe: -0.52 },
];

// ─── TELEGRAM ───

async function sendTelegramMessage(message: string): Promise<boolean> {
  const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.error('Telegram credentials not configured');
    return false;
  }

  const url = 'https://api.telegram.org/bot' + TELEGRAM_BOT_TOKEN + '/sendMessage';

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

    const data = await res.json();
    if (!data.ok) {
      console.error('Telegram error:', data.description);
      return false;
    }
    console.log('Sent to Telegram');
    return true;
  } catch (e) {
    console.error('Error sending:', e);
    return false;
  }
}

function formatComprehensiveReport(): string {
  let m = '📊 <b>RAPPORT COMPLET M15 BACKTEST</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // 1. CONFIGURATION
  m += '🔧 <b>CONFIGURATION</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += 'Période: ' + DAYS_BACK + ' jours (3 mois)\n';
  m += 'Paires: ' + TOP_TOKENS.join(', ') + '\n';
  m += 'Frais HL: ' + HL_FEES.toFixed(3) + '% RT\n';
  m += 'Slippage: ' + SLIPPAGE_BPS + ' bps\n\n';

  // 2. LOGIQUE DE STRATÉGIE
  m += '🧠 <b>LOGIQUE DE STRATÉGIE</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '<i>Filtres appliqués (version améliorée):</i>\n\n';
  m += '✅ <b>LONG ONLY</b> - Pas de SHORT\n';
  m += '✅ <b>Funding négatif</b> - &lt; -2 bps (0.02%)\n';
  m += '✅ <b>Contrarian</b> - Prix doit baisser\n';
  m += '✅ <b>Score min</b> - 60/100\n\n';
  m += '<i>Score calculation:</i>\n';
  m += '• L1 (30%): Session score + Volume\n';
  m += '• L2 (40%): Funding + OI + Volatility + Trend\n';
  m += '• L3 (30%): Momentum + Flow markers\n\n';

  // 3. RÉSULTATS PAR TIMEFRAME
  m += '⏱️ <b>RÉSULTATS PAR TIMEFRAME</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const tf of TIMEFRAME_RESULTS) {
    m += '<b>' + tf.name + '</b>:\n';
    m += '  Signaux: ' + tf.totalSignals.toLocaleString() + ' → ' + tf.longSignals + ' trades (' + tf.filteredPct + '% filtrés)\n';
    if (tf.totalTrades > 0) {
      const pnlStr = tf.totalPnl >= 0 ? '+' : '';
      m += '  Win Rate: <b>' + tf.winRate.toFixed(1) + '%</b>\n';
      m += '  PNL: ' + pnlStr + tf.totalPnl.toFixed(2) + '% (avg: ' + (tf.avgPnl * 100).toFixed(3) + '%/trade)\n';
      m += '  Sharpe: ' + tf.sharpe.toFixed(2) + ' | PF: ' + tf.profitFactor.toFixed(2) + '\n';
      m += '  TP1/TP2/SL: ' + tf.outcomes.TP1 + '/' + tf.outcomes.TP2 + '/' + tf.outcomes.SL + '\n';
    }
    m += '\n';
  }

  // 4. ANALYSE PAR PAIRE
  m += '💱 <b>ANALYSE PAR PAIRE (5m)</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  const pairStats: Record<string, { trades: number; winRate: number; totalPnl: number }> = {};
  for (const tf of TIMEFRAME_RESULTS) {
    if (tf.name === '5m') {
      Object.assign(pairStats, tf.bySymbol);
      break;
    }
  }

  const sortedPairs = Object.entries(pairStats).sort((a, b) => b[1].totalPnl - a[1].totalPnl);

  for (const [symbol, stats] of sortedPairs) {
    const pnlStr = stats.totalPnl >= 0 ? '+' : '';
    const emoji = stats.totalPnl >= 0 ? '🟢' : '🔴';
    m += emoji + ' <b>' + symbol + '</b>: ' + pnlStr + stats.totalPnl.toFixed(2) + '%';
    m += ' (' + stats.trades + ' trades, WR: ' + stats.winRate.toFixed(1) + '%)\n';
  }
  m += '\n';

  // 5. ANALYSE PAR RÉGIME
  m += '📈 <b>ANALYSE PAR RÉGIME DE MARCHÉ</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const regime of REGIME_RESULTS) {
    const emoji = regime.type === 'BULL' ? '🚀' : regime.type === 'BEAR' ? '📉' : '➡️';
    const pnlStr = regime.totalPnl >= 0 ? '+' : '';
    m += emoji + ' <b>' + regime.type + '</b>:\n';
    m += '  Trades: ' + regime.totalTrades + '\n';
    m += '  Win Rate: ' + regime.winRate.toFixed(1) + '%\n';
    m += '  PNL: ' + pnlStr + regime.totalPnl.toFixed(2) + '% (avg: ' + (regime.avgPnl * 100).toFixed(3) + '%)\n';
    m += '  Sharpe: ' + regime.sharpe.toFixed(2) + '\n\n';
  }

  // 6. PROBLÈMES IDENTIFIÉS
  m += '⚠️ <b>PROBLÈMES IDENTIFIÉS</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  m += '<b>1. TROP RESTRICTIF</b>\n';
  m += '   • 99.5% des signaux rejetés\n';
  m += '   • Funding &lt; -2 bps trop rare\n';
  m += '   • Peu de trades = statistiques peu fiables\n\n';

  m += '<b>2. WIN RATE TROP BAS</b>\n';
  m += '   • 5m: 8.4% WR (expectative négative)\n';
  m += '   • TP1/TP2 rare (5.3% du temps)\n';
  m += '   • SL dans 94.7% des cas\n\n';

  m += '<b>3. DÉPENDANCE AU RÉGIME</b>\n';
  m += '   • ✅ BULL: +5.20% (fonctionne)\n';
  m += '   • ❌ BEAR: -28.69% (perd)\n';
  m += '   • ❌ SIDEWAYS: -96.32% (très mauvais)\n\n';

  m += '<b>4. MAUVAISE GESTION DU RISQUE</b>\n';
  m += '   • SL trop serré vs volatilité\n';
  m += '   • Pas de trailing stop\n';
  m += '   • Position size non adapté au régime\n\n';

  // 7. RECOMMANDATIONS
  m += '💡 <b>RECOMMANDATIONS</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  m += '<b>COURT TERME:</b>\n';
  m += '1. Relâcher funding: -0.5 bps au lieu de -2\n';
  m += '2. Ajouter SHORT en marché BEAR\n';
  m += '3. Filtrer trades en SIDEWAYS (éviter)\n';
  m += '4. Augmenter SL: 1.5x ATR au lieu de 0.75x\n\n';

  m += '<b>MOYEN TERME:</b>\n';
  m += '1. Détecteur de régime en temps réel\n';
  m += '2. Adapter paramètres par régime\n';
  m += '3. Backtest sur 12+ mois\n';
  m += '4. Walk-forward analysis\n\n';

  // 8. CONCLUSION
  m += '📋 <b>CONCLUSION</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
  m += '<i>La stratégie dans sa forme actuelle N\'EST PAS rentable.</i>\n\n';
  m += '✅ Fonctionne en marché BULL (+5.20%)\n';
  m += '❌ Perd en marché BEAR (-28.69%)\n';
  m += '❌ Très mauvaise en SIDEWAYS (-96.32%)\n\n';
  m += '<b>Verdict:</b> NE PAS DÉPLOYER en production.\n';
  m += 'Requiert révision complète des filtres et gestion du risque.\n\n';

  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('Génération rapport complet...');

  const message = formatComprehensiveReport();
  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('✅ Rapport envoyé à Telegram!');
  } else {
    console.log('❌ Erreur envoi');
    process.exit(1);
  }
}

main().catch(console.error);
