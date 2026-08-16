/**
 * GET /api/crypto/top50
 *
 * Top 50 crypto by market cap (CoinGecko /coins/markets — same provider as
 * the existing api-clients.ts global/simple-price calls) merged with live
 * Hyperliquid perp funding (metaAndAssetCtxs) where the coin trades.
 */
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const CG_MARKETS =
  'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&price_change_percentage=24h,7d&sparkline=false';
const HL_INFO = 'https://api.hyperliquid.xyz/info';

interface Top50Coin {
  rank: number;
  id: string;
  symbol: string;
  name: string;
  price: number | null;
  chg_24h: number | null;
  chg_7d: number | null;
  volume_24h: number | null;
  market_cap: number | null;
  funding_apr: number | null;
}

async function fetchMarkets(): Promise<Top50Coin[]> {
  const res = await fetch(CG_MARKETS, {
    cache: 'no-store',
    headers: { accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`coingecko HTTP ${res.status}`);
  const rows = (await res.json()) as Array<Record<string, unknown>>;
  return rows.map((r, i) => ({
    rank: i + 1,
    id: String(r.id ?? ''),
    symbol: String(r.symbol ?? '').toUpperCase(),
    name: String(r.name ?? ''),
    price: (r.current_price as number) ?? null,
    chg_24h: (r.price_change_percentage_24h_in_currency as number) ?? null,
    chg_7d: (r.price_change_percentage_7d_in_currency as number) ?? null,
    volume_24h: (r.total_volume as number) ?? null,
    market_cap: (r.market_cap as number) ?? null,
    funding_apr: null,
  }));
}

async function fetchHlFunding(): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  try {
    const res = await fetch(HL_INFO, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type: 'metaAndAssetCtxs' }),
      cache: 'no-store',
    });
    if (!res.ok) return out;
    const [meta, ctxs] = (await res.json()) as [
      { universe: Array<{ name: string }> },
      Array<Record<string, string>>,
    ];
    meta.universe.forEach((asset, i) => {
      const ctx = ctxs[i];
      const f = ctx ? Number(ctx.funding) : NaN;
      if (Number.isFinite(f)) {
        // HL funding is an hourly rate → APR %
        out.set(asset.name, f * 24 * 365 * 100);
      }
    });
  } catch {
    // funding merge is best-effort; table renders without it
  }
  return out;
}

export async function GET() {
  try {
    const [coins, funding] = await Promise.all([fetchMarkets(), fetchHlFunding()]);
    for (const c of coins) {
      const f = funding.get(c.symbol) ?? funding.get(c.id.toUpperCase());
      if (f != null) c.funding_apr = Math.round(f * 100) / 100;
    }
    return NextResponse.json(
      { asOf: new Date().toISOString(), coins },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: String(e), coins: [] },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
