/**
 * SEND MEGA REPORT TO TELEGRAM
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

  // Part 2 - Architecture
  String.raw`📊 *ARCHITECTURE GLOBALE*

Le dashboard utilise une architecture en **5 Couches** :

│ Couche │ Nom │ Fonction │
│ L1 │ FILTERS │ Session, Volume, Funding │
│ L2 │ SETUP │ VWAP, OI, OFI, Depth │
│ L3 │ CONFIRM │ Trend, Vol, ACF, GARCH │
│ L4 │ EXECUTION │ Risk management, TP/SL │
│ L5 │ JOURNAL │ Tracking performance │`,

  // Part 3 - Sessions
  String.raw`🕘 *SESSIONS DE TRADING*

│ Session │ Heure UTC │ Score │ Couleur │
│ Asia │ 01h00–04h00 │ 35/100 │ Jaune ⚠️ │
│ EU Open │ 07h00–09h00 │ 80/100 │ Vert ✅ │
│ EU/US Core │ 13h00–17h00 │ 100/100 │ Vert foncé ✅ │
│ US Extend │ 17h00–20h00 │ 70/100 │ Vert clair ✅ │
│ Off │ Autres │ 0/100 │ Gris ⬜ │

Pourquoi les Scores ?
- Asia : Volume faible, spreads larges → Éviter
- EU Open : Bon volume, volatilité émergente → Opportunités
- EU/US Core : Meilleur momentum → Zone prime
- US Extend : Volatilité décroissante → Cherry pick`,

  // Part 4 - Scanner
  String.raw`📈 *TOP TOKEN SCANNER V9*

Colonnes du Scanner :

│ Colonne │ Contenu │ Usage │
│ Token │ Symbol │ Identification │
│ Score │ 0-6 │ Setup quality │
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
│ Size │ USDT | Taille position │`,

  // Part 5 - OFI Badge
  String.raw`🔹 *LECTURE DU BADGE OFI*

Format : ▲68%ρ.41

│ Élément │ Signification │
│ ▲ │ Direction (BUY/SELL/NEUTRAL) │
│ 68% │ Probabilité de continuation │
│ ρ.41 │ Premier lag ACF (persistence) │

Interprétation :
- ▲68%ρ.41 → Flux BUY persistant, 68% de chance de continuer
- ▼42%ρ-.20 → Flux SELL mais persistence faible (ρ négatif)
- ◆55%ρ.05 → NEUTRAL, pas de signal clair`,

  // Part 6 - ACF
  String.raw`🔬 *ACF (AUTOCORRELATION FUNCTION)*

ρ(k) = Corrélation(OFI_t, OFI_{t-k})

Mesure si le flux d'ordres actuel influence le flux futur.

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

Le dashboard se connecte en WebSocket au carnet d'ordres Hyperliquid pour capturer :
- Trades en temps réel (L2)
- Order flow imbalance
- Mise à jour ACF chaque ~3 secondes

Status Indicator :
🟢 CONNECTED → Données temps réelles actives
🔴 DISCONNECTED → Mode fallback (refresh 30s)`,

  // Part 8 - Scoring
  String.raw`🎯 *SCORING ET DÉCISION*

Score Composite (0-100) :

│ Élément │ Poids │ Détail │
│ L1 (Filters) │ 30% │ Session 60% + Volume 40% │
│ L2 (Setup) │ 40% │ Funding 25% + OI 20% + OFI 30% + Depth 15% + Spread 10% │
│ L3 (Confirm) │ 30% │ Trend 30% + Vol 20% + ACF 30% + P(continuation) 20% │

Seuils d'Action :

│ Score │ Action │ Rationale │
│ 80-100 │ ENTRY IMMÉDIATE │ Setup parfait │
│ 60-79 │ SURVEILLANCE RAPPROCHÉE │ Presque prêt │
│ 40-59 │ OBSERVER │ Pas encore │
│ < 40 │ ÉVITER │ Setup absent │`,

  // Part 9 - Decision Bar
  String.raw`🚦 *DECISION BAR*

🟢 READY — Tous les critères validés
🟡 WATCH — Presque, attendre confirmation
🔴 AVOID — Setup absent, risque élevé`,

  // Part 10 - GARCH
  String.raw`📊 *GARCH ET VOLATILITÉ*

GARCH (Generalized Autoregressive Conditional Heteroskedasticity) :
Modèle statistique qui prédit la volatilité future.

Régimes de Volatilité :

│ Régime │ Vol │ Spread │ SL/TP │
│ LOW | < 1% ATR | Standard | SL/TP normaux │
│ NORMAL | 1-2% ATR | Standard | SL/TP normaux │
│ HIGH | 2-4% ATR | Élargir | +20% SL/TP │
│ EXPLOSIVE | > 4% ATR | Très large | Éviter ou sizing réduit │`,

  // Part 11 - Funding
  String.raw`💰 *FUNDING RATE ARBITRAGE*

Funding Rate : Paiement périodique (8h) entre longs et shorts

- Funding négatif = Longs payent Shorts (bearish)
- Funding positif = Shorts payent Longs (bullish)

Edge de Trading : Calcul = |Funding|/8 - TakerFee (0.05%)

│ Funding brut │ Net après fees │ Edge │
│ 0.10% │ 0.10% - 0.05% = 0.05% │ ⚠️ Faible │
│ 0.20% │ 0.20% - 0.05% = 0.15% │ ✅ Bon │
│ 0.50% │ 0.50% - 0.05% = 0.45% │ 🔥 Excellent │`,

  // Part 12 - Macro
  String.raw`🌍 *MACRO CONTEXT*

Régimes Macro : Le dashboard analyse 4 facteurs macro

1. **VIX** : Volatilité implicite S&P500
   - < 15 : Risk-on, carry trade favorable
   - 15-25 : Normal
   - > 25 : Risk-off, réduire sizing

2. **Taux US (10Y)** : Croissant = USD strong = crypto pressure

3. **DXY (Dollar Index)** :
   - > 105 : USD strong, crypto sous pression
   - < 100 : USD weak, crypto favorable

4. **Risk-on/off Sentiment** :
   - Risk-on = Crypto, Tech outperform
   - Risk-off = USD, Gold, Bonds outperform`,

  // Part 13 - Stratégies
  String.raw`⚔️ *STRATÉGIES*

*M15 TREND FOLLOWING*

Setup :
1. Session EU/US Core active
2. Score composite ≥ 60/100
3. OFI BUY/SELL avec ρ(1) > 0.3
4. p(continuation) ≥ 65%
5. VOL NORMAL

Exécution : Entrée à l'ouverture de bougie M15, SL = 0.75 × ATR, TP1 = 1.2 × SL

*FUNDING EDGE*

Setup : Funding ≥ 0.20% net, Direction alignée
Exécution : Hold au moins 4h, SL plus large

*MEAN-REVERSION ACF*

Setup : OFI mais ρ(1) < 0, sumACF(1-5) < 0
Exécution : Cherry pick, TP serrés`,

  // Part 14 - Risk Management
  String.raw`🛡️ *RISK MANAGEMENT*

Calculateur de Position :

Risk USDT = Equity × 0.15% (1.5% du total par trade)
Size = Risk USDT / SL distance

Règles de Risk :

│ Règle │ Valeur │
│ Max risk/trade │ 0.15% equity │
│ Max risk/jour │ 0.60% equity │
│ Max positions │ 3 simultanées │

Adjustement Volatilité :

│ VOL Régime │ Ajustement │
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
☑ Score composite ≥ 60/100
☑ SL calculé et placé
☑ TP1 et TP2 définis
☑ Size = 0.15% equity max
☑ R:R ≥ 1.5

Si 10+ checks → Entrée autorisée
Si 8-9 checks → Attendre confirmation
Si < 8 checks → PAS DE TRADE`,

  // Part 16 - Erreurs
  String.raw`⚠️ *ERREURS COMMUNES*

❌ Ignorer la Session (trader Asia avec score 35)
❌ Ignorer ρ(1) < 0 (mean-reversion probable)
❌ Trader VOL:EXPLOSIVE (SL large + slippage)
❌ Sur-respecter le Funding (OFI est plus rapide)
❌ No ACF Check (entrer en fin de trend)
❌ Oversizing (3% risk = gamble)
❌ Cherry Pick Contrariant (suivre le trend)
❌ Ignorer Macro (VIX > 25 = réduire sizing)`,

  // Part 17 - Final
  String.raw`🚀 *RÉSUMÉ D'EXÉCUTION*

FLUX DE TRADING COMPLET :

1. OUVRIR DASHBOARD → Vérifier session
2. SCANNER TOKENS → Filtrer Score ≥ 4/6
3. VÉRIFIER ACF → ρ(1) > 0.3
4. CONFIRMER VOL → Pas EXPLOSIVE
5. CHECKER FUNDING → Edge ≥ 0.10%
6. VALIDER MACRO → VIX < 25
7. CALCULER SIZE → 0.15% equity / SL
8. PLACER ORDRE → Entrée + SL + TP1/TP2
9. SURVEILLER ACF → Mise à jour L2 WS
10. AJUSTER SI BESOIN → Trail après TP1
11. ENREGISTRER → Trade Journal

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 *DASHBOARD LIVE :* https://macro-dashboard-lemon.vercel.app

🔄 *MAJ :*
- Scanner : 30s
- ACF/OFI : 3s (L2 WS)
- Funding : 60s

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*FIN DU RAPPORT*

Version : v9.0 (OFI + ACF + GARCH)
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

    if (!response.ok) {
      const error = await response.text();
      console.error('Telegram API error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Error:', err);
    return false;
  }
}

async function sendMegaReport() {
  console.log('📤 Envoi du MEGA RAPPORT sur Telegram...');

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

  console.log('✅ MEGA RAPPORT envoyé avec succès !');
}

sendMegaReport();
