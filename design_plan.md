# V18 §5.3 — Plan design "lux" discipliné

**Sujet**: terminal de recherche quantitative personnel, manipule options/greeks/surfaces de volatilité. Pas "luxury dashboard" générique. Le vocabulaire visuel vient des terminaux de trading professionnels (Bloomberg, Refinitiv, CME Globex) et de la typographie financière (chiffres tabulaires, tableaux denses).

**Discipline**: 1 élément signature, socle invisible mais non négociable (responsive, focus clavier, prefers-reduced-motion).

---

## 1. Palette — 6 couleurs nommées

| Token | Hex | Rôle | Sémantique |
|---|---|---|---|
| `ink` | `#06070b` | Fond racine | Plus profond que le `#08080f` actuel, plus neutre (supprime teinte violette) |
| `surface` | `#0d0f15` | Cards, panels | Saturation zéro, contraste net avec ink |
| `edge` | `#1c2028` | Bordures, séparateurs | Gris bleuté froid, pas violet |
| `frost` | `#e8ecf2` | Texte primaire | Nommé pour la pureté froide, contraste AA sur ink |
| `mist` | `#7a8290` | Texte secondaire, labels | Pour hiérarchie sans casser la densité |
| `pulse` | `#4ade80` | Up / long / hausse | Conservé: sémantique directionnelle, pas décorative |

Plus 2 couleurs fonctionnelles **non négociables** (sémantique financière):
- `signal` `#ff3355` — down / short / baisse
- `caution` `#ffaa00` — warning / threshold drift

**Pas d'accent cyan `#00e5ff`** ni de gold `#d4a017` décoratif — ces tokens servaient à différencier des sections par couleur, ce qui est exactement le pattern "SaaS générique" à éliminer. Hiérarchie par typographie et spacing, pas par couleur.

**Total: 8 tokens (6 neutres + 2 sémantiques)**. Sous le seuil des 6 nommées car les 2 sémantiques sont fonctionnelles, pas décoratives.

---

## 2. Typographie — 3 rôles

