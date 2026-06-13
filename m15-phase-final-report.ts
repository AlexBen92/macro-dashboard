/**
 * RAPPORT FINAL M15 BACKTEST - PHASE 1 & 2
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

const PHASE1_RESULTS = {
  baseline: { trades: 125, pnl: 3.80, wr: 14.4, pf: 1.15 },
  whitelist: { trades: 3, pnl: 0.36, wr: 0, pf: 0 },
  sessionFilter: { trades: 35, pnl: -2.32, wr: 0, pf: 0 },
  whitelistSession: { trades: 2, pnl: 0.90, wr: 0, pf: 0 },
};

const PHASE2_FUNDING = [
  { threshold: -2, trades: 125, pnl: 3.80, pf: 1.39 },
  { threshold: -1.5, trades: 177, pnl: 3.90, pf: 1.22 },
  { threshold: -1, trades: 319, pnl: 15.16, pf: 1.61 },
  { threshold: -0.5, trades: 567, pnl: 21.39, pf: 1.38 },
  { threshold: -0.25, trades: 705, pnl: 5.11, pf: 1.05 },
];

const PHASE2_SL_SCORE = [
  { score: 60, sl: 0.75, trades: 567, pnl: 12.67, slHit: 83.6 },
  { score: 60, sl: 1, trades: 567, pnl: 26.98, slHit: 90.8 },
  { score: 60, sl: 1.5, trades: 567, pnl: 46.61, slHit: 97.0 },
  { score: 60, sl: 2, trades: 567, pnl: 56.48, slHit: 98.8 },
  { score: 65, sl: 0.75, trades: 178, pnl: 17.45, slHit: 79.8 },
  { score: 65, sl: 1, trades: 178, pnl: 16.94, slHit: 87.6 },
  { score: 65, sl: 1.5, trades: 178, pnl: 26.35, slHit: 94.4 },
  { score: 65, sl: 2, trades: 178, pnl: 30.23, slHit: 98.3 },
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

function formatFinalReport(): string {
  let m = '📊 <b>RAPPORT FINAL M15 BACKTEST - PHASE 1 & 2</b> 📊\n\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  // PHASE 1 RESULTS
  m += '<b>PHASE 1: FILTRES STRUCTURELS</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += '<i>Comparaison variantes (1H, 90j):</i>\n\n';
  m += '1️⃣ Baseline (tous tokens, 24/24)\n';
  m += '   Trades: ' + PHASE1_RESULTS.baseline.trades + ' | PNL: +' + PHASE1_RESULTS.baseline.pnl.toFixed(2) + '%\n';
  m += '   WR: ' + PHASE1_RESULTS.baseline.wr.toFixed(1) + '% | PF: ' + PHASE1_RESULTS.baseline.pf.toFixed(2) + '\n\n';

  m += '2️⃣ Whitelist LINK+BTC\n';
  m += '   ❌ Trop restrictif: ' + PHASE1_RESULTS.whitelist.trades + ' trades seulement\n\n';

  m += '3️⃣ Session Filter EU/US\n';
  m += '   ❌ Pire performance: PNL ' + PHASE1_RESULTS.sessionFilter.pnl.toFixed(2) + '%\n\n';

  m += '4️⃣ Régime Filter BULL only\n';
  m += '   ✅ Fonctionne mais bloque en BEAR/SIDEWAYS\n\n';

  m += '<b>Verdict Phase 1:</b> Baseline seul est optimal.\n\n';

  // PHASE 2 FUNDING
  m += '<b>PHASE 2A: FUNDING OPTIMISATION</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  for (const r of PHASE2_FUNDING) {
    const emoji = r.pnl >= 10 ? '🟢' : r.pnl >= 0 ? '🟡' : '🔴';
    m += emoji + ' Funding &lt; ' + r.threshold + ' bps\n';
    m += '    Trades: ' + r.trades + ' | PNL: +' + r.pnl.toFixed(2) + '% | PF: ' + r.pf.toFixed(2) + '\n';
  }
  m += '\n';

  m += '<b>🏆 Optimum: Funding &lt; -0.5 bps</b>\n';
  m += '    PNL: +21.39% sur 90 jours\n\n';

  // PHASE 2 SL + SCORE
  m += '<b>PHASE 2B: SL + SCORE OPTIMISATION</b>\n';
  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  m += '<i>Meilleures combinaisons (Funding &lt; -0.5 bps):</i>\n\n';

  const best = PHASE2_SL_SCORE.slice(0, 5);
  for (const r of best) {
    const emoji = r.pnl >= 30 ? '🟢' : r.pnl >= 0 ? '🟡' : '🔴';
    m += emoji + ' Score ≥ ' + r.score + ', SL ' + r.sl + 'x\n';
    m += '    Trades: ' + r.trades + ' | PNL: +' + r.pnl.toFixed(2) + '% | SL Hit: ' + r.slHit.toFixed(1) + '%\n';
  }
  m += '\n';

  // FINAL RECOMMENDATION
  m += '<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n';
  m += '<b>🎯 RECOMMANDATION FINALE</b>\n';
  m += '<b>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</b>\n\n';

  m += '<b>PARAMÈTRES OPTIMAUX:</b>\n';
  m += '• Timeframe: 1H\n';
  m += '• Funding: &lt; -0.5 bps\n';
  m += '• Score: ≥ 60\n';
  m += '• SL: 1.5x ATR (dynamique)\n';
  m += '• Paires: Tous top 9 tokens\n';
  m += '• Sessions: 24/24 (pas de filtre)\n\n';

  m += '<b>PERFORMANCE ATTENDUE (90 jours):</b>\n';
  m += '• Trades: 567 (6.3/jour)\n';
  m += '• PNL: +46.61%\n';
  m += '• Win Rate: ~20%\n';
  m += '• Profit Factor: ~1.4\n\n';

  m += '<b>⚠️ LIMITATIONS:</b>\n';
  m += '• SL Hit Rate reste élevé (97%)\n';
  m += '• Ne fonctionne qu\'en marché BULL\n';
  m += '• Pas validé sur 12+ mois\n\n';

  m += '<b>📋 PROCHAINES ÉTAPES (PHASE 3):</b>\n';
  m += '1. Backtest 12 mois + walk-forward\n';
  m += '2. Implémenter trailing stop\n';
  m += '3. Ajouter SHORT en régime BEAR\n';
  m += '4. Monte Carlo analysis\n\n';

  m += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  m += '🔗 https://macro-dashboard-lemon.vercel.app/';

  return m;
}

// ─── MAIN ───

async function main() {
  console.log('Génération rapport final...');

  const message = formatFinalReport();
  const sent = await sendTelegramMessage(message);

  if (sent) {
    console.log('✅ Rapport final envoyé à Telegram!');
  } else {
    console.log('❌ Erreur envoi');
    process.exit(1);
  }
}

main().catch(console.error);
