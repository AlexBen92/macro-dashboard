/**
 * GET /api/microstructure
 *
 * Proxy VPS (DASH_DATA_ORIGIN, fallback baked-in IP) — même pattern que
 * /api/ofi-obi-status. Fallback local-dev: public/data/microstructure_status.json.
 *
 * Staleness 5min (collector systemd exporte toutes les 5s — payload doit être frais).
 */
import { NextResponse } from 'next/server';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_FILE = join(process.cwd(), 'public', 'data', 'microstructure_status.json');
const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const REMOTE_URL = `${DASH_DATA_ORIGIN.replace(/\/$/, '')}/microstructure_status.json`;
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildResponse(body: string, fallbackMtimeMs: number) {
  let parsed: { generated_at?: string } = {};
  try {
    parsed = JSON.parse(body) as { generated_at?: string };
  } catch {
    // ignore: staleness retombe sur mtime
  }
  const lastExportAgeMs = parsed.generated_at
    ? Date.now() - Date.parse(parsed.generated_at)
    : Date.now() - fallbackMtimeMs;
  const isStale = lastExportAgeMs > STALE_THRESHOLD_MS;
  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=10',
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
  try {
    const upstream = await fetch(REMOTE_URL, { cache: 'no-store' });
    if (!upstream.ok) {
      return staleBody(`upstream HTTP ${upstream.status}`, 502);
    }
    return buildResponse(await upstream.text(), Date.now());
  } catch {
    // upstream injoignable → fallback snapshot local (dev)
  }
  try {
    if (!existsSync(LOCAL_FILE)) {
      return staleBody('microstructure_status.json not found', 503);
    }
    const stat = statSync(LOCAL_FILE);
    return buildResponse(readFileSync(LOCAL_FILE, 'utf-8'), stat.mtimeMs);
  } catch (e) {
    return staleBody(String(e), 500);
  }
}
