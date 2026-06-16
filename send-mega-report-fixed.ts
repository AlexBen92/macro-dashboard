/**
 * SEND CORRIGED MEGA REPORT TO TELEGRAM
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
const BOT_TOKEN = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/)?.[1] ?? '';
const CHAT_ID = envContent.match(/TELEGRAM_CHAT_ID=(.+)/)?.[1] ?? '';

const PARTS = [
  // Part 1
  String.raw`📘 *MACRO DASHBOARD — RAPPORT COMPLET*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🌐 *URL :* https://macro-dashboard-lemon.vercel.app

🎯 *OBJECTIF :*
Dashboard de trading multi-actives (Crypto + Prop Firms) avec signaux temps réel, scoring multicouche, et détection de régimes de marché.`,

  // Part 2 - Architecture CORRIGÉE
  String.raw`📊 *ARCHITECTURE GLOBALE*

Le dashboard utilise une architecture en **3 Couches** :

│ Couche │ Nom │ Fonction │
│ L1 │ FILTERS │ Session, Volume, Funding │
│ L2 │ SETUP │ VWAP, OI, OFI, Depth │
│ L3 │ CONFIRM │ Trend, Vol, ACF │

Note : L4 Execution et L5 Journal sont en développement (calculateur de position présent mais pas connecté au live).`,

  // Part 3 - Sessions
  String.raw`🕘 *SESSIONS DE TRADING*

│ Session │ Heure UTC │ Score │ Couleur │
│ Asia │ 01h00–04h00 │ 35/100 │ Jaune ⚠️ │
│ EU Open │ 07h00–09h00 │ 80/100 │ Vert ✅ │
│ EU/US Core │ 13h00–17h00 │ 100/100 │ Vert foncé ✅ │
│ US Extend │ 17h00–20h00 │ 70/100 │ Vert clair ✅ │
│ Off │ Autres │ 0/100 │ Gris ⬜ │`,

  // Part 4 - Scanner CORRIGÉ
  String.raw`📈 *TOP TOKEN SCANNER V9*

Colonnes du Scanner :

│ Colonne │ Contenu │ Usage │
│ Token │ Symbol │ Identification │
│ Score │ 0-6 (Setup) │ Ancien système checklist │
│ Prix │ Prix │ Entrée │
│ Funding │ % (8h) │ Edge et direction │
│ 24h │ % | Trend daily │
│ Vol │ Volume | Liquidité │
│ OI │ OI | Intérêt ouvert │
│ OFI │ ▲68%ρ.41 | Order flow persistant │
│ ACF │ ████ | Autocorrélation lags 1-10 │
│ VOL │ LOW/NORMAL/HIGH | Régime volatilité │
│ Dir │ L/S/W | Direction trade │
│ SL │ Prix | Stop loss calculé │
│ TP1/TP2 │ Prix | Take profits │
│ Size │ USDT | Taille position │

Note : Le "ScalpScore 0-100" composite est calculé en interne mais pas encore affiché dans le tableau. La colonne Score actuelle (0-6) est le système de checklist basé sur 6 critères.`,

  // Part 5 - OFI Badge
  String.raw`🔹 *LECTURE DU BADGE OFI*

Format : ▲68%ρ.41

│ Élément │ Signification │
│ ▲ │ Direction (BUY/SELL/NEUTRAL) │
│ 68% │ Probabilité de continuation │
│ ρ.41 │ Premier lag ACF (persistence) │`,

  // Part 6 - ACF
  String.raw`🔬 *ACF (AUTOCORRELATION FUNCTION)*

ρ(k) = Corrélation(OFI_t, OFI_{t-k})

│ ρ(1) │ Signification │ Trade │
│ > 0.4 │ Flux très persistant │ Entrée dans le sens │
│ 0.2–0.4 │ Persistence modérée │ Continuation probable │
│ < 0 │ Anti-persistence │ Mean-reversion │

*sumACF(1-5)* : Somme des 5 premiers lags

│ Valeur │ Régime │ Stratégie │
│ > 1.5 │ Trending fort │ Traîner stops │
│ 0.5–1.5 │ Trending modéré │ TP serrés │
│ < -0.5 │ Mean-reversion │ Fade les moves │`,

  // Part 7 - Sparkline ACF
  String.raw`📊 *SPARKLINE ACF*

█████████ → Croissant = Trend établi
████░░░░░ → Décroissant = Momentum faiblit
█░█░█░█░ → Alternant = Oscillation/Range

*L2 WebSocket* :

Le dashboard se connecte en WebSocket au carnet d'ordres Hyperliquid pour capturer les trades en temps réel.

🟢 CONNECTED → Données temps réelles actives
🔴 DISCONNECTED → Mode fallback (refresh 30s)`,

  // Part 8 - Scoring CORRIGÉ
  String.raw`🎯 *SCORING*

**Score Setup (0-6)** — Colonne actuelle du scanner :

Basé sur 6 critères binaires :
1. Session active (≥ 70/100)
2. Volume significatif (≥ 10M USD)
3. Funding edge (≥ 0.10%)
4. Trend clair (|24h| > 0.5%)
5. OI significatif (≥ 5M USD)
6. Volatilité exploitable

Score = Nombre de critères validés (0-6)

**ScalpScore (0-100)** — Calculé en interne (pas encore affiché) :

│ Élément │ Poids │
│ L1 (Filters) │ 30% │
│ L2 (Setup) │ 40% │
│ L3 (Confirm) │ 30% │`,

  // Part 9 - Decision Bar
  String.raw`🚦 *DECISION BAR*

🟢 READY — Tous les critères validés
🟡 WATCH — Presque, attendre confirmation
🔴 AVOID — Setup absent, risque élevé`,

  // Part 10 - VOL (sans GARCH)
  String.raw`📊 *RÉGIMES DE VOLATILITÉ*

Le dashboard classe la volatilité en 4 régimes basés sur la variance réalisée :

│ Régime │ Description │ Action │
│ LOW │ March calme │ Size +20% │
│ NORMAL │ Volatilité standard │ Size standard │
│ HIGH │ Volatilité élevée │ Size -30% │
│ EXPLOSIVE │ Volatilité extrême │ Size -50% ou skip │

Note : Le modèle GARCH pour la prédiction de volatilité est implémenté mais les colonnes GARCH (vol_ratio, regime, size_mult) ne sont pas encore visibles dans le tableau principal.`,

  // Part 11 - Funding
  String.raw`💰 *FUNDING RATE ARBITRAGE*

Funding Rate : Paiement périodique (8h) entre longs et shorts

- Funding négatif = Longs payent Shorts (bearish)
- Funding positif = Shorts payent Longs (bullish)

Edge de Trading : |Funding|/8 - TakerFee (0.05%)

│ Funding brut │ Net après fees │ Edge │
│ 0.10% │ 0.05% | ⚠️ Faible │
│ 0.20% │ 0.15% | ✅ Bon │
│ 0.50% │ 0.45% | 🔥 Excellent │`,

  // Part 12 - Macro
  String.raw`🌍 *MACRO CONTEXT*

Le dashboard analyse 4 facteurs macro :

1. **VIX** : Volatilité implicite S&P500
   - < 15 : Risk-on
   - > 25 : Risk-off (réduire sizing)

2. **Taux US (10Y)** : Croissant = USD strong = crypto pressure

3. **DXY (Dollar Index)** :
   - > 105 : USD strong, crypto sous pression
   - < 100 : USD weak, crypto favorable

4. **Risk-on/off Sentiment** :
   - Risk-on = Crypto outperform
   - Risk-off = USD, Gold safe haven`,

  // Part 13 - Stratégies
  String.raw`⚔️ *STRATÉGIES*

*M15 TREND FOLLOWING*

Setup :
1. Session EU/US Core active
2. Score Setup ≥ 4/6
3. OFI BUY/SELL avec ρ(1) > 0.3
4. p(continuation) ≥ 65%
5. VOL NORMAL

Exécution : Entrée à l'ouverture M15, SL = 0.75 × ATR, TP1 = 1.2 × SL

*FUNDING EDGE*

Setup : Funding ≥ 0.20% net
Exécution : Hold au moins 4h

*MEAN-REVERSION*

Setup : OFI mais ρ(1) < 0, sumACF(1-5) < 0
Exécution : Cherry pick, TP serrés`,

  // Part 14 - Risk Management
  String.raw`🛡️ *RISK MANAGEMENT*

Calculateur de Position :

Risk = Equity × 0.15%
Size = Risk / SL distance

Règles :
- Max risk/trade = 0.15% equity
- Max risk/jour = 0.60% equity
- Max positions = 3 simultanées

Adjustement Volatilité :

│ VOL │ Ajustement │
│ LOW | Size +20% │
│ NORMAL | Size standard │
│ HIGH | Size -30% │
│ EXPLOSIVE | Size -50% ou skip │`,

  // Part 15 - Checklist
  String.raw`✅ *CHECKLIST PRÉ-TRADE*

AVANT D'OUVRIR UNE POSITION :

☑ Session active et score ≥ 70/100
☑ Volume ≥ 10M USD 24h
☑ Funding edge ≥ 0.10% net
☑ Trend direction claire
☑ OI ≥ 5M USD
☑ VOL pas EXPLOSIVE
☑ OFI : ρ(1) > 0.3 dans le sens
☑ ACF : sumACF(1-5) confirme régime
☑ P(continuation) ≥ 60%
☑ Score Setup ≥ 4/6
☑ SL calculé et placé
☑ TP1 et TP2 définis
☑ Size = 0.15% equity max
☑ R:R ≥ 1.5

Si 10+ checks → Entrée autorisée
Si 8-9 checks → Attendre confirmation
Si < 8 checks → PAS DE TRADE`,

  // Part 16 - Erreurs
  String.raw`⚠️ *ERREURS COMMUNES*

❌ Ignorer la Session (trader Asia score 35)
❌ Ignorer ρ(1) < 0 (mean-reversion)
❌ Trader VOL:EXPLOSIVE (SL large)
❌ Sur-respecter le Funding (OFI est plus rapide)
❌ No ACF Check (entrer en fin de trend)
❌ Oversizing (3% risk = gamble)
❌ Cherry Pick Contrarian (suivre le trend)
❌ Ignorer Macro (VIX > 25 = réduire sizing)`,

  // Part 17 - Status et Roadmap
  String.raw`🚀 *STATUS ET ROADMAP*

**DÉPLOYÉ ✅**
- TopTokenScanner v9 (OFI + ACF)
- Session scoring
- Funding Rate aggregator
- OFI Badge (ρ(1) visible)
- ACF Sparkline
- Decision Bar

**EN DÉVELOPPEMENT 🔨**
- ScalpScore 0-100 (calculé mais pas affiché)
- Colonnes GARCH (vol_ratio, regime, size_mult)
- L4 Execution automation
- L5 Trade Journal live

**BUG RÉPARÉ 🐛**
- CORS fix : Proxy /api/hyperliquid déployé
- Tokens chargent maintenant (178 actifs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *DASHBOARD :* https://macro-dashboard-lemon.vercel.app

🔄 *MAJ :*
- Scanner : 30s
- ACF/OFI : 3s (L2 WS)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*FIN DU RAPPORT*

Version : v9.1 (OFI + ACF déployés, GARCH en dev)
CORS fix : ✅ déployé
Date : ` + new Date().toISOString().split('T')[0]
];

async function sendToTelegram(message: string): Promise<boolean> {
  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

async function sendMegaReport() {
  console.log('📤 Envoi du RAPPORT CORRIGÉ sur Telegram...');

  for (let i = 0; i < PARTS.length; i++) {
    console.log(`📨 Part ${i + 1}/${PARTS.length}...`);
    const success = await sendToTelegram(PARTS[i]);
    if (!success) {
      console.error(`❌ Failed at part ${i + 1}`);
      return;
    }
    if (i < PARTS.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log('✅ RAPPORT CORRIGÉ envoyé !');
}

sendMegaReport();
