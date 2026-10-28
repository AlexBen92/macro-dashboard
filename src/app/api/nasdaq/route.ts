/**
 * GET /api/nasdaq
 *
 * ORB Nasdaq : status intraday + contexte + stats descriptives.
 * Sources : JSON produits par les collecteurs VPS (timers orb-*,
 * /var/www/dash-data/nasdaq_*.json), servis via nginx /dash-data.
 * Même schéma que corr-basket : fichier local d'abord, fallback distant,
 * staleness explicite (jamais de valeur sans horodatage).
 */
import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { isStale } from '@/lib/nasdaq';

const LOCAL_DIR = join(process.cwd(), 'public', 'data');
const DASH_DATA_ORIGIN = process.env.DASH_DATA_ORIGIN || '';
const FILES = [
  ['nasdaq_orb_status', 'status'],
  ['nasdaq_context', 'context'],
  ['nasdaq_orb_stats', 'stats'],
  ['nasdaq_night_day', 'night_day'],
  ['nasdaq_events', 'events'],
  ['nasdaq_strategies', 'strategies'],
] as const;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function loadLocal(name: string): Record<string, unknown> | null {
  const p = join(LOCAL_DIR, `${name}.json`);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function loadRemote(name: string): Promise<Record<string, unknown> | null> {
  if (!DASH_DATA_ORIGIN) return null;
  try {
    const url = `${DASH_DATA_ORIGIN.replace(/\/$/, '')}/${name}.json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET() {
  const data: Record<string, unknown> = {};
  const stale: Record<string, boolean> = {
    status: true, context: true, stats: true,
    night_day: true, events: true, strategies: true,
  };
  for (const [name, kind] of FILES) {
    const obj = loadLocal(name) ?? (await loadRemote(name));
    if (!obj) continue;
    data[kind] = obj;
    stale[kind] = isStale(obj['as_of'] as string | undefined,
      kind === 'status' ? 'status' : kind === 'context' ? 'context'
        : kind === 'stats' ? 'stats' : 'panels');
  }
  const res = NextResponse.json({ ...data, stale });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
