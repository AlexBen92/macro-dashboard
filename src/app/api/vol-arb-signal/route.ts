import { NextResponse } from 'next/server';

const VPS_ENDPOINT = process.env.VOL_ARB_SIGNAL_URL || '';

export const revalidate = 300;

export async function GET() {
  if (!VPS_ENDPOINT) {
    return NextResponse.json(
      { success: false, available: false, error: 'VOL_ARB_SIGNAL_URL not configured' },
      { status: 200 },
    );
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(VPS_ENDPOINT, {
      next: { revalidate: 300 },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`VPS responded ${res.status}`);
    }

    const data = await res.json();
    return NextResponse.json({ success: true, available: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        available: false,
        error: error instanceof Error ? error.message : 'VPS unreachable',
      },
      { status: 200 },
    );
  }
}
