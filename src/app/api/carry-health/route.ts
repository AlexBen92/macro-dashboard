/**
 * GET /api/carry-health — proxy VPS dash-data/carry_health.json.
 * Basis/funding live par paire + statut contrats carry D1 + alertes drift.
 * Exporteur cron VPS: m15-cockpit-service (2,17,32,47 * * * *).
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DASH_DATA_ORIGIN = (
  process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data'
).replace(/\/$/, '');
const STALE_THRESHOLD_MS = 35 * 60 * 1000;

export async function GET() {
  try {
    const res = await fetch(`${DASH_DATA_ORIGIN}/carry_health.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const body = (await res.json()) as { as_of?: string };
    const ageMs = body.as_of ? Date.now() - Date.parse(body.as_of) : null;
    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      'X-Stale': ageMs !== null && ageMs > STALE_THRESHOLD_MS ? '1' : '0',
      'X-Last-Export-Age-Ms': String(ageMs ?? -1),
    });
    return NextResponse.json(body, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: 'carry_health indisponible (exporteur VPS)' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
