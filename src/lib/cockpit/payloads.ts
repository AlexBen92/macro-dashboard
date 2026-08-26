/**
 * Types des payloads cockpit M15 (source: /root/projects/m15-cockpit-service,
 * exporters cron → /dash-data/{cockpit_state,vol_surface_state,carry_health}.json).
 * Un seul endroit pour hooks, composants et tests.
 */

export type GateLight = 'GREEN' | 'ORANGE' | 'RED';
export type GateStrategyState = 'ALLOWED' | 'SHADOW_ONLY' | 'BLOCKED' | 'EN_TEST';
export type Compliance = 'OK' | 'EN_TEST' | 'REJETÉ';

export interface GateM15Gating {
  state: GateStrategyState;
  reasons: string[];
  statistical_status?: string;
}

export interface GateCounters {
  trades_today: number;
  max_trades: number;
  daily_pnl_pct: number;
  daily_stop_pct: number;
  stop_hit: boolean;
  trades_remaining: number;
}

export interface CockpitGate {
  as_of: string;
  light: GateLight;
  reasons_red: string[];
  reasons_orange: string[];
  m15_permission: GateStrategyState;
  agent_status: {
    hl_agent: string;
    hl_mode: string | null;
    m15_agent: string;
  };
  regime: { current: string; days_in_regime: number | null };
  vol_regime: {
    label: string;
    H_btc: number | null;
    rough_extreme: boolean;
    stale: boolean;
  };
  carry_universe: Record<string, string> | null;
  counters: GateCounters;
  m15_gating: Record<string, GateM15Gating>;
  registry?: {
    tradable_rule?: string;
    statistical_status?: Record<string, string>;
  } | null;
}

export interface ContractRow {
  strategy: string;
  leg_template: string;
  compliance: Compliance;
  gate_state: GateStrategyState;
  statistical_status?: string;
  rejection_reason: string | null;
  recent_contract_rejects: number;
}

export interface AttributionBreakdown {
  total_pct: number;
  delta_pct: number;
  funding_pct: number;
  basis_pct: number;
  fees_pct: number;
  residual_pct?: number;
  basis_drift_bps?: number | null;
  held_hours?: number;
}

export interface AttributionPosition {
  source: string;
  asset: string;
  setup?: string;
  direction?: string | null;
  has_legs: boolean;
  attribution: AttributionBreakdown;
  tag: string | null;
  opened_at?: string;
  as_of?: string;
}

export interface AttributionTrade {
  source: string;
  ts: string;
  asset: string;
  direction?: string;
  pnl_pct: number | null;
  exit_reason?: string | null;
  sl?: number | null;
  tp?: number | null;
  attribution: AttributionBreakdown;
  tag: string | null;
}

export interface CockpitAttribution {
  as_of: string;
  positions: AttributionPosition[];
  trades_recent: AttributionTrade[];
  summary: {
    n_trades: number;
    structural_pnl_share: number | null;
    n_directional_unintended: number;
  };
}

export interface JournalEvent {
  ts: string;
  kind: string;
  source: string;
  action?: string | null;
  asset?: string | null;
  setup?: string | null;
  direction?: string | null;
  pnl_pct?: number | null;
  risk_action?: string | null;
  risk_reason?: string | null;
  exit_reason?: string | null;
  context: Record<string, unknown> | null;
}

export interface CockpitSkills {
  as_of: string;
  skills: {
    carry_vs_directionnel: {
      n_carry_enter_14d: number;
      compliance_rate: number | null;
      n_one_leg_violations: number;
      top_reject_reasons: Record<string, number>;
    } | null;
    zero_trade_discipline: {
      days_with_trades_30d: number;
      days_zero_trade_30d: number;
      today_edge: number | null;
      clause: string;
    } | null;
    regime_transitions: {
      n_transitions: number;
      last: { ts: string; from: string; to: string } | null;
      enter_within_24h_of_transition: number;
    } | null;
    shadow_discipline: {
      actions_7d: Record<string, number>;
      action_rate_pct: Record<string, number>;
      churn_events_7d: number;
    } | null;
  };
  tests: Record<string, number | null>;
  commits: Record<string, string[]>;
}

export interface CockpitState {
  as_of: string;
  gate: CockpitGate;
  contracts: { as_of: string | null; rows: ContractRow[] };
  attribution: CockpitAttribution;
  skills: CockpitSkills;
  journal: { as_of: string; events: JournalEvent[]; n_events_total: number };
}

export type VolRegimeLabel =
  | 'REGIME_VOL_ROUGH'
  | 'REGIME_VOL_MARKOVIEN'
  | 'MIXED'
  | 'INSUFFICIENT_DATA'
  | 'DATA_UNAVAILABLE';

export interface VolAssetState {
  asset: string;
  iv: {
    atm_short: number | null;
    atm_mid: number | null;
    atm_long: number | null;
    skew_1d: number | null;
    skew_7d: number | null;
    n_expiries: number;
  };
  hurst: {
    H_iv_skew_scaling: { H: number; r2: number; n_pts: number } | null;
    H_realized_vol: number | null;
  };
  fits: {
    markov_1f: { rmse_var: number; kappa: number } | null;
    rough_powerlaw: { rmse_var: number; p: number } | null;
  };
  regime_label: VolRegimeLabel;
  realized: {
    H: number | null;
    vol_of_vol: number | null;
    rho_proxy: number | null;
    rv_pct_m15: number | null;
  };
  iv_source: string;
  as_of: string;
}

export type PathLabel = 'STABLE' | 'NEUTRAL' | 'CHAOTIC' | 'TRANSITION' | 'INSUFFICIENT_DATA';

export interface PathFeatureState {
  asset: string;
  signature: {
    x_sum: number;
    y_sum: number;
    xx: number;
    xy: number;
    yy: number;
    trend: number;
    xy_sign: number;
    n_bars: number;
  } | null;
  realized_vol_pct_bar: number;
  jumps_4sigma: number;
  chaos_score: number;
  rv_ratio_24h: number | null;
  path_label: PathLabel;
  description: string;
}

export interface VolSurfaceState {
  as_of: string;
  assets: VolAssetState[];
  path_features: PathFeatureState[];
  basis_path_btc: number[];
  method: string;
}

export interface CarryHealthRow {
  asset: string;
  basis_bps: number | null;
  funding_rate_hourly: number | null;
  funding_sign: number | null;
  carry_position: string;
  accrued_funding_bps: number | null;
  divergence_zscore: number | null;
  divergence_z_max?: number;
  div_z_alert?: boolean;
  basis_drift_bps: number | null;
  contract: {
    status: string;
    reason: string;
    legs_expected: string[];
  };
  drift_alert: boolean;
}

export interface CarryHealthState {
  as_of: string;
  strategy: string;
  universe_status: Record<string, string>;
  rows: CarryHealthRow[];
  health: 'OK' | 'DEGRADED';
  alerts: Array<{
    type: string;
    asset: string;
    drift_bps?: number;
    threshold_bps?: number;
    z?: number;
    z_max?: number;
  }>;
}
