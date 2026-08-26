'use client';

import { useCockpitState } from '@/hooks/api/useCockpitState';

/**
 * Carte des 10 lois (plan 2026-08-26 §5) — rappel culturel permanent.
 * Chaque loi = badge court + tooltip pointant vers l'épisode qui l'a établie.
 * Aucune de ces lois ne doit pouvoir être violée silencieusement :
 * les checks automatisés vivent dans regime/src/law_guards.py.
 */

const LAWS: ReadonlyArray<{ id: string; label: string; episode: string }> = [
  {
    id: 'L1',
    label: 'Forward tax ×12',
    episode:
      'Multiplicateur empirique projet entier (V16-S1: théo +55.6bps → réel −496.6bps). Tout edge in-sample affiché = raw/12 avant tout statut.',
  },
  {
    id: 'L2',
    label: 'Friction = edge',
    episode:
      'V29 small markets: 60 backtests données faciles = 0 GO. Les données dures d’accès (CVD, GEX/DEX, L2) sont les seules à prime potentielle.',
  },
  {
    id: 'L3',
    label: 'Régimes, jamais poolé',
    episode:
      'V36 C+D / S1 regime matrix: un candidat se reporte par régime (CALM/BUILDING/STRESS/CRISIS), la moyenne poolée masque les effondrements.',
  },
  {
    id: 'L4',
    label: 'ML OHLCV = hasard',
    episode:
      'V35 LSTM: 9 modèles × 73 variants, DA 0.49 systématique, NULL_EXHAUSTED gravé au ledger. Aucun ML sans feature hors prix/volume pur.',
  },
  {
    id: 'L5',
    label: 'Nested CV insuffisant',
    episode:
      'V27 §10b « edge robuste » démonté par bug shift(-1). Paper/shadow N≥10 obligatoire avant toute considération live, quel que soit le backtest.',
  },
  {
    id: 'L6',
    label: 'Maker = piège',
    episode:
      'S1: théo +55.6bps / réel −496.6bps. A3: gap théo/réel +308bps. Adverse selection confirmée 2x — exécution passive = stress test obligatoire.',
  },
  {
    id: 'L7',
    label: 'Meta-label dégrade',
    episode:
      'V36 M+G + H24/G22 (3e confirmation): la couche meta-labeling n’a jamais battu le primaire sur holdout. Preuve holdout exigée sinon rejet.',
  },
  {
    id: 'L8',
    label: 'Mécanisme > narrative',
    episode:
      'V28: « digital gold » XAU/TIPS NULL vs ETF flows #9 réel. Une corrélation sans mécanisme structurel (flux/contrainte/inventaire) = rejet d’office.',
  },
  {
    id: 'L9',
    label: 'Per-fold worst casse tout',
    episode:
      'V28 #9 ETF: fold 2024-Q4 −65.8bps tuait l’edge « confirmé ». Le pire fold se reporte à côté de la moyenne MC — gate sur le pire, pas la moyenne.',
  },
  {
    id: 'L10',
    label: 'Données fabriquées n’existent pas',
    episode:
      '2026-08-19: moteur corr avec priors aléatoires supprimé (4c3124c) + garde-fou vitest. Toute donnée synthétique/interpolée = marquée ou rejetée.',
  },
];

export default function LawsOfTheGameCard() {
  const { data } = useCockpitState();
  const stats = data?.gate?.registry?.statistical_status ?? null;
  const nValidated = stats
    ? Object.values(stats).filter((v) => v === 'VALIDATED').length
    : null;

  return (
    <div
      className="rounded-[3px] border border-[var(--border)] bg-[var(--bg2)] p-3"
      data-testid="laws-of-the-game"
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[0.55rem] uppercase tracking-[3px] text-[var(--label)]">
          LES 10 LOIS — RAPPEL PERMANENT
        </span>
        <span className="font-mono text-[0.45rem] text-[var(--dim)]">
          checks auto: regime/src/law_guards.py
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {LAWS.map((law) => (
          <span
            key={law.id}
            title={`${law.label} — ${law.episode}`}
            className="cursor-help rounded-[3px] border border-[var(--border)] bg-[var(--bg)] px-2 py-1 font-mono text-[0.48rem] text-[var(--muted)] hover:border-[var(--caution)] hover:text-[var(--label)]"
          >
            {law.id} · {law.label}
          </span>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[0.45rem] text-[var(--dim)]">
        <span>
          Seuil minimal avant toute conclusion: N≥10 trades paper — 3 trades
          gagnants ne constituent aucune preuve.
        </span>
        <span className="text-[var(--caution)]">
          Setups VALIDATED: {nValidated ?? '—'} /{' '}
          {stats ? Object.keys(stats).length : '—'}
          {nValidated === 0 ? ' — réponse correcte à l’état actuel' : ''}
        </span>
      </div>
    </div>
  );
}
