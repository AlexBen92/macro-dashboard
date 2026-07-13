export type VrpRegime = 'LOW_VRP' | 'MID_VRP' | 'HIGH_VRP' | 'NA';

export interface VrpHistoryPoint {
  date: string;
  vrp: number | null;
  iv_atm: number | null;
  rv_30d: number | null;
}

export interface VrpCcyBlock {
  current_value_volpts: number | null;
  iv_atm_30d: number | null;
  iv_snapshot_date: string | null;
  rv_30d: number | null;
  rv_last_date: string | null;
  regime: VrpRegime;
  regime_thresholds: { LOW: string; MID: string; HIGH: string; ref_window_days: number };
  regime_distribution_30d_s32: {
    LOW: number; MID: number; HIGH: number; NA: number; total: number;
    pct: { LOW: number; MID: number; HIGH: number; NA: number };
  };
  history: VrpHistoryPoint[];
  robustness: string;
}

export interface D1CcyBlock {
  rv_30d_pct_current: number | null;
  rv_30d_volpts_current: number | null;
  threshold_pct: number;
  compression_detected: boolean;
  verdict_h14: string | null;
  verdict_h30: string | null;
  n_pass_gates_h14: number;
  n_pass_gates_h30: number;
  mean_expansion_hold_volpt_h14: number;
  mean_expansion_hold_volpt_h30: number;
  straddle_pnl_hold_bps_h14: number;
  straddle_pnl_hold_bps_h30: number;
  robustness: string;
}

export interface TermPoint {
  expiry: string;
  dte: number;
  iv_atm: number;
}

export interface TermCcyBlock {
  spot: number;
  shape: 'CONTANGO' | 'BACKWARDATION' | 'FLAT';
  slope_volpts_per_dte: number;
  short_end_inversion: boolean;
  points: TermPoint[];
  snapshot_date: string;
}

export interface SkewCcyBlock {
  expiry: string;
  dte: number;
  iv_atm: number;
  put_iv_25d_approx: number;
  call_iv_25d_approx: number;
  spread_volpts: number;
  regime: 'PROTECTION_BID' | 'CALL_BID' | 'NEUTRAL';
  method: string;
  snapshot_date: string;
}

export interface S1TearsheetCcy {
  sharpe_daily_nw_hac: number;
  sharpe_daily_naive: number;
  sortino_daily: number;
  win_rate: number;
  profit_factor: number;
  mean_per_trade_bps: number;
  realistic_dd_p50_pct: number;
  realistic_dd_p95_pct: number;
  max_dd_bps: number;
  n_trades: number;
  period_years: number;
  threshold_pt: number;
  tail_ratio: number;
  psr: number;
}

export interface S1PaperEquityPoint {
  date: string;
  equity: number;
}

export interface S1PaperBlock {
  equity_current_usd: number;
  signal_count: number;
  fill_count: number;
  cancel_count: number;
  active_count: number;
  pending_count: number;
  start_ts: number;
  last_save: string;
  days_running: number;
  start_date: string;
  equity_start_usd: number;
  equity_curve_daily: S1PaperEquityPoint[];
  n_days_data: number;
}

export interface VolResearchPayload {
  last_updated: string;
  schema_version: number;
  vrp: Record<'BTC' | 'ETH', VrpCcyBlock>;
  d1_compression: Record<'BTC' | 'ETH', D1CcyBlock>;
  term_structure: Record<'BTC' | 'ETH', TermCcyBlock>;
  skew: Record<'BTC' | 'ETH', SkewCcyBlock>;
  s1_tearsheet: Record<'BTC' | 'ETH', S1TearsheetCcy>;
  s1_paper: S1PaperBlock;
}

export interface VolResearchApiResponse {
  success: boolean;
  available: boolean;
  data?: VolResearchPayload;
  error?: string;
}
