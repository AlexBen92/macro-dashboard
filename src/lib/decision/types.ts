// M15 Decision Engine — TypeScript mirror of Python pipeline payload.
// Single source of truth = /root/edge_discovery/decision/src/decision_pipeline.py
// This file MUST round-trip against the JSON fixture in
// public/data/__test__/decision_sample.json (see contract.test.ts).

export type Verdict = 'LONG' | 'SHORT' | 'WAIT' | 'NO_TRADE';
export type Direction = 'LONG' | 'SHORT' | 'FLAT';
export type EntryState =
  | 'WATCH'
  | 'ARMED'
  | 'TRIGGERED'
  | 'ACTIVE'
  | 'INVALIDATED'
  | 'EXPIRED';
export type SetupKind =
  | 'TREND_CONTINUATION'
  | 'LIQUIDITY_SWEEP_REVERSAL'
  | 'BREAKOUT'
  | 'SHORT_SQUEEZE'
  | 'LONG_SQUEEZE'
  | 'MEAN_REVERSION'
  | 'NO_TRADE';

export type GarchRegime = 'COMPRESSED' | 'NORMAL' | 'ELEVATED' | 'EXPLOSIVE';
export type ScalpStyle = 'TREND' | 'MEAN_REV' | 'BREAKOUT' | 'NO_TRADE';
export type HMMState = 'BULL' | 'BEAR' | 'RANGING';
export type TrendDirection = 'bull' | 'bear' | 'range';
export type RiskState = 'RISK_ON' | 'RISK_OFF' | 'NEUTRAL';
export type SessionName = 'ASIA' | 'LONDON' | 'NY' | 'OVERLAP' | 'OFF';
export type EventKind = 'FOMC' | 'CPI' | 'NFP' | 'PPI' | 'FED_SPEECH';
export type EventImpact = 'HIGH' | 'MED' | 'LOW';

export interface SignalContribution {
  source: string;
  delta_pts: number;
  reason: string;
}

export interface SourceState {
  fresh: boolean;
  age_ms: number | null;
  coverage_pct: number;
  last_ok_iso: string | null;
}

export interface DataQuality {
  score: number;
  sources: {
    hl: SourceState;
    binance: SourceState;
    deribit: SourceState;
    coinglass: SourceState;
    yahoo: SourceState;
  };
  stale_sources: string[];
  missing_fields: string[];
}

export interface RegimeBlock {
  label: 'CALM' | 'BUILDING' | 'STRESS' | 'CRISIS';
  hurst: number | null;
  adx: number | null;
  vol_ratio: number | null;
  hmm_state: HMMState | null;
  garch_regime: GarchRegime | null;
  trend_direction: TrendDirection | null;
  confidence: number;
}

export interface SetupBlock {
  kind: SetupKind;
  trigger_conditions: string[];
  contributions: SignalContribution[];
  setup_score: number;
}

export interface EntryBlock {
  state: EntryState;
  price: number | null;
  armed_at_iso: string | null;
  trigger_at_iso: string | null;
  expires_at_iso: string | null;
  reason: string | null;
}

export interface StopBlock {
  price: number | null;
  bps: number | null;
  method: 'GARCH_3SIGMA' | 'ATR' | 'STRUCTURAL';
  invalidation_reasons: string[];
}

export interface TPBlock {
  tp1: number | null;
  tp2: number | null;
  tp3: number | null;
  rr_tp1: number | null;
  rr_tp2: number | null;
  rr_tp3: number | null;
}

export interface RiskBlock {
  size_mult: number;
  notional_usd: number;
  margin_usd: number;
  max_loss_usd: number;
  leverage_cap: number;
  kelly_raw: number;
  kelly_capped: number;
  blocked: boolean;
  block_reasons: string[];
}

export interface WhyChecklistItem {
  label: string;
  pass: boolean;
  weight: number;
}

export interface CrossAssetBlock {
  btc_leadership: number;
  beta_to_btc: number | null;
  relative_strength: number | null;
  suppressed_by_btc: boolean;
  suppression_reason: string | null;
}

export interface SessionBlock {
  name: SessionName;
  expectancy_bps: number | null;
  n_obs: number;
  sharpe: number | null;
  winrate: number | null;
  tag: 'STRONG' | 'OK' | 'LOW-N' | 'NO_DATA';
}

export interface CalibrationBlock {
  brier: number | null;
  reliability_bin: number | null;
  n_predictions: number;
}

