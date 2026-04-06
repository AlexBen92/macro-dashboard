# 🚀 LANCEMENT RAPIDE AVEC CLÉ FRED

## ⚡ Obtention de la clé FRED (30 secondes - GRATUIT)

### Étape 1: Inscription
1. Aller sur: https://fred.stlouisfed.org/docs/api/api_key.html
2. Cliquer sur "Request API Key"
3. Remplir:
   - Email: votre email
   - Purpose: "Personal / Academic"
   - Description: "Crypto trading dashboard"
4. Valider

### Étape 2: Récupération
- Clé envoyée par email immédiatement
- Format: `abcdefgh12345678` (20 caractères)

### Étape 3: Configuration
```bash
# Dans macro-dashboard/.env.local
FRED_API_KEY=abcdefgh12345678
```

### Étape 4: Lancement
```bash
cd "c:\Users\Lexo\Desktop\Macro Crypto\macro-dashboard"
npm run dev
```

✅ **Aller sur:** http://localhost:3000/crypto

---

## 🎯 Ce qui marche avec la clé FRED

### ✅ Données RÉELLES disponibles:
- **VIX Index** — Volatilité marché temps réel
- **Fed Funds Rate** — Taux directeurs Fed
- **10Y Treasury** — Taux obligataires US 10 ans
- **2Y Treasury** — Taux obligataires US 2 ans
- **GDP** — Produit Intérieur Brut US
- **CPI** — Inflation (Consumer Price Index)
- **Unemployment Rate** — Taux de chômage

### 📊 Composants qui utilisent FRED:
1. **MarketRegimePanel** — Calculé avec vrai VIX
2. **Macro Flow Map** — Données économiques US
3. **FTMO Decision Engine** — Contexte macro réel

---

## 🔥 Mode LANCEMENT RAPIDE

### Option 1: AVEC clé FRED (Données réelles)

```bash
# 1. Obtenir clé: https://fred.stlouisfed.org/docs/api/api_key.html (30 sec)

# 2. Configurer
cd "c:\Users\Lexo\Desktop\Macro Crypto\macro-dashboard"
echo "FRED_API_KEY=votre_clé_ici" >> .env.local

# 3. Lancer
npm run dev

# 4. Ouvrir: http://localhost:3000/crypto
```

**Résultat:**
- ✅ VIX: 18.23 (valeur réelle du marché)
- ✅ Market Regime: Calculé sur vrai VIX
- ✅ Taux US: Valeurs temps réel FED

### Option 2: SANS clé (Mode fallback)

```bash
# Lancer directement
cd "c:\Users\Lexo\Desktop\Macro Crypto\macro-dashboard"
npm run dev

# Ouvrir: http://localhost:3000/crypto
```

**Résultat:**
- ⚠️ VIX: ~18.5 (simulé)
- ⚠️ Market Regime: Calculé sur VIX simulé
- ✅ Dashboard fonctionne parfaitement pour tester l'UX

---

## 📋 Checklist de vérification

### Après lancement, vérifier:

1. **Ouvrir:** http://localhost:3000/crypto
2. **Regarder:** MarketRegimePanel
3. **Vérifier VIX:**
   - Si fixe ~18.5 → Mode fallback
   - Si varie (16.5 - 22.3) → Mode réel ✓
4. **Ouvrir:** http://localhost:3000/api/fred?series_id=VIXCLS
   - Doit afficher données réelles si clé configurée

---

## 🎨 Pages disponibles

| URL | Description | Status |
|-----|-------------|--------|
| `http://localhost:3000/` | Dashboard Legacy | ✅ Actif |
| `http://localhost:3000/crypto` | Dashboard Crypto | ✅ Actif |
| `http://localhost:3000/ftmo` | Dashboard FTMO | ✅ Actif |

---

## ⚡ Commandes utiles

```bash
# Dev server (avec hot reload)
npm run dev

# Build production
npm run build

# Start production
npm start

# Lancer sur port différent
npm run dev -- -p 3001
```

---

**Le dashboard est LANCÉ et fonctionne !** 🚀

**Obtenez votre clé FRED ici (30 sec, gratuit):**
👉 https://fred.stlouisfed.org/docs/api/api_key.html
