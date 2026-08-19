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
const FUNDING_STALE_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8_000;
const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';

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

export interface SourceStatus {
  ok: boolean;
  http_status: number | null;
  age_ms: number | null;
  stale: boolean;
  error?: string;
}

export interface FundingState {
  as_of: string;
  source: string;
  divergence_zscore?: Record<string, number>;
  assets: Record<string, {
    funding_hourly: number;
    funding_apr_pct: number;
    mark_px: number | null;
  }>;
}

export interface AgentState {
  as_of: string;
  generated_at: string;
  stale: boolean;
  data_complete: boolean;
  sources: Record<'regime' | 'm15' | 'decision' | 'orderflow' | 'funding', SourceStatus>;
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
  funding: FundingState | null;
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
  funding: FundingState | null = null,
  metas: Partial<Record<'regime' | 'm15' | 'decision' | 'orderflow' | 'funding', SourceStatus>> = {},
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

  const fundingNode = funding as FundingState | null;
  const fundingAge = fundingNode ? ageMs(fundingNode.as_of, now) : null;

  const mergeMeta = (
    flux: 'regime' | 'm15' | 'decision' | 'orderflow' | 'funding',
    dataOk: boolean,
    age: number | null,
    stale: boolean,
  ): SourceStatus => {
    const m = metas[flux];
    return {
      ok: m ? m.ok : dataOk,
      http_status: m?.http_status ?? null,
      age_ms: age,
      stale: stale || (m ? !m.ok : !dataOk),
      ...(m?.error ? { error: m.error } : {}),
    };
  };
  const orderflowAge = ageMs(
    typeof orderflowNode?.as_of === 'string' ? orderflowNode.as_of : undefined,
    now,
  );
  const fundingStaleRaw = fundingNode === null || (fundingAge !== null && fundingAge > FUNDING_STALE_MS);
  const sources: Record<'regime' | 'm15' | 'decision' | 'orderflow' | 'funding', SourceStatus> = {
    regime: mergeMeta('regime', regimeStatus !== null, regimeAge, regimeStale),
    m15: mergeMeta('m15', edgeM15 !== null, m15Age, m15Stale),
    decision: mergeMeta('decision', decision !== null, decisionAge, decisionStale),
    orderflow: mergeMeta('orderflow', orderflow !== null, orderflowAge, false),
    funding: mergeMeta('funding', fundingNode !== null, fundingAge, fundingStaleRaw),
  };
  const fundingStale = sources.funding.stale;

  return {
    as_of: pickAsOf(
      (edgeM15 as Record<string, unknown>)?.as_of,
      (decision as Record<string, unknown>)?.as_of,
      regimeNode?.as_of,
    ),
    generated_at: nowIso,
    stale: m15Stale || decisionStale,
    data_complete: !(m15Stale || decisionStale || regimeStale || orderflow === null || fundingStale),
    sources,
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
    funding: fundingNode,
    orderflow: orderflowNode,
  };
}

interface FetchedJson {
  data: Json;
  meta: { ok: boolean; http_status: number | null; error?: string };
}

async function fetchJsonLogged(origin: string, name: string): Promise<FetchedJson> {
  const url = `${origin.replace(/\/$/, '')}/${name}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (res.ok) {
        return { data: (await res.json()) as Record<string, unknown>, meta: { ok: true, http_status: res.status } };
      }
      // 5xx/transitoire → un retry; 4xx → pas la peine
      if (res.status >= 500 && attempt === 0) continue;
      return { data: null, meta: { ok: false, http_status: res.status } };
    } catch (e) {
      if (attempt === 1) {
        return { data: null, meta: { ok: false, http_status: null, error: e instanceof Error ? e.message : String(e) } };
      }
    }
  }
  return { data: null, meta: { ok: false, http_status: null } };
}

async function fetchHlFunding(assets: string[] = ['BTC', 'ETH']): Promise<FundingState | null> {
  try {
    const res = await fetch(HL_INFO_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const [meta, ctxs] = (await res.json()) as [
      { universe: Array<{ name: string }> },
      Array<Record<string, string>>,
    ];
    const out: FundingState['assets'] = {};
    meta.universe.forEach((asset, i) => {
      if (!assets.includes(asset.name)) return;
      const ctx = ctxs[i];
      const f = ctx ? Number(ctx.funding) : NaN;
      if (!Number.isFinite(f)) return;
      out[asset.name] = {
        funding_hourly: f,
        funding_apr_pct: f * 24 * 365 * 100,
        mark_px: ctx && Number.isFinite(Number(ctx.markPx)) ? Number(ctx.markPx) : null,
      };
    });
    if (Object.keys(out).length === 0) return null;
    return { as_of: new Date().toISOString(), source: 'hyperliquid:metaAndAssetCtxs', assets: out };
  } catch {
    return null;
  }
}

export async function fetchAgentState(origin = DASH_DATA_ORIGIN, now = Date.now()): Promise<AgentState> {
  const [edgeM15, regimeStatus, decision, orderflow, funding, carryState] = await Promise.all([
    fetchJsonLogged(origin, 'edge_m15_status.json'),
    fetchJsonLogged(origin, 'regime_status.json'),
    fetchJsonLogged(origin, 'decision_btceth_status.json'),
    fetchJsonLogged(origin, 'orderflow_status.json'),
    fetchHlFunding(),
    fetchJsonLogged(origin, 'funding_carry_state.json'),
  ]);
  // z(div) calculé côté VPS par l'exporter carry (def. V40 S8b) — badge dashboard
  const divZ = (carryState.data as Record<string, unknown> | null)?.divergence_zscore;
  const fundingWithDiv: FundingState | null = funding && divZ && typeof divZ === 'object'
    ? { ...funding, divergence_zscore: divZ as Record<string, number> }
    : funding;
  return buildAgentState(
    edgeM15.data,
    regimeStatus.data,
    decision.data,
    orderflow.data,
    fundingWithDiv,
    {
      m15: { ok: edgeM15.meta.ok, http_status: edgeM15.meta.http_status, ...(edgeM15.meta.error ? { error: edgeM15.meta.error } : {}), age_ms: null, stale: false },
      regime: { ok: regimeStatus.meta.ok, http_status: regimeStatus.meta.http_status, ...(regimeStatus.meta.error ? { error: regimeStatus.meta.error } : {}), age_ms: null, stale: false },
      decision: { ok: decision.meta.ok, http_status: decision.meta.http_status, ...(decision.meta.error ? { error: decision.meta.error } : {}), age_ms: null, stale: false },
      orderflow: { ok: orderflow.meta.ok, http_status: orderflow.meta.http_status, ...(orderflow.meta.error ? { error: orderflow.meta.error } : {}), age_ms: null, stale: false },
      funding: { ok: funding !== null, http_status: null, age_ms: null, stale: false },
    },
    now,
  );
}
