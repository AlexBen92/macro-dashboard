/**
 * GET /api/decision-status
 *
 * Verbatim clone of /api/edge-m15-status pattern. Two modes:
 *   1. DASH_DATA_ORIGIN set (prod Vercel): proxy-fetch VPS file (avoids
 *      mixed-content HTTPS→HTTP). VPS cron keeps file fresh.
 *   2. DASH_DATA_ORIGIN unset (local dev): read /public/data/decision_btceth_status.json.
 *
 * Both paths emit X-Stale / X-Last-Export-Age-Ms headers derived from the
 * payload's last_export_success field (or fs mtime fallback).
 */
import { NextResponse } from 'next/server';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_FILE = join(process.cwd(), 'public', 'data', 'decision_btceth_status.json');
const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const REMOTE_URL = DASH_DATA_ORIGIN
  ? `${DASH_DATA_ORIGIN.replace(/\/$/, '')}/decision_btceth_status.json`
  : null;
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildResponse(body: string, fallbackMtimeMs: number) {
  let parsed: { last_export_success?: string | null } = {};
  try {
    parsed = JSON.parse(body) as { last_export_success?: string | null };
  } catch {
    // fall through with empty parsed; staleness falls back to mtime
  }
  const lastExportAgeMs = parsed.last_export_success
    ? Date.now() - Date.parse(parsed.last_export_success)
    : Date.now() - fallbackMtimeMs;
  const isStale = lastExportAgeMs > STALE_THRESHOLD_MS;
  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
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
      return staleBody('decision_btceth_status.json not found', 503);
    }
    const stat = statSync(LOCAL_FILE);
    const body = readFileSync(LOCAL_FILE, 'utf-8');
    return buildResponse(body, stat.mtimeMs);
  } catch (e) {
    return staleBody(String(e), 500);
  }
}
