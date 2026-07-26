import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  return NextResponse.json(
    {
      success: false,
      available: false,
      error: 'history not configured — no persisted GEX/DEX collector yet',
      source: 'deribit_public',
    },
    {
      status: 404,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
