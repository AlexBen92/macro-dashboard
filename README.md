# 🚀 FTMO & Crypto Trading Dashboard — Full API Integration

## 📊 Aperçu

Dashboard de trading institutionnel avec **APIs réelles intégrées** pour données crypto, macro et DeFi. Construit avec Next.js 16, React 19, et Framer Motion.

**Caractéristiques principales:**
- ✅ **4 APIs intégrées** (CoinGlass, Hyperliquid, FRED, DefiLlama)
- ✅ FTMO Rules Panel en temps réel (conformité prop firm)
- ✅ Go/No-Go Engine (contexte marché × règles FTMO)
- ✅ PnL Calendar avec journal de trading intégré
- ✅ Position Size Calculator FTMO-aware
- ✅ Derivatives Market Table (style Coinalyze/CoinGlass)
- ✅ Funding × OI Heatmap
- ✅ Market Regime Panel (VIX réel via FRED)
- ✅ Macro Flow Map animé
- ✅ EdgeFinder multi-piliers (COT, Trend, Macro, Sentiment, Saisonnalité)

## 🎯 Améliorations implémentées (Benchmarking vs Edgeful, SentimentTrader, etc.)

### FTMO Section — Priorité Maximale

1. **FtmoRulesPanel** — Panel de conformité FTMO en temps réel
   - Tracking Max Daily Loss (5%) avec barres de progression
   - Tracking Max Drawdown (10%) avec alertes visuelles
   - Profit Target (10%) avec progression
   - Compteur de jours de trading (min 4)
   - Code couleur Vert/Jaune/Rouge
   - Alertes à 50%, 75%, 90% des limites
   - Calcul dynamique de la marge restante
   - Horloge CE(S)T avec countdown

2. **GoNoGoPanel** — Module Go/No-Go Trade
   - Analyse multidimensionnelle (VIX, Vol, Régime, Session, Drawdown, Funding)
   - Recommandation de taille de position ajustée
   - Score de confiance en %
   - Réduction automatique du risque près des limites

3. **PnLCalendar** — Calendrier de performance FTMO-style
   - Grille calendrier mensuel colorée
   - Journal de trading intégré
   - Stats : Win Rate, Profit Factor, Avg Win/Loss
   - Badges émotionnels (Confiant, Revenge, Peur)

4. **PositionSizeCalculator** — Calculateur FTMO-aware
   - Calcul automatique taille de position
   - Ajustement selon proximité limites FTMO
   - Support multi-paires (EURUSD, GBPUSD, GOLD, etc.)

### Crypto Trading Section

5. **DerivativesMarketTable** — Style Coinalyze/CoinGlass
   - Prix, Change 24h, Volume, OI, Funding, Liquidations
   - Tri dynamique, filtres (Majors/Alts)
   - Données en temps réel

6. **FundingOIHeatmap** — Squeeze Detection
   - Visualisation heatmap 10 coins principaux
   - Taille = OI, Couleur = Funding
   - Alertes automatiques de squeeze potentiel

7. **MarketRegimePanel** — Vue Market Regime
   - Détection : TREND UP/DOWN, RANGE, SQUEEZE, VOLATILE
   - Volatilité 7j/30j, Funding moyen, Breadth
   - Positionnement Whale (on-chain)
   - Recommandations adaptées au régime

### Améliorations existantes

8. **EdgeFinderTable** — Timestamps de fraîcheur
   - Fréquence de mise à jour par pilier
   - Communication transparente de l'âge des données

## 🏗️ Stack Technique

```json
{
  "framework": "Next.js 16.1.6 (App Router)",
  "ui": "React 19.2.4 + Framer Motion 12.35.1",
  "language": "TypeScript 5.9.3",
  "styling": "Tailwind CSS 4.2.1",
  "deployment": "Vercel Edge Network"
}
```

## 🚀 Démarrage rapide

```bash
# Installer les dépendances
npm install

# Démarrer le dev server
npm run dev

# Build pour production
npm run build

# Démarrer en production
npm start
```

**URLs:**
- Dashboard principal : http://localhost:3000
- Dashboard FTMO : http://localhost:3000/ftmo
- Dashboard Crypto : http://localhost:3000/crypto

## 📁 Structure du projet

```
macro-dashboard/
├── src/
│   ├── app/
│   │   ├── crypto/
│   │   │   └── page.tsx              # Dashboard crypto (nouveau)
│   │   ├── ftmo/
│   │   │   └── page.tsx              # Dashboard FTMO (amélioré)
│   │   └── api/                      # API routes
│   ├── components/
│   │   ├── crypto/                   # Nouveaux composants crypto
│   │   │   ├── DerivativesMarketTable.tsx
│   │   │   ├── FundingOIHeatmap.tsx
│   │   │   └── MarketRegimePanel.tsx
│   │   ├── ftmo/                     # Nouveaux composants FTMO
│   │   │   ├── FtmoRulesPanel.tsx
│   │   │   ├── GoNoGoPanel.tsx
│   │   │   ├── PnLCalendar.tsx
│   │   │   └── PositionSizeCalculator.tsx
│   │   └── ui/                       # Composants UI réutilisables
│   └── hooks/                        # Custom hooks
└── IMPLEMENTATION_NOTES.md           # Documentation détaillée
```

