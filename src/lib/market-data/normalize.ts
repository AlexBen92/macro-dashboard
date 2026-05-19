import type { HyperliquidResponse, MarketRow, HyperliquidMonitorStats } from './types';
import { deriveMarketBias } from './interpretation';

interface NormalizationOptions {
  includeStablecoins?: boolean;
  minVolume?: number;
  minOpenInterest?: number;
}

const STABLECOINS = ['USDC', 'USDT', 'DAI', 'TUSD', 'USDD', 'FDUSD', 'PYUSD'];
const DEFAULT_OPTIONS: NormalizationOptions = {
  includeStablecoins: false,
  minVolume: 100000,
  minOpenInterest: 50000,
};

function safeFloat(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return isNaN(num) ? null : num;
}

function formatVolume(val: number | null): string {
  if (val === null) return '—';
  if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(2)}K`;
  return `$${val.toFixed(2)}`;
}

function formatPercentage(val: number | null, decimals = 2): string {
  if (val === null) return '—';
  return `${val >= 0 ? '+' : ''}${val.toFixed(decimals)}%`;
}

function formatPrice(val: number | null, symbol: string): string {
  if (val === null) return '—';
  if (val >= 1000) return `$${val.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  if (val >= 1) return `$${val.toFixed(4)}`;
  if (val >= 0.0001) return `$${val.toFixed(6)}`;
  return `$${val.toFixed(8)}`;
}

export function formatMarketTableRows(
  response: HyperliquidResponse,
  options: NormalizationOptions = {},
  prevData?: Map<string, { oi: number; vol: number }>
): MarketRow[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const now = new Date().toISOString();

  const rows: MarketRow[] = [];

  for (let i = 0; i < response.universe.length; i++) {
    const meta = response.universe[i];
    const ctx = response.assetCtxs[i];

    if (!ctx) continue;

    const symbol = meta.name;

    if (!opts.includeStablecoins && STABLECOINS.includes(symbol)) continue;

    const price = safeFloat(ctx.markPx);
    const prevPrice = safeFloat(ctx.prevDayPx);
    const fundingRate = safeFloat(ctx.funding);
    const openInterest = safeFloat(ctx.openInterest);
    const volume24h = safeFloat(ctx.dayNtlVlm);

    if (
      (opts.minVolume && volume24h && volume24h < opts.minVolume) ||
      (opts.minOpenInterest && openInterest && openInterest < opts.minOpenInterest)
    ) {
      continue;
    }

    let change24h: number | null = null;
    if (price !== null && prevPrice !== null && prevPrice > 0) {
      change24h = ((price - prevPrice) / prevPrice) * 100;
    }

    const prev = prevData?.get(symbol);
    const bias = deriveMarketBias({
      change24h,
      openInterest,
      volume24h,
      fundingRate,
      volatility24h: null,
      prevOpenInterest: prev?.oi ?? null,
      prevVolume: prev?.vol ?? null,
    });

    rows.push({
      symbol,
      price,
      change24h,
      volume24h,
      openInterest,
      fundingRate: fundingRate !== null ? fundingRate * 100 : null,
      volatility24h: null,
      source: 'hyperliquid',
      updatedAt: now,
      biasLabel: bias.label,
      biasColor: bias.color,
      strengthScore: bias.strengthScore,
      interpretation: bias.interpretation,
    });
  }

  return rows.sort((a, b) => (b.openInterest ?? 0) - (a.openInterest ?? 0));
}

export function computeMonitorStats(rows: MarketRow[]): HyperliquidMonitorStats {
  const validRows = rows.filter(r => r.openInterest !== null && r.volume24h !== null);

  const aggregateOpenInterest = validRows.reduce((sum, r) => sum + (r.openInterest ?? 0), 0);
  const aggregate24hVolume = validRows.reduce((sum, r) => sum + (r.volume24h ?? 0), 0);

  const fundingRates = rows
    .map(r => r.fundingRate)
    .filter((f): f is number => f !== null)
    .map(f => f / 100);

  const medianFunding =
    fundingRates.length > 0
      ? fundingRates.sort((a, b) => a - b)[Math.floor(fundingRates.length / 2)] * 100
      : 0;

  const withChange = rows.filter(r => r.change24h !== null).sort((a, b) => (b.change24h ?? 0) - (a.change24h ?? 0));
  const topGainers = withChange.slice(0, 5).map(r => ({ symbol: r.symbol, change: r.change24h! }));
  const topLosers = withChange.slice(-5).reverse().map(r => ({ symbol: r.symbol, change: r.change24h! }));

  return {
    marketsTracked: rows.length,
    aggregateOpenInterest,
    aggregate24hVolume,
    medianFunding,
    topMovers: { topGainers, topLosers },
  };
}

export { formatVolume, formatPercentage, formatPrice, safeFloat };
