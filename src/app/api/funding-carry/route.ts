/**
 * GET /api/funding-carry
 *
 * Panneau "Live Edge" — seule stratégie VALIDATED du programme (funding carry
 * D1). Composite: état paper trader (VPS via dash-data) + funding live HL +
 * percentile 90j de l'historique funding HL. Cache 60s.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const HL_INFO_URL = 'https://api.hyperliquid.xyz/info';
const FETCH_TIMEOUT_MS = 8_000;
const HISTORY_DAYS = 90;

interface HlFundingEvent { fundingRate: string; time: number }

async function hlFundingHistory(coin: string, startTime: number): Promise<HlFundingEvent[]> {
  const res = await fetch(HL_INFO_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'fundingHistory', coin, startTime }),
    cache: 'no-store',
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) return [];
  return (await res.json()) as HlFundingEvent[];
}

function percentile(sorted: number[], x: number): number | null {
  if (sorted.length === 0) return null;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] < x) lo = mid + 1;
    else hi = mid;
  }
  return (lo / sorted.length) * 100;
}

export async function GET() {
  const startTime = Date.now() - HISTORY_DAYS * 24 * 3600 * 1000;
  const origin = DASH_DATA_ORIGIN.replace(/\/$/, '');

  // Univers piloté par le paper trader VPS (11 instruments depuis 2026-08-25),
  // fallback majors si l'état est indisponible.
  let coins: string[] = ['BTC', 'ETH'];
  try {
    const probe = await fetch(`${origin}/funding_carry_state.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch(() => null);
    if (probe && probe.ok) {
      const st = (await probe.json().catch(() => null)) as
        | { assets_universe?: string[] }
        | null;
      if (Array.isArray(st?.assets_universe) && st.assets_universe.length) {
        coins = st.assets_universe;
      }
    }
  } catch {
    // garde fallback majors
  }

  const [stateRes, ...hists] = await Promise.all([
    fetch(`${origin}/funding_carry_state.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch(() => null),
    ...coins.map((c) => hlFundingHistory(c, startTime).catch(() => [] as HlFundingEvent[])),
  ]);

  let paperState: Record<string, unknown> | null = null;
  if (stateRes && stateRes.ok) {
    paperState = (await stateRes.json().catch(() => null)) as Record<string, unknown> | null;
  }

  const assets: Record<string, unknown> = {};
  for (const [i, coin] of coins.entries()) {
    const hist = hists[i];
    const rates = hist.map((e) => Number(e.fundingRate)).filter((x) => Number.isFinite(x));
    if (rates.length === 0) continue;
    const sorted = [...rates].sort((a, b) => a - b);
    const current = rates[rates.length - 1];
    const windowDays = Math.round((rates.length / 24) * 10) / 10;
    assets[coin] = {
      funding_hourly: current,
      funding_apr_pct: current * 24 * 365 * 100,
      mean_apr_pct_window: (rates.reduce((s, x) => s + x, 0) / rates.length) * 24 * 365 * 100,
      percentile_window: percentile(sorted, current),
      window_days: windowDays,
      n_events: rates.length,
      last_event_ts: hist.length ? hist[hist.length - 1].time : null,
    };
  }

  return NextResponse.json(
    {
      as_of: new Date().toISOString(),
      history_days: HISTORY_DAYS,
      paper_state: paperState,
      funding: assets,
      sources: {
        paper_state_ok: paperState !== null,
        hl_history_ok: Object.keys(assets).length > 0,
      },
    },
    {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    },
  );
}
