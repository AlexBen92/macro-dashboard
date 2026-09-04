/**
 * GET /api/paper-dsr
 *
 * Rolling Sharpe/PSR/DSR monitor for the freqtrade paper-trade combos
 * (ICHI_COMBO spot 4h + SRSI_COMBO futures 1d). Source: VPS cron
 * rolling_dsr.py (06:37 daily) -> /dash-data/paper_dsr.json.
 *
 * Same modes as /api/edge-m15-status:
 *   1. DASH_DATA_ORIGIN set (prod Vercel): proxy-fetch VPS file.
 *   2. unset (local dev): read /public/data/paper_dsr.json.
 *
 * Freshness derived from payload generated_utc; stale threshold 26h (cron daily).
 */
import { NextResponse } from 'next/server';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LOCAL_FILE = join(process.cwd(), 'public', 'data', 'paper_dsr.json');
const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data';
const REMOTE_URL = `${DASH_DATA_ORIGIN.replace(/\/$/, '')}/paper_dsr.json`;
const STALE_THRESHOLD_MS = 26 * 60 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function buildResponse(body: string, fallbackMtimeMs: number) {
  let parsed: { generated_utc?: string } = {};
  try {
    parsed = JSON.parse(body) as { generated_utc?: string };
  } catch {
    // fall through with empty parsed; staleness falls back to mtime
  }
  const t = parsed.generated_utc ? Date.parse(parsed.generated_utc) : NaN;
  const lastExportAgeMs = Number.isFinite(t) ? Date.now() - t : Date.now() - fallbackMtimeMs;
  const isStale = lastExportAgeMs > STALE_THRESHOLD_MS;
  const headers = new Headers({
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
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
    const body = await upstream.text();
    return buildResponse(body, Date.now());
  } catch (e) {
    // local dev fallback when VPS unreachable
    try {
      if (!existsSync(LOCAL_FILE)) {
        return staleBody(String(e), 502);
      }
      const stat = statSync(LOCAL_FILE);
      return buildResponse(readFileSync(LOCAL_FILE, 'utf-8'), stat.mtimeMs);
    } catch (e2) {
      return staleBody(String(e2), 500);
    }
  }
}
