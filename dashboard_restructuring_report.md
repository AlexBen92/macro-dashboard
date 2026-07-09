# V18 §4 — Rapport restructuration dashboard

**Date**: 2026-07-09
**Périmètre**: retrait section FTMO + consolidation crypto sur route unique `/crypto`.

---

## 1. Avant / après — routes

| Route | Avant | Après | Action |
|---|---|---|---|
| `/` (home) | kitchen-sink: 15 composants (macro + crypto + tools) | Macro-only: Decision Engine + 4 panels macro + 3 tools | 9 composants crypto retirés |
| `/crypto` | 5 composants + 3 placeholders | 13 composants en 4 sections + 2 placeholders | 8 composants migrés depuis home |
| `/ftmo` | route + 30 fichiers (1 page + 18 components + 2 hooks + 8 lib + 2 API) | **404** | Supprimé intégralement |
| `/scalping` | standalone | standalone | Inchangé |

---

## 2. Fichiers supprimés (FTMO)

**Total: 30 fichiers + 6 dossiers**

- `src/app/ftmo/page.tsx`
- `src/app/api/backtest-ftmo/route.ts`
- `src/app/api/ftmo-data/route.ts`
- `src/components/ftmo/` (18 fichiers: COTCards, CurrencyStrength, CurrencyStrengthV2, EdgeFinderTable, FtmoDecisionBar, FtmoRulesPanel, FtmoTradeCard, GoNoGoPanel, GoldOilPanel, MacroFlowMap, MacroPanel, PnLCalendar, PositionSizeCalculator, ScorePanel, SessionClock, StrategyCard, StrategyPanel, TradableToday)
- `src/hooks/ftmo/` (useFtmoData, useFlowMap)
- `src/lib/ftmo/` (constants, indicators, risk, scoring, signals-v3, strategies, tradableToday, types)

---

## 3. Liens migrés / navigation

**Nav globale** (`src/components/Nav.tsx`):
- Avant: liens CRYPTO + FTMO
- Après: liens CRYPTO + SCALPING

**Layout metadata** (`src/app/layout.tsx`):
- Avant: `Institutional-grade crypto & FTMO macro trading dashboard`
- Après: `Institutional-grade crypto research terminal`

**Home page nav locale** (lignes 100-111 ancienne version) supprimée — la nav `<Nav />` du layout racine est déjà globale, la nav locale était redondante.

---

## 4. Composants partagés — préservés

**Aucun composant partagé n'a été supprimé**:
- `src/components/ui/*` (16 fichiers): tous génériques, conservés
- `BacktestPanel.tsx`: propri `mode?: 'crypto' | 'ftmo'` laissée — branche `'ftmo'` morte mais compilable, à nettoyer en §5.6
- `useBacktest.ts`: idem, `BacktestMode` inclut `'ftmo'` mort
- `virtualAccount.ts`: `AccountType = 'crypto' | 'ftmo'` laissé
- `VirtualAccountPanel.tsx`: fallback `accountType` changé de `'FTMO'` à `'CRYPTO'` (visibilité: si pas d'account, n'affiche plus "FTMO DEMO")

---

## 5. Consolidation crypto — structure 4 sections

**Nouvelle structure `/crypto`**:

```
Section 1 — TEMPS RÉEL (#00ff9d)
  ├─ RealTimeCryptoDashboard (websocket live)
  └─ TopTokensM15Monitor (top tokens M15)

Section 2 — SIGNAUX (#4ade80)
  ├─ CryptoAdvancedSignals (academic signals)
  ├─ StrategySignalEngine (strategy signals)
  ├─ TopTokenScanner + IntradayHeatmap (2 cols)
  └─ BtcEcosystemSection

Section 3 — DÉRIVÉES (#aa66ff)
  ├─ MarketRegimePanel (régime composite)
  ├─ DerivativesMarketTable (coinglass)
  └─ FundingOIHeatmap + FundingAggregator (2 cols)

Section 4 — RECHERCHE (#d4a017)
  ├─ VolArbSignalCard (S1 paper trading)
  └─ HyperliquidMonitor + OrderFlowProxy (2 cols)

Placeholders (à intégrer):
  ├─ DeFi Opportunities (DefiLlama)
  └─ Crypto + Macro Calendar
```

**Composants migrés depuis home (9)**:
- `BtcEcosystemSection` (→ Section 2)
- `CryptoAdvancedSignals` (→ Section 2)
- `StrategySignalEngine` (→ Section 2)
- `TopTokenScanner` (→ Section 2)
- `IntradayHeatmap` (→ Section 2)
- `TopTokensM15Monitor` (→ Section 1)
- `FundingAggregator` (→ Section 3)
- `HyperliquidMonitor` (→ Section 4)
- `OrderFlowProxy` (→ Section 4)

**Composants restés sur home (9)**:
- `MacroAdvancedPanel`, `MacroCorrelationsPanel`, `MacroContext`, `QuantRegimesPanel`
- `Top5ScoreEngine` (macro score)
- `TradingChecklist`, `TradeJournal` (outils génériques)
- `M15ScalpingSignals` (scalping dédié — probable futur /scalping)

---

## 6. Régressions vérifiées

### TypeScript compilation
```
$ npx tsc --noEmit
EXIT=0
```
Aucune erreur de type après suppression FTMO + consolidation.

### Références FTMO résiduelles
 après suppression initiale:
- `BacktestPanel.tsx` (mode prop + label): branche morte, non visible
- `useBacktest.ts` (BacktestMode union + apiRoute ternary): branche morte
- `virtualAccount.ts` (AccountType union): type inchangé
- `VirtualAccountPanel.tsx`: fallback string corrigé `'FTMO'` → `'CRYPTO'`

Aucune référence `/ftmo` dans le routing. Aucun import cassé.

### Données externes
- `paper_trader/export_dashboard_json.py` → `/opt/openclaw/outputs/s1-vol-arb-signal.json`: inchangé, consommé par `VolArbSignalCard` (toujours sur `/crypto`)
- 50 fichiers `data/*_H1.json`: inchangés

---

## 7. Definition of Done (spec §4.3)

- [x] Section FTMO retirée, aucun lien mort ailleurs sur le site
- [x] Toutes les sections crypto précédemment séparées sont accessibles depuis une seule page `/crypto`
- [x] Navigation globale mise à jour (Nav.tsx: CRYPTO + SCALPING)
- [x] Aucune régression de fonctionnalité sur les composants migrés (tous présents sur /crypto)

---

## 8. Notes pour §5 (refonte UI)

À traiter en §5.4-5.6:
- Emoji résiduels dans `TopTokenScanner.tsx` (8+), `DecisionCard.tsx` (1) — à remplacer par Lucide
- `BacktestPanel`/`useBacktest`/`virtualAccount`: nettoyer les unions `'crypto' | 'ftmo'` mortes
- `globals.css`: retirer `glow-bull`, `glow-accent`, `glow-gold`, `@keyframes scanLine`, `@keyframes pulse-glow`, couleurs scrollbar
- Layout: swap Outfit → Inter, ajouter IBM Plex Serif
- Créer composant motif "surface de volatilité" SVG pour signature