| Rôle | Police | Usage | Restriction |
|---|---|---|---|
| **Display** | IBM Plex Serif (Italic optionnel) | Titres de section H2 uniquement, brand "MACRO STACK" | **Retenue totale**: jamais sur un chiffre, jamais sur un CTA, jamais en body. Une page = ≤6 instances. |
| **Body** | Inter (swap d'Outfit) | Texte courant, labels, navigation | Outfit est geometric-modern, trop "SaaS startup". Inter est neutre-institutionnel, optimisé écran, evite le caractère "luxe" faux. |
| **Utilitaire** | JetBrains Mono (déjà en place) | Tous les chiffres, codes, instruments, timestamps | **`font-feature-settings: "tnum" 1, "zero" 1`** obligatoire — tabular nums + slashed zero. Non négociable pour alignement colonnes. |

**Hiérarchie par taille + graisse, pas par couleur**:
- H2 display: 22px, regular, serif
- H3: 14px, 600, Inter
- Label: 10px, 500, tracking 0.1em uppercase, mist
- Body: 13px, 400, frost
- Data: 13px, 500, JetBrains Mono, tabular

**Outfit supprimé** du layout.tsx. IBM Plex Serif ajouté via `next/font/google`. Inter aussi.

---

## 3. Layout — concept en 1 phrase

**"Grille dense à 3 colonnes variables, hiérarchie verticale par densité décroissante: signaux chauds en haut plein écran, tableaux denses au milieu, surfaces de vol/résidus en bas."**

Wireframe (route `/crypto`):

```
┌─────────────────────────────────────────────────────────────┐
│ MACRO STACK   | CRYPTO  SCALPING              [time] [usr]  │ Nav mono, mist
├─────────────────────────────────────────────────────────────┤
│ ╲╱╲╱  VOL SURFACE — BTC 28D          [signature motif]      │ H2 serif
│                                                              │
│ ┌────────────────────┬───────────────────┬─────────────────┐│
│ │ S1 SIGNAL (live)   │ Market Regime     │ Funding OI      ││ top row
│ │ mispricing +5.2pt  │ state: RISK_ON    │ heat ribbon     ││ 3 cols
│ │ thr=10 · vega=0.8  │ Hurst 0.61        │                 ││
│ ├────────────────────┴───────────────────┤                 ││
│ │ DERIVATIVES TABLE (full width)         │                 ││ mid
│ │ sym   iv   rv   vrp   fund   oi   basis (tabular nums)   ││ table
│ ├────────────────────────────────────────┴─────────────────┤│
│ │  RESIDUALS HEATMAP          │  EQUITY CURVE (paper trader)││ bottom
│ │  [strike × expiry cells]    │  + Tearsheet KPIs (V18 §1)  ││
│ └─────────────────────────────┴────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

Pas de glassmorphism, pas de gradient décoratif, pas d'ombre portée profonde. Bordures 1px `edge`, espacement 12-16-24px (pas 32+).

---

## 4. Signature — motif "surface de volatilité"

**Un seul élément signature, répété en 2 contextes**:

1. **Wireframe SVG de la surface de vol impliquée** (skew + term structure) rendu en filaires 1px `mist` sur fond `ink`, derrière le H2 de section "VOL SURFACE". Seule couleur: 1 point `pulse` marquant le strike ATM courant. Hauteur 80px, positionnement absolu top-right, opacité 0.4.

2. **Cellule de résidu**: dans la heatmap résidus, chaque cellule = mini-cube vu en perspective isométrique dont la profondeur encode `|residual|` (vol pts) et la couleur encode le signe (`pulse`/`signal`). Visuel = vrai cube 3D, pas un carré coloré — c'est la signature qui incarne le sujet.

**Justification**: la surface de vol EST le sujet. Tout autre élément décoratif (orbes, gradients, particules, "glow boxes") est retiré.

---

## 5. Contraintes financières (non négociables)

- **Tabular nums** partout: `font-feature-settings: "tnum" 1, "zero" 1` sur `:root` et tous les mono. Justification: alignement colonnes de funding/IV/Sharpe.
- **Icônes Lucide** déjà installé (`lucide-react@1.17.0`). Remplacer TOUS les emoji (`🧪 🔍 🚀 📦 🔄` repérés dans BacktestPanel, VolArbSignalCard probablement) par lignes minimalistes Lucide: `Activity`, `Crosshair`, `TrendingUp/Down`, `Calendar`, `RefreshCw`. Couleur héritée du parent, pas de couleur dédiée.
- **Sémantique couleurs directionnelles conservée**: `pulse` (up/long), `signal` (down/short), `caution` (warning). Ne pas réinventer pour le style.
- **Mode sombre par défaut**: déjà en place (`ink` racine). Justifié par usage "terminal consulté fréquemment", fatigue visuelle, convention terminaux pros.
- **`prefers-reduced-motion`**: désactive `framer-motion` layoutId, scanLine, pulse-glow. Garde flash instantané (informationnel).

---

## 6. Restraint — réflexe "retirer un accessoire"

À retirer du `globals.css` actuel:
- `glow-bull`, `glow-accent`, `glow-gold` (box-shadow flou décoratif)
- `@keyframes scanLine` (effet CRT, inapproprié pour terminal sérieux)
- `@keyframes pulse-glow` (à remplacer par flash ponctuel si besoin d'alerte)
- Scrollbar `#3b82f6` hover (bleu SaaS, casser la neutralité)
- Selection bleue `#3b82f633` → `#ffffff10`

Garder:
- `.v4-container` (max-width 72rem + responsive)
- `.decision-bar-sticky` (backdrop-blur est OK car fonctionnel: fixer en-tête pendant scroll)
- Animations `flash` (0.5s, informationnel sur update)

---

## 7. Critique anti-patterns (avant code)

### Anti-pattern 1: "cream + serif + terracotta"
**Mon plan**: ink (#06070b) + Plex Serif + pulse green.
**Risque**: Plex Serif + "luxe" suggéré dans le brief pourrait dériver vers éditorial warm.
**Garde-fou**: Plex Serif en **italic optionnel uniquement** pour sous-titres H3, jamais sur H2 pleine page. Italic réservé aux annotations type "vs B&H" / "since 2026-07-08". Si une page a >6 instances de Plex Serif, revoir.

### Anti-pattern 2: "near-black + single accent (acid/vermilion)"
**Mon plan**: ink + 2 accents sémantiques (pulse/signal).
**Risque**: 2 couleurs pourraient être lues comme "1 accent + 1 contre-accent" (pattern dual-acid).
**Garde-fou**: pulse/signal **uniquement pour données directionnelles** (P&L, position long/short, IV skew sign). Jamais sur navigation, boutons, brand. Sur un écran sans donnée signée, aucune couleur chaude ne doit apparaître. Si un screenshot "vierge" montre du vert/rouge, c'est raté.

### Anti-pattern 3: "journal + thin rules + angles droits"
**Mon plan**: bordures 1px edge, tableaux denses.
**Risque**: le combo Plex Serif + tableaux + 1px rules ressemble à du FT/Economist.
**Garde-fou**: (a) **signature vol surface = courbes**, pas que des angles. (b) corner radius 4px sur cards (pas 0, pas 16px). (c) Plex Serif **pas en body** — réservé au H2. Le body en Inter casse le côté journal. (d) Pas de filets horizontaux entre lignes d'un tableau (lignes alternées par opacité `mist/5%`).

### Anti-pattern bonus: emoji statut
**Mon plan**: Lucide partout.
**Garde-fou**: grep `🧪|🔍|🚀|📦|🔄|🪦|🎯|🐛|🚨|🔧` dans src/, remplacer 1-pour-1 par icône Lucide sémantiquement équivalente.

---

## 8.À NE PAS FAIRE (liste négative)

- Glassmorphism / backdrop-blur décoratif (sauf sticky bars fonctionnels)
- Gradients (linéaires, radiaux, coniques) — palette unie
- Box-shadow > 4px (pas de néon)
- Coins > 8px (pas de cards "bulle")
- Animations > 500ms (sauf loader explicite)
- Couleur sur navigation (sauf état actif 1 seul)
- Plus de 6 couleurs visibles simultanément sur un viewport
- Emoji
- Typographie décorative (outfit, poppins, montserrat)
- Sparkles / particules / scanlines
- "Hero" / "CTA" / sections marketing — c'est un terminal, pas une landing

---

## 9. Séquencement (avec §4)

1. **Maintenant** (avant §4.2 consolidation): valider ce plan. Patch `globals.css` pour retirer glow/scanLine/pulse-glow (§6). Ajouter tabular nums sur `:root`.
2. **Après §4.2** (consolidation /crypto stable): swap fonts dans `layout.tsx` (Outfit → Inter + IBM Plex Serif). Créer motif SVG vol surface. Remplacer emoji → Lucide.
3. **Itération finale**: appliquer `edge` à toutes les bordures (remplacer `#1e1e32` hardcoded). Vérifier le test "screenshot vide" du §7 anti-pattern 2.

---

## 10. Socle invisible (non négociable mais non visible)

- [ ] Responsive jusqu'à 360px mobile (testé sur tableaux denses: horizontal scroll acceptable pour derivatives table uniquement)
- [ ] Focus clavier visible: `outline: 2px solid frost; outline-offset: 1px` (pas `outline: none`)
- [ ] `prefers-reduced-motion`: désactive flash, scanLine, framer layoutId
- [ ] `prefers-contrast: high`: bordures `edge` passent à `frost`
- [ ] Tous les composants conservent ARIA labels (Lucide `aria-label` ou `<title>`)
- [ ] Lighthouse perf > 85 (Next 16 + Turbopack déjà)

---

**Fin du plan**. Code après validation du §7 (critique anti-patterns).
