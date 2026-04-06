# 🔑 Guide de Configuration API — Macro Crypto Dashboard

## 📋 **Résumé de la recherche des variables d'environnement**

### 🔍 **Fichiers trouvés:**
- ✅ `.env.example` — Template de configuration
- ✅ `.env.local` — Configuration créée (vides)
- ✅ `.gitignore` — Les fichiers .env sont protégés

### ❌ **Aucune clé API configurée**
- Pas de clés API dans les variables système
- Pas de fichiers de secrets externes
- Dashboard fonctionnera en **mode fallback** avec données mockées

---

## 🚀 **Comment configurer les APIs**

### Étape 1: Clé FRED API (GRATUITE - Recommandé)

C'est **la seule clé vraiment nécessaire** pour avoir des données réelles.

1. **Inscription gratuite:**
   - Allez sur: https://fred.stlouisfed.org/docs/api/api_key.html
   - Cliquez sur "Request API Key"
   - Remplissez le formulaire (gratuit, prend 30 secondes)
   - Recevez votre clé par email instantanément

2. **Configuration:**
   ```bash
   # Éditer .env.local
   FRED_API_KEY=votre_clé_ici_abcdefgh12345678
   ```

3. **Ce que vous obtenez:**
   - ✅ VIX réel au lieu de mock
   - ✅ Taux d'intérêt US (10Y, 2Y, FEDFUNDS)
   - ✅ Données économiques (GDP, UNRATE, CPI)
   - ✅ Market Regime calculé avec vrai VIX

### Étape 2: Clé CoinGlass API (Optionnel)

Pour des données de marché crypto plus précises.

1. **Inscription:**
   - Allez sur: https://www.coinglass.com/
   - Créez un compte gratuit
   - Obtenez votre clé API

2. **Configuration:**
   ```bash
   COINGLASS_API_KEY=votre_clé_ici
   ```

3. **Ce que vous obtenez:**
   - ✅ Funding rates précis
   - ✅ Open Interest temps réel
   - ✅ Liquidations 24h exactes
   - ✅ Derivatives Market Table avec vraies données

### Étape 3: Hyperliquid (Optionnel)

Pour le trading crypto automatisé.

1. **Configuration:**
   ```bash
   HYPERLIQUID_ADDRESS=votre_adresse_wallet
   ```

2. **Ce que vous obtenez:**
   - ✅ Données de position
   - ✅ Historique des trades
   - ✅ Exécution d'ordres

### Étape 4: DefiLlama (GRATUIT - Pas de clé nécessaire)

Données DeFi déjà disponibles via API publique.

```bash
# Pas de configuration nécessaire !
# Les données DeFi fonctionnent déjà en mode fallback
```

---

## 📁 **Emplacements des fichiers de configuration**

### Structure actuelle:
```
macro-dashboard/
├── .env.example          # Template (à ne pas modifier)
├── .env.local            # Votre configuration (créé)
├── .gitignore            # Protège .env.local
└── src/
    ├── app/
    │   └── api/
    │       ├── coinglass/route.ts    # Utilise FRED_API_KEY
    │       ├── fred/route.ts         # Utilise FRED_API_KEY
    │       ├── hyperliquid/route.ts  # Utilise HYPERLIQUID_ADDRESS
    │       └── defillama/route.ts    # Pas de clé nécessaire
    └── ...
```

### Variables d'environnement dans le code:

Les API routes lisent automatiquement les variables:
```typescript
// src/app/api/fred/route.ts
const apiKey = process.env.FRED_API_KEY;

// src/app/api/coinglass/route.ts  
// Peut utiliser COINGLASS_API_KEY si configuré
```

---

## ⚙️ **Modes de fonctionnement**

### Mode Fallback (Actuel - Sans clés API)

**Status:** Dashboard fonctionne **normalement** avec données mockées

```typescript
// Les API routes retournent des fallback automatiquement
{
  success: true,
  data: [...mockData...],
  fallback: true  // Indique que ce sont des données mockées
}
```

**Avantages:**
- ✅ Pas de configuration nécessaire
- ✅ Dashboard fonctionnel immédiatement
- ✅ Permet de tester l'UX

**Inconvénients:**
- ❌ Données pas en temps réel
- ❌ Valeurs simulées

### Mode Production (Avec clés API)

**Status:** Dashboard avec **données réelles**

```typescript
// Les API routes retournent des vraies données
{
  success: true,
  data: [...realData...],
  timestamp: Date.now()
}
```

