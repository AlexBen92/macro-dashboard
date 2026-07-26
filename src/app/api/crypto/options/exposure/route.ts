import { NextResponse } from 'next/server';

import { aggregateExposure, fetchDeribitBookSummary } from '@/lib/options/deribit';
import type { ExpiryBucket, SupportedCurrency } from '@/lib/options/types';

export const revalidate = 300;
export const dynamic = 'force-dynamic';

const SUPPORTED: ReadonlySet<SupportedCurrency> = new Set<SupportedCurrency>(['BTC', 'ETH']);
const BUCKETS: ReadonlySet<ExpiryBucket> = new Set<ExpiryBucket>([
  'all',
  '0-7d',
  '8-30d',
  '31-90d',
]);

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<string, { ts: number; payload: unknown; status: number }>();

interface QueryError {
  success: boolean;
  available: boolean;
  error: string;
  status: 'bad_request' | 'upstream_error' | 'no_data';
  source?: string;
}

function badRequest(error: string) {
  return NextResponse.json({ success: false, error }, { status: 400 });
}

function upstreamError(error: string) {
  const payload: QueryError = {
    success: false,
    available: false,
    error,
    status: 'upstream_error',
    source: 'deribit_public',
  };
  return NextResponse.json(payload, {
    status: 502,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const symbolRaw = (url.searchParams.get('symbol') ?? 'BTC').toUpperCase();
  const bucketRaw = (url.searchParams.get('expiryBucket') ?? 'all') as ExpiryBucket;

  if (!SUPPORTED.has(symbolRaw as SupportedCurrency)) {
    return badRequest(`unsupported symbol: ${symbolRaw}. Supported: BTC, ETH.`);
  }
  if (!BUCKETS.has(bucketRaw)) {
    return badRequest(`invalid expiryBucket: ${bucketRaw}. Valid: all, 0-7d, 8-30d, 31-90d.`);
  }
  const symbol = symbolRaw as SupportedCurrency;
  const expiryBucket = bucketRaw;

  const cacheKey = `${symbol}|${expiryBucket}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return NextResponse.json(hit.payload, {
      status: hit.status,
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
        'X-Cache': 'HIT',
      },
    });
  }

  try {
    const fetched = await fetchDeribitBookSummary(symbol, { timeoutMs: 8000 });
    const snapshot = aggregateExposure(fetched.rows, fetched.underlying, {
      expiryBucket,
    });
    snapshot.warnings.unshift(...fetched.warnings);

    if (snapshot.strikes.length === 0) {
      const payload = {
        success: false,
        available: false,
        error: 'no parseable strikes for this symbol/bucket',
        warnings: snapshot.warnings,
        source: 'deribit_public',
      };
      cache.set(cacheKey, { ts: Date.now(), payload, status: 503 });
      return NextResponse.json(payload, {
        status: 503,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const payload = { success: true, available: true, data: snapshot };
    cache.set(cacheKey, { ts: Date.now(), payload, status: 200 });
    return NextResponse.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=60',
        'X-Cache': 'MISS',
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    cache.delete(cacheKey);
    return upstreamError(`deribit upstream error: ${msg}`);
  }
}
