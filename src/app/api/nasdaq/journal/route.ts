/**
 * Proxy journal de trades (spec V3 §10) — le front ne parle jamais au VPS
 * directement (http + secret) : ce handler injecte le token côté serveur.
 * GET = liste ; POST = ajout ; DELETE = suppression par id.
 */
import { NextResponse } from 'next/server';

const ORIGIN = (process.env.DASH_DATA_ORIGIN || '')
  .replace(/\/dash-data\/?$/, '')
  .replace(/\/$/, '');
const BASE = `${ORIGIN}/journal-api`;

function headers(): HeadersInit | null {
  const token = process.env.JOURNAL_TOKEN || '';
  if (!token || !ORIGIN.startsWith('http')) return null;
  return { 'Content-Type': 'application/json', 'X-Journal-Token': token };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const h = headers();
  if (!h) return NextResponse.json({ error: 'config manquante' }, { status: 503 });
  try {
    const r = await fetch(`${BASE}/all`, { headers: h, cache: 'no-store', signal: AbortSignal.timeout(6000) });
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'indisponible' },
      { status: 502 },
    );
  }
}

async function forward(path: string, req: Request, expectBody: boolean) {
  const h = headers();
  if (!h) return NextResponse.json({ error: 'config manquante' }, { status: 503 });
  let payload = '{}';
  try {
    payload = await req.text();
    if (payload.length > 4096) {
      return NextResponse.json({ error: 'payload trop grand' }, { status: 413 });
    }
    JSON.parse(payload);
  } catch {
    return NextResponse.json({ error: 'json invalide' }, { status: 400 });
  }
  try {
    const r = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: h,
      body: payload,
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    const body = await r.json();
    return NextResponse.json(body, { status: r.status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'indisponible' },
      { status: 502 },
    );
  }
}

export async function POST(req: Request) {
  return forward('/append', req, true);
}

export async function DELETE(req: Request) {
  return forward('/delete', req, true);
}
