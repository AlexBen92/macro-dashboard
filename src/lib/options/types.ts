export type Currency = 'BTC' | 'ETH' | 'SOL';
export type SupportedCurrency = 'BTC' | 'ETH';
export type Timeframe = 'H4' | 'H1' | 'M15';

export type DataFreshness = 'live' | 'delayed' | 'stale' | 'unavailable';
export type GammaRegime = 'positive' | 'negative' | 'neutral' | 'unknown';
export type DealerDeltaBias = 'long' | 'short' | 'flat' | 'unknown';
export type ExpiryBucket = 'all' | '0-7d' | '8-30d' | '31-90d';

export type ContextBadge =
  | 'risk-on'
  | 'risk-off'
  | 'mixed'
  | 'insufficient'
  | 'not_configured';

export interface StrikeExposure {
  strike: number;
  callGex: number;
  putGex: number;
  netGex: number;
  callDex: number;
  putDex: number;
  netDex: number;
  callOi: number;
  putOi: number;
  expiries: string[];
}

export type OptionLevelKind =
  | 'call_wall'
  | 'put_wall'
  | 'zero_gamma'
  | 'hvl'
  | 'reference';

export interface OptionLevel {
  kind: OptionLevelKind;
  strike: number;
  distancePct: number;
  source: 'computed' | 'unavailable';
  note?: string;
}

export interface OptionsExposureSnapshot {
  schemaVersion: 1;
  source: 'deribit_public';
  currency: SupportedCurrency;
  spot: number | null;
  asOf: string;
  expiryBucket: ExpiryBucket;
  includedExpiries: string[];
  strikes: StrikeExposure[];
  levels: {
    callWall: OptionLevel | null;
    putWall: OptionLevel | null;
    zeroGamma: OptionLevel | null;
    hvl: OptionLevel | null;
  };
  aggregate: {
    netGex: number;
    netDex: number;
    totalOi: number;
  };
  regime: {
    gamma: GammaRegime;
    dealerDelta: DealerDeltaBias;
    ruleVersion: string;
  };
  freshness: {
    status: DataFreshness;
    sourceTs: string | null;
    computedTs: string;
    ageMs: number;
  };
  warnings: string[];
}

export interface OptionsRead {
  lines: [string, string, string];
  ruleVersion: string;
}

export type SessionSeverity = 'info' | 'caution' | 'alert';

export interface SessionPlanItem {
  id: string;
  text: string;
  rationale: string;
  severity: SessionSeverity;
}

export interface SessionPlan {
  items: SessionPlanItem[];
  ruleVersion: string;
}

export interface ContextState {
  badge: ContextBadge;
  ruleVersion: string;
  evidence: string[];
}

export interface CorrCellLike {
  a: string;
  b: string;
  r: number;
  window: string;
  n: number;
}
