/**
 * Agrégateur d'état pour l'agent de trading autonome (/api/agent/state).
 * Réutilise les mêmes fichiers dash-data que les pages /crypto et /markets —
 * aucune logique de calcul dupliquée.
 *
 * Invariant: chaque setup expose status + tradable. Un setup sans statut de
 * registre = UNTESTED, tradable:false. Live capital uniquement VALIDATED.
 */
import { H4D1_PROGRAM } from '@/lib/researchStatus';
import { lookupM15Status } from '@/lib/m15SetupStatus';

export const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const M15_STALE_MS = 20 * 60 * 1000;
const REGIME_STALE_MS = 26 * 60 * 60 * 1000;

export interface M15SetupRow {
  name: string;
  status: string;
  pipeline_status: string | null;
  tradable: boolean;
  stats: Record<string, unknown> | null;
}

export interface DecisionEntry {
  asset: string;
  verdict: string;
  score: number | null;
  confidence: number | null;
  setup_kind: string | null;
  status: string;
  tradable: boolean;
  regime_label: string | null;
}

export interface AgentState {
  as_of: string;
  generated_at: string;
  stale: boolean;
  data_complete: boolean;
  regime: {
    wf_regime: string | null;
    distribution: Record<string, number> | null;
    days_in_regime: number | null;
  };
  m15: {
    edge_global: string | null;
    verdict_btc: string | null;
    setups: M15SetupRow[];
    decision: DecisionEntry[];
  };
  h4d1: Array<{ id: string; label: string; status: string; tradable: boolean; detail: string }>;
  funding: unknown;
  orderflow: unknown;
}

type Json = Record<string, unknown> | null;

function ageMs(ts: unknown, now: number): number | null {
  if (typeof ts !== 'string') return null;
  const t = Date.parse(ts);
  return Number.isNaN(t) ? null : now - t;
}

function str(x: unknown): string | null {
  return typeof x === 'string' ? x : null;
}

function pickAsOf(a: unknown, b: unknown, c: unknown): string {
  for (const x of [a, b, c]) if (typeof x === 'string' && !Number.isNaN(Date.parse(x))) return x;
  return new Date().toISOString();
}

export function buildAgentState(
  edgeM15: Json,
  regimeStatus: Json,
  decision: Json,
  orderflow: Json,
  now = Date.now(),
): AgentState {
  const nowIso = new Date(now).toISOString();

  const regimeDist =
    regimeStatus && typeof regimeStatus === 'object' && regimeStatus.regime_distribution
      ? (regimeStatus.regime_distribution as Record<string, number>)
      : null;

  const setupsRaw =
    edgeM15 && Array.isArray((edgeM15 as Record<string, unknown>).setups_actifs)
      ? ((edgeM15 as Record<string, unknown>).setups_actifs as Array<Record<string, unknown>>)
      : [];
  const m15Setups: M15SetupRow[] = setupsRaw.map((s) => ({
    name: String(s.strategy ?? 'unknown'),
    status: 'UNTESTED',
    pipeline_status: str(s.validation_status),
    tradable: false,
    stats: {
      regime: s.regime ?? null,
      n_obs: s.n_obs ?? null,
      mean_bps: s.mean_bps ?? null,
      sharpe: s.sharpe ?? null,
      dsr: s.dsr ?? null,
      tag: s.tag ?? null,
      sizing_suggestion: s.sizing_suggestion ?? null,
    },
  }));

  const decisionEntries: DecisionEntry[] = [];
  for (const asset of ['btc', 'eth'] as const) {
    const node = decision?.[asset] as Record<string, unknown> | undefined;
    if (!node) continue;
    const setup = node.setup as Record<string, unknown> | undefined;
    const kind = str(setup?.kind);
    const entry = lookupM15Status(kind);
    const reg = node.regime as Record<string, unknown> | undefined;
    decisionEntries.push({
      asset: String(node.symbol ?? asset.toUpperCase()),
      verdict: str(node.verdict) ?? 'NONE',
      score: typeof node.score === 'number' ? node.score : null,
      confidence: typeof node.confidence === 'number' ? node.confidence : null,
      setup_kind: kind,
      status: entry.status,
      tradable: entry.tradable,
      regime_label: str(reg?.label),
    });
  }

  const edgeRegime = str((edgeM15 as Record<string, unknown>)?.regime);
  const regimeNode = regimeStatus as Record<string, unknown> | null;
  const wfRegime = str(regimeNode?.current_regime) ?? edgeRegime;

  const m15Age = ageMs((edgeM15 as Record<string, unknown>)?.last_export_success, now)
    ?? ageMs((edgeM15 as Record<string, unknown>)?.as_of, now);
  const decisionAge = ageMs((decision as Record<string, unknown>)?.last_export_success, now);
  const regimeAge = ageMs(regimeNode?.as_of, now);
  const m15Stale = m15Age === null || m15Age > M15_STALE_MS;
  const decisionStale = decisionAge === null || decisionAge > M15_STALE_MS;
  const regimeStale = regimeAge === null || regimeAge > REGIME_STALE_MS;

  const orderflowNode = orderflow as Record<string, unknown> | null;

  return {
    as_of: pickAsOf(
      (edgeM15 as Record<string, unknown>)?.as_of,
      (decision as Record<string, unknown>)?.as_of,
      regimeNode?.as_of,
    ),
    generated_at: nowIso,
    stale: m15Stale || decisionStale,
    data_complete: !(m15Stale || decisionStale || regimeStale || orderflow === null),
    regime: {
      wf_regime: wfRegime,
      distribution: regimeDist,
      days_in_regime: typeof regimeNode?.days_in_regime === 'number' ? regimeNode.days_in_regime : null,
    },
    m15: {
      edge_global: str((edgeM15 as Record<string, unknown>)?.edge_global),
      verdict_btc: ((edgeM15 as Record<string, unknown>)?.verdict_btc as Record<string, unknown>)?.label
        ? String(((edgeM15 as Record<string, unknown>).verdict_btc as Record<string, unknown>).label)
        : null,
      setups: m15Setups,
      decision: decisionEntries,
    },
    h4d1: H4D1_PROGRAM.entries.map((e) => ({
      id: e.id,
      label: e.label,
      status: e.status,
      tradable: e.status === 'VALIDATED',
      detail: e.detail,
    })),
    funding: null,
    orderflow: orderflowNode,
  };
}

async function fetchJson(origin: string, name: string): Promise<Json> {
  try {
    const res = await fetch(`${origin.replace(/\/$/, '')}/${name}`, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchAgentState(origin = DASH_DATA_ORIGIN, now = Date.now()): Promise<AgentState> {
  const [edgeM15, regimeStatus, decision, orderflow] = await Promise.all([
    fetchJson(origin, 'edge_m15_status.json'),
    fetchJson(origin, 'regime_status.json'),
    fetchJson(origin, 'decision_btceth_status.json'),
    fetchJson(origin, 'orderflow_status.json'),
  ]);
  return buildAgentState(edgeM15, regimeStatus, decision, orderflow, now);
}
