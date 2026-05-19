import type { HyperliquidResponse, HyperliquidMeta, HyperliquidAssetCtx } from './types';

const HL_API = 'https://api.hyperliquid.xyz/info';

async function hlPost<T>(body: Record<string, unknown>): Promise<T | null> {
  try {
    const res = await fetch(HL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getHyperliquidMeta(): Promise<HyperliquidMeta[]> {
  const res = await hlPost<{ universe: HyperliquidMeta[] }>({ type: 'meta' });
  return res?.universe ?? [];
}

export async function getHyperliquidAssetCtxs(): Promise<HyperliquidAssetCtx[]> {
  const res = await hlPost<unknown[]>({ type: 'assetCtxs' });
  return (Array.isArray(res) ? res : []) as HyperliquidAssetCtx[];
}

export async function getHyperliquidMetaAndAssetCtxs(): Promise<HyperliquidResponse> {
  const res = await hlPost<[HyperliquidMeta[], HyperliquidAssetCtx[]]>({ type: 'metaAndAssetCtxs' });
  if (!res || !Array.isArray(res) || res.length < 2) {
    return { universe: [], assetCtxs: [] };
  }
  return { universe: res[0], assetCtxs: res[1] };
}

export async function getHyperliquidAllMids(): Promise<Record<string, string>> {
  const res = await hlPost<Record<string, string>>({ type: 'allMids' });
  return res ?? {};
}

export async function getHyperliquidFundingHistory(coin: string, startTime?: number, endTime?: number): Promise<unknown[]> {
  const now = endTime ?? Date.now();
  const start = startTime ?? now - 86400000;
  const res = await hlPost<unknown[]>({
    type: 'fundingHistory',
    coin,
    startTime: Math.floor(start / 1000),
    endTime: Math.floor(now / 1000),
  });
  return (Array.isArray(res) ? res : []) as unknown[];
}

export async function getHyperliquidCandles(coin: string, interval: string, startTime: number, endTime: number): Promise<Array<{
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
}>> {
  const res = await hlPost<{ candleSnapshot: Array<{ t: number; o: string; h: string; l: string; c: string; v: string }> }>({
    type: 'candleSnapshot',
    req: { coin, interval, startTime, endTime },
  });
  return res?.candleSnapshot ?? [];
}
