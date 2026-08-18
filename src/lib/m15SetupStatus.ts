/**
 * Miroir TS de /root/edge_discovery/decision/data/setup_status_registry.json
 * (schema v1, source unique de vérité consultée par decision_pipeline).
 * Le registre vit sur le VPS; ce miroir alimente /api/agent/state côté Vercel.
 * L'agent Python re-lit le registre directement et fait autorité en cas
 * d'écart (défense en profondeur).
 *
 * Règle: tradable = (status === 'VALIDATED') && registry.tradable === true.
 * NO_TRADE est VALIDATED mais non-tradable par construction.
 */

export type ResearchStatus = 'UNTESTED' | 'IN_VALIDATION' | 'NULL' | 'VALIDATED';

export interface M15SetupStatusEntry {
  status: ResearchStatus;
  tradable: boolean;
  note: string;
}

export const M15_SETUP_STATUS: Record<string, M15SetupStatusEntry> = {
  TREND_CONTINUATION: {
    status: 'NULL',
    tradable: false,
    note: 'PF 0.23-0.55, permutation p_upper=1.0 — jamais actionnable, exposé pour audit uniquement',
  },
  LIQUIDITY_SWEEP: {
    status: 'IN_VALIDATION',
    tradable: false,
    note: 'CVD collector démarré 2026-08-13, backtest après 60-90j',
  },
  BREAKOUT: { status: 'UNTESTED', tradable: false, note: 'non couvert par le sweep' },
  SHORT_SQUEEZE: { status: 'UNTESTED', tradable: false, note: 'dépend liquidations persistantes' },
  LONG_SQUEEZE: { status: 'UNTESTED', tradable: false, note: 'dépend liquidations persistantes' },
  MEAN_REVERSION: { status: 'UNTESTED', tradable: false, note: 'attend Stage 11' },
  NO_TRADE: {
    status: 'VALIDATED',
    tradable: false,
    note: 'verdict par défaut, non-tradable par construction',
  },
};

export const UNTESTED_ENTRY: M15SetupStatusEntry = {
  status: 'UNTESTED',
  tradable: false,
  note: 'setup absent du registre — traité UNTESTED, jamais tradable',
};

export function lookupM15Status(kind: string | null | undefined): M15SetupStatusEntry {
  if (!kind) return UNTESTED_ENTRY;
  return M15_SETUP_STATUS[kind] ?? UNTESTED_ENTRY;
}
