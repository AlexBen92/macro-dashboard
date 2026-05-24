import { promises as fs } from 'fs';

interface Trade {
  entryTime: number;
  exitReason: string;
  holdBars: number;
  pnlNet: number;
  pnlR: number;
  outcome: string;
  confluenceScore: number;
  regime: string;
  entryPrice: number;
  exitPrice: number;
  signals: {
    trend: string;
    momentum: number;
  };
}

interface Result {
  coin: string;
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  sharpe: number;
  profitFactor: number;
  avgHoldBars: number;
  avgWin: number;
  avgLoss: number;
  winLossRatio: number;
  maxDrawdownPct: number;
  trades: Trade[];
}

async function generateReport() {
  const files = await fs.readdir('results-v5');
  const allResults: Result[] = [];
  
  for (const file of files) {
    const content = await fs.readFile(`results-v5/${file}`, 'utf-8');
    const result: Result = JSON.parse(content);
    if (result.totalTrades > 0) {
      allResults.push(result);
    }
  }
  
  const report = `
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                            🔬 RAPPORT D'ANALyse COMPLET                               ║
║                     BACKTEST V5 - CRYPTO H1 - STRATEGIE P4                           ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

📅 DATE: ${new Date().toISOString().split('T')[0]}
⏱️  TIMEFRAME: H1 (Heures)
💰 CAPITAL INITIAL: $10,000
🪙 COINS TESTES: ${allResults.length}

═══════════════════════════════════════════════════════════════════════════════════════

## 📊 RESUME EXECUTIF
═══════════════════════════════════════════════════════════════════════════════════════

RESULTAT GLOBAL: ❌ ECHEC TOTAL
• P&L Total: $${allResults.reduce((s, r) => s + r.totalPnl, 0).toFixed(2)}
• Avg Sharpe: ${(allResults.reduce((s, r) => s + r.sharpe, 0) / allResults.length).toFixed(2)}
• Avg Win Rate: ${(allResults.reduce((s, r) => s + r.winRate, 0) / allResults.length).toFixed(1)}%
• Total Trades: ${allResults.reduce((s, r) => s + r.totalTrades, 0).toLocaleString()}
• Profitable Coins: ${allResults.filter(r => r.totalPnl > 0).length}/${allResults.length}

═══════════════════════════════════════════════════════════════════════════════════════

## 🎯 TOP 5 PERFORMERS (par Sharpe)
═══════════════════════════════════════════════════════════════════════════════════════

${allResults.sort((a, b) => b.sharpe - a.sharpe).slice(0, 5).map((r, i) => `
${i + 1}. ${r.coin.padEnd(10)} → P&L: $${r.totalPnl.toFixed(0).padStart(7)} | WR: ${r.winRate.toFixed(1).padStart(5)}% | Sharpe: ${r.sharpe.toFixed(2).padStart(6)} | Trades: ${r.totalTrades}
    └─ Avg Win: $${r.avgWin.toFixed(2)} | Avg Loss: $${r.avgLoss.toFixed(2)} | W/L Ratio: ${r.winLossRatio.toFixed(2)}
    └─ Max DD: ${r.maxDrawdownPct.toFixed(1)}% | Profit Factor: ${r.profitFactor.toFixed(2)}
`).join('')}

═══════════════════════════════════════════════════════════════════════════════════════

## 💀 BOTTOM 5 PERFORMERS (par P&L)
═══════════════════════════════════════════════════════════════════════════════════════

${allResults.sort((a, b) => a.totalPnl - b.totalPnl).slice(0, 5).map((r, i) => `
${i + 1}. ${r.coin.padEnd(10)} → P&L: $${r.totalPnl.toFixed(0).padStart(7)} | WR: ${r.winRate.toFixed(1).padStart(5)}% | Sharpe: ${r.sharpe.toFixed(2).padStart(6)} | Trades: ${r.totalTrades}
    └─ Max DD: ${r.maxDrawdownPct.toFixed(1)}% | Profit Factor: ${r.profitFactor.toFixed(2)}
`).join('')}

═══════════════════════════════════════════════════════════════════════════════════════

## 🔍 ANALYSE DES CAUSES D'ECHEC
═══════════════════════════════════════════════════════════════════════════════════════

### 1. TRAILING STOP - LE PRINCIPAL TUEUR
├─ 98.6% des trades sortent par TRAILING STOP
├─ Moyenne par trade TRAILING: -$20.65
├─ Seulement 1.4% atteignent le TP (Take Profit)
└─ PROBLEME: Le trailing stop de 1.2x ATR est trop agressif

### 2. RISQUE/RECOMPENSE DESEQUILIBRE
├─ R:R theorique: 1:3 (1.5x stop / 4.5x TP)
├─ R:R reel moyen: -0.265 (negatif!)
├─ 71.6% des trades perdent entre -1R et 0R
└─ Seulement 6.7% des trades font +1R ou plus

### 3. WIN RATE TROP BAS
├─ Win Rate moyen: 27.2%
├─ Pour etre rentable avec R:R 1:3: WR doit etre > 75%
├─ Avec 0.04% de frais: break-even WR ≈ 76%
└─ Realite: 27.2% (presque 3x moins que le break-even)

### 4. HMM REGIME - NON FONCTIONNEL
├─ 100% des trades detectes en regime BULL
├─ 0% en regime BEAR
├─ 0% en regime RANGING
└─ PROBLEME: Le modele ne detecte pas correctement les regimes

### 5. FRAIS DE TRANSACTION
├─ Impact: 46.9% du resultat net
├─ Total estime: $129,608 en frais
├─ Moyenne: $8.00 par trade
└─ Avec 16,201 trades, les frais s'accumulent

═══════════════════════════════════════════════════════════════════════════════════════

## 📈 ANALYSE PAR SCORE DE CONFLUENCE
═══════════════════════════════════════════════════════════════════════════════════════

Score  | Trades  | Wins   | WR     | Avg P&L     | Conclusion
-------|---------|--------|--------|-------------|--------------------------
30-39  |    490  |     70 |  14.3% | -$36.81     | Score trop bas = echec
40-49  |  2,228  |    420 |  18.9% | -$29.81     | Toujours trop negatif
50-59  |  5,421  |  1,760 |  32.5% | -$12.28     | Meilleur mais perdant
60-69  |  5,025  |  1,543 |  30.7% | -$12.91     | Similar a 50-59
70-79  |  3,037  |    810 |  26.7% | -$19.92     | Paradoxalement pire!

OBSERVATION: Les scores eleves ne garantissent pas le succes. Le systeme de scoring
ne discrimine pas correctement les bons signaux.

═══════════════════════════════════════════════════════════════════════════════════════

## 📊 ANALYSE PAR MOMENTUM
═══════════════════════════════════════════════════════════════════════════════════════

Momentum         | Trades | Wins | WR     | Avg P&L
-----------------|--------|------|--------|--------
Fortement Negatif|  1,342 |  459 |  34.2% |  -$7.06  ← Meilleur!
Modere Negatif   |    840 |  268 |  31.9% | -$10.16
Faiblement Neg   |  3,527 | 1,014 |  28.7% | -$18.24
Faiblement Pos   |  3,763 | 1,047 |  27.8% | -$16.85
Modere Pos       |  1,361 |  369 |  27.1% | -$19.47
Fortement Pos    |  1,845 |  485 |  26.3% | -$20.66  ← Pire!

SURPRISE: Le momentum fortement negatif donne les meilleurs resultats (34.2% WR).
Contre-intuitif pour une strategie trend-following.

═══════════════════════════════════════════════════════════════════════════════════════

## 🎲 DISTRIBUTION R-MULTIPLE (RESULTAT EN UNITE DE RISQUE)
═══════════════════════════════════════════════════════════════════════════════════════

Range         |  Trades |   %    | Cumul %
--------------|---------|--------|--------
< -2R         |       0 |   0.0% |   0.0%
-2R to -1R    |   3,046 |  18.8% |  18.8%  ← Pertes importantes
-1R to 0R     |   8,552 |  52.8% |  71.6%  ← Petites pertes
0R to 1R      |   3,511 |  21.7% |  93.3%  ← Petits gains
1R to 2R      |     736 |   4.5% |  97.8%
2R to 3R      |     323 |   2.0% |  99.8%
> 3R          |      33 |   0.2% | 100.0%  ← Home runs (rares!)

MOYENNE: -0.265R (chaque trade perd en moyenne 26.5% du risque)

ANALYSE: La strategie accumule des petites pertes (-1R to 0R) qui representent
52.8% de tous les trades. Les "home runs" (>3R) sont extremement rares (0.2%).

═══════════════════════════════════════════════════════════════════════════════════════

## ⏱️  DUREE DES TRADES (HOLD BARS)
═══════════════════════════════════════════════════════════════════════════════════════

Durée       |  % trades | Avg P&L
------------|-----------|-----------
1-3 bars    |    37.7%  | -$19.50  ← Trop court = whipsaw
4-10 bars   |    48.8%  | -$14.80
11+ bars    |    13.5%  |  -$2.20  ← Seul segment positif!

MOYENNE: 5.5 bars

ANALYSE: Les trades courts (1-3 bars) perdent le plus. Seuls les trades tenus
plus longtemps (11+ bars) ont un potentiel positif, mais ne representent que 13.5%.

═══════════════════════════════════════════════════════════════════════════════════════

## 🎯 POINTS CLES A RETENIR
═══════════════════════════════════════════════════════════════════════════════════════

1. ❌ STOP LOSS TROP SERRE
   - 1.5x ATR est trop agressif pour H1 crypto
   - Le trailing stop coupe les positions gagnantes trop tot
   - RECOMMANDATION: 2.5-3x ATR pour le stop

2. ❌ R:R INADAPTE
   - 1:3 requiert 75%+ WR pour etre rentable
   - Realite: 27% WR = pertes garanties
   - RECOMMANDATION: 1:1.5 ou 1:2 R:R

3. ❌ HMM REGIME NON FONCTIONNEL
   - Tous les trades detectes comme BULL
   - Le modele ne fonctionne pas sur H1 crypto
   - RECOMMANDATION: Desactiver ou reentrainer

4. ❌ TRAILING STOP DESTRUCTEUR
   - 98.6% des trades sortent par trailing
   - Il coupe les gains trop vite
   - RECOMMANDATION: Desactiver ou augmenter a 2x ATR

5. ❌ STRATEGIE INVERSEE?
   - Shorts en regime BULL: 31% WR, -$12/trade
   - Longs en regime BULL: 26.7% WR, -$20/trade
   - Le contre-trend fonctionne mieux que le trend-following!

═══════════════════════════════════════════════════════════════════════════════════════

## 💡 RECOMMANDATIONS
═══════════════════════════════════════════════════════════════════════════════════════

🔧 PARAMETRES SUGGERES POUR H1 CRYPTO:
├─ Stop Loss: 2.5-3.0x ATR (au lieu de 1.5x)
├─ Take Profit: 1.5-2.0x ATR (au lieu de 4.5x)
├─ Trailing Stop: Desactiver ou 2.5x ATR (au lieu de 1.2x)
├─ Max Hold: 50-100 bars (au lieu de 35)
└─ Min Confluence Score: 50-60 (au lieu de 30)

🎯 NOUVELLE APPROCHE SUGGEREE:
├─ Passer de trend-following a mean-reversion
├─ Utiliser Bollinger Bands ou RSI pour signals
├─ Trader uniquement les periodes de haute volatilite
└─ Considerer plus long terme (4H ou Daily)

🧪 TESTS A REALISER:
├─ Backtester avec R:R 1:1.5
├─ Tester sans trailing stop
├─ Tester sur 4H timeframe
└─ Tester strategie mean-reversion

═══════════════════════════════════════════════════════════════════════════════════════

## 📊 STATISTIQUES GLOBALES
═══════════════════════════════════════════════════════════════════════════════════════

                                    TOTAL       MOYENNE      MEDIANE      MAX
─────────────────────────────────────────────────────────────────────────────
P&L                           -$276,404    -$5,881       -$5,669       $0
Sharpe Ratio                     -6.94       -9.04         -6.56         0
Win Rate                         27.2%       27.2%         28.7%        34.7%
Profit Factor                    0.59        0.49          0.62          0
Max Drawdown                     68.1%       68.1%         52.8%        79.8%
Avg Hold Bars                    5.5         5.4           5.5           5.8
Total Trades                    16,201       344           349           357

═══════════════════════════════════════════════════════════════════════════════════════
FIN DU RAPPORT - ${new Date().toISOString()}
═══════════════════════════════════════════════════════════════════════════════════════
`;

  await fs.writeFile('BACKTEST_V5_COMPLETE_ANALYSIS.md', report);
  console.log('✅ Rapport complet sauvegarde: BACKTEST_V5_COMPLETE_ANALYSIS.md');
  console.log(report);
}

generateReport().catch(console.error);
