/**
 * GET /api/regime-matrix
 *
 * Same two-mode pattern as regime-status. Regime matrix updates daily 05:43 UTC.
 * Staleness threshold 26 hours.
 */
import { NextResponse } from 'next/server';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_FILE = join(process.cwd(), 'public', 'data', 'regime_matrix.json');
const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const REMOTE_URL = DASH_DATA_ORIGIN
  ? `${DASH_DATA_ORIGIN.replace(/\/$/, '')}/regime_matrix.json`
  : null;
const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildResponse(body: string, fallbackMtimeMs: number) {
  let parsed: { as_of?: string } = {};
  try {
    parsed = JSON.parse(body) as { as_of?: string };
  } catch {
    // ignore: staleness falls back to mtime
  }
  const asOfMs = parsed.as_of ? Date.parse(parsed.as_of) : NaN;
  const lastExportAgeMs = Number.isNaN(asOfMs)
    ? Date.now() - fallbackMtimeMs
    : Date.now() - asOfMs;
  const isStale = lastExportAgeMs > STALE_THRESHOLD_MS;
  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
    'X-Last-Export-Age-Ms': String(lastExportAgeMs),
    'X-Stale': isStale ? '1' : '0',
  });
  return new NextResponse(body, { status: 200, headers });
}

function staleBody(message: string, status: number) {
  return NextResponse.json(
    { error: message, stale: true },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function GET() {
  if (REMOTE_URL) {
    try {
      const upstream = await fetch(REMOTE_URL, { cache: 'no-store' });
      if (!upstream.ok) {
        return staleBody(`upstream HTTP ${upstream.status}`, 502);
      }
      const body = await upstream.text();
      return buildResponse(body, Date.now());
    } catch (e) {
      return staleBody(String(e), 502);
    }
  }

  try {
    if (!existsSync(LOCAL_FILE)) {
      return staleBody('regime_matrix.json not found', 503);
    }
    const stat = statSync(LOCAL_FILE);
    const body = readFileSync(LOCAL_FILE, 'utf-8');
    return buildResponse(body, stat.mtimeMs);
  } catch (e) {
    return staleBody(String(e), 500);
  }
}
