/**
 * Statut public du programme de recherche H4/Daily (V36→V38, fermé 2026-08-15).
 * MAJ 2026-10-09: re-validation v44 S01/S01b NO-GO (érosion 2025-26) — le carry
 * validé v36 n'est plus tradable; XS carry fermé v39 (0/160).
 * Source: registre interne strategy_status_registry_h4_d1 + rapports V36-V44.
 * Affiché sur /markets et /crypto pour transparence méthodologique:
 * un dashboard pro n'affiche pas de signal non validé comme tradable.
 */

export type ResearchStatus =
  | 'VALIDATED'
  | 'IN_VALIDATION'
  | 'RECONSTRUCTION'
  | 'SATELLITE'
  | 'BORDERLINE'
  | 'BLOCKED'
  | 'NOT_TESTABLE'
  | 'NO_EDGE'
  | 'NULL'
  | 'UNTESTED';

export interface ResearchProgramEntry {
  id: string;
  label: string;
  status: ResearchStatus;
  detail: string;
}

export const H4D1_PROGRAM: {
  closed: string;
  families: number;
  configs: number;
  entries: ResearchProgramEntry[];
} = {
  closed: '2026-08-15',
  families: 36,
  configs: 163,
  entries: [
    {
      id: 'funding_carry_d1',
      label: 'Funding carry D1 (BTC/ETH)',
      status: 'NO_EDGE',
      detail:
        'v44 S01/S01b re-validation NO-GO (2026-10-02) — érosion 2025-26: −49 bps 2025, −215 bps 2026. VALIDATED v36 historique, plus tradable. Paper 2 jambes = monitoring only',
    },
    {
      id: 'xs_carry',
      label: 'XS carry bas-turnover',
      status: 'NULL',
      detail: 'v39 0/160 — fermé 2026-08-16, pas de reconstruction en cours. Ne pas retester sans nouveau mécanisme',
    },
    {
      id: 'stablecoin_depeg',
      label: 'Stablecoin depeg (satellite)',
      status: 'SATELLITE',
      detail: 'BORDERLINE — exposition optionnelle faible, monitoring',
    },
    {
      id: 'directional_d1_h4',
      label: 'Directionnel D1/H4 (trend, MR, filtres vol)',
      status: 'NO_EDGE',
      detail: 'NO_EDGE confirmé après WF/DSR/PBO — recherche en pause, ne pas retester',
    },
  ],
};

export const RESEARCH_STATUS_COLOR: Record<ResearchStatus, string> = {
  VALIDATED: 'var(--bull)',
  IN_VALIDATION: 'var(--caution)',
  RECONSTRUCTION: 'var(--caution)',
  SATELLITE: 'var(--info)',
  BORDERLINE: 'var(--caution)',
  BLOCKED: 'var(--muted)',
  NOT_TESTABLE: 'var(--muted)',
  NO_EDGE: 'var(--muted)',
  NULL: 'var(--muted)',
  UNTESTED: 'var(--dim)',
};

export const RESEARCH_STATUS_LABEL: Record<ResearchStatus, string> = {
  VALIDATED: 'validé',
  IN_VALIDATION: 'en validation',
  RECONSTRUCTION: 'reconstruction',
  SATELLITE: 'satellite',
  BORDERLINE: 'borderline',
  BLOCKED: 'bloqué',
  NOT_TESTABLE: 'non testable',
  NO_EDGE: 'no edge',
  NULL: 'null',
  UNTESTED: 'non testé',
};

export const RESEARCH_STATUS_ORDER: ResearchStatus[] = [
  'VALIDATED',
  'IN_VALIDATION',
  'RECONSTRUCTION',
  'SATELLITE',
  'BORDERLINE',
  'BLOCKED',
  'NOT_TESTABLE',
  'NO_EDGE',
  'NULL',
  'UNTESTED',
];
