/**
 * GET /api/ftmo-pricer
 * Calibration FTMO pricer (chaîne SPX CBOE → SSVI → Bates).
 * Proxy DASH_DATA_ORIGIN en prod (Vercel), fichier local public/data en dev.
 * Headers X-Stale / X-Last-Export-Age-Ms comme /api/edge-m15-status.
 */
import { NextResponse } from 'next/server';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_FILE = join(process.cwd(), 'public', 'data', 'ftmo_pricer_calib.json');
const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const REMOTE_URL = `${DASH_DATA_ORIGIN.replace(/\/$/, '')}/ftmo_pricer_calib.json`;
const STALE_THRESHOLD_MS = 36 * 60 * 60 * 1000; // calibration 1×/jour → stale après 36h

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildResponse(body: string, fallbackMtimeMs: number) {
  let parsed: { last_export_success?: string } = {};
  try {
    parsed = JSON.parse(body);
  } catch {
    // staleness via mtime
  }
  const lastExportAgeMs = parsed.last_export_success
    ? Date.now() - Date.parse(parsed.last_export_success)
    : Date.now() - fallbackMtimeMs;
  const isStale = lastExportAgeMs > STALE_THRESHOLD_MS;
  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=120',
    'X-Last-Export-Age-Ms': String(lastExportAgeMs),
    'X-Stale': isStale ? '1' : '0',
  });
  return new NextResponse(body, { status: 200, headers });
}

export async function GET() {
  try {
    const res = await fetch(REMOTE_URL, { cache: 'no-store' });
    if (res.ok) {
      return buildResponse(await res.text(), Date.now());
    }
    throw new Error(`origin HTTP ${res.status}`);
  } catch {
    if (existsSync(LOCAL_FILE)) {
      return buildResponse(readFileSync(LOCAL_FILE, 'utf8'), statSync(LOCAL_FILE).mtimeMs);
    }
    return NextResponse.json(
      { error: 'calibration FTMO indisponible', stale: true },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
