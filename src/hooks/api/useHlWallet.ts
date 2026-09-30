'use client';

import useSWR from 'swr';

/** Hyperliquid wallet live state — read-only, public info endpoint via
 * /api/hyperliquid proxy (clearinghouseState + userFills). */
export const HL_WALLET_ADDRESS = '0x6eBB536e529bE4c5aCF2D8AeE16D56b07BaD8731';

interface HlMarginSummary {
  accountValue: string;
  totalNtlPos: string;
  totalRawUsd: string;
  totalMarginUsed: string;
}

export interface HlPosition {
  coin: string;
  szi: number;
  entryPx: string | null;
  positionValue: string;
  unrealizedPnl: string;
  returnOnEquity: string;
  liquidationPx: string | null;
  leverage: number;
  isLong: boolean;
}

export interface HlFill {
  coin: string;
  dir: string;
  px: string;
  sz: string;
  closedPnl: string;
  time: number;
}

export interface HlWalletState {
  accountValue: number;
  withdrawable: number;
  marginUsed: number;
  notionalPos: number;
  spotUsdc: number;
  totalEquity: number;
  positions: HlPosition[];
  fills: HlFill[];
  timestamp: number;
}

interface RouteResponse {
  success: boolean;
  data: unknown;
  error?: string;
}

async function postHl<T>(method: string, params: Record<string, string>): Promise<T> {
  const res = await fetch('/api/hyperliquid', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ method, params }),
  });
  const json = (await res.json()) as RouteResponse;
  if (!json.success) throw new Error(json.error ?? 'HL route error');
  return json.data as T;
}

function parseState(raw: unknown): Omit<HlWalletState, "fills" | "spotUsdc" | "totalEquity"> {
  const s = raw as {
    marginSummary: HlMarginSummary;
    withdrawable: string;
    assetPositions: Array<{ position: Record<string, string | number | boolean> }>;
    time: number;
  };
  const positions: HlPosition[] = (s.assetPositions ?? [])
    .map(({ position: p }) => {
      const lev = p.leverage as { value?: number; type?: string } | undefined;
      return {
        coin: String(p.coin),
        szi: Number(p.szi),
        entryPx: typeof p.entryPx === 'string' ? p.entryPx : null,
        positionValue: String(p.positionValue ?? '0'),
        unrealizedPnl: String(p.unrealizedPnl ?? '0'),
        returnOnEquity: String(p.returnOnEquity ?? '0'),
        liquidationPx:
          typeof p.liquidationPx === 'string' && p.liquidationPx !== ''
            ? p.liquidationPx
            : null,
        leverage: Number(lev?.value ?? 1),
        isLong: Number(p.szi) > 0,
      };
    })
    .filter((p) => p.szi !== 0);
  return {
    accountValue: Number(s.marginSummary?.accountValue ?? 0),
    withdrawable: Number(s.withdrawable ?? 0),
    marginUsed: Number(s.marginSummary?.totalMarginUsed ?? 0),
    notionalPos: Number(s.marginSummary?.totalNtlPos ?? 0),
    positions,
    timestamp: Number(s.time ?? Date.now()),
  };
}

const fetcher = async (): Promise<HlWalletState> => {
  const [state, fills, spot] = await Promise.all([
    postHl<unknown>('user_state', { address: HL_WALLET_ADDRESS }),
    postHl<unknown[]>('user_fills', { address: HL_WALLET_ADDRESS }).catch(() => []),
    postHl<unknown>('spot_state', { address: HL_WALLET_ADDRESS }).catch(() => null),
  ]);
  const parsed = parseState(state);
  const spotUsdc = parseSpotUsdc(spot);
  return {
    ...parsed,
    spotUsdc,
    totalEquity: parsed.accountValue + spotUsdc,
    fills: parseFills(fills),
  };
};

function parseSpotUsdc(spot: unknown): number {
  if (!spot || typeof spot !== 'object') return 0;
  const balances = (spot as { balances?: Array<Record<string, unknown>> }).balances ?? [];
  const usdc = balances.find((b) => b.coin === 'USDC');
  return usdc ? Number(usdc.total ?? 0) : 0;
}

function parseFills(fills: unknown): HlFill[] {
  return (Array.isArray(fills) ? fills : [])
    .slice(0, 8)
    .map((f) => {
      const row = f as Record<string, string | number>;
      return {
        coin: String(row.coin),
        dir: String(row.dir ?? ''),
        px: String(row.px),
        sz: String(row.sz),
        closedPnl: String(row.closedPnl ?? '0'),
        time: Number(row.time ?? 0),
      };
    });
}

export function useHlWallet(): {
  data: HlWalletState | null;
  isLoading: boolean;
  error: string | null;
} {
  const { data, error, isLoading } = useSWR<HlWalletState>(
    'hl-wallet-live',
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );
  return {
    data: data ?? null,
    isLoading: isLoading && !data,
    error: error ? String(error) : null,
  };
}