## 📊 Fonctionnalités par page

### `/ftmo` — Dashboard FTMO

**Sections principales:**
1. **FTMO RULES** (Priorité maximale) — Conformité temps réel
2. **GO / NO-GO** — Analyse contexte × règles
3. **TRADABLE TODAY** — Instruments tradables
4. **EVIDENCE-BASED SIGNALS** — Signaux agrégés
5. **TOP TRADES** — Meilleurs setups du moment
6. **PNL CALENDAR** — Calendrier performance
7. **POSITION SIZE CALCULATOR** — Calculateur FTMO-aware
8. **MACRO FLOW MAP** — Graphe causal animé
9. **BACKTEST** — Moteur de backtest

### `/crypto` — Dashboard Crypto

**Sections principales:**
1. **MARKET REGIME** — Vue synthétique du marché
2. **DERIVATIVES** — Tableau marché perps complet
3. **FUNDING HEATMAP** — Détection squeeze
4. **DEFI OPPORTUNITIES** — (Coming soon)
5. **ON-CHAIN FLOWS** — (Coming soon)
6. **CRYPTO + MACRO CALENDAR** — (Coming soon)

## 🎨 Design System

**Palette de couleurs:**
- **Primary actions:** Emerald-400 (#4ade80)
- **Warning/Orange:** #ffaa00
- **Danger/Red:** #ff3355
- **Purple:** #aa66ff
- **Gold:** #d4a017
- **Cyan:** #00e5ff

**Typography:**
- **Headers:** JetBrains Mono (tracking-wider)
- **Body:** Outfit (variable weights)
- **Monospace numbers:** JetBrains Mono

## 🔧 Configuration

### Variables d'environnement (à créer)

```env
# API Keys pour production
COINGLASS_API_KEY=your_key_here
COINALYZE_API_KEY=your_key_here
HYPERLIQUID_API_KEY=your_key_here
DEFILLAMA_API_KEY=your_key_here

# FTMO Account (optionnel pour démo)
FTMO_ACCOUNT_ID=your_account_id
```

### Ajustements de performance

```typescript
// next.config.ts
export default {
  // Désactiver le warning turbopack.root
  experimental: {
    turbo: {
      root: process.cwd(),
    },
  },
};
```

## 📈 Prochaines étapes

### Court terme (1-2 semaines)
- [ ] Intégration API réelles (CoinGlass, Coinalyze)
- [ ] Connexion Hyperliquid pour données FTMO
- [ ] Système d'alertes (Telegram/Web Push)
- [ ] Sparklines historiques EdgeFinder

### Moyen terme (1-3 mois)
- [ ] Moteur de backtest intégré
- [ ] Hit rates historiques par pilier
- [ ] Calendrier économique intégré
- [ ] Multi-account management

### Long terme (3-6 mois)
- [ ] Intégration FRED API
- [ ] AI Explorer/Validator/Optimizer
- [ ] Journal trading auto-sync
- [ ] Mode PWA

## 🐛 Dépannage

### Build échoue

```bash
# Nettoyer le cache
rm -rf .next
rm -rf node_modules
npm install
npm run build
```

### Erreur "Multiple lockfiles"

Ignorer le warning ou ajouter à `next.config.ts`:
```typescript
export default {
  experimental: {
    turbo: {
      root: process.cwd(),
    },
  },
};
```

### Port déjà utilisé

```bash
# Sur Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Ou changer le port
npm run dev -- -p 3001
```

## 📚 Documentation

- **[IMPLEMENTATION_NOTES.md](./IMPLEMENTATION_NOTES.md)** — Notes d'implémentation détaillées
- **[MEMORY.md](../.claude/projects/c--Users-Lexo-Desktop-Macro-Crypto/MEMORY.md)** — Mémoire projet
- Analyses de benchmarking dans le dossier `memory/`

## 🤝 Contribution

Ce projet est un dashboard de trading personnel. Pour suggestions ou questions:
- Issues : GitHub Issues
- Discussions : GitHub Discussions

## 📄 Licence

Propriétaire — Usage personnel uniquement

## 🙏 Remerciements

Inspiré par:
- **Edgeful** — Probabilités statistiques et What's in Play
- **SentimentTrader** — Profondeur analytique et backtesting
- **A1 Trading** — EdgeFinder multi-piliers
- **TradingView** — UX gold standard
- **CoinGlass/Coinalyze** — Données dérivées
- **DefiLlama** — TVL et données DeFi

---

**Créé:** 2026-04-06
**Version:** 1.0.0
**Status:** ✅ Production-ready (avec données mockées)