export interface AssetDecision {
  symbol: 'BTC' | 'ETH';
  verdict: Verdict;
  score: number;
  confidence: number;
  regime: RegimeBlock;
  setup: SetupBlock;
  entry: EntryBlock;
  stop: StopBlock;
  tp: TPBlock;
  risk: RiskBlock;
  data_quality: DataQuality;
  why_checklist: WhyChecklistItem[];
  risks: string[];
  cross_asset: CrossAssetBlock;
  session: SessionBlock;
  calibration: CalibrationBlock;
  mtf_alignment: MTFAlignmentBlock;
  derivatives: DerivativesBlock;
  orderflow: OrderFlowBlock;
  liquidations: LiquidationBlock;
}

export interface MTFDirectionEntry {
  tf: '4H' | '1H' | 'M15' | '5M';
  dir: TrendDirection | null;
}

export interface MTFAlignmentBlock {
  score: number;
  directions: MTFDirectionEntry[];
}

export interface DerivativesBlock {
  oi_now: number | null;
  oi_delta_15m_pct: number | null;
  oi_delta_1h_pct: number | null;
  oi_delta_4h_pct: number | null;
  oi_classification: 'NEW_LONGS' | 'SHORT_COVERING' | 'NEW_SHORTS' | 'DELEVERAGING' | 'NEUTRAL' | 'UNKNOWN';
  funding_now: number | null;
  funding_annualized_pct: number | null;
  funding_zscore_30d: number | null;
  funding_tag: 'EXTREME_BULL' | 'EXTREME_BEAR' | 'NEUTRAL' | 'RAPID' | 'UNKNOWN';
  basis_bps: number | null;
}

export interface OrderFlowBlock {
  cvd_now: number | null;
  cvd_slope_15m: number | null;
  cvd_divergence: 'BULLISH' | 'BEARISH' | 'NONE' | 'UNKNOWN';
  taker_buy_sell_ratio: number | null;
  ofi: number | null;
  bid_ask_imbalance: number | null;
  absorption: 'BULLISH' | 'BEARISH' | 'NONE' | 'UNKNOWN';
}

export interface LiquidationCluster {
  price_level: number;
  total_usd: number;
  side: 'LONG' | 'SHORT';
  distance_pct: number;
}

export interface LiquidationBlock {
  longs_1h_usd: number | null;
  shorts_1h_usd: number | null;
  longs_4h_usd: number | null;
  shorts_4h_usd: number | null;
  ratio_long_short_1h: number | null;
  cascade_risk: boolean;
  cascade_reason: string | null;
  clusters: LiquidationCluster[];
  stale: boolean;
}

export interface MacroBlock {
  risk_state: RiskState;
  macro_pressure: number;
  drivers: { asset: string; corr_30d: number | null; daily_change_pct: number | null }[];
  as_of_iso: string | null;
}

export interface EventRiskBlock {
  next_event_iso: string | null;
  kind: EventKind | null;
  impact: EventImpact | null;
  minutes_until: number | null;
  in_window: boolean;
  calendar_version: string;
}

export interface SessionMatrixCell {
  session: SessionName;
  setup_kind: SetupKind;
  expectancy_bps: number | null;
  n_obs: number;
  sharpe: number | null;
  winrate: number | null;
  tag: 'STRONG' | 'OK' | 'LOW-N' | 'NO_DATA';
}

export interface SessionMatrixBlock {
  as_of_iso: string | null;
  cells: SessionMatrixCell[];
}

export interface CrossAssetGlobalBlock {
  beta_eth_to_btc: number | null;
  lead_lag_btc_eth_hours: number | null;
  btc_leadership_score: number;
  eth_suppressed: boolean;
  as_of_iso: string | null;
}

export interface DecisionStatusPayload {
  as_of: string;
  last_export_success: string | null;
  heartbeat: { last_attempt_iso: string; last_success_iso: string | null; error: string | null };
  pipeline_version: string;
  weights_version: string;
  btc: AssetDecision;
  eth: AssetDecision;
  cross_asset: CrossAssetGlobalBlock;
  macro: MacroBlock;
  event_risk: EventRiskBlock;
  session_matrix: SessionMatrixBlock;
}

export const VERDICT_VALUES: Verdict[] = ['LONG', 'SHORT', 'WAIT', 'NO_TRADE'];
export const ENTRY_STATE_VALUES: EntryState[] = [
  'WATCH',
  'ARMED',
  'TRIGGERED',
  'ACTIVE',
  'INVALIDATED',
  'EXPIRED',
];
export const SETUP_KIND_VALUES: SetupKind[] = [
  'TREND_CONTINUATION',
  'LIQUIDITY_SWEEP_REVERSAL',
  'BREAKOUT',
  'SHORT_SQUEEZE',
  'LONG_SQUEEZE',
  'MEAN_REVERSION',
  'NO_TRADE',
];
