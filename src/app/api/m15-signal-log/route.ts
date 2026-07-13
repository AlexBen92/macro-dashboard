/**
 * M15 signal log API
 * POST  /api/m15-signal-log        -> persist one READY signal
 * GET   /api/m15-signal-log        -> query (symbol, since, limit, action)
 * GET   /api/m15-signal-log?stats  -> aggregate stats
 */
import { NextRequest, NextResponse } from 'next/server';
import { appendSignal, readSignals, getStats, type M15SignalEntry } from '@/lib/m15-signal-log';

const SCHEMA_VERSION = '30/40/30@0e2f2c3';
const RATE_LIMIT_PER_SYMBOL_MS = 15 * 60 * 1000;

const lastWriteBySymbol = new Map<string, number>();

function isM15SignalEntry(x: unknown): x is M15SignalEntry {
  if (typeof x !== 'object' || x === null) return false;
  const e = x as Record<string, unknown>;
  return (
    typeof e.ts === 'string' &&
    typeof e.symbol === 'string' &&
    typeof e.session === 'string' &&
    typeof e.session_score === 'number' &&
    typeof e.layers === 'object' && e.layers !== null &&
    typeof e.action === 'string' &&
    typeof e.direction === 'string' &&
    typeof e.price_entry === 'number'
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!isM15SignalEntry(body)) {
      return NextResponse.json({ error: 'invalid payload' }, { status: 400 });
    }
    if (body.action !== 'READY') {
      return NextResponse.json(
        { error: 'only READY signals are persisted', action: body.action },
        { status: 400 },
      );
    }

    // Dedup: 1 log per symbol per 15min
    const now = Date.now();
    const last = lastWriteBySymbol.get(body.symbol) ?? 0;
    if (now - last < RATE_LIMIT_PER_SYMBOL_MS) {
      return NextResponse.json(
        { ok: true, skipped: true, reason: 'rate_limited', cooldown_ms: RATE_LIMIT_PER_SYMBOL_MS - (now - last) },
        { status: 200 },
      );
    }

    const entry: M15SignalEntry = { ...body, version: SCHEMA_VERSION };
    const res = await appendSignal(entry);
    lastWriteBySymbol.set(body.symbol, now);
    return NextResponse.json(res, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    if (searchParams.get('stats') === '1') {
      const stats = await getStats();
      return NextResponse.json(stats, { status: 200 });
    }
    const symbol = searchParams.get('symbol') ?? undefined;
    const sinceStr = searchParams.get('since');
    const since = sinceStr ? Number(sinceStr) : undefined;
    const limitStr = searchParams.get('limit');
    const limit = limitStr ? Number(limitStr) : undefined;
    const action = (searchParams.get('action') as 'READY' | 'WATCH' | 'AVOID' | null) ?? undefined;
    const rows = await readSignals({ symbol, since, limit, action });
    return NextResponse.json({ count: rows.length, rows }, { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
