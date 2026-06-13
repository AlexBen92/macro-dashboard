# M15 SCORING SYSTEM - GUIDE COMPLET

## 📊 SURVIEW

Le système de scoring M15 utilise 3 couches pour évaluer les opportunités de scalping:

| Layer | Nom | Poids | Fonction |
|-------|-----|-------|----------|
| L1 | Hard Filters | 30% | Filtres de sécurité (session, liquidité, spread) |
| L2 | Setup | 40% | Qualité du setup (VWAP, funding, OI, vol, flow, trend) |
| L3 | Confirmation | 30% | Signaux de confirmation (momentum, reclaim, CVD, structure) |

**Score Final = L1×30% + L2×40% + L3×30%**

---

## 🔵 L2: SETUP SCORE (0-100)

### Composants et Poids

| Composant | Poids | Bull Signal | Bear Signal |
|-----------|-------|-------------|-------------|
| **VWAP** | 20% | Prix proche VWAP (0.2%) | Prix loin VWAP (>1%) |
| **Funding** | 25% | Funding négatif (shorts payent longs) | Funding positif (longs payent shorts) |
| **OI Momentum** | 15% | OI en hausse (>5%) | OI stable ou baisse |
| **Volatilité** | 15% | ATR optimal (0.3-1.5%) | Vol trop faible ou extrême |
| **Order Flow** | 15% | CVD bullish (>65%) | CVD bearish (<35%) |
| **Trend** | 10% | Trend UP + funding LONG alignés | Trend DOWN + funding SHORT alignés |

### POURQUOI ÇA MARQUE BULL/BEAR?

#### 1. VWAP (Volume Weighted Average Price)
```
BULL: Prix proche VWAP (< 0.5%)
  → Prix "juste", pas sur-acheté
  → Bon point d'entrée pour un scalp

BEAR: Prix loin VWAP (> 1%)
  → Sur-achat ou sur-vente extrême
  → Momentum épuisé
```

#### 2. Funding Rate
```
BULL: Funding négatif (< -0.05%)
  → Shorts dominent, paient aux longs
  → Sentiment extrême bear = contrarian bull
  → Squeeze potentiel si shorts se couvrent

BEAR: Funding positif (> 0.05%)
  → Longs dominent, paient aux shorts
  → Sentiment extrême bull = contrarian bear
  → Longs surchauffés, susceptible de dump

Exemple BTC:
  Funding -0.02% = shorts payent 0.02%/4h = 4.38%/jour
  → Pression short extrême = bull contrarian
```

#### 3. OI Momentum (Open Interest)
```
BULL: OI en hausse (>5% sur 15m)
  → Nouvelles positions entrantes
  → Momentum fort, continuation probable

BEAR: OI stable ou baisse
  → Pas de nouveau capital
  → Momentum faible
```

#### 4. Volatilité (ATR)
```
OPTIMAL: ATR 0.3-1.5% du prix
  → Assez de mouvement pour profiter
  → Pas trop choppy

TROP FAIBLE: ATR < 0.3%
  → Pas de mouvement = pas d'opportunité

TROP ÉLEVÉ: ATR > 1.5%
  → Trop risqué, slippage élevé
```

#### 5. Order Flow / CVD (Cumulative Volume Delta)
```
BULL: CVD > 65%
  → Aggressive buyers dominent
  → 65%+ du volume est buy aggressif
  → Exemple: CVD 72% (B:1.2M S:450K)

BEAR: CVD < 35%
  → Aggressive sellers dominent
  → 65%+ du volume est sell aggressif
  → Exemple: CVD 28% (B:300K S:1.1M)

NEUTRE: CVD 35-65%
  → Équilibre buy/sell
  → Pas d'edge clair
```

#### 6. Trend Alignment
```
BULL MAX: Trend UP (>0.5%) + Funding négatif
  → Prix monte ET shorts dominent
  → Squeeze setup parfait

BEAR MAX: Trend DOWN (>-0.5%) + Funding positif
  → Prix descend ET longs dominent
  → Flush setup parfait
```

---

## 🩷 L3: CONFIRMATION SCORE (0-100)

### Composants et Poids

| Composant | Poids | Bull Signal | Bear Signal |
|-----------|-------|-------------|-------------|
| **M5 Momentum** | 30% | ATR 5m > 0.2% | ATR 5m faible |
| **Reclaim** | 25% | Prix reclaimed VWAP | Prix loin VWAP |
| **CVD** | 25% | CVD 5m bullish (>60) | CVD 5m bearish (<40) |
| **Structure Break** | 10% | Break avec volume | Pas de break |
| **Retest** | 10% | Retest VWAP en cours | Pas de retest |

### POURQUOI ÇA MARQUE BULL/BEAR?

#### 1. M5 Momentum (5-minute timeframe)
```
BULL: ATR 5m > 0.2%
  → Mouvement actif sur 5m
  → Momentum présent
  → Bon pour scalp rapide

BEAR: ATR 5m faible (< 0.1%)
  → Pas de mouvement
  → Marché mort
  → Pas d'opportunité
```

