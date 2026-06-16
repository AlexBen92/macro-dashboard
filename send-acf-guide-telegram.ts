/**
 * SEND ACF GUIDE TO TELEGRAM
 * Envoie le guide complet ACF sur Telegram
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Lire .env.local manuellement
const envContent = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
const BOT_TOKEN = envContent.match(/TELEGRAM_BOT_TOKEN=(.+)/)?.[1] || '';
const CHAT_ID = envContent.match(/TELEGRAM_CHAT_ID=(.+)/)?.[1] || '';

const ACF_GUIDE = `🔬 *ACF (Autocorrelation Function) — Guide Complet*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*1. Qu'est-ce que l'ACF ?*

L'ACF mesure à quel point une série temporelle est corrélée avec elle-même à différents délais (lags).

ρ(k) = Covariance(X_t, X_{t-k}) / (σ_X × σ_X)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*2. ACF appliquée à l'OFI (Order Flow Imbalance)*

Dans le dashboard, l'ACF est calculée sur l'OFI — la différence entre les ordres acheteurs et vendeurs qui exécutent sur le carnet L2.

• OFI positif = pression buy
• OFI négatif = pression sell

L'ACF répond à la question critique : *ce flux va-t-il continuer ?*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*3. Les 3 Indicateurs ACF du Scanner*

*🔹 ρ(1) — Le Premier Lag (le plus important)*

C'est ce qui s'affiche dans OFI Badge : ▲68%ρ.41

│ Valeur ρ(1) │ Signification │ Trade │
│ > 0.4 │ Flux très persistant │ Entrée dans le sens │
│ 0.2 à 0.4 │ Persistence modérée │ Continuation probable │
│ 0 à 0.2 │ Persistence faible │ Pas de signal clair │
│ < 0 │ Anti-persistence │ Mean-reversion │

*🔹 sumACF(1-5) — Somme des 5 Premiers Lags*

Indique le régime sur 2-3 minutes :

│ Valeur │ Régime │ Stratégie M15 │
│ > 1.5 │ Trending fort │ Continuation, trailing stops │
│ 0.5 à 1.5 │ Trending modéré │ TP plus serrés │
│ -0.5 à 0.5 │ Oscillation │ Range trading │
│ < -0.5 │ Mean-reversion │ Fade les moves │

*🔹 p(continuation) — Probabilité de Continuation*

│ Valeur │ Action │
│ ≥ 70% │ Signal fort, entrée en confiance │
│ ≥ 60% │ Signal modéré, confirmation souhaitée │
│ < 50% │ Pas de trade, flux incertain │

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*4. Comment Trader avec l'ACF sur M15*

*Setup de Continuation (Trend Following)*

Conditions :
1. Session active (EU/US Core)
2. OFI BUY avec ρ(1) > 0.3
3. p(continuation) ≥ 65%
4. sumACF(1-5) > 0.5
5. L2/L3 scores élevés

Exemple : BTC | Score 5/6 | ▲72%ρ.45 | ACF vert croissant
→ Entrée LONG, SL au-dessus du dernier swing low
→ TP1 = 1.2× SL, TP2 = 2.5× SL

*Setup de Mean-Reversion (Fade)*

Conditions :
1. OFI BUY mais ρ(1) < 0
2. p(continuation) < 40%
3. sumACF(1-5) < 0
4. Prix proche résistance

Exemple : ETH | ▲32%ρ-.15 | ACF rouge descendant
→ NE PAS entrer dans le sens, cherry pick sur support
→ TP serrés (0.5-0.8× ATR)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*5. Patterns ACF Visuels*

Croissant (tous positifs) → Trend établi
█████████

Décroissant → Momentum qui faiblit
████░░░░░░

Alternant (+/-/+/-) → Oscillation/Range
█░█░█░█░

Plate (près de 0) → Random walk
░░░░░░░░░

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*6. Checklist Pré-Entrée ACF*

☑ ρ(1) > 0.3 dans le sens du trade ?
☑ p(continuation) ≥ 60% ?
☑ sumACF(1-5) confirme le régime ?
☑ Session active ?
☑ VOL pas explosif ?

5/5 → Entrée en confiance
3-4/5 → Attendre confirmation
< 3/5 → Pas de trade

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*7. Erreurs à Éviter*

❌ Trader avec ρ(1) < 0 dans le sens du flux
❌ Ignorer sumACF(1-5) négatif
❌ Entrer pendant VOL:EXPLOSIVE
❌ Survoler ACF décroissante

📊 *Dashboard :* macro-dashboard-lemon.vercel.app`;

async function sendToTelegram(message: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID in .env');
    return false;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Message envoyé:', data.result?.message_id);
    return true;
  } catch (err) {
    console.error('❌ Erreur envoi:', err);
    return false;
  }
}

async function main() {
  console.log('📤 Envoi du guide ACF sur Telegram...');
  const success = await sendToTelegram(ACF_GUIDE);
  if (success) {
    console.log('✅ Guide envoyé avec succès !');
  } else {
    console.log('❌ Échec de l\'envoi');
    process.exit(1);
  }
}

main();
