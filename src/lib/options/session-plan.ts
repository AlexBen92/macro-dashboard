import type {
  ContextState,
  OptionsExposureSnapshot,
  SessionPlan,
  SessionPlanItem,
  SessionSeverity,
} from './types';

export const SESSION_RULE_VERSION = 'v1';

function item(
  id: string,
  text: string,
  rationale: string,
  severity: SessionSeverity,
): SessionPlanItem {
  return { id, text, rationale, severity };
}

export function buildSessionPlan(
  s: OptionsExposureSnapshot,
  ctx: ContextState,
): SessionPlan {
  const out: SessionPlanItem[] = [];

  if (s.regime.gamma === 'negative') {
    out.push(
      item(
        'neg-gamma',
        'Negative provider gamma regime — volatility-amplifying conditions possible.',
        'Net GEX < 0 (raw aggregate). Hedging flows may magnify moves; reduce size, tighten risk controls.',
        'alert',
      ),
    );
  } else if (s.regime.gamma === 'positive') {
    out.push(
      item(
        'pos-gamma',
        'Positive provider gamma regime — mean-reversion tendency around concentrated strikes.',
        'Net GEX > 0 (raw aggregate). Spot may pin near high-OI strikes; breakouts can fail.',
        'info',
      ),
    );
  }

  const putWall = s.levels.putWall;
  if (putWall && s.spot != null) {
    const d = putWall.distancePct;
    if (d <= 0 && d >= -2) {
      out.push(
        item(
          'near-putwall',
          'Spot near Put Wall — defensive reference zone for mean-reversion candidates.',
          `Put Wall ${putWall.strike} is ${d.toFixed(2)}% from spot. Mark as decision zone, not automatic reversal.`,
          'caution',
        ),
      );
    }
  }

  const callWall = s.levels.callWall;
  if (callWall && s.spot != null) {
    const d = callWall.distancePct;
    if (d >= 0 && d <= 2) {
      out.push(
        item(
          'near-callwall',
          'Spot near Call Wall — upside resistance reference; watch failed breakouts.',
          `Call Wall ${callWall.strike} is ${d.toFixed(2)}% from spot. Mark as decision zone, not automatic reversal.`,
          'caution',
        ),
      );
    }
  }

  if (ctx.badge === 'risk-off' && s.regime.gamma !== 'negative') {
    out.push(
      item(
        'ctx-riskoff',
        'Macro context risk-off — confirmation from correlations weaker for long bias.',
        ctx.evidence.join(' · ') || 'risk-off rule triggered',
        'caution',
      ),
    );
  } else if (ctx.badge === 'risk-on' && s.regime.gamma !== 'positive') {
    out.push(
      item(
        'ctx-riskon',
        'Macro context risk-on — correlations supportive but options regime neutral.',
        ctx.evidence.join(' · ') || 'risk-on rule triggered',
        'info',
      ),
    );
  }

  if (s.freshness.status === 'stale' || s.freshness.status === 'unavailable') {
    out.push(
      item(
        'stale',
        'Options snapshot stale or unavailable — confirmation delayed.',
        `Freshness: ${s.freshness.status}. Avoid relying on options-derived guidance until refreshed.`,
        'alert',
      ),
    );
  }

  if (s.regime.dealerDelta === 'short') {
    out.push(
      item(
        'dex-short',
        'Provider DEX negative — downward notional tilt in raw delta-weighted exposure.',
        'Sign = raw aggregate, NOT dealer/client positioning. Use as context only.',
        'info',
      ),
    );
  } else if (s.regime.dealerDelta === 'long') {
    out.push(
      item(
        'dex-long',
        'Provider DEX positive — upward notional tilt in raw delta-weighted exposure.',
        'Sign = raw aggregate, NOT dealer/client positioning. Use as context only.',
        'info',
      ),
    );
  }

  if (out.length === 0) {
    out.push(
      item(
        'no-rule',
        'No specific rule triggered — proceed with standard plan.',
        'Conditions within neutral bands.',
        'info',
      ),
    );
  }

  return {
    items: out.slice(0, 5),
    ruleVersion: SESSION_RULE_VERSION,
  };
}
