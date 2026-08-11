/**
 * GET /api/edge-m15-status
 *
 * Wraps /public/data/edge_m15_status.json with:
 *   - short Cache-Control (60s s-maxage, 30s stale-while-revalidate)
 *   - mtime-based staleness check returning { stale: true, ageMs } in header
 *   - 503 with stale body if file missing entirely (vs 200 with degraded JSON)
 *
 * On Vercel serverless, fs is readonly — the cron writes via VPS backend or
 * NEXT_PUBLIC_DASH_DATA_URL serves the file directly. This route is a thin
 * layer for local dev + Vercel preview deployments reading from /public.
 */
import { NextResponse } from 'next/server';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const DATA_FILE = join(process.cwd(), 'public', 'data', 'edge_m15_status.json');
const STALE_THRESHOLD_MS = 20 * 60 * 1000;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    if (!existsSync(DATA_FILE)) {
      return NextResponse.json(
        { error: 'edge_m15_status.json not found', stale: true },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const stat = statSync(DATA_FILE);
    const body = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(body) as { last_export_success?: string };
    // Prefer the in-payload timestamp (more precise than fs mtime on cloud hosts).
    const lastExportAgeMs = parsed.last_export_success
      ? Date.now() - Date.parse(parsed.last_export_success)
      : Date.now() - stat.mtimeMs;
    const isStale = lastExportAgeMs > STALE_THRESHOLD_MS;
    const headers = new Headers({
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
      'X-Last-Export-Age-Ms': String(lastExportAgeMs),
      'X-Stale': isStale ? '1' : '0',
    });
    return new NextResponse(body, { status: 200, headers });
  } catch (e) {
    return NextResponse.json(
      { error: String(e), stale: true },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
