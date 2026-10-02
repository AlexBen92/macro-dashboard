/**
 * GET /api/m15-shadow — proxy VPS dash-data/m15-shadow.json.
 * Variantes shadow (cap 18), lentilles comptables, sims de capacité.
 * Exporteur nocturne: m15-reconcile.timer (stats_shadow → sim_capacity).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DASH_DATA_ORIGIN = (
  process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data'
).replace(/\/$/, '');
const STALE_THRESHOLD_MS = 30 * 3600 * 1000; // export daily 20:07 UTC

export async function GET() {
  try {
    const res = await fetch(`${DASH_DATA_ORIGIN}/m15-shadow.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const body = (await res.json()) as { utc?: string };
    const ageMs = body.utc ? Date.now() - Date.parse(body.utc) : null;
    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
      'X-Stale': ageMs !== null && ageMs > STALE_THRESHOLD_MS ? '1' : '0',
      'X-Last-Export-Age-Ms': String(ageMs ?? -1),
    });
    return NextResponse.json(body, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: 'm15-shadow indisponible (reconcile VPS)' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
