export interface HyperliquidMeta {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated: boolean;
}

export interface HyperliquidAssetCtx {
  markPx: string;
  funding: string;
  openInterest: string;
  dayNtlVlm: string;
  prevDayPx: string;
  premium: string;
  midPx: string;
  oraclePx: string;
  dayBaseVlm?: string;
}

export interface HyperliquidResponse {
  universe: HyperliquidMeta[];
  assetCtxs: HyperliquidAssetCtx[];
}

export interface MarketRow {
  symbol: string;
  price: number | null;
  change24h: number | null;
  volume24h: number | null;
  openInterest: number | null;
  fundingRate: number | null;
  volatility24h: number | null;
  source: 'hyperliquid' | 'thegraph-hyperliquid' | 'binance-fallback' | 'mixed';
  updatedAt: string;
  biasLabel: string | null;
  biasColor: 'green' | 'gray' | 'red' | 'amber' | null;
  strengthScore: number | null;
  interpretation: string | null;
}

export interface MarketBias {
  label: string;
  color: 'green' | 'gray' | 'red' | 'amber';
  strengthScore: number | null;
  interpretation: string;
}

export interface HyperliquidMonitorStats {
  marketsTracked: number;
  aggregateOpenInterest: number;
  aggregate24hVolume: number;
  medianFunding: number;
  topMovers: {
    topGainers: Array<{ symbol: string; change: number }>;
    topLosers: Array<{ symbol: string; change: number }>;
  };
}
