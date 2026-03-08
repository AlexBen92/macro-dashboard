import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const res = await fetch('https://colintalkscrypto.com/cbbi/data/latest.json');
    const cb = await res.json();

    const keys = Object.keys(cb.Confidence).sort((a, b) => +a - +b);
    const lastKey = keys[keys.length - 1];

    const confidence = cb.Confidence[lastKey];
    const indicators: Record<string, number> = {
      mvrv: cb.MVRV?.[lastKey] ?? 0,
      pi: cb.PiCycle?.[lastKey] ?? 0,
      puell: cb.Puell?.[lastKey] ?? 0,
      rhodl: cb.RHODL?.[lastKey] ?? 0,
      rupl: cb.RUPL?.[lastKey] ?? 0,
      rr: cb.ReserveRisk?.[lastKey] ?? 0,
      yma: cb['2YMA']?.[lastKey] ?? 0,
      woob: cb.Woobull?.[lastKey] ?? 0,
    };

    return NextResponse.json(
      { confidence, indicators, timestamp: Date.now() },
      { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=600' } }
    );
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
