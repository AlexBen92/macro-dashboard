/**
 * GET /api/hurst-crypto — proxy VPS dash-data/hurst_crypto.json.
 * Exposant de Hurst multi-TF (BTC/ETH/SOL × M15/H1/H4/D1).
 * Exporteur cron VPS horaire :07 (src.export_hurst_crypto).
 * Proxy serveur (et non fetch client direct de DASH_DATA_ORIGIN) pour éviter
 * le mixed content http→https bloqué par le navigateur.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const DASH_DATA_ORIGIN = (
  process.env.DASH_DATA_ORIGIN || 'http://187.124.38.41/dash-data'
).replace(/\/$/, '');

export async function GET() {
  try {
    const res = await fetch(`${DASH_DATA_ORIGIN}/hurst_crypto.json`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}` },
        { status: 502, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    const body = await res.json();
    return NextResponse.json(body, {
      status: 200,
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30' },
    });
  } catch {
    return NextResponse.json(
      { error: 'hurst_crypto indisponible (exporteur VPS)' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
