/**
 * Statut public du programme de recherche H4/Daily (V36→V38, fermé 2026-08-15).
 * Source: registre interne strategy_status_registry_h4_d1 + rapports V36-V38.
 * Affiché sur /markets et /crypto pour transparence méthodologique:
 * un dashboard pro n'affiche pas de signal non validé comme tradable.
 */

export type ResearchStatus =
  | 'VALIDATED'
  | 'RECONSTRUCTION'
  | 'SATELLITE'
  | 'NO_EDGE'
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
      status: 'VALIDATED',
      detail: '6/6 gates WF — seule stratégie VALIDATED du programme, en paper trading 2 jambes',
    },
    {
      id: 'xs_carry',
      label: 'XS carry bas-turnover',
      status: 'RECONSTRUCTION',
      detail: 'V37/V38 NULL sur holdout frais — mécanisme en reconstruction, pas tradable',
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
  RECONSTRUCTION: 'var(--caution)',
  SATELLITE: 'var(--info)',
  NO_EDGE: 'var(--muted)',
  UNTESTED: 'var(--dim)',
};

export const RESEARCH_STATUS_LABEL: Record<ResearchStatus, string> = {
  VALIDATED: 'validé',
  RECONSTRUCTION: 'reconstruction',
  SATELLITE: 'satellite',
  NO_EDGE: 'no edge',
  UNTESTED: 'non testé',
};