**Avantages:**
- ✅ Données en temps réel
- ✅ VIX réel du marché
- ✅ Funding rates exacts
- ✅ TVL et volumes DeFi précis

---

## 🎯 **Recommandation rapide**

### Pour commencer immédiatement (5 min):

1. **Obtenir uniquement la clé FRED (gratuite):**
   - https://fred.stlouisfed.org/docs/api/api_key.html
   - Prend 30 secondes

2. **Configurer dans .env.local:**
   ```bash
   FRED_API_KEY=votre_clé_fred_ici
   ```

3. **Redémarrer le dev server:**
   ```bash
   npm run dev
   ```

4. **Résultat:**
   - ✅ VIX réel dans MarketRegimePanel
   - ✅ Market Regime calculé avec vraies données
   - ✅ Temps réel sur les indicateurs macro

### Pour configuration complète (30 min):

1. **FRED API** (gratuit) — VIX et macro
2. **CoinGlass API** (gratuit) — Crypto dérivés
3. **Hyperliquid** (optionnel) — Trading

---

## 🔍 **Comment vérifier que les APIs fonctionnent**

### Méthode 1: Console du navigateur

```javascript
// Ouvrir la console (F12)
// Aller sur http://localhost:3000/api/fred?series_id=VIXCLS

// Réponse si clé API configurée:
{
  "success": true,
  "data": {
    "series": {...},
    "observations": [...],
    "latest": { "date": "2026-04-06", "value": 18.5 }
  }
}

// Réponse si clé API manquante:
{
  "success": false,
  "error": "FRED_API_KEY not configured...",
  "fallbackData": {...}
}
```

### Méthode 2: Vérifier dans le composant

```javascript
// Dans MarketRegimePanel
// Regarder la valeur du VIX affichée

// Si c'est ~18.5 avec des variations aléatoires → Mode Fallback
// Si c'est la vraie valeur du marché → Mode Production
```

### Méthode 3: Logs du serveur

```bash
npm run dev

# Chercher dans les logs:
# - "FRED API Error:" → Erreur API
# - "CoinGlass API Error:" → Erreur API  
# - "Using fallback data" → Mode Fallback activé
```

---

## 📊 **Tableau de comparaison des modes**

| Fonctionnalité | Mode Fallback | Mode Production |
|---|---|---|
| **VIX** | Mock (~18.5 fixe) | Réel (temps réel FRED) |
| **Funding Rates** | Mock (aléatoire) | Réel (CoinGlass) |
| **Market Regime** | Calculé sur mock | Calculé sur VIX réel |
| **OI Data** | Mock (aléatoire) | Réel (Hyperliquid) |
| **DeFi TVL** | Mock (aléatoire) | Réel (DefiLlama) |
| **Liquidations** | Mock (aléatoire) | Réel (CoinGlass) |

---

## 🚨 **Dépannage**

### Problème: "FRED_API_KEY not configured"

**Solution:**
```bash
# 1. Vérifier que .env.local existe
ls -la .env.local

# 2. Ajouter la clé
echo "FRED_API_KEY=votre_clé" >> .env.local

# 3. Redémarrer le serveur
npm run dev
```

### Problème: API rate limit

**Solution:**
- FRED: 120 req/min (suffisant pour usage normal)
- CoinGlass: Variable selon plan
- DefiLlama: Pas de rate limit
- Hyperliquid: Pas de rate limit

### Problème: Données qui changent pas

**Solution:**
```bash
# Vérifier que le serveur a bien redémarré
# Les variables d'environnement ne sont chargées qu'au démarrage
```

---

## 📝 **Checklist rapide de configuration**

- [ ] Clé FRED API obtenue (gratuit)
- [ ] .env.local créé avec FRED_API_KEY
- [ ] Dev server redémarré
- [ ] VIX réel affiché dans MarketRegimePanel
- [ ] (Optionnel) CoinGlass API configurée
- [ ] (Optionnel) Hyperliquid address configurée

---

## 🎉 **Conclusion**

Le dashboard fonctionne **parfaitement en mode fallback** pour tester l'interface et l'UX.

Pour des données réelles, **seule la clé FRED est nécessaire** (gratuite, 30 secondes).

**Recommandation:** Commencez avec FRED API seulement, puis ajoutez les autres APIs selon vos besoins.

---

**Dernière mise à jour:** 2026-04-06
**Statut:** ✅ Guide complet de configuration
