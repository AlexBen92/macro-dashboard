/**
 * RAPPORT FINAL CONSOLIDÉ - M15 BACKTEST
 * PHASE 1 + 2 + 3
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

// ─── RÉSULTATS CONSOLIDÉS ───

const PHASE1_SUMMARY = {
  baseline: { trades: 125, pnl: 3.80, verdict: '✅ Meilleur' },
  whitelist: { trades: 3, pnl: 0.36, verdict: '❌ Trop restrictif' },
  sessionFilter: { trades: 35, pnl: -2.32, verdict: '❌ Pire performance' },
  regimeFilter: { trades: 0, pnl: 0, verdict: '✅ Bloque correctement' },
};

const PHASE2_FUNDING = [
  { threshold: -2, trades: 125, pnl: 3.80, pf: 1.39 },
  { threshold: -1.5, trades: 177, pnl: 3.90, pf: 1.22 },
  { threshold: -1, trades: 319, pnl: 15.16, pf: 1.61 },
  { threshold: -0.5, trades: 567, pnl: 21.39, pf: 1.38, best: true },
  { threshold: -0.25, trades: 705, pnl: 5.11, pf: 1.05 },
];

const PHASE2_SL_SCORE = [
  { score: 60, sl: 1.5, trades: 567, pnl: 46.61, best: true },
  { score: 60, sl: 2, trades: 567, pnl: 56.48, slHit: 98.8 },
  { score: 65, sl: 0.75, trades: 178, pnl: 17.45, slHit: 79.8 },
];

const PHASE3_WALK_FORWARD = {
  is: { trades: 1222, pnl: -136.10, sharpe: -1.29, days: 240 },
  oos: { trades: 806, pnl: 38.38, sharpe: 1.01, days: 125, valid: true },
  total: { trades: 2028, pnl: -97.72, sharpe: -0.5 },
};

const PHASE3_MIRROR = {
  bull: { trades: 292, pnl: -66.17 },
  bear: { trades: 1210, pnl: -284.92 },
  total: { trades: 1502, pnl: -351.08 },
};

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

function formatFinalMessage(): string {
  let m = '📊 <b>RAPPORT FINAL M15 - PHASES 1, 2, 3</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // PHASE 1
  m += '<b>━━━ PHASE 1: FILTRES STRUCTURELS ━━━</b>\n\n';
  m += '✅ Baseline (1H, tous tokens): +3.80% PNL\n';
  m += '❌ Whitelist LINK+BTC: Trop restrictif\n';
  m += '❌ Session Filter: Détériore performance\n';
  m += '✅ Régime Filter: Fonctionne (bloque en BEAR)\n\n';

  // PHASE 2
  m += '<b>━━━ PHASE 2: OPTIMISATION PARAMÈTRES ━━━</b>\n\n';
  m += '<b>Funding:</b> &lt; -0.5 bps optimal → +21.39%\n';
  m += '<b>Score:</b> ≥ 60 optimal\n';
  m += '<b>SL:</b> 1.5x ATR → +46.61% PNL (meilleur ratio)\n\n';

  m += '⚠️ <b>PROBLÈME:</b> SL Hit Rate reste 97%\n';
  m += '   Objectif &lt; 60% NON ATTEINT\n\n';

  // PHASE 3
  m += '<b>━━━ PHASE 3: VALIDATION 12 MOIS ━━━</b>\n\n';

  m += '<b>Walk-Forward:</b>\n';
  m += '  IS (8 mois): -136.10% (Sharpe -1.29) ❌\n';
  m += '  OOS (4 mois): +38.38% (Sharpe 1.01) ✅\n';
  m += '  TOTAL: -97.72% ❌\n\n';

  m += '<b>Mirror Strategy (SHORT en BEAR):</b>\n';
  m += '  BULL (LONG): -66.17% ❌\n';
  m += '  BEAR (SHORT): -284.92% ❌❌❌\n';
  m += '  TOTAL: -351.08% ❌❌❌\n\n';

  // VERDICT
  m += '<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n';
  m += '<b>❌ VERDICT FINAL: STRATÉGIE NON DÉPLOYABLE</b>\n';
  m += '<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n';

  m += '<b>PROBLÈMES FONDAMENTAUX:</b>\n';
  m += '1️⃣ Dépendance extrême au régime BULL\n';
  m += '2️⃣ PNL négatif sur 12 mois (-97% à -351%)\n';
  m += '3️⃣ Win Rate catastrophique (8-20%)\n';
  m += '4️⃣ SL Hit Rate 95-98% (objectif &lt; 60% impossible)\n';
  m += '5️⃣ Mirror strategy (SHORT) aggrave les pertes\n\n';

  m += '<b>SEULE OPTION VALIDE:</b>\n';
  m += '• LONG ONLY en régime BULL strict\n';
  m += '• Bloquer totalement en BEAR/SIDEWAYS\n';
  m += '• Accepter longues périodes sans trading\n\n';

  m += '<b>PERFORMANCE ATTENDUE (BULL only):</b>\n';
  m += '• Trades: ~292 sur période BULL\n';
  m += '• PNL: -66.17% (même en BULL!)\n';
  m += '• Win Rate: ~15%\n\n';

  m += '<b>🚫 RECOMMANDATION: NE PAS DÉPLOYER</b>\n\n';

  m += '<b>ALTERNATIVES:</b>\n';
  m += '1. Pivot vers pure funding arbitrage\n';
  m += '2. Refondre complète la logique de signal\n';
  m += '3. Backtester sur d\'autres marchés\n\n';

  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

async function main() {
  console.log('Génération rapport final consolidé...');

  const message = formatFinalMessage();
  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('✅ Rapport final envoyé à Telegram!');
  } else {
    console.log('❌ Erreur envoi');
    process.exit(1);
  }
}

main().catch(console.error);
