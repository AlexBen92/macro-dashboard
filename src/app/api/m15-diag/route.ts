/**
 * GET /api/m15-diag — proxy VPS dash-data m15-diag.json (divergence par
 * symbole + SLO) et m15-diag-brake.json (coût d'opportunité BRAKE).
 * Exporteurs nocturnes: m15-reconcile.timer.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DASH_DATA_ORIGIN = (
  process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data'
).replace(/\/$/, '');
const STALE_THRESHOLD_MS = 30 * 3600 * 1000;

export async function GET() {
  const upstream = async (file: string) => {
    const res = await fetch(`${DASH_DATA_ORIGIN}/${file}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) throw new Error(`${file} upstream ${res.status}`);
    return res.json();
  };
  try {
    const [diag, brake] = await Promise.all([
      upstream('m15-diag.json'),
      upstream('m15-diag-brake.json').catch(() => null),
    ]);
    const utc = (diag as { utc?: string }).utc ?? null;
    const ageMs = utc ? Date.now() - Date.parse(utc) : null;
    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
      'X-Stale': ageMs !== null && ageMs > STALE_THRESHOLD_MS ? '1' : '0',
      'X-Last-Export-Age-Ms': String(ageMs ?? -1),
    });
    return NextResponse.json(
      { diag, brake },
      { status: 200, headers },
    );
  } catch {
    return NextResponse.json(
      { error: 'm15-diag indisponible (reconcile VPS)' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