#### 2. Reclaim Signal
```
BULL: Prix crossed VWAP récemment et hold
  → Reclaim = reprise d'un niveau clé
  → Acheteurs défendent le niveau
  → Bon signe de continuation

BEAR: Prix loin VWAP (> 0.5%)
  → Pas de reclaim
  → Pas de défense claire
```

#### 3. CVD 5m (Shorter-term CVD)
```
BULL: CVD 5m > 60
  → Aggressive buying sur 5m
  → Momentum court-term bullish
  → Confirme le setup

BEAR: CVD 5m < 40
  → Aggressive selling sur 5m
  → Momentum court-term bearish
  → Évite le setup
```

#### 4. Structure Break
```
BULL: 24h change > 1% avec volume confirmé
  → Break de structure avec volume
  → Nouveau trend démarré
  → Confirmation forte

BEAR: Pas de break ou sans volume
  → Structure intacte
  → Pas de nouveau momentum
```

#### 5. Retest Confirmation
```
BULL: Prix consolidant près VWAP/level
  → Retest en cours
  → Absorption de l'offre
  → Préparation pour breakout

BEAR: Prix loin des levels
  → Pas de retest
  → Pas de préparation visible
```

---

## 🎯 DIRECTION: LONG vs SHORT vs NEUTRAL

### Règles de Direction

```
LONG: Funding < -0.02% ET Change24h > 0
  → Shorts paient, prix monte
  → Contrarian squeeze setup

SHORT: Funding > 0.02% ET Change24h < 0
  → Longs paient, prix descend
  → Contrarian flush setup

NEUTRAL: Autres cas
  → Pas d'edge clair
```

### Exemples

#### Exemple LONG (Bull Setup)
```
BTC: $67,000
- Funding: -0.025% (shorts payent)
- Change24h: +1.5% (prix monte)
- CVD 15m: 72% (buy pressure)
- OI Change: +8% (nouvelles positions)

→ Direction: LONG
→ Logic: Shorts se font squeeze, prix monte
→ Play: Long scalp, TP1 0.5-1%
```

#### Exemple SHORT (Bear Setup)
```
ETH: $3,450
- Funding: +0.03% (longs paient)
- Change24h: -1.2% (prix descend)
- CVD 15m: 28% (sell pressure)
- OI Change: +6% (nouvelles positions shorts)

→ Direction: SHORT
→ Logic: Longs surchauffés, prix descend
→ Play: Short scalp, TP1 0.5-1%
```

#### Exemple NEUTRAL
```
SOL: $145
- Funding: +0.005% (faiblement positif)
- Change24h: +0.3% (faiblement haussier)
- CVD 15m: 52% (presque neutre)

→ Direction: NEUTRAL
→ Logic: Pas d'edge clair
→ Play: Watch, no trade
```

---

## 📈 CONFIDENCE SCORES

### Confidence ≠ Score

| Metric | Signification |
|--------|---------------|
| **Score** | Qualité du setup (combien de critères satisfaits) |
| **Confidence** | Fiabilité du score (cohérence des signaux) |

### Interprétation

```
HIGH Score + HIGH Confidence = READY
  → Setup de qualité, signaux cohérents
  → Trade avec confiance

HIGH Score + LOW Confidence = WATCH
  → Setup OK mais signaux mixtes
  → Réduire taille ou attendre

LOW Score + HIGH Confidence = AVOID
  → Mauvais setup, signaux cohérents
  → Pas de trade

LOW Score + LOW Confidence = AVOID
  → Mauvais setup, signaux incohérents
  → Pas de trade
```

---

## 🎮 ACTION MATRIX

| Score | Confidence | Action | Position Size |
|-------|------------|--------|---------------|
| ≥80 | ≥70 | READY | Full size (0.15% equity) |
| ≥80 | <70 | WATCH | Half size |
| 60-79 | ≥70 | WATCH | Half size |
| 60-79 | <70 | AVOID | No trade |
| <60 | Any | AVOID | No trade |

---

## 🔧 TIPS POUR SCALPING

1. **Respecte les sessions**
   - EU/US Core (13-17 UTC) = meilleurs setups
   - Asia (1-4 UTC) = évite

2. **Wait for confluence**
   - Score ≥ 80
   - Confidence ≥ 70
   - Direction claire (LONG/SHORT)

3. **Gestion du risque**
   - SL: 0.4-0.6% (ATR based)
   - TP1: 0.5-1% (quick scalp)
   - TP2: 1.5-2% (if momentum strong)

4. **Évite le chop**
   - Si vol24h faible (<2M) → skip
   - Si spread élevé (>0.05%) → skip
   - Si session off → skip

---

## 📚 GLOSSAIRE

- **VWAP**: Volume Weighted Average Price - prix moyen pondéré par volume
- **Funding**: Coût de maintenir une position perp (payé par le côté dominant)
- **OI**: Open Interest - capital total dans les perps
- **CVD**: Cumulative Volume Delta - volume agressif buy vs sell
- **ATR**: Average True Range - volatilité moyenne
- **Reclaim**: Reprendre un niveau clé après l'avoir perdu
- **Structure Break**: Rompre un sommet/plancher précédent
